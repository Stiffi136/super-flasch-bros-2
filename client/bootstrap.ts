import './style.css';
import { renderShell, type BottleId } from './shell';
import type { MountedGame } from './main';
import { MultiplayerClient, type PlayerInfo, type RemoteState } from './multiplayer';


const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Die Spieloberfläche konnte nicht geladen werden.');
let mounted: MountedGame | undefined;
let network: MultiplayerClient | undefined;
let selfId = '', hostId = '', lobbyCode = '', players: PlayerInfo[] = [];
let selectedBottle = 0, inRace = false, intentionalClose = false, ready = false;
let mountGame: typeof import('./main').mountGame;
let moduleSetHash: string;
let queuedStates: RemoteState[] = [], queuedWinner: string | undefined;
const bottleIndex: Record<BottleId, number> = { amber: 0, mint: 1, berry: 2 };
const shell = renderShell(app, {
  onStartSingleplayer: (bottle) => {
    if (!mountGame) { shell.setStatus('Spiel wird noch geladen.', 'error'); return; }
    disconnect(); mounted?.destroy();
    shell.showView('game'); shell.setStatus('');
    mounted = mountGame(shell.gameMount, { bottleIndex: bottleIndex[bottle], startImmediately: true });
    window.scrollTo(0, 0);
  },
  onCreateLobby: (bottle) => connect('create', bottle),
  onJoinLobby: (code, bottle) => connect('join', bottle, code),
});
const el = <T extends HTMLElement>(selector: string): T => shell.root.querySelector<T>(selector)!;
const serverInput = el<HTMLInputElement>('[data-server-url]');
const nameInput = el<HTMLInputElement>('[data-player-name]');
const defaultServer = import.meta.env.VITE_SERVER_URL as string | undefined;
serverInput.value = defaultServer || ((location.hostname === 'localhost' || location.hostname === '127.0.0.1') ? 'ws://localhost:8080/ws' : '');
const lobbyMessage = el<HTMLElement>('[data-lobby-message]');
const startButton = el<HTMLButtonElement>('[data-action="start-race"]');

// Load and validate authored modules before enabling the game. Surface broken
// module files in the shell instead of leaving the loading screen on an error.
void Promise.all([import('./main'), import('./custom-modules')]).then(([game, modules]) => {
  mountGame = game.mountGame;
  moduleSetHash = modules.moduleSetHash;
}).catch((error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  shell.setStatus(`Module konnten nicht geladen werden: ${message}`, 'error');
  shell.root.querySelectorAll<HTMLButtonElement>('button').forEach(button => { button.disabled = true; });
});

function disconnect(): void {
  const old = network; network = undefined; intentionalClose = true;
  if (old) old.close();
  selfId = ''; hostId = ''; lobbyCode = ''; players = []; inRace = false; ready = false; queuedStates = []; queuedWinner = undefined;
}
function updateLobby(): void {
  el<HTMLElement>('[data-lobby-code]').textContent = lobbyCode;
  const list = el<HTMLElement>('[data-lobby-players]'); list.replaceChildren();
  for (const player of players) {
    const item = document.createElement('li');
    item.textContent = `${player.name}${player.id === selfId ? ' (du)' : ''}${player.id === hostId ? ' · Lobby-Leitung' : ''}`;
    list.append(item);
  }
  startButton.hidden = selfId !== hostId;
  startButton.disabled = players.length < 2;
  lobbyMessage.textContent = selfId === hostId
    ? (players.length < 2 ? 'Warte auf mindestens eine weitere Person.' : 'Alle bereit? Du kannst das Rennen starten.')
    : 'Warte, bis die Lobby-Leitung das Rennen startet.';
}
function connect(action: 'create' | 'join', bottle: BottleId, code = ''): void {
  if (!mountGame) throw new Error('Spiel wird noch geladen.');
  const url = serverInput.value.trim(), name = nameInput.value.trim();
  if (!url) throw new Error('Bitte gib die WebSocket-Adresse des Spielservers ein.');
  if (!name) throw new Error('Bitte gib deinen Namen ein.');
  disconnect(); intentionalClose = false; selectedBottle = bottleIndex[bottle];
  const client = new MultiplayerClient({ url, moduleHash: moduleSetHash, callbacks: {
    onOpen: () => { if (network !== client) return; if (action === 'create') client.create(name, selectedBottle); else client.join(code.trim().toUpperCase(), name, selectedBottle); },
    onWelcome: message => {
      if (network !== client) return;
      selfId = message.id; hostId = message.hostId; lobbyCode = message.code; players = message.players;
      updateLobby(); shell.setStatus(''); shell.showView('lobby'); window.scrollTo(0, 0);
    },
    onLobby: message => { if (network !== client) return; hostId = message.hostId; lobbyCode = message.code; players = message.players; if (!inRace) updateLobby(); },
    onHostChanged: id => { if (network !== client) return; hostId = id; if (!inRace) updateLobby(); },
    onStarted: ({ seed }) => {
      if (network !== client) return;
      inRace = true; ready = false; queuedStates = []; queuedWinner = undefined;
      mounted?.destroy(); shell.showView('game'); shell.setStatus('');
      mounted = mountGame(shell.gameMount, { bottleIndex: selectedBottle, seed, startImmediately: true });
      const instance = mounted;
      instance.game.events.once('step', () => {
        if (network !== client || mounted !== instance) return;
        instance.scene.configureMultiplayer({ selfId, players, onState: state => client.sendState(state) });
        ready = true;
        for (const state of queuedStates) instance.scene.updateRemotePlayer(state.id, state);
        queuedStates = [];
        if (queuedWinner) instance.scene.setRaceWinner(queuedWinner);
      });
      window.scrollTo(0, 0);
    },
    onState: state => { if (network !== client) return; if (ready) mounted?.scene.updateRemotePlayer(state.id, state); else { queuedStates = queuedStates.filter(s => s.id !== state.id); queuedStates.push(state); } },
    onWinner: id => { if (network !== client) return; if (ready) mounted?.scene.setRaceWinner(id); else queuedWinner = id; },
    onPlayerLeft: id => { if (network !== client) return; players = players.filter(p => p.id !== id); mounted?.scene.removeRemotePlayer(id); if (!inRace) updateLobby(); },
    onServerError: message => { if (network === client) { shell.setStatus(message.startsWith('Module set mismatch') ? 'Unterschiedliche Modulversionen: Alle Spieler brauchen denselben Spiel-Build mit denselben Modulen.' : `Spielserver: ${message}`, 'error'); if (!selfId) { network = undefined; client.close(); } } },
    onError: error => { if (network === client) shell.setStatus(`Verbindung: ${error.message}`, 'error'); },
    onClose: () => { if (network !== client || intentionalClose) return; network = undefined; if (inRace) mounted?.scene.clearMultiplayer(); shell.setStatus('Die Verbindung zum Spielserver wurde getrennt. Bitte kehre zum Menü zurück.', 'error'); },
  }});
  network = client;
}
startButton.addEventListener('click', () => network?.start());
el<HTMLButtonElement>('[data-action="leave-lobby"]').addEventListener('click', () => { disconnect(); shell.showView('menu'); shell.setStatus(''); });
el<HTMLButtonElement>('[data-action="menu"]').addEventListener('click', () => { disconnect(); mounted?.destroy(); mounted = undefined; shell.setStatus(''); window.scrollTo(0, 0); });
