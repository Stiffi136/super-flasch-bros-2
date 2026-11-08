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

## Lokaler Moduleditor

Der Editor läuft separat vom Spiel und ohne Spielserver:

```sh
npm ci                 # einmalig, falls noch nicht geschehen
npm run editor
```

Anschließend `http://127.0.0.1:5174/` im Browser öffnen. Der Editor lauscht nur lokal und wird nicht mit dem Spiel auf GitHub Pages veröffentlicht. Im Dev-Container wird Port 5174 weitergeleitet. Module lassen sich als JSON herunterladen und später wieder importieren; es gibt keine automatische Speicherung auf dem Server. **Neues Modul** beginnt einen leeren Entwurf mit neuer ID. **Als neues Modul exportieren** erzeugt eine Kopie mit eigener ID; der normale Export behält die ID und eignet sich zum Aktualisieren einer vorhandenen Datei.

Die ein- und ausblendbare Sprunghilfe zeigt über dem Boden und soliden Blöcken die ungefähre Steighöhe und Kopfreichweite bei gehaltenem Sprung. Sie berücksichtigt weder Hindernisse noch horizontale Bewegung und ist kein Erreichbarkeitsnachweis.

Die Datei beschreibt ein Modul mit Versionskennung, ID, Name, Breite und Rechtecken. Die X-Koordinaten beginnen am linken Modulrand; Y ist relativ zum Boden (`0` = Bodenoberkante, negative Werte liegen darüber). Der Generator stellt den Boden selbst bereit. `solid` kollidiert und erlaubt Wand-/Deckenkontakt, `hazard` ist auf seiner gesamten Rechteckfläche gefährlich, `grip` ist nur eine visuelle Markierung. Checkpoints und Ziel werden vom Generator gesetzt.

### Eigene Module im Spiel verwenden

1. Im Editor ein Modul als JSON exportieren.
2. Die Datei aus dem Download-Ordner nach `modules/` im Projekt kopieren, zum Beispiel `modules/mein-modul.json`. Nur Dateien direkt in diesem Ordner werden geladen.
3. Spiel mit `npm run dev` starten. Nach dem Hinzufügen oder Entfernen einer Datei den Entwicklungsserver neu starten und die Seite neu laden; Änderungen an bestehenden Dateien erfordern ein Neuladen. Für eine Veröffentlichung `npm run build` erneut ausführen und den neuen Build deployen.

Der Generator verwendet ausschließlich die JSON-Module aus `modules/` und mischt sie deterministisch zu 24 Abschnitten. Abhängig von Seed und Anzahl der Dateien kann nicht jedes Modul in jedem Rennen vorkommen. Ein automatischer Checkpoint entfällt, falls der vorgesehene Bereich innerhalb eines Moduls blockiert ist. Mindestens eine gültige Moduldatei ist erforderlich; fehlende, ungültige oder doppelte Modul-IDs werden mit einer Fehlermeldung angezeigt.

Im Multiplayer müssen alle Teilnehmer denselben Spiel-Build und dasselbe Modulset verwenden. Der Server vergleicht beim Lobbybeitritt einen Fingerabdruck und verweigert abweichende Modulsets; dafür muss auch der aktualisierte Server laufen. Der Fingerabdruck schützt nicht vor absichtlicher Manipulation. Eine gültige Datei garantiert weder einen freien Übergang noch die spielerische Lösbarkeit.

## Prüfen und bauen

```sh
npm test
npx vitest run server/test
npx vitest run --config /dev/null client/multiplayer.test.ts
npm run build
npm run build:editor
npm run build:server
```

Der ältere experimentelle Level-Routentest ist derzeit nicht zuverlässig bestanden; er verwendet eine von der Spielphysik getrennte Näherung. Die Lösbarkeit aller generierten Level ist nicht garantiert.

Die Spiel- und Technikziele stehen in `SPEC.md`. Die Implementierung ist ein früher Prototyp; nicht alle Punkte des Specs sind bereits umgesetzt.

## Deployment

Der Workflow `.github/workflows/deploy.yml` baut den Client und veröffentlicht ihn auf GitHub Pages. In den Repository-Einstellungen muss unter Pages **GitHub Actions** als Quelle ausgewählt sein. Der Workflow setzt den Repository-Unterpfad automatisch. Für eine Benutzer-/Organisationsseite im Domainwurzelverzeichnis muss `BASE_PATH` entsprechend auf `/` angepasst werden.

Der Server lässt sich über das `Dockerfile` auf Railway ausführen. Die öffentliche WebSocket-Adresse einschließlich `/ws` (z. B. `wss://beispiel.up.railway.app/ws`) kann als GitHub-Repository-Variable `VITE_SERVER_URL` für den Client-Build hinterlegt werden; ansonsten kann sie im Menü eingegeben werden. Setze am Server `ORIGIN_ALLOWLIST` auf die exakten Browser-Origins, z. B. `https://name.github.io`; lokale Origins sind nur ohne eigene Allowlist voreingestellt. `GET /health` dient als Health-Check. GitHub Pages hostet nur den Client, nicht den Server. Ein tatsächliches Deployment muss noch geprüft werden.
