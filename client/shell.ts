export type BottleId = "amber" | "mint" | "berry";

export interface ShellCallbacks {
  /** Starts a local run. This callback must not require a server connection. */
  onStartSingleplayer: (bottle: BottleId) => void | Promise<void>;
  /** Requests a new private multiplayer lobby. */
  onCreateLobby: (bottle: BottleId) => void | Promise<void>;
  /** Requests entry to a lobby using the entered code. */
  onJoinLobby: (code: string, bottle: BottleId) => void | Promise<void>;
}

export interface ShellElements {
  root: HTMLElement;
  gameMount: HTMLElement;
  status: HTMLElement;
  bottleInputs: HTMLInputElement[];
  lobbyCodeInput: HTMLInputElement;
  /** Show the menu or the game mount without making assumptions about the game. */
  showView: (view: "menu" | "lobby" | "game") => void;
  /** Set an accessible status message, for example a lobby error or connection state. */
  setStatus: (message: string, kind?: "info" | "error" | "success") => void;
  /** Returns the currently selected bottle. */
  getSelectedBottle: () => BottleId;
}

const bottleData: Array<{ id: BottleId; name: string; note: string; shape: string }> = [
  { id: "amber", name: "Klara Kola", note: "Die flinke Klassikerin", shape: "classic" },
  { id: "mint", name: "Minz-Mats", note: "Frisch an jeder Decke", shape: "mint" },
  { id: "berry", name: "Beeren-Bert", note: "Mit extra Sprunglaune", shape: "berry" },
];

/** Mounts the menu shell in `container` and returns controls for game integration. */
export function renderShell(container: HTMLElement, callbacks: ShellCallbacks): ShellElements {
  const root = document.createElement("div");
  root.className = "sfb-shell";
  root.innerHTML = `
    <header class="topbar">
      <a class="wordmark" href="#start" aria-label="Super Flasch Bros. 2 – Startseite">
        <span class="brand-mark" aria-hidden="true">✦</span><span>SUPER FLASCH <b>BROS. 2</b></span>
      </a>
      <span class="edition"><i aria-hidden="true"></i> BROWSER-PLATTFORMER</span>
    </header>
    <main id="start">
      <section class="hero" aria-labelledby="hero-title">
        <div class="hero-copy">
          <p class="eyebrow"><span class="sparkle" aria-hidden="true">✳</span> HALT DICH FEST. LASS DICH FALLEN.</p>
          <h1 id="hero-title">Eine Flasche.<br><em>Viele Wege.</em></h1>
          <p class="hero-lede">Spring, rutsch und hangel dich kopfüber ins Abenteuer. Dein nächstes Level wartet schon.</p>
          <div class="hero-actions">
            <button class="button button-primary" type="button" data-action="single">Allein losflaschen <span aria-hidden="true">↗</span></button>
            <a class="text-link" href="#zusammen">Oder zusammen spielen <span aria-hidden="true">↓</span></a>
          </div>
          <div class="hero-meta"><span class="local-dot" aria-hidden="true"></span> Einzelspieler läuft komplett lokal – kein Server nötig.</div>
        </div>
        <div class="hero-art" aria-label="Illustration einer fröhlichen Flasche auf einer Plattform" role="img">
          <div class="orbit orbit-one"></div><div class="orbit orbit-two"></div>
          <span class="star star-a" aria-hidden="true">✦</span><span class="star star-b" aria-hidden="true">✳</span>
          <div class="platform platform-top"></div><div class="platform platform-bottom"></div>
          <div class="bottle-figure" aria-hidden="true"><div class="bottle-cap"></div><div class="bottle-neck"></div><div class="bottle-body"><span class="bottle-label">POP!<small>100% SPRUDEL</small></span><span class="bottle-eye eye-one"></span><span class="bottle-eye eye-two"></span><span class="bottle-smile"></span></div><span class="limb arm-left"></span><span class="limb arm-right"></span><span class="limb leg-left"></span><span class="limb leg-right"></span></div>
          <div class="art-caption"><span>SEIT DEM ERSTEN BUG</span><b>MIT HALTUNG.</b></div>
          <span class="art-sticker">100%<br>SPRITZIG</span>
        </div>
      </section>

      <section class="selection-section" aria-labelledby="bottle-heading">
        <div class="section-heading"><div><p class="eyebrow">DEIN TEAM, DEINE WAHL</p><h2 id="bottle-heading">Wen nimmst du mit?</h2></div><p>Alle Flaschen spielen fair<br>mit denselben Fähigkeiten.</p></div>
        <fieldset class="bottle-picker"><legend class="visually-hidden">Wähle deine Flasche</legend>
          ${bottleData.map((bottle, index) => `<label class="bottle-card ${index === 0 ? "selected" : ""}" data-bottle-card="${bottle.id}">
            <input type="radio" name="sfb-bottle" value="${bottle.id}" ${index === 0 ? "checked" : ""} aria-label="${bottle.name}: ${bottle.note}">
            <span class="card-check" aria-hidden="true">✓</span><span class="mini-bottle mini-${bottle.shape}" aria-hidden="true"><i></i><b></b><em></em></span>
            <span class="bottle-name">${bottle.name}</span><span class="bottle-note">${bottle.note}</span>
          </label>`).join("")}
        </fieldset>
      </section>

      <section class="play-section" id="zusammen" aria-labelledby="play-heading">
        <div class="play-intro"><p class="eyebrow">ZUSAMMEN ODER SOLO</p><h2 id="play-heading">Dein nächster<br>Durchlauf beginnt hier.</h2><p>Such dir eine Flasche aus. Den Rest macht der Zufall – oder ihr gemeinsam.</p></div>
        <div class="mode-card single-card"><div class="mode-icon" aria-hidden="true">↗</div><div class="mode-content"><span class="mode-kicker">SOFORT SPIELEN</span><h3>Einzelspieler</h3><p>Ein neues Level, direkt in deinem Browser. Keine Lobby, kein Server.</p><button class="button button-dark" type="button" data-action="single">Level starten <span aria-hidden="true">→</span></button></div><span class="mode-number" aria-hidden="true">01</span></div>
        <div class="mode-card multi-card"><div class="mode-icon multi-icon" aria-hidden="true">◎</div><div class="mode-content"><span class="mode-kicker">2–8 SPIELER · PRIVATES RENNEN</span><h3>Mit Freunden</h3><p>Gemeinsames Level, schneller ins Ziel. Wähle vorher deine Flasche.</p><label class="multi-field">Dein Name<input data-player-name maxlength="20" autocomplete="nickname" placeholder="Flaschenpilot" value="Flaschenpilot"></label><label class="multi-field">Spielserver (WebSocket)<input data-server-url type="url" spellcheck="false" placeholder="wss://dein-server/ws"></label><div class="multi-actions"><button class="button button-light" type="button" data-action="create">Lobby erstellen</button><form class="join-form" data-join-form><label class="visually-hidden" for="sfb-lobby-code">Lobbycode</label><input id="sfb-lobby-code" type="text" maxlength="16" autocomplete="off" placeholder="LOBBYCODE" aria-label="Lobbycode" spellcheck="false"><button class="join-button" type="submit" aria-label="Mit Lobbycode beitreten">Beitreten <span aria-hidden="true">→</span></button></form></div></div><span class="mode-number" aria-hidden="true">02</span></div>
      </section>

      <section class="story-strip" aria-labelledby="story-heading"><div class="story-badge" aria-hidden="true">DAMALS<br><b>→</b><br>HEUTE</div><div><p class="eyebrow">EINE KLEINE GESCHICHTE</p><h2 id="story-heading">Aus einem Bug wurde ein Griff.</h2><p>Der Vorgänger entstand vor vielen Jahren als kleine SPS-Anwendung in einem Visualisierungstool. Eine Flasche suchte sich ihren Weg durchs Level – und ein Bug ließ sie an Wänden und Decken haften. Das fühlte sich so besonders an, dass es jetzt zur Fähigkeit wird: Im Nachfolger hält sich die Flasche fest und hangelt an der Decke entlang.</p></div><span class="story-doodle" aria-hidden="true">〰</span></section>

      <section class="controls" aria-labelledby="controls-heading"><div><p class="eyebrow">TASTATUR BEREIT?</p><h2 id="controls-heading">Gut zu wissen.</h2></div><ul class="key-list"><li><span class="key">A</span><span class="key">D</span><span class="key-alt">oder</span><span class="key">←</span><span class="key">→</span><span>Bewegen</span></li><li><span class="key key-wide">LEERTASTE</span><span>Springen</span></li><li><span class="key key-wide">SHIFT</span><span>Rutschen / Loslassen</span></li><li><span class="key key-wide">AUTO</span><span>Wand und Decke greifen</span></li><li><span class="key">R</span><span>Neustart am Checkpoint</span></li></ul></section>
    </main>
    <footer class="footer"><span>SUPER FLASCH BROS. 2</span><span>Mit beiden Füßen auf dem Boden? Langweilig.</span><span>✦</span></footer>
    <div class="shell-status" role="status" aria-live="polite" aria-atomic="true"></div>
    <section class="lobby-view" hidden aria-label="Multiplayer-Lobby"><div class="game-toolbar"><button class="back-button" type="button" data-action="leave-lobby">← Lobby verlassen</button><span class="game-label">PRIVATES RENNEN</span></div><div class="lobby-panel"><p class="eyebrow">BEREIT ZUM RENNEN?</p><h2>Lobby <strong data-lobby-code>------</strong></h2><p>Teile den Code und die Serveradresse mit deinen Freunden. Die Lobby-Leitung startet das Rennen.</p><ul class="lobby-players" data-lobby-players></ul><p data-lobby-message role="status"></p><button class="button button-dark" type="button" data-action="start-race" disabled>Rennen starten →</button></div></section>
    <section class="game-view" hidden aria-label="Spielbereich"><div class="game-toolbar"><button class="back-button" type="button" data-action="menu">← Zurück zum Menü</button><span class="game-label">SUPER FLASCH BROS. 2</span></div><div class="game-mount" data-game-mount aria-label="Spiel"></div></section>
  `;
  container.replaceChildren(root);

  const bottleInputs = Array.from(root.querySelectorAll<HTMLInputElement>('input[name="sfb-bottle"]'));
  const lobbyCodeInput = root.querySelector<HTMLInputElement>("#sfb-lobby-code")!;
  const status = root.querySelector<HTMLElement>(".shell-status")!;
  const menu = root.querySelector<HTMLElement>("main")!;
  const gameView = root.querySelector<HTMLElement>(".game-view")!;
  const lobbyView = root.querySelector<HTMLElement>(".lobby-view")!;
  const gameMount = root.querySelector<HTMLElement>("[data-game-mount]")!;
  const getSelectedBottle = (): BottleId => (bottleInputs.find((input) => input.checked)?.value ?? "amber") as BottleId;
  status.hidden = true;
  const setStatus = (message: string, kind: "info" | "error" | "success" = "info") => {
    status.textContent = message;
    status.dataset.kind = kind;
    status.hidden = !message;
  };
  const showView = (view: "menu" | "lobby" | "game") => {
    const isMenu = view === "menu";
    menu.hidden = !isMenu;
    root.querySelector<HTMLElement>(".topbar")!.hidden = !isMenu;
    root.querySelector<HTMLElement>(".footer")!.hidden = !isMenu;
    gameView.hidden = view !== "game";
    lobbyView.hidden = view !== "lobby";
  };

  bottleInputs.forEach((input) => input.addEventListener("change", () => {
    root.querySelectorAll<HTMLElement>("[data-bottle-card]").forEach((card) => card.classList.toggle("selected", card.dataset.bottleCard === input.value));
  }));

  const run = async (action: () => void | Promise<void>, label: string) => {
    setStatus(`${label} wird vorbereitet …`);
    try { await action(); }
    catch (error) { setStatus(error instanceof Error ? error.message : "Das hat gerade nicht geklappt. Bitte versuch es noch einmal.", "error"); }
  };
  root.querySelectorAll<HTMLButtonElement>('[data-action="single"]').forEach((button) => button.addEventListener("click", () => {
    setStatus("Dein lokales Level wird vorbereitet …");
    void run(() => callbacks.onStartSingleplayer(getSelectedBottle()), "Einzelspieler");
  }));
  root.querySelector<HTMLButtonElement>('[data-action="create"]')!.addEventListener("click", () => void run(() => callbacks.onCreateLobby(getSelectedBottle()), "Lobby"));
  root.querySelector<HTMLFormElement>("[data-join-form]")!.addEventListener("submit", (event) => {
    event.preventDefault();
    const code = lobbyCodeInput.value.trim();
    if (!code) { lobbyCodeInput.focus(); setStatus("Gib zuerst einen Lobbycode ein.", "error"); return; }
    void run(() => callbacks.onJoinLobby(code, getSelectedBottle()), "Lobbybeitritt");
  });
  root.querySelector<HTMLButtonElement>('[data-action="menu"]')!.addEventListener("click", () => showView("menu"));

  return { root, gameMount, status, bottleInputs, lobbyCodeInput, showView, setStatus, getSelectedBottle };
}
