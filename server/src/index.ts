import { createServer, type Server } from "node:http";
import { randomInt, randomUUID } from "node:crypto";
import { WebSocket, WebSocketServer } from "ws";

export type Bottle = 0 | 1 | 2;
type Player = { id: string; name: string; bottle: Bottle; ws: WebSocket; lastSeq: number };
type Room = { code: string; hostId: string; started: boolean; seed: number; moduleHash: string; winnerId?: string; players: Map<string, Player> };
type ServerOptions = { port?: number; host?: string; allowedOrigins?: string[]; maxConnections?: number; maxRooms?: number; idleTimeoutMs?: number };
const MAX_CONNECTIONS = 256;
const MAX_ROOMS = 128;
const IDLE_UNJOINED_TIMEOUT_MS = 15_000;
const MAX_PLAYERS = 8;
const MAX_NAME_LENGTH = 20;
const MAX_MODULE_HASH_LENGTH = 256;
const MAX_RATE = 30;
const STATE_FIELDS = ["seq", "x", "y", "vx", "vy", "grounded", "wall", "ceiling", "sliding", "facing", "lean", "runPhase", "deaths", "finished"] as const;
const NUMERIC_LIMITS: Record<string, [number, number]> = {
  x: [-1_000_000, 1_000_000], y: [-1_000_000, 1_000_000], vx: [-100_000, 100_000], vy: [-100_000, 100_000],
  wall: [-1, 1], facing: [-1, 1], lean: [-Math.PI * 2, Math.PI * 2], runPhase: [-1_000_000, 1_000_000], deaths: [0, 1_000_000],
};
const DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:3000"];

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
function hasOnlyKeys(value: Record<string, unknown>, allowed: string[]): boolean {
  return Object.keys(value).every((key) => allowed.includes(key));
}
function validBottle(value: unknown): value is Bottle { return Number.isInteger(value) && (value === 0 || value === 1 || value === 2); }
function validName(value: unknown): value is string { return typeof value === "string" && value.trim().length > 0 && value.length <= 64; }
function validModuleHash(value: unknown): value is string { return typeof value === "string" && value.length <= MAX_MODULE_HASH_LENGTH && /^[A-Za-z0-9._:-]*$/.test(value); }
function sanitizeName(value: string): string {
  const cleaned = value.normalize("NFKC").replace(/[\u0000-\u001f\u007f-\u009f]/g, "").trim();
  return [...cleaned].slice(0, MAX_NAME_LENGTH).join("") || "Player";
}
function validState(value: Record<string, unknown>): boolean {
  if (!hasOnlyKeys(value, ["type", ...STATE_FIELDS]) || STATE_FIELDS.some((key) => !(key in value))) return false;
  if (!Number.isSafeInteger(value.seq) || (value.seq as number) < 0) return false;
  for (const [key, [min, max]] of Object.entries(NUMERIC_LIMITS)) {
    const number = value[key];
    if (typeof number !== "number" || !Number.isFinite(number) || number < min || number > max) return false;
    if (["wall", "facing", "deaths"].includes(key) && !Number.isInteger(number)) return false;
  }
  return ["grounded", "ceiling", "sliding", "finished"].every((key) => typeof value[key] === "boolean");
}
function codeFor(rooms: Map<string, Room>): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (;;) {
    let code = "";
    for (let i = 0; i < 6; i++) code += alphabet[randomInt(alphabet.length)];
    if (!rooms.has(code)) return code;
  }
}

export function createGameServer(options: ServerOptions = {}) {
  const rooms = new Map<string, Room>();
  const connections = new Map<WebSocket, { room: Room; player: Player }>();
  const sockets = new Set<WebSocket>();
  const idleTimers = new Map<WebSocket, ReturnType<typeof setTimeout>>();
  const maxConnections = options.maxConnections ?? MAX_CONNECTIONS;
  const maxRooms = options.maxRooms ?? MAX_ROOMS;
  const idleTimeoutMs = options.idleTimeoutMs ?? IDLE_UNJOINED_TIMEOUT_MS;
  const allowedOrigins = new Set(options.allowedOrigins ?? (process.env.ORIGIN_ALLOWLIST ?? DEFAULT_ORIGINS.join(",")).split(",").map((s) => s.trim()).filter(Boolean));
  const server: Server = createServer((req, res) => {
    if (req.url === "/health" && req.method === "GET") {
      res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
      res.end(JSON.stringify({ status: "ok" }));
    } else { res.writeHead(404, { "content-type": "application/json" }); res.end(JSON.stringify({ error: "not_found" })); }
  });
  const wss = new WebSocketServer({ noServer: true, maxPayload: 8 * 1024 });
  const send = (ws: WebSocket, message: unknown) => { if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(message)); };
  const error = (ws: WebSocket, message: string) => send(ws, { type: "error", message });
  const players = (room: Room) => [...room.players.values()].map(({ id, name, bottle }) => ({ id, name, bottle }));
  const broadcast = (room: Room, message: unknown) => { for (const p of room.players.values()) send(p.ws, message); };
  const lobby = (room: Room) => broadcast(room, { type: "lobby", code: room.code, hostId: room.hostId, seed: room.seed, players: players(room) });
  const disconnect = (ws: WebSocket) => {
    const entry = connections.get(ws);
    if (!entry) return;
    connections.delete(ws);
    const { room, player } = entry;
    room.players.delete(player.id);
    if (!room.players.size) { rooms.delete(room.code); return; }
    if (room.hostId === player.id) {
      room.hostId = room.players.keys().next().value as string;
      broadcast(room, { type: "host-changed", hostId: room.hostId });
    }
    broadcast(room, { type: "player-left", id: player.id });
    lobby(room);
  };
  const attach = (ws: WebSocket, room: Room, name: string, bottle: Bottle) => {
    const player: Player = { id: randomUUID(), name: sanitizeName(name), bottle, ws, lastSeq: -1 };
    room.players.set(player.id, player);
    if (!room.hostId) room.hostId = player.id;
    connections.set(ws, { room, player });
    const idleTimer = idleTimers.get(ws);
    if (idleTimer) { clearTimeout(idleTimer); idleTimers.delete(ws); }
    send(ws, { type: "welcome", id: player.id, code: room.code, hostId: room.hostId, seed: room.seed, players: players(room) });
    lobby(room);
  };
  server.on("upgrade", (req, socket, head) => {
    const origin = req.headers.origin;
    if (req.url !== "/ws" || (origin !== undefined && !allowedOrigins.has(origin))) {
      socket.write("HTTP/1.1 403 Forbidden\r\nConnection: close\r\n\r\n"); socket.destroy(); return;
    }
    if (sockets.size >= maxConnections) {
      socket.write("HTTP/1.1 503 Service Unavailable\r\nConnection: close\r\n\r\n"); socket.destroy(); return;
    }
    wss.handleUpgrade(req, socket, head, (ws) => wss.emit("connection", ws, req));
  });
  wss.on("connection", (ws) => {
    sockets.add(ws);
    idleTimers.set(ws, setTimeout(() => { if (!connections.has(ws)) ws.terminate(); }, idleTimeoutMs));
    let messageTimes: number[] = [];
    ws.on("message", (raw) => {
      const now = Date.now(); messageTimes = messageTimes.filter((time) => now - time < 1000);
      if (messageTimes.length >= MAX_RATE) { error(ws, "Too many messages."); return; }
      messageTimes.push(now);
      let message: unknown;
      try { message = JSON.parse(raw.toString()); } catch { error(ws, "Message must be valid JSON."); return; }
      if (!record(message) || typeof message.type !== "string") { error(ws, "Message must be an object with a type."); return; }
      const current = connections.get(ws);
      if (message.type === "create") {
        if (current || !hasOnlyKeys(message, ["type", "name", "bottle", "moduleHash"]) || !validName(message.name) || !validBottle(message.bottle) || ("moduleHash" in message && !validModuleHash(message.moduleHash))) { error(ws, "Invalid create message."); return; }
        if (rooms.size >= maxRooms) { error(ws, "Server room limit reached."); return; }
        const room: Room = { code: codeFor(rooms), hostId: "", started: false, seed: 0, moduleHash: message.moduleHash === undefined ? "" : message.moduleHash as string, players: new Map() };
        rooms.set(room.code, room); attach(ws, room, message.name, message.bottle); return;
      }
      if (message.type === "join") {
        if (current || !hasOnlyKeys(message, ["type", "code", "name", "bottle", "moduleHash"]) || typeof message.code !== "string" || !/^[A-HJ-NP-Z2-9]{6}$/.test(message.code) || !validName(message.name) || !validBottle(message.bottle) || ("moduleHash" in message && !validModuleHash(message.moduleHash))) { error(ws, "Invalid join message."); return; }
        const room = rooms.get(message.code);
        if (!room) { error(ws, "Lobby does not exist."); return; }
        if (room.started) { error(ws, "Lobby has already started."); return; }
        if (room.moduleHash !== (message.moduleHash ?? "")) { error(ws, "Module set mismatch: this lobby uses a different custom module set."); return; }
        if (room.players.size >= MAX_PLAYERS) { error(ws, "Lobby is full."); return; }
        attach(ws, room, message.name, message.bottle); return;
      }
      if (!current) { error(ws, "Create or join a lobby first."); return; }
      const { room, player } = current;
      if (message.type === "start") {
        if (!hasOnlyKeys(message, ["type"])) { error(ws, "Invalid start message."); return; }
        if (player.id !== room.hostId) { error(ws, "Only the host can start."); return; }
        if (room.started) { error(ws, "Lobby has already started."); return; }
        if (room.players.size < 2) { error(ws, "At least 2 players are required to start."); return; }
        room.started = true; room.seed = randomInt(0, 0x1_0000_0000);
        broadcast(room, { type: "started", seed: room.seed }); return;
      }
      if (message.type === "state") {
        if (!room.started || !validState(message)) { error(ws, "Invalid state message or game has not started."); return; }
        const seq = message.seq as number;
        if (seq <= player.lastSeq) { error(ws, "State sequence must increase."); return; }
        player.lastSeq = seq;
        if (message.finished === true && !room.winnerId) {
          room.winnerId = player.id;
          broadcast(room, { type: "winner", id: player.id });
        }
        const relayed = { type: "state", id: player.id, ...Object.fromEntries(STATE_FIELDS.map((key) => [key, message[key]])) };
        for (const other of room.players.values()) if (other.id !== player.id) send(other.ws, relayed);
        return;
      }
      error(ws, "Unknown message type.");
    });
    ws.on("close", () => cleanupSocket(ws)); ws.on("error", () => cleanupSocket(ws));
  });
  const cleanupSocket = (ws: WebSocket) => {
    const timer = idleTimers.get(ws);
    if (timer) { clearTimeout(timer); idleTimers.delete(ws); }
    sockets.delete(ws);
    disconnect(ws);
  };
  return {
    server, wss, rooms,
    listen(port = options.port ?? Number(process.env.PORT ?? 8080), host = options.host ?? process.env.HOST ?? "0.0.0.0") {
      return new Promise<void>((resolve) => server.listen(port, host, () => resolve()));
    },
    close() {
      for (const ws of wss.clients) ws.terminate();
      return new Promise<void>((resolve, reject) => { wss.close(); server.close((err) => err ? reject(err) : resolve()); });
    },
    address() { return server.address(); },
  };
}

if (process.argv[1] && import.meta.url === new URL(`file://${process.argv[1]}`).href) {
  const app = createGameServer();
  app.listen().then(() => console.log(`Lobby server listening on ${process.env.HOST ?? "0.0.0.0"}:${process.env.PORT ?? 8080}`));
}
