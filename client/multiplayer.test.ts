import { describe, expect, it, vi } from 'vitest';
import { MultiplayerClient, type PlayerState } from './multiplayer';

class FakeSocket extends EventTarget {
  static instance: FakeSocket | undefined;
  readyState = 0;
  sent: string[] = [];
  url: string;
  constructor(url: string) { super(); this.url = url; FakeSocket.instance = this; }
  send(data: string) { this.sent.push(data); }
  close() { this.readyState = 3; this.dispatchEvent(new Event('close')); }
  open() { this.readyState = 1; this.dispatchEvent(new Event('open')); }
  message(data: unknown) { this.dispatchEvent(new MessageEvent('message', { data })); }
}
const makeClient = (callbacks = {}) => new MultiplayerClient({ url: 'ws://localhost:8080/ws', WebSocketCtor: FakeSocket as unknown as new (url: string) => WebSocket, callbacks });
const state: PlayerState = { seq: 1, x: 1, y: 2, vx: 3, vy: 4, grounded: true, wall: 0, ceiling: false, sliding: false, facing: 1, lean: 0, runPhase: 2, deaths: 0, finished: false };

describe('MultiplayerClient', () => {
  it('connects only when instantiated and sends the documented client messages', () => {
    const client = makeClient();
    const socket = FakeSocket.instance!;
    expect(socket.url).toBe('ws://localhost:8080/ws');
    client.create('Ada', 2);
    client.join('ABC234', 'Lin', 1);
    client.start();
    client.returnToLobby();
    expect(socket.sent).toEqual([]);
    socket.open();
    client.create('Ada', 2);
    client.join('ABC234', 'Lin', 1);
    client.start();
    client.returnToLobby();
    socket.message(JSON.stringify({ type: 'started', seed: 10, countdownMs: 3000, raceId: 'race-a' }));
    client.sendState(state);
    expect(socket.sent.map((item) => JSON.parse(item))).toEqual([
      { type: 'create', name: 'Ada', bottle: 2 },
      { type: 'join', code: 'ABC234', name: 'Lin', bottle: 1 },
      { type: 'start' },
      { type: 'return-to-lobby' },
      { type: 'state', raceId: 'race-a', ...state },
    ]);
  });

  it('includes an optional module hash in create and join messages', () => {
    const client = new MultiplayerClient({ url: 'ws://localhost:8080/ws', moduleHash: 'sha256:abc123', WebSocketCtor: FakeSocket as unknown as new (url: string) => WebSocket });
    const socket = FakeSocket.instance!;
    socket.open();
    client.create('Ada', 2);
    client.join('ABC234', 'Lin', 1);
    expect(socket.sent.map((item) => JSON.parse(item))).toEqual([
      { type: 'create', name: 'Ada', bottle: 2, moduleHash: 'sha256:abc123' },
      { type: 'join', code: 'ABC234', name: 'Lin', bottle: 1, moduleHash: 'sha256:abc123' },
    ]);
  });

  it('rejects unsafe or oversized module hashes', () => {
    expect(() => new MultiplayerClient({ url: 'ws://localhost:8080/ws', moduleHash: 'bad hash', WebSocketCtor: FakeSocket as unknown as new (url: string) => WebSocket })).toThrow(TypeError);
    expect(() => new MultiplayerClient({ url: 'ws://localhost:8080/ws', moduleHash: 'x'.repeat(257), WebSocketCtor: FakeSocket as unknown as new (url: string) => WebSocket })).toThrow(TypeError);
  });

  it('dispatches validated server messages and ignores stale per-player states', () => {
    const onWelcome = vi.fn(), onLobby = vi.fn(), onStarted = vi.fn(), onGo = vi.fn(), onState = vi.fn();
    const onServerError = vi.fn(), onPlayerLeft = vi.fn(), onHostChanged = vi.fn(), onWinner = vi.fn(), onRaceComplete = vi.fn(), onReturnToLobby = vi.fn(), onError = vi.fn();
    const client = makeClient({ onWelcome, onLobby, onStarted, onGo, onState, onServerError, onPlayerLeft, onHostChanged, onWinner, onRaceComplete, onReturnToLobby, onError });
    const socket = FakeSocket.instance!;
    const players = [{ id: 'p1', name: 'Ada', bottle: 2 }];
    socket.message(JSON.stringify({ type: 'welcome', id: 'p1', code: 'ABC234', hostId: 'p1', seed: 8, players }));
    socket.message(JSON.stringify({ type: 'lobby', code: 'ABC234', hostId: 'p1', seed: 8, players }));
    socket.message(JSON.stringify({ type: 'started', seed: 8, countdownMs: 3000, raceId: 'race-a' }));
    socket.message(JSON.stringify({ type: 'go' }));
    socket.message(JSON.stringify({ type: 'state', id: 'p1', raceId: 'race-a', ...state }));
    socket.message(JSON.stringify({ type: 'state', id: 'p1', raceId: 'race-a', ...state }));
    socket.message(JSON.stringify({ type: 'error', message: 'No room.' }));
    socket.message(JSON.stringify({ type: 'player-left', id: 'p2' }));
    socket.message(JSON.stringify({ type: 'host-changed', hostId: 'p2' }));
    socket.message(JSON.stringify({ type: 'winner', id: 'p1' }));
    socket.message(JSON.stringify({ type: 'race-complete', winnerId: 'p1' }));
    socket.message(JSON.stringify({ type: 'lobby-reset', code: 'ABC234', hostId: 'p1', seed: 0, players }));
    socket.message(JSON.stringify({ type: 'state', id: 'p1', raceId: 'race-a', ...state }));
    expect(onWelcome).toHaveBeenCalledOnce();
    expect(onLobby).toHaveBeenCalledOnce();
    expect(onStarted).toHaveBeenCalledOnce();
    expect(onStarted).toHaveBeenCalledWith({ seed: 8, countdownMs: 3000, raceId: 'race-a' });
    expect(onGo).toHaveBeenCalledOnce();
    expect(onState).toHaveBeenCalledOnce();
    expect(onServerError).toHaveBeenCalledWith('No room.');
    expect(onPlayerLeft).toHaveBeenCalledWith('p2');
    expect(onHostChanged).toHaveBeenCalledWith('p2');
    expect(onWinner).toHaveBeenCalledOnce();
    expect(onWinner).toHaveBeenCalledWith('p1');
    expect(onRaceComplete).toHaveBeenCalledWith({ winnerId: 'p1' });
    expect(onReturnToLobby).toHaveBeenCalledWith({ code: 'ABC234', hostId: 'p1', seed: 0, players });
    expect(onError).not.toHaveBeenCalled();
  });

  it('rejects malformed, extra-field, and non-text messages and invalid outgoing states', () => {
    const onError = vi.fn();
    const client = makeClient({ onError });
    const socket = FakeSocket.instance!;
    socket.message('{');
    socket.message(JSON.stringify({ type: 'started', seed: Infinity, countdownMs: 3000 }));
    socket.message(JSON.stringify({ type: 'started', seed: 1 }));
    socket.message(JSON.stringify({ type: 'started', seed: 1, countdownMs: -1 }));
    socket.message(JSON.stringify({ type: 'started', seed: 1, countdownMs: 3000, extra: true }));
    socket.message(JSON.stringify({ type: 'go', extra: true }));
    socket.message(JSON.stringify({ type: 'winner', id: '' }));
    socket.message(JSON.stringify({ type: 'winner', id: 'p1', extra: true }));
    socket.message(JSON.stringify({ type: 'race-complete', winnerId: 3 }));
    socket.message(JSON.stringify({ type: 'lobby-reset', code: 'ABC234', hostId: 'p1', seed: 0, players: [{ id: 'p1', name: 'Ada', bottle: 9 }] }));
    socket.message({ type: 'started', seed: 1, countdownMs: 3000 });
    expect(onError).toHaveBeenCalledTimes(11);
    socket.open();
    socket.message(JSON.stringify({ type: 'started', seed: 4, countdownMs: 0, raceId: 'race-x' }));
    expect(() => client.sendState({ ...state, x: Number.NaN })).toThrow(TypeError);
  });

  it('reports connection errors and close events', () => {
    const onError = vi.fn(), onClose = vi.fn();
    const client = makeClient({ onError, onClose });
    const socket = FakeSocket.instance!;
    socket.dispatchEvent(new Event('error'));
    client.close();
    expect(onError).toHaveBeenCalledOnce();
    expect(onClose).toHaveBeenCalledOnce();
  });

  it('rejects non-WebSocket URLs', () => {
    expect(() => new MultiplayerClient({ url: 'https://example.test/ws', WebSocketCtor: FakeSocket as unknown as new (url: string) => WebSocket })).toThrow(TypeError);
  });
});
