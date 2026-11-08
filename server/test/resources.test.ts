import { afterEach, describe, expect, it } from "vitest";
import { WebSocket } from "ws";
import { createGameServer } from "../src/index.js";

const apps: ReturnType<typeof createGameServer>[] = [];
const start = async (options: Parameters<typeof createGameServer>[0] = {}) => {
  const app = createGameServer({ port: 0, host: "127.0.0.1", allowedOrigins: ["http://allowed.test"], ...options });
  apps.push(app); await app.listen();
  const address = app.address();
  if (!address || typeof address === "string") throw new Error("No TCP address");
  return { app, url: `ws://127.0.0.1:${address.port}/ws` };
};
const connect = (url: string) => new Promise<WebSocket>((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.once("open", () => resolve(ws)); ws.once("error", reject);
});
const connectionRejected = (url: string) => new Promise<void>((resolve, reject) => {
  const ws = new WebSocket(url);
  ws.once("open", () => { ws.close(); reject(new Error("Connection unexpectedly accepted")); });
  ws.once("error", () => resolve());
});
const message = (ws: WebSocket) => new Promise<Record<string, unknown>>((resolve, reject) => {
  const timer = setTimeout(() => reject(new Error("Timed out")), 1000);
  ws.once("message", (data) => { clearTimeout(timer); resolve(JSON.parse(data.toString())); });
});
const send = (ws: WebSocket, data: unknown) => ws.send(JSON.stringify(data));
afterEach(async () => { await Promise.all(apps.splice(0).map((app) => app.close())); });

describe("resource bounds", () => {
  it("enforces the connection limit and frees a slot after an unjoined idle timeout", async () => {
    const { url } = await start({ maxConnections: 1, idleTimeoutMs: 40 });
    const idle = await connect(url);
    await connectionRejected(url);
    await new Promise<void>((resolve) => idle.once("close", () => resolve()));
    const next = await connect(url);
    send(next, { type: "create", name: "Player", bottle: 0 });
    expect((await message(next)).type).toBe("welcome");
    next.close();
  });

  it("caps lobby creation and allows a new room after the last player leaves", async () => {
    const { app, url } = await start({ maxRooms: 1 });
    const first = await connect(url), second = await connect(url);
    send(first, { type: "create", name: "One", bottle: 0 });
    const welcome = await message(first);
    expect(app.rooms.size).toBe(1);
    send(second, { type: "create", name: "Two", bottle: 1 });
    expect(await message(second)).toMatchObject({ type: "error", message: "Server room limit reached." });
    first.close();
    await new Promise<void>((resolve) => first.once("close", () => resolve()));
    expect(app.rooms.size).toBe(0);
    send(second, { type: "create", name: "Two", bottle: 1 });
    expect(await message(second)).toMatchObject({ type: "welcome" });
    expect(app.rooms.size).toBe(1);
    expect(welcome.code).toEqual(expect.any(String));
    second.close();
  });
});
