import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { io as connect } from "socket.io-client";
import { createApp } from "../server/app";
test("GM removal and self-leave end a player's session and free the room list", async () => {
  const dir = await mkdtemp(path.join(os.tmpdir(), "vtt-kick-"));
  const server = createApp(dir);
  await new Promise<void>((r) => server.http.listen(0, "127.0.0.1", r));
  const base = `http://127.0.0.1:${(server.http.address() as any).port}`;
  const sockets: any[] = [];
  try {
    const api = async (route: string, body?: any, cookie = "") => {
      const r = await fetch(base + route, {
        method: body ? "POST" : "GET",
        headers: { "Content-Type": "application/json", cookie },
        body: body ? JSON.stringify(body) : undefined,
      });
      return { data: await r.json(), cookie: r.headers.get("set-cookie")?.split(";")[0] || cookie };
    };
    const gm = await api("/api/guest", { name: "captain", password: "test-password-123" });
    const p1 = await api("/api/guest", { name: "pilot", password: "test-password-123" });
    const p2 = await api("/api/guest", { name: "gunner", password: "test-password-123" });
    const room = (await api("/api/rooms", { name: "Table" }, gm.cookie)).data.id;
    // the GM's own state includes the invite code
    const join = (cookie: string) =>
      new Promise<any>((resolve, reject) => {
        const s: any = connect(base, { extraHeaders: { cookie }, transports: ["websocket"] });
        sockets.push(s);
        s.state = null;
        s.kicked = false;
        s.on("state", (c: any) => (s.state = c));
        s.on("kicked", () => (s.kicked = true));
        s.on("connect_error", reject);
        s.on("connect", () => s.emit("room:join", { roomId: room }, (r: any) => (r.error ? reject(new Error(r.error)) : resolve(s))));
      });
    const emit = (s: any, e: string, p: any) => new Promise<any>((r) => s.emit(e, p, r));
    const gs = await join(gm.cookie);
    await new Promise((r) => setTimeout(r, 100));
    const code = gs.state.invite;
    assert.ok(code);
    for (const p of [p1, p2]) await api("/api/join", { code, name: "P", color: "#ffffff" }, p.cookie);
    const s1 = await join(p1.cookie), s2 = await join(p2.cookie);
    await new Promise((r) => setTimeout(r, 100));
    assert.equal(gs.state.members.length, 3);
    const id1 = gs.state.members.find((m: any) => m.name === "P" && m.userId !== gs.state.members[0].userId).userId;
    // a player cannot remove anyone
    assert.match((await emit(s2, "member:remove", { userId: id1 })).error, /GM permission/);
    // GM removes player 1: they are told, get no more table data, and the room leaves their list
    assert.equal((await emit(gs, "member:remove", { userId: id1 })).ok, true);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal(s1.kicked || s2.kicked, true);
    const removed = [s1, s2].filter((s) => s.kicked);
    assert.equal(removed.length, 1);
    assert.equal(gs.state.members.length, 2);
    const listFor = async (c: string) => (await api("/api/rooms", undefined, c)).data;
    const keeper = removed[0] === s1 ? p2 : p1, gone = removed[0] === s1 ? p1 : p2;
    assert.equal((await listFor(gone.cookie)).length, 0);
    assert.equal((await listFor(keeper.cookie)).length, 1);
    // the remaining player leaves on their own
    const keepSocket = removed[0] === s1 ? s2 : s1;
    assert.equal((await emit(keepSocket, "member:leave", {})).ok, true);
    await new Promise((r) => setTimeout(r, 150));
    assert.equal((await listFor(keeper.cookie)).length, 0);
    assert.equal(gs.state.members.length, 1);
  } finally {
    sockets.forEach((s) => s.close());
    server.http.close();
    await rm(dir, { recursive: true, force: true });
  }
});
