# Super Flasch Bros. 2

Ein schneller Browser-Plattformer über eine Flasche, einen alten SPS-Visualisierungsbug und dessen Folgen. Der Singleplayer läuft nach dem Laden unabhängig vom Spielserver.

## Voraussetzungen und Start

Node.js 22 und npm werden benötigt. Alternativ das Repository in VS Code öffnen und **Dev Containers: Reopen in Container** auswählen. Der Dev-Container installiert die Abhängigkeiten und leitet die Ports 5173 und 8080 weiter.

```sh
npm ci
npm run dev
```

Die von Vite angezeigte Adresse im Browser öffnen. Für Multiplayer den Spielserver in einem zweiten Terminal starten:

```sh
npm run dev:server
```

Im Mehrspielerkasten Namen und Serveradresse eingeben (`ws://localhost:8080/ws` lokal), dann eine Lobby erstellen. Weitere Spieler treten mit demselben Server und Lobbycode bei. Die Lobby-Leitung startet das Rennen ab 2 Spielern. Wer zuerst das Ziel erreicht, gewinnt; die anderen können weiterlaufen. Für Singleplayer ist kein Server erforderlich.

Das Rennen verwendet clientseitige Spielphysik und überträgt Positionen; es ist **nicht gegen Manipulation geschützt**. Die Reihenfolge der Zieleingänge bestimmt der Server anhand der eingehenden Meldungen. Ein Serverneustart beendet alle Lobbys. Details stehen in `server/README.md`.

## Prüfen und bauen

```sh
npm test
npx vitest run server/test
npx vitest run --config /dev/null client/multiplayer.test.ts
npm run build
npm run build:server
```

Der ältere experimentelle Level-Routentest ist derzeit nicht zuverlässig bestanden; er verwendet eine von der Spielphysik getrennte Näherung. Die Lösbarkeit aller generierten Level ist nicht garantiert.

Die Spiel- und Technikziele stehen in `SPEC.md`. Die Implementierung ist ein früher Prototyp; nicht alle Punkte des Specs sind bereits umgesetzt.

## Deployment

Der Workflow `.github/workflows/deploy.yml` baut den Client und veröffentlicht ihn auf GitHub Pages. In den Repository-Einstellungen muss unter Pages **GitHub Actions** als Quelle ausgewählt sein. Der Workflow setzt den Repository-Unterpfad automatisch. Für eine Benutzer-/Organisationsseite im Domainwurzelverzeichnis muss `BASE_PATH` entsprechend auf `/` angepasst werden.

Der Server lässt sich über das `Dockerfile` auf Railway ausführen. Die öffentliche WebSocket-Adresse einschließlich `/ws` (z. B. `wss://beispiel.up.railway.app/ws`) kann als GitHub-Repository-Variable `VITE_SERVER_URL` für den Client-Build hinterlegt werden; ansonsten kann sie im Menü eingegeben werden. Setze am Server `ORIGIN_ALLOWLIST` auf die exakten Browser-Origins, z. B. `https://name.github.io`; lokale Origins sind nur ohne eigene Allowlist voreingestellt. `GET /health` dient als Health-Check. GitHub Pages hostet nur den Client, nicht den Server. Ein tatsächliches Deployment muss noch geprüft werden.
