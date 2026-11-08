import './style.css';
import { renderShell, type BottleId } from './shell';
import type { MountedGame } from './main';
import { MultiplayerClient, type PlayerInfo, type RemoteState } from './multiplayer';
import { invitationCode, invitationUrl } from './invitation';

const app = document.querySelector<HTMLElement>('#app');
if (!app) throw new Error('Die Spieloberfläche konnte nicht geladen werden.');
let mounted: MountedGame | undefined;
let network: MultiplayerClient | undefined;
let selfId = '', hostId = '', lobbyCode = '', players: PlayerInfo[] = [];
let selectedBottle = 0, inRace = false, intentionalClose = false, ready = false, raceComplete = false;
let mountGame: typeof import('./main').mountGame;
let moduleSetHash: string;
let queuedStates: RemoteState[] = [], queuedWinner: string | undefined, queuedGo = false, queuedComplete = false;
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
const nameInput = el<HTMLInputElement>('[data-player-name]');
const serverUrl = (import.meta.env.VITE_SERVER_URL as string | undefined)?.trim() ?? '';
const invitedCode = invitationCode(location.href);
if (invitedCode) {
  shell.lobbyCodeInput.value = invitedCode;
  shell.setStatus(`Einladung für Lobby ${invitedCode}: Wähle eine Flasche und tritt bei.`, 'info');
  document.getElementById('zusammen')?.scrollIntoView();
}
const inviteLink = el<HTMLAnchorElement>('[data-invitation-link]');
const inviteStatus = el<HTMLElement>('[data-invitation-status]');
const lobbyMessage = el<HTMLElement>('[data-lobby-message]');
const startButton = el<HTMLButtonElement>('[data-action="start-race"]');
const gameBackButton = el<HTMLButtonElement>('[data-action="menu"]');
function setGameBackButton(): void {
  gameBackButton.textContent = inRace && raceComplete ? '← Zurück zur Lobby' : inRace ? '← Rennen verlassen' : '← Zurück zum Menü';
}

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
  selfId = ''; hostId = ''; lobbyCode = ''; players = []; inRace = false; raceComplete = false; ready = false; queuedStates = []; queuedWinner = undefined; queuedGo = false; queuedComplete = false;
  setGameBackButton();
}
function updateLobby(): void {
  el<HTMLElement>('[data-lobby-code]').textContent = lobbyCode;
  const link = invitationUrl(location.href, lobbyCode);
  inviteLink.href = link; inviteLink.textContent = link; inviteStatus.textContent = '';
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
  const url = serverUrl, name = nameInput.value.trim();
  if (!url) throw new Error('Kein Spielserver konfiguriert. Bitte VITE_SERVER_URL beim Client-Build setzen.');
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
    onStarted: ({ seed, countdownMs }) => {
      if (network !== client) return;
      const receivedAt = performance.now();
      inRace = true; raceComplete = false; ready = false; queuedStates = []; queuedWinner = undefined; queuedGo = false; queuedComplete = false;
      setGameBackButton();
      mounted?.destroy(); shell.showView('game'); shell.setStatus('');
      mounted = mountGame(shell.gameMount, { bottleIndex: selectedBottle, seed, startImmediately: true, multiplayerCountdown: true });
      const instance = mounted;
      instance.game.events.once('step', () => {
        if (network !== client || mounted !== instance) return;
        instance.scene.configureMultiplayer({ selfId, players, onState: state => client.sendState(state), onReturnToLobby: () => client.returnToLobby() });
        instance.scene.beginMultiplayerCountdown(Math.max(0, countdownMs - (performance.now() - receivedAt)));
        if (queuedGo) instance.scene.releaseMultiplayerCountdown();
        ready = true;
        for (const state of queuedStates) instance.scene.updateRemotePlayer(state.id, state);
        queuedStates = [];
        if (queuedWinner) instance.scene.setRaceWinner(queuedWinner);
        if (queuedComplete) instance.scene.setRaceComplete();
      });
      window.scrollTo(0, 0);
    },
    onGo: () => { if (network !== client) return; if (ready) mounted?.scene.releaseMultiplayerCountdown(); else queuedGo = true; },
    onState: state => { if (network !== client) return; if (ready) mounted?.scene.updateRemotePlayer(state.id, state); else { queuedStates = queuedStates.filter(s => s.id !== state.id); queuedStates.push(state); } },
    onWinner: id => { if (network !== client) return; if (ready) mounted?.scene.setRaceWinner(id); else queuedWinner = id; },
    onRaceComplete: ({winnerId}) => {
      if (network !== client) return;
      raceComplete = true; setGameBackButton();
      if (winnerId) { if (ready) mounted?.scene.setRaceWinner(winnerId); else queuedWinner = winnerId; }
      if (ready) mounted?.scene.setRaceComplete(); else queuedComplete = true;
    },
    onReturnToLobby: message => {
      if (network !== client) return;
      inRace = false; raceComplete = false; ready = false; queuedStates = []; queuedWinner = undefined; queuedGo = false; queuedComplete = false;
      lobbyCode = message.code; hostId = message.hostId; players = message.players;
      mounted?.destroy(); mounted = undefined; setGameBackButton(); updateLobby(); shell.setStatus(''); shell.showView('lobby'); window.scrollTo(0, 0);
    },
    onPlayerLeft: id => { if (network !== client) return; players = players.filter(p => p.id !== id); mounted?.scene.removeRemotePlayer(id); if (!inRace) updateLobby(); },
    onServerError: message => { if (network === client) { shell.setStatus(message.startsWith('Module set mismatch') ? 'Unterschiedliche Modulversionen: Alle Spieler brauchen denselben Spiel-Build mit denselben Modulen.' : `Spielserver: ${message}`, 'error'); if (!selfId) { network = undefined; client.close(); } } },
    onError: error => { if (network === client) shell.setStatus(`Verbindung: ${error.message}`, 'error'); },
    onClose: () => { if (network !== client || intentionalClose) return; network = undefined; if (inRace) mounted?.scene.clearMultiplayer(); shell.setStatus('Die Verbindung zum Spielserver wurde getrennt. Bitte kehre zum Menü zurück.', 'error'); },
  }});
  network = client;
}
el<HTMLButtonElement>('[data-action="copy-invitation"]').addEventListener('click', async () => {
  const url = inviteLink.href;
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(url);
      inviteStatus.textContent = 'Einladungslink kopiert.';
    } else if (navigator.share) {
      await navigator.share({ title: 'Super Flasch Bros. 2', url });
      inviteStatus.textContent = 'Einladung geteilt.';
    } else {
      inviteStatus.textContent = 'Bitte den angezeigten Link markieren und kopieren.';
    }
  } catch {
    try {
      if (navigator.share) { await navigator.share({ title: 'Super Flasch Bros. 2', url }); inviteStatus.textContent = 'Einladung geteilt.'; return; }
    } catch { /* The share action was cancelled or failed. */ }
    inviteStatus.textContent = 'Kopieren oder Teilen nicht möglich. Bitte den Link manuell kopieren.';
  }
});
startButton.addEventListener('click', () => network?.start());
el<HTMLButtonElement>('[data-action="leave-lobby"]').addEventListener('click', () => { disconnect(); shell.showView('menu'); shell.setStatus(''); });
gameBackButton.addEventListener('click', () => {
  if (inRace && raceComplete && network) { network.returnToLobby(); return; }
  disconnect(); mounted?.destroy(); mounted = undefined; shell.showView('menu'); shell.setStatus(''); window.scrollTo(0, 0);
});
