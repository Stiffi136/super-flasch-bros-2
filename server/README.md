# Multiplayer server

WebSocket room server for the browser game. It manages private lobbies, host migration, start/seed assignment, input validation, and state relay. Lobby data is held in memory and is lost when the process restarts.

## Run

Build with `npm run build:server`, then run `npm run start:server`. The server listens on `0.0.0.0:8080` by default and serves WebSockets at `/ws`.

- `PORT`: HTTP and WebSocket port. Defaults to `8080`.
- `HOST`: bind address. Defaults to `0.0.0.0`.
- `ORIGIN_ALLOWLIST`: comma-separated exact origins. Defaults to localhost ports 5173 and 3000. Requests without an Origin header are accepted for non-browser clients.
- Resource bounds: at most 256 simultaneous WebSocket connections and 128 active rooms. Unjoined connections are closed after 15 seconds. These limits are fixed defaults in production.
- `GET /health` returns `200 {"status":"ok"}`. Other HTTP routes return 404.

## Protocol

Every message is a JSON object. The server limits payloads to 8 KiB and each connection to 30 messages per second. Invalid messages receive `{ "type":"error", "message":"..." }`. Names are Unicode-normalized, control characters are removed, and names are limited to 20 code points. `bottle` is an integer from `0` to `2`.

Client to server:

```json
{"type":"create","name":"Ada","bottle":0}
{"type":"join","code":"ABC234","name":"Lin","bottle":1}
{"type":"start"}
{"type":"return-to-lobby"}
{"type":"state","raceId":"server-issued-race-id","seq":1,"x":0,"y":0,"vx":0,"vy":0,"grounded":true,"wall":0,"ceiling":false,"sliding":false,"facing":1,"lean":0,"runPhase":0,"deaths":0,"finished":false}
```

The state message requires all listed fields. Numeric values must be finite and within reasonable bounds; booleans and integer fields are checked. Sequence numbers must strictly increase per connection and race. The state `raceId` must match the current race. Unknown keys are rejected. Valid late states from a finished player, a completed race, or an older race are silently discarded. State messages are accepted and relayed only after `go`, with the server-assigned `id` added; the sender does not receive an echo.

Server to client:

- `welcome`: `{type,id,code,hostId,seed,players:[{id,name,bottle}]}`
- `lobby`: `{type,code,hostId,seed,players:[{id,name,bottle}]}`
- `started`: `{type,seed,countdownMs,raceId}` – starts the countdown and supplies the server-issued identifier required on state messages; the default duration is 3000 ms.
- `go`: `{type}` – releases the race after the countdown.
- `winner`: `{type,id}` (broadcast once, before forwarding the winning finished state)
- `race-complete`: `{type,winnerId}` (broadcast once when every remaining player has finished; `winnerId` is `null` if no player finished)
- `lobby-reset`: `{type,code,hostId,seed,players}` (broadcast to all current room members after a completed race returns to the lobby)
- `state`: `{type,id,raceId,seq,x,y,vx,vy,grounded,wall,ceiling,sliding,facing,lean,runPhase,deaths,finished}`
- `error`: `{type,message}`
- `player-left`: `{type,id}`
- `host-changed`: `{type,hostId}`

Lobby codes contain 6 unambiguous uppercase letters/digits. Rooms support 2–8 players. Only the host can start, and start requires at least 2 players. Started rooms reject new joins. The host is the first remaining player after host disconnect. Empty rooms are removed. The seed is a random unsigned 32-bit integer assigned at start. The server sends `go` after the countdown; clients start on receipt, so network and loading delays can cause small start-time differences. There is no synchronized clock or authoritative physics. The first valid state with `finished:true` wins: the server broadcasts `{type:"winner",id}` once per race, before forwarding that state. Finished status is tracked for each connected player. The server broadcasts `race-complete` once all remaining players have finished; a player who disconnects no longer blocks completion. Any room member can send `return-to-lobby` after completion. The server keeps the room and host, clears the seed and winner, resets each player's sequence and finish status, and broadcasts `lobby-reset`. The host can then start another race. A `return-to-lobby` request before completion is rejected.

## Trust model

This server is **not authoritative for gameplay**. A connected client can submit arbitrary but syntactically valid positions, velocities, flags, deaths, and completion state. The server checks message shape, ranges, rate, room membership, and increasing sequence numbers only. It does not simulate physics, verify collisions, or prevent cheating. Do not use relayed state for competitive results or security decisions.

## Tests

Run `npx vitest run server/test` and `npm run build:server` from the repository root. Tests also cover connection and room caps, idle timeout, and cleanup.
