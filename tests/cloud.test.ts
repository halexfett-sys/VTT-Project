import test from "node:test";
import assert from "node:assert/strict";
import { io } from "socket.io-client";
import { SupabaseTransport } from "../server/supabase";
import { createCloudApp } from "../server/cloud-app";
import { CloudStore } from "../server/cloud-db";
import { newCampaign } from "../server/state";
import sharp from "sharp";
function fakeCloud() {
  const tables: Record<string, any[]> = {
    vtt_guests: [],
    vtt_sessions: [],
    vtt_campaigns: [],
    vtt_save_keys: [],
    vtt_transfers: [],
  };
  const objects = new Map<string, Uint8Array>();
  const request: typeof fetch = async (input, init = {}) => {
    const u = new URL(String(input)),
      p = u.pathname,
      method = init.method || "GET",
      body = typeof init.body === "string" ? JSON.parse(init.body) : init.body;
    if (p.endsWith("/rpc/vtt_rate_limit")) return Response.json(true);
    if (p.endsWith("/rpc/vtt_commit_campaign")) {
      const r = tables.vtt_campaigns.find((r) => r.id === body.p_id);
      if (body.p_expected === null) {
        if (r) return Response.json(false);
        tables.vtt_campaigns.push({
          id: body.p_id,
          invite: body.p_state.invite,
          state: body.p_state,
          revision: body.p_state.revision,
        });
      } else {
        if (!r || r.revision !== body.p_expected) return Response.json(false);
        r.state = body.p_state;
        r.revision = body.p_state.revision;
      }
      return Response.json(true);
    }
    if (p.startsWith("/storage/v1/object/")) {
      const key = p.slice("/storage/v1/object/".length);
      if (method === "POST") {
        objects.set(key, new Uint8Array(body));
        return Response.json({});
      }
      if (method === "DELETE") {
        for (const name of body.prefixes) objects.delete(`${key}/${name}`);
        return Response.json({});
      }
      const data = objects.get(key);
      return data
        ? new Response(new Uint8Array(data))
        : new Response("", { status: 404 });
    }
    const table = tables[p.split("/").pop()!];
    if (!table) throw new Error(`Unknown fake route ${p}`);
    const matches = (r: any) =>
      [...u.searchParams].every(
        ([k, v]) =>
          k === "select" ||
          k === "limit" ||
          (v.startsWith("eq.")
            ? String(r[k]) === v.slice(3)
            : v.startsWith("gt.")
              ? r[k] > v.slice(3)
              : v.startsWith("cs.")
                ? r.state.members.some(
                    (m: any) =>
                      m.userId === JSON.parse(v.slice(3)).members[0].userId,
                  )
                : false),
      );
    if (method === "POST") {
      const ignore = new Headers(init.headers)
        .get("Prefer")
        ?.includes("ignore-duplicates");
      if (
        !ignore ||
        !table.some(
          (r) =>
            r.campaign_id === body.campaign_id && r.key_hash === body.key_hash,
        )
      )
        table.push(body);
      return Response.json({});
    }
    if (method === "PATCH") {
      table.filter(matches).forEach((r) => Object.assign(r, body));
      return Response.json({});
    }
    if (method === "DELETE") {
      for (let i = table.length - 1; i >= 0; i--)
        if (matches(table[i])) table.splice(i, 1);
      return Response.json({});
    }
    const rows = table
      .filter(matches)
      .map((r) =>
        p.endsWith("vtt_sessions")
          ? {
              ...r,
              vtt_guests: tables.vtt_guests.find((g) => g.id === r.guest_id),
            }
          : u.searchParams.get("select") === "id,state->>name"
            ? { id: r.id, name: r.state.name }
            : r,
      );
    return Response.json(rows);
  };
  return new SupabaseTransport(
    "https://test.supabase.co",
    "sb_secret_test",
    request,
  );
}
test("cloud API and two websocket instances share guests, campaigns, images and saves", async () => {
  const transport = fakeCloud(),
    a = createCloudApp(transport),
    b = createCloudApp(transport),
    sockets: any[] = [];
  await Promise.all(
    [a, b].map(
      (s) => new Promise<void>((r) => s.http.listen(0, "127.0.0.1", r)),
    ),
  );
  const base = (s: any) => `http://127.0.0.1:${s.http.address().port}`;
  const call = async (
    s: any,
    path: string,
    cookie = "",
    body?: any,
    method?: string,
  ) => {
    const r = await fetch(base(s) + "/api" + path, {
      method: method || (body ? "POST" : "GET"),
      headers: {
        cookie,
        "content-type":
          body instanceof Uint8Array
            ? "application/octet-stream"
            : "application/json",
      },
      body:
        body instanceof Uint8Array
          ? new Uint8Array(body)
          : body
            ? JSON.stringify(body)
            : undefined,
    });
    return {
      status: r.status,
      data: await r.json(),
      cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie,
    };
  };
  const stage = async (cookie: string, bytes: Uint8Array, type = "save") => {
    const t = await call(a, "/transfers", cookie, {
      size: bytes.length,
      name: "save.json",
      type,
    });
    assert.equal(t.status, 200, JSON.stringify(t.data));
    for (let i = 0; i < bytes.length; i += 2097152) {
      const r = await call(
        a,
        `/transfers/${t.data.id}/${i / 2097152}`,
        cookie,
        bytes.slice(i, i + 2097152),
        "PUT",
      );
      assert.equal(r.status, 200, JSON.stringify(r.data));
    }
    return t.data.id;
  };
  const open = async (srv: any, cookie: string, room: string) => {
    const s = io(base(srv), {
      path: "/api/server/socket.io",
    addTrailingSlash: false,
      transports: ["websocket"],
      extraHeaders: { cookie },
      forceNew: true,
    });
    sockets.push(s);
    await new Promise<void>((r, j) => {
      s.once("connect", () => r());
      s.once("connect_error", j);
    });
    const ack = await s
      .timeout(5000)
      .emitWithAck("room:join", { roomId: room });
    assert.equal(ack.ok, true);
    return s;
  };
  try {
    assert.equal((await call(a, "/me")).data, null);
    const gm = await call(a, "/guest", "", { name: "GM" }),
      player = await call(b, "/guest", "", { name: "Pilot" });
    assert.equal((await call(b, "/me", gm.cookie)).data.id, gm.data.id);
    const room = (await call(a, "/rooms", gm.cookie, { name: "Cloud room" }))
        .data.id,
      c = await a.store.get(room);
    assert.equal(
      (
        await call(b, "/join", player.cookie, {
          code: c.invite,
          name: "Pilot",
          color: "#abcdef",
        })
      ).status,
      200,
    );
    assert.equal((await call(b, "/rooms", player.cookie)).data.length, 1);
    const gs = await open(a, gm.cookie, room),
      ps = await open(b, player.cookie, room);
    assert.match(
      (await ps.timeout(5000).emitWithAck("map:create", { name: "Denied" }))
        .error,
      /GM/,
    );
    const nextState = new Promise<any>((r, j) => {
      const timer = setTimeout(
        () => j(new Error("Cross-instance state timeout")),
        5000,
      );
      ps.on("state", (c) => {
        if (c.destiny.light === 7) {
          clearTimeout(timer);
          r(c);
        }
      });
    });
    assert.equal(
      (await gs.timeout(5000).emitWithAck("destiny:set", { light: 7, dark: 2 }))
        .ok,
      true,
    );
    assert.equal((await nextState).destiny.light, 7);
    const image = new Uint8Array(
      await sharp({
        create: { width: 10, height: 10, channels: 3, background: "red" },
      })
        .png()
        .toBuffer(),
    );
    const imageTransfer = await stage(player.cookie, image, "image");
    const asset = await call(a, `/rooms/${room}/assets`, player.cookie, {
      kind: "art",
      transfer: imageTransfer,
    });
    assert.equal(asset.status, 200, JSON.stringify(asset.data));
    assert.equal(
      (
        await ps
          .timeout(5000)
          .emitWithAck("profile:update", { portrait: asset.data.id })
      ).ok,
      true,
    );
    const saved = await call(a, `/rooms/${room}/export/player`, player.cookie);
    assert.equal(saved.status, 200, JSON.stringify(saved.data));
    assert.equal(saved.data.files.length, 1);
    const full = await call(b, `/rooms/${room}/export/table`, gm.cookie);
    assert.equal(full.data.claims.length, 1);
    const transfer = await stage(
      gm.cookie,
      new TextEncoder().encode(JSON.stringify(full.data)),
    );
    const restored = await call(a, "/restore", gm.cookie, { transfer });
    assert.equal(restored.status, 200, JSON.stringify(restored.data));
    const newcomer = await call(b, "/guest", "", { name: "Recovered" }),
      copy = await a.store.get(restored.data.id);
    const playerTransfer = await stage(
      newcomer.cookie,
      new TextEncoder().encode(JSON.stringify(saved.data)),
    );
    const joined = await call(b, "/join-save", newcomer.cookie, {
      code: copy.invite,
      transfer: playerTransfer,
    });
    assert.equal(joined.status, 200, JSON.stringify(joined.data));
    assert.equal((await a.store.get(copy.id)).members.length, 2);
    const other = await call(a, "/guest", "", { name: "Other" });
    const stolen = await stage(player.cookie, image, "image");
    assert.equal(
      (
        await call(a, `/rooms/${room}/assets`, other.cookie, {
          kind: "art",
          transfer: stolen,
        })
      ).status,
      400,
    );
    // Actual payload above function request limits is accepted only as 2 MB chunks.
    const large = new Uint8Array(5 * 1024 * 1024);
    const staged = await stage(player.cookie, large);
    assert.ok(staged);
    const x = await a.store.get(room),
      y = await b.store.get(room);
    await a.store.save(x);
    await assert.rejects(b.store.save(y), /table changed/);
  } finally {
    sockets.forEach((s) => s.disconnect());
    await Promise.all(
      [a, b].map((s) => new Promise<void>((r) => s.io.close(() => r()))),
    );
  }
});
