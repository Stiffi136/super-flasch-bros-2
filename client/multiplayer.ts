export type MultiplayerBottle = number;

export type PlayerInfo = { id: string; name: string; bottle: MultiplayerBottle };
export type PlayerState = {
  seq: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  grounded: boolean;
  wall: number;
  ceiling: boolean;
  sliding: boolean;
  facing: number;
  lean: number;
  runPhase: number;
  deaths: number;
  finished: boolean;
};
export type RemoteState = PlayerState & { id: string };

export type MultiplayerCallbacks = {
  onOpen?: () => void;
  onWelcome?: (message: { id: string; code: string; hostId: string; seed: number; players: PlayerInfo[] }) => void;
  onLobby?: (message: { code: string; hostId: string; seed: number; players: PlayerInfo[] }) => void;
  onStarted?: (message: { seed: number }) => void;
  onState?: (state: RemoteState) => void;
  onServerError?: (message: string) => void;
  onPlayerLeft?: (id: string) => void;
  onHostChanged?: (hostId: string) => void;
  onWinner?: (id: string) => void;
  onError?: (error: Error) => void;
  onClose?: (event: CloseEvent) => void;
};

export type MultiplayerOptions = {
  url: string;
  callbacks?: MultiplayerCallbacks;
  /** Injection point for tests. Defaults to the browser WebSocket implementation. */
  WebSocketCtor?: new (url: string) => WebSocket;
};

const STATE_KEYS = ['seq', 'x', 'y', 'vx', 'vy', 'grounded', 'wall', 'ceiling', 'sliding', 'facing', 'lean', 'runPhase', 'deaths', 'finished'] as const;
const own = (value: object, key: string) => Object.prototype.hasOwnProperty.call(value, key);
function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function exactKeys(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return Object.keys(value).length === keys.length && keys.every((key) => own(value, key));
}
function finite(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}
function validString(value: unknown): value is string {
  return typeof value === 'string' && value.length > 0;
}
function validPlayer(value: unknown): value is PlayerInfo {
  if (!isRecord(value) || !exactKeys(value, ['id', 'name', 'bottle'])) return false;
  return validString(value.id) && value.id.length <= 80 && typeof value.name === 'string' && value.name.length > 0 && value.name.length <= 40 && Number.isInteger(value.bottle) && (value.bottle === 0 || value.bottle === 1 || value.bottle === 2);
}
function validPlayers(value: unknown): value is PlayerInfo[] {
  return Array.isArray(value) && value.length <= 8 && value.every(validPlayer);
}
function validPlayerState(value: Record<string, unknown>): boolean {
  if (!exactKeys(value, STATE_KEYS)) return false;
  return Number.isSafeInteger(value.seq) && (value.seq as number) >= 0 &&
    ['x', 'y', 'vx', 'vy', 'lean', 'runPhase'].every((key) => finite(value[key]) && Math.abs(value[key] as number) <= 1_000_000) &&
    [-1, 0, 1].includes(value.wall as number) && [-1, 0, 1].includes(value.facing as number) &&
    Number.isSafeInteger(value.deaths) && (value.deaths as number) >= 0 && (value.deaths as number) <= 1_000_000 &&
    ['grounded', 'ceiling', 'sliding', 'finished'].every((key) => typeof value[key] === 'boolean');
}

function validateUrl(rawUrl: string): string {
  let url: URL;
  try { url = new URL(rawUrl, typeof location !== 'undefined' ? location.href : undefined); }
  catch { throw new TypeError('A valid WebSocket URL is required.'); }
  if (url.protocol !== 'ws:' && url.protocol !== 'wss:') throw new TypeError('WebSocket URL must use ws: or wss:.');
  if (typeof location !== 'undefined' && location.protocol === 'https:' && url.protocol !== 'wss:') {
    throw new TypeError('An HTTPS page must use a secure wss: connection.');
  }
  return url.toString();
}

/** Browser WebSocket client. Constructing an instance connects; importing this module does not. */
export class MultiplayerClient {
  readonly socket: WebSocket;
  readonly callbacks: MultiplayerCallbacks;
  private readonly lastSeqByPlayer = new Map<string, number>();
  private closed = false;

  constructor(options: MultiplayerOptions) {
    this.callbacks = options.callbacks ?? {};
    const url = validateUrl(options.url);
    const Socket = options.WebSocketCtor ?? globalThis.WebSocket;
    if (!Socket) throw new Error('WebSocket is not available in this environment.');
    this.socket = new Socket(url);
    this.socket.addEventListener('open', () => this.callbacks.onOpen?.());
    this.socket.addEventListener('message', (event: MessageEvent) => this.receive(event.data));
    this.socket.addEventListener('error', () => this.reportError(new Error('WebSocket connection error.')));
    this.socket.addEventListener('close', (event: CloseEvent) => {
      this.closed = true;
      this.callbacks.onClose?.(event);
    });
  }

  create(name: string, bottle: number): void {
    this.send({ type: 'create', name, bottle });
  }

  join(code: string, name: string, bottle: number): void {
    this.send({ type: 'join', code, name, bottle });
  }

  start(): void {
    this.send({ type: 'start' });
  }

  sendState(state: PlayerState): void {
    if (!validPlayerState(state)) throw new TypeError('Invalid player state.');
    this.send({ type: 'state', ...state });
  }

  close(code?: number, reason?: string): void {
    this.closed = true;
    this.socket.close(code, reason);
  }

  private send(message: Record<string, unknown>): void {
    if (this.closed || this.socket.readyState !== 1) {
      this.reportError(new Error('WebSocket is not open.'));
      return;
    }
    try { this.socket.send(JSON.stringify(message)); }
    catch (error) { this.reportError(error instanceof Error ? error : new Error('WebSocket send failed.')); }
  }

  private receive(data: unknown): void {
    if (typeof data !== 'string') {
      this.reportError(new Error('Invalid server message: expected JSON text.'));
      return;
    }
    let value: unknown;
    try { value = JSON.parse(data); }
    catch {
      this.reportError(new Error('Invalid server message: malformed JSON.'));
      return;
    }
    if (!isRecord(value) || typeof value.type !== 'string') {
      this.reportError(new Error('Invalid server message: expected a typed object.'));
      return;
    }

    switch (value.type) {
      case 'welcome':
        if (!exactKeys(value, ['type', 'id', 'code', 'hostId', 'seed', 'players']) || !validString(value.id) || !validString(value.code) || !validString(value.hostId) || !finite(value.seed) || !validPlayers(value.players)) break;
        this.callbacks.onWelcome?.({ id: value.id, code: value.code, hostId: value.hostId, seed: value.seed, players: value.players });
        return;
      case 'lobby':
        if (!exactKeys(value, ['type', 'code', 'hostId', 'seed', 'players']) || !validString(value.code) || !validString(value.hostId) || !finite(value.seed) || !validPlayers(value.players)) break;
        this.callbacks.onLobby?.({ code: value.code, hostId: value.hostId, seed: value.seed, players: value.players });
        return;
      case 'started':
        if (!exactKeys(value, ['type', 'seed']) || !finite(value.seed)) break;
        this.callbacks.onStarted?.({ seed: value.seed });
        return;
      case 'state': {
        if (!exactKeys(value, ['type', 'id', ...STATE_KEYS]) || !validString(value.id)) break;
        const state = Object.fromEntries(STATE_KEYS.map((key) => [key, value[key]])) as unknown as Record<string, unknown>;
        if (!validPlayerState(state)) break;
        const previous = this.lastSeqByPlayer.get(value.id);
        if (previous !== undefined && (state.seq as number) <= previous) return;
        this.lastSeqByPlayer.set(value.id, state.seq as number);
        this.callbacks.onState?.({ id: value.id, ...state } as RemoteState);
        return;
      }
      case 'error':
        if (!exactKeys(value, ['type', 'message']) || typeof value.message !== 'string') break;
        this.callbacks.onServerError?.(value.message);
        return;
      case 'player-left':
        if (!exactKeys(value, ['type', 'id']) || !validString(value.id)) break;
        this.callbacks.onPlayerLeft?.(value.id);
        return;
      case 'host-changed':
        if (!exactKeys(value, ['type', 'hostId']) || !validString(value.hostId)) break;
        this.callbacks.onHostChanged?.(value.hostId);
        return;
      case 'winner':
        if (!exactKeys(value, ['type', 'id']) || !validString(value.id)) break;
        this.callbacks.onWinner?.(value.id);
        return;
      default:
        break;
    }
    this.reportError(new Error(`Invalid or unsupported server message: ${value.type}.`));
  }

  private reportError(error: Error): void {
    this.callbacks.onError?.(error);
  }
}
