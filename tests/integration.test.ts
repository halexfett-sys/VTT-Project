import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { io as connect } from "socket.io-client";
import sharp from "sharp";
import { createApp } from "../server/app";
import { act } from "../server/actions";
import { newCampaign, viewFor, obscured } from "../server/state";
test("ordered multiplayer workflow: guests, maps, tokens, art, tools, chat, persistence", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vtt-"));
  const server = createApp(dir);
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const port = (server.http.address() as any).port,
    base = `http://127.0.0.1:${port}`;
  let sockets: any[] = [];
  try {
    const api = async (route: string, body?: any, cookie = "") => {
      const response = await fetch(base + route, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      return {
        response,
        data: await response.json(),
        cookie: response.headers.get("set-cookie")?.split(";")[0] || cookie,
      };
    };
    const gm = await api("/api/guest", {
      name: "captain",
      password: "test-password-123",
    });
    assert.equal(gm.response.status, 200);
    const player = await api("/api/guest", {
      name: "pilot",
      password: "test-password-123",
    });
    assert.equal(player.response.status, 200);
    assert.equal(
      (
        await api("/api/auth/login", {
          name: "pilot",
          password: "wrong-password",
        })
      ).response.status,
      410,
    );
    const created = await api(
        "/api/rooms",
        { name: "Test campaign" },
        gm.cookie,
      ),
      room = created.data.id,
      c = server.store.get(room);
    await api(
      "/api/join",
      { code: c.invite, name: "Pilot", color: "#abcdef" },
      player.cookie,
    );
    assert.equal(server.store.get(room).members.length, 2);
    const open = async (cookie: string) => {
      const s = connect(base, {
        extraHeaders: { cookie },
        transports: ["websocket"],
        forceNew: true,
      });
      sockets.push(s);
      await new Promise<void>((resolve, reject) => {
        s.once("connect", resolve);
        s.once("connect_error", reject);
      });
      await emit(s, "room:join", { roomId: room });
      return s;
    };
    const emit = (s: any, event: string, data: any): Promise<any> =>
      new Promise((resolve, reject) =>
        s
          .timeout(3000)
          .emit(event, data, (err: any, result: any) =>
            err ? reject(err) : resolve(result),
          ),
      );
    const gs = await open(gm.cookie),
      ps = await open(player.cookie);
    assert.match(
      (await emit(ps, "map:create", { name: "Denied" })).error,
      /GM/,
    );
    const image = await sharp({
      create: { width: 100, height: 100, channels: 3, background: "#ff0000" },
    })
      .png()
      .toBuffer();
    const upload = async (kind: string, cookie: string) => {
      const form = new FormData();
      form.set("kind", kind);
      form.set(
        "file",
        new Blob([new Uint8Array(image)], { type: "image/png" }),
        "../../unsafe.png",
      );
      const r = await fetch(`${base}/api/rooms/${room}/assets`, {
        method: "POST",
        headers: { cookie },
        body: form,
      });
      assert.equal(r.status, 200);
      return r.json();
    };
    const map = await upload("map", gm.cookie);
    assert.equal(
      (await emit(gs, "map:create", { name: "Deck", assetId: map.id })).ok,
      true,
    );
    const scene = server.store.get(room).activeMapId;
    await emit(gs, "fog:stroke", {
      erase: false,
      size: 100,
      points: [{ x: 50, y: 50 }],
    });
    const masked = await fetch(`${base}/api/rooms/${room}/map/${scene}`, {
      headers: { cookie: player.cookie },
    });
    const pixel = await sharp(Buffer.from(await masked.arrayBuffer()))
      .raw()
      .toBuffer();
    assert.ok(pixel[(50 * 100 + 50) * 3] < 30);
    assert.equal(
      (
        await fetch(`${base}/api/rooms/${room}/assets/${map.id}`, {
          headers: { cookie: player.cookie },
        })
      ).status,
      400,
    );
    await emit(gs, "fog:clear", {});
    const art = await upload("token", player.cookie);
    await emit(ps, "token:create", { name: "Pilot", assetId: art.id });
    let t = server.store.get(room).tokens[0];
    assert.equal(t.ownerId, player.data.id);
    assert.equal(
      (await emit(ps, "token:move", { id: t.id, x: 64, y: 64 })).ok,
      true,
    );
    await emit(gs, "token:create", { name: "Sentinel" });
    const enemy = server.store.get(room).tokens[1];
    assert.match(
      (await emit(ps, "token:move", { id: enemy.id, x: 10, y: 10 })).error,
      /permission/,
    );
    assert.match(
      (await emit(ps, "token:update", { id: t.id, hidden: true })).error,
      /GM/,
    );
    await emit(gs, "token:update", { id: enemy.id, hidden: true });
    assert.equal(
      viewFor(server.store.get(room), player.data.id).tokens.length,
      1,
    );
    await emit(ps, "profile:update", { portrait: art.id, art: [art.id] });
    await emit(gs, "handout:show", { title: "Briefing", assetId: map.id });
    assert.equal(server.store.get(room).handout?.title, "Briefing");
    await emit(ps, "dice:roll", { proficiency: 2, difficulty: 1 });
    assert.ok(server.store.get(room).messages[0].roll);
    await emit(ps, "destiny:flip", { side: "light" });
    assert.deepEqual(server.store.get(room).destiny, { light: 1, dark: 3 });
    await emit(gs, "initiative:add", { type: "PC", success: 2, advantage: 1 });
    await emit(gs, "initiative:add", { type: "NPC", success: 1, advantage: 0 });
    assert.equal(server.store.get(room).initiative.slots[0].type, "PC");
    await emit(gs, "chat:send", {
      text: "Private briefing",
      to: player.data.id,
    });
    await emit(ps, "chat:send", { text: "Ready" });
    ps.disconnect();
    const reconnected = await open(player.cookie);
    assert.ok(reconnected.connected);
    assert.equal(server.store.get(room).messages.at(-1)?.text, "Ready");
  } finally {
    for (const s of sockets) s.disconnect();
    await new Promise<void>((r) => server.io.close(() => r()));
    server.store.db.close();
  }
  const reopened = createApp(dir);
  assert.equal(
    (
      reopened.store.db
        .prepare("SELECT count(*) AS n FROM campaigns")
        .get() as any
    ).n,
    1,
  );
  reopened.store.db.close();
  await rm(dir, { recursive: true, force: true });
});
test("fog erase and confidential token fields are enforced", () => {
  const c = newCampaign("test", "gm", "GM");
  c.members.push({
    userId: "player",
    name: "P",
    role: "player",
    color: "#ffffff",
    art: [],
  });
  const map = c.maps[0];
  map.fog = [
    { id: "1", erase: false, size: 100, points: [{ x: 50, y: 50 }] },
    { id: "2", erase: true, size: 10, points: [{ x: 50, y: 50 }] },
  ];
  assert.equal(obscured(map, { x: 50, y: 50 }), false);
  assert.equal(obscured(map, { x: 70, y: 50 }), true);
  assert.equal(viewFor(c, "player").maps[0].assetId, undefined);
  assert.equal(viewFor(c, "player").invite, "");
});
