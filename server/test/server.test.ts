import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createGameServer } from "../src/index.js";

const apps: ReturnType<typeof createGameServer>[] = [];
const inboxes = new WeakMap<WebSocket, { queue: Record<string, unknown>[]; waiters: ((value: Record<string, unknown>) => void)[] }>();
const connect = (url: string) => new Promise<WebSocket>((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.once("open", () => {
    const inbox = { queue: [] as Record<string, unknown>[], waiters: [] as ((value: Record<string, unknown>) => void)[] };
    inboxes.set(ws, inbox);
    ws.on("message", (data) => {
      const message = JSON.parse(data.toString()) as Record<string, unknown>;
      const waiter = inbox.waiters.shift();
      if (waiter) waiter(message); else inbox.queue.push(message);
    });
    resolve(ws);
  }); ws.once("error", reject);
});
const receive = (ws: WebSocket) => new Promise<Record<string, unknown>>((resolve, reject) => {
  const inbox = inboxes.get(ws);
  if (!inbox) { reject(new Error("Socket inbox is not ready")); return; }
  const queued = inbox.queue.shift();
  if (queued) { resolve(queued); return; }
  const timeout = setTimeout(() => reject(new Error("Timed out waiting for message")), 1500);
  inbox.waiters.push((message) => { clearTimeout(timeout); resolve(message); });
});
const startApp = async () => {
  const app = createGameServer({ port: 0, host: "127.0.0.1", allowedOrigins: ["http://allowed.test"] });
  apps.push(app); await app.listen();
  const address = app.address();
  if (!address || typeof address === "string") throw new Error("No TCP address");
  return `ws://127.0.0.1:${address.port}/ws`;
};
const send = (ws: WebSocket, value: unknown) => ws.send(JSON.stringify(value));
const awaitType = async (ws: WebSocket, type: string) => {
  for (;;) { const msg = await receive(ws); if (msg.type === type) return msg; }
};
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("multiplayer server", () => {
  it("creates and joins a lobby, starts with a seed, and relays strict state", async () => {
    const url = await startApp();
    const host = await connect(url), guest = await connect(url);
    send(host, { type: "create", name: "  Ada\u0000", bottle: 0 });
    const welcome = await awaitType(host, "welcome");
    expect(welcome).toMatchObject({ id: expect.any(String), hostId: welcome.id, seed: 0 });
    expect(welcome.players).toEqual([{ id: welcome.id, name: "Ada", bottle: 0 }]);
    send(guest, { type: "join", code: welcome.code, name: "Lin", bottle: 2 });
    await awaitType(guest, "welcome"); await awaitType(host, "lobby");
    send(host, { type: "start" });
    const started = await awaitType(host, "started");
    expect(started.seed).toEqual(expect.any(Number));
    await awaitType(guest, "started");
    const state = { type: "state", seq: 1, x: 3, y: 4, vx: 2, vy: -1, grounded: false, wall: 0, ceiling: false, sliding: true, facing: 1, lean: 0.2, runPhase: 5, deaths: 0, finished: false };
    send(host, state);
    expect(await awaitType(guest, "state")).toEqual({ ...state, id: welcome.id });
    send(host, { ...state, seq: 2, finished: true });
    expect(await awaitType(guest, "winner")).toEqual({ type: "winner", id: welcome.id });
    expect(await awaitType(guest, "state")).toMatchObject({ type: "state", id: welcome.id, seq: 2, finished: true });
    send(guest, { ...state, seq: 1, finished: true });
    expect(await awaitType(host, "state")).toMatchObject({ type: "state", seq: 1, finished: true });
    host.close(); guest.close();
  });

  it("rejects solo start, late join, stale or malformed state, and migrates host", async () => {
    const url = await startApp();
    const host = await connect(url), guest = await connect(url), late = await connect(url);
    send(host, { type: "create", name: "Host", bottle: 1 });
    const h = await awaitType(host, "welcome");
    send(host, { type: "start" }); expect((await awaitType(host, "error")).message).toContain("2 players");
    send(guest, { type: "join", code: h.code, name: "Guest", bottle: 2 }); await awaitType(guest, "welcome");
    send(host, { type: "start" }); await awaitType(host, "started"); await awaitType(guest, "started");
    send(late, { type: "join", code: h.code, name: "Late", bottle: 0 }); expect((await awaitType(late, "error")).message).toContain("already started");
    const invalid = { type: "state", seq: 1, x: Infinity, y: 0, vx: 0, vy: 0, grounded: true, wall: 0, ceiling: false, sliding: false, facing: 1, lean: 0, runPhase: 0, deaths: 0, finished: false };
    send(host, invalid); expect((await awaitType(host, "error")).message).toContain("Invalid state");
    host.close(); expect(await awaitType(guest, "host-changed")).toMatchObject({ hostId: expect.any(String) });
    guest.close(); late.close();
  });

  it("rejects module-set mismatches in either join direction", async () => {
    const url = await startApp();
    const hostHasHash = await connect(url), guestWithoutHash = await connect(url);
    send(hostHasHash, { type: "create", name: "Has hash", bottle: 0, moduleHash: "modules-a" });
    const firstLobby = await awaitType(hostHasHash, "welcome");
    send(guestWithoutHash, { type: "join", code: firstLobby.code, name: "No hash", bottle: 1 });
    expect((await awaitType(guestWithoutHash, "error")).message).toContain("Module set mismatch");

    const hostWithoutHash = await connect(url), guestHasHash = await connect(url);
    send(hostWithoutHash, { type: "create", name: "No hash", bottle: 0 });
    const secondLobby = await awaitType(hostWithoutHash, "welcome");
    send(guestHasHash, { type: "join", code: secondLobby.code, name: "Has hash", bottle: 1, moduleHash: "modules-a" });
    expect((await awaitType(guestHasHash, "error")).message).toContain("Module set mismatch");
    hostHasHash.close(); guestWithoutHash.close(); hostWithoutHash.close(); guestHasHash.close();
  });

  it("allows matching module hashes and treats missing and empty hashes as equal", async () => {
    const url = await startApp();
    const host = await connect(url), matching = await connect(url);
    send(host, { type: "create", name: "Host", bottle: 0, moduleHash: "modules-a" });
    const lobby = await awaitType(host, "welcome");
    send(matching, { type: "join", code: lobby.code, name: "Match", bottle: 1, moduleHash: "modules-a" });
    expect((await awaitType(matching, "welcome")).code).toBe(lobby.code);
    await awaitType(host, "lobby");

    const oldHost = await connect(url), emptyHashGuest = await connect(url);
    send(oldHost, { type: "create", name: "Old client", bottle: 0 });
    const oldLobby = await awaitType(oldHost, "welcome");
    send(emptyHashGuest, { type: "join", code: oldLobby.code, name: "Empty", bottle: 1, moduleHash: "" });
    expect((await awaitType(emptyHashGuest, "welcome")).code).toBe(oldLobby.code);
    host.close(); matching.close(); oldHost.close(); emptyHashGuest.close();
  });

  it("rejects invalid module hash values", async () => {
    const url = await startApp();
    const client = await connect(url);
    send(client, { type: "create", name: "Host", bottle: 0, moduleHash: "not safe" });
    expect((await awaitType(client, "error")).message).toContain("Invalid create message");
    client.close();
  });

  it("serves the health endpoint", async () => {
    const wsUrl = await startApp();
    const response = await fetch(wsUrl.replace("ws://", "http://").replace("/ws", "/health"));
    expect(response.status).toBe(200); expect(await response.json()).toEqual({ status: "ok" });
  });
});
