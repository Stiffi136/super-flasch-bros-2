# Super Flasch Bros. 2 – Vorläufiger Spiel- und Technik-Spec

**Status:** Entwurf, noch nicht implementiert  
**Ziel:** Grundlage für Spielentwicklung, Prototyping und spätere Entscheidungen  
**Arbeitstitel:** Super Flasch Bros. 2  
**Verbindliche Technologieentscheidung:** TypeScript für Client, Server und gemeinsam genutzte Spiellogik

## 1. Spielidee

Super Flasch Bros. 2 ist ein schneller 2D-Plattformer für den Browser. Die Spielerfigur ist eine Flasche mit beweglichen Gliedmaßen. Ziel ist es, ein prozedural erzeugtes Level vom Start bis zum Ziel zu durchqueren.

Der Vorgänger entstand als SPS-Anwendung in einem Visualisierungstool. Ein ursprünglicher Bug, durch den die Figur an Wänden und Decken haften konnte, wird im Nachfolger zu einer bewussten Kernmechanik. Das Spiel verbindet dieses Haften mit präzisen Sprüngen, schnellem Rutschen und Wall Jumps.

### Leitziele

- **Direkte Kontrolle:** Eingaben reagieren unmittelbar und Bewegungen bleiben vorhersehbar.
- **Lesbare Herausforderungen:** Oberflächen, Gefahren und erreichbare Wege sind gut erkennbar.
- **Ausdrucksstarke Figuren:** Drei auswählbare Flaschen erhalten animierte Gliedmaßen.
- **Gemeinsam spielen:** Mehrere Personen können ein Level über das Netzwerk spielen.
- **Abwechslung:** Ein Seed erzeugt reproduzierbare Levelvarianten.
- **Niedrige Einstiegshürde:** Der Client läuft ohne Installation im Browser.

## 2. Umfang des ersten spielbaren MVP

Der MVP soll den Kernspaß und die technische Machbarkeit beweisen, nicht bereits das vollständige Spiel darstellen.

### Enthalten

- Zwei Spielmodi: ein vollständig clientseitiger Singleplayer-Modus und ein gemeinsamer Leveldurchlauf in einer privaten Lobby.
- Singleplayer benötigt nach dem Laden des Clients keine Verbindung zum Spielserver. Ist der Server nicht erreichbar, bleiben Startseite und Singleplayer spielbar. Ein erstmaliger Seitenaufruf benötigt grundsätzlich eine Verbindung zum statischen Hosting; Offline-Installation oder Offline-Start nach erneutem Laden sind im MVP nicht zugesagt.
- Vorläufig **2–4 Spieler** pro Lobby; diese Zahl ist eine Planungsannahme.
- Start, Ziel, feste Oberflächen, Abgründe und mindestens eine klar erkennbare Gefahrenart.
- Prozedurale Level aus handgebauten, validierten Segmenten; identischer Seed für alle Spieler.
- Drei auswählbare Flaschen mit zunächst gleichen Spieleigenschaften.
- Laufen, Springen, Rutschen, Wand- und Deckenhaften, Wall Jumps und ein kontrollierter Neustart nach einem Fehlversuch.
- Einfache prozedurale Arm- und Beinanimation mittels inverser Kinematik.
- Startseite mit einer kurzen Geschichte des Vorgängers, Lobby, Start eines Durchlaufs, Fortschrittsanzeige und Abschlussbildschirm.
- Server über WebSocket in Docker auf Railway; statischer Client auf GitHub Pages.
- Desktop-Tastatur als verbindliches Eingabegerät; Gamepad und Touch sind spätere Erweiterungen.

### Zunächst nicht enthalten

- Account-System, Matchmaking, Ranglisten und dauerhafte Speicherung.
- Kampf, Gegenstände, Fähigkeiten mit Einfluss auf die Balance oder ein Level-Editor.
- Komplexe zerstörbare Physik, serverübergreifende Spielräume und garantierte Cheat-Sicherheit.
- Native Mobile-Apps und ein für Touch optimiertes Steuerungslayout.

## 3. Startseite und Geschichte des Vorgängers

Die Startseite stellt das Spiel kurz vor und zeigt eine kurze Geschichte seiner Entstehung. Der Text soll auch auf einem Smartphone gut lesbar sein und den Zugang zum Spiel nicht verdecken.

**Vorläufiger Text:**

> Der Vorgänger von Super Flasch Bros. 2 entstand vor vielen Jahren als kleine SPS-Anwendung. In einem Visualisierungstool wurde eine Flasche zur Spielfigur, die ihren Weg durch ein Level finden musste. Ein Bug ließ sie an Wänden und Decken haften – und machte das Spiel dadurch erst richtig besonders. Im Nachfolger wird aus diesem Zufall eine gewollte Fähigkeit: Die Flasche kann sich wieder festhalten und an Decken entlanghangeln.

Der Text kann später anhand weiterer Erinnerungen oder Originalmaterialien angepasst werden. Klar sichtbare Einstiege führen von der Startseite zum Singleplayer und zur Multiplayer-Lobby.

## 4. Spielablauf und Spielmodi

### Singleplayer

Auf der Startseite kann eine Person direkt ein Einzelspieler-Level starten und eine der drei Flaschen wählen. Der Client erzeugt das Level lokal, simuliert Bewegung, Kollisionen, Checkpoints und Zielankunft und zeigt den Abschlussbildschirm. Für all dies sind weder Lobby noch WebSocket-Verbindung oder laufender Spielserver erforderlich. Die gemeinsamen Bewegungs- und Generierungsregeln entsprechen denen des Mehrspielermodus. Der Seed kann lokal erzeugt werden; ein manueller Seed ist zunächst optional.

### Multiplayer

1. Eine Person erstellt eine private Lobby und erhält einen teilbaren Lobbycode oder Link.
2. Weitere Personen treten bei und wählen eine der drei Flaschen. Mehrere Personen dürfen dieselbe Flasche wählen; Namens- oder Farbmarkierungen unterscheiden sie.
3. Die Lobby-Leitung startet den Durchlauf. Der Server legt den Seed und die Levelversion fest.
4. Alle Spieler starten im selben Level. Sie können sich sehen, behindern sich aber im MVP nicht gegenseitig.
5. Wer eine Gefahr berührt oder die Spielfläche verlässt, startet am letzten aktivierten Checkpoint neu. Bis ein Checkpoint existiert, ist das der Levelstart.
6. **Vorläufiger Abschluss:** Der Durchlauf endet, wenn alle verbundenen Spieler das Ziel erreicht haben oder die Lobby-Leitung ihn beendet. Eine Zielankunft wird für den Spieler festgehalten.
7. Der Abschlussbildschirm zeigt zumindest Zielankunft und Fehlversuche; Zeitmessung ist eine optionale Erweiterung.

**Offene Produktentscheidung:** Soll der Modus kooperativ, kompetitiv oder beides sein? Die obigen Regeln sind ein kooperativer Ausgangspunkt, kein endgültiges Design.

## 5. Figuren und Darstellung

### Flaschen

Zum Start gibt es drei visuell unterscheidbare Flaschen-Sprites. Namen, Form, Farbe und Stil werden in einer separaten Art-Direction-Phase festgelegt. Die Figuren haben zunächst identische Hitboxen und Bewegungswerte; die Wahl ist kosmetisch. So bleiben Level und Multiplayer fair und leichter testbar.

Die Darstellung besteht aus Flaschenkörper, Gesicht und je zwei Armen und Beinen. Der Körper kann ein Sprite sein; Gliedmaßen dürfen aus Linien, Einzelteilen oder Sprites zusammengesetzt werden.

### Inverse Kinematik

- Arme und Beine besitzen je einen Ansatzpunkt am Körper, ein Gelenk und einen Endpunkt.
- Ein einfacher analytischer 2-Bone-IK-Solver positioniert Hände und Füße anhand von Zielpunkten; Zielpunkte außerhalb der Reichweite werden begrenzt.
- Zielpunkte hängen von Bewegungszustand, Geschwindigkeit und erkannten Kontaktflächen ab: Laufen, Luft, Rutschen, Wand- und Deckenhaften.
- Die Gliedmaßen sind im MVP rein visuell. Sie verändern weder Hitbox noch Kollision oder erreichbare Flächen.
- Eine vereinfachte Darstellung ohne IK muss möglich bleiben, falls Leistung oder Lesbarkeit leiden.

## 6. Steuerung und Bewegung

### Eingaben für den ersten Prototyp

| Aktion | Tastatur, vorläufig |
|---|---|
| Nach links / rechts bewegen | A/D oder Pfeiltasten |
| Springen | Leertaste |
| Rutschen / Haften lösen | Umschalt-Taste halten |
| An geeigneter Wand oder Decke haften | Automatisch beim Kontakt |
| Manueller Neustart am Checkpoint | R |

Alle Belegungen sind Platzhalter. Tastenbelegung und Eingaben müssen später konfigurierbar und mit der Bewegungsmechanik abgestimmt werden. Browser-Standardaktionen für verwendete Spieltasten werden während des aktiven Spiels soweit erforderlich unterdrückt; Texteingaben in der Lobby bleiben benutzbar.

### Bewegungsregeln

- **Laufen:** Schnelle horizontale Beschleunigung, definierte Höchstgeschwindigkeit und starke, kontrollierbare Richtungswechsel.
- **Springen:** Sprunghöhe hängt innerhalb definierter Grenzen von der Haltedauer ab. Die Figur fällt schneller, als sie aufsteigt.
- **Fehlertoleranz:** Kurzes Coyote-Time-Fenster nach Verlassen einer Kante und Jump-Buffer kurz vor einer Landung. Beide Werte sind einstellbar.
- **Rutschen:** Bewegung am Boden mit eigener Beschleunigung und Reibung. Die Flasche behält ihre Form und neigt sich deutlich nach hinten; ihre Hitbox bleibt unverändert. Niedrige Durchgänge erfordern daher eine spätere eigenständige Designentscheidung.
- **Wandhaften:** Bei Kontakt zu einer haftbaren Wand hält sich die Figur automatisch fest. Mit gehaltener Rutschtaste löst sie den Griff und rutscht nach unten. Ein Wandsprung bleibt möglich.
- **Wall Jump:** Ein Sprung aus Wandkontakt oder Haftzustand stößt die Figur zuverlässig von der Wand weg. Die kurzzeitige horizontale Kontrolle wird separat abgestimmt.
- **Deckenhaften und Hangeln:** Bei Kontakt zu einer haftbaren Decke hält sich die Figur automatisch fest. Mit der horizontalen Bewegungseingabe hangelt sie sich nach links oder rechts entlang der Decke. Die Hände greifen dabei visuell zur Decke; die IK-Animation beeinflusst weder Kollision noch Bewegung. Die Rutschtaste löst den Griff, sodass die Figur fällt; solange sie gehalten wird, greift die Figur nicht erneut. Das Hangeln ist eine verbindliche Kernmechanik und erinnert an den Bug des ursprünglichen Spiels.
- **Zustandswechsel:** Boden, Luft, Wandhaften, Deckenhaften, Rutschen, Tod und Zielzustand werden explizit behandelt. Übergänge müssen auch an Ecken und bei gleichzeitigem Kontakt konsistent sein.
- **Kein Ausdauersystem im MVP:** Haften ist zeitlich unbegrenzt, sofern das Level nichts anderes vorgibt.

### Anforderungen an das Spielgefühl

Super Meat Boy dient als Referenz für Direktheit und Präzision, nicht als Vorgabe zum Kopieren konkreter Werte. Beschleunigung, Abbremsen, Fallgeschwindigkeit, Sprunghöhe, Wall-Jump-Impuls und Toleranzfenster sind zentral konfigurierbar. Sie werden anhand spielbarer Prototypen festgelegt.

Die Simulation läuft in einem festen Zeitschritt. Darstellung und Animation dürfen mit der Bildwiederholrate interpolieren, ohne das Bewegungsverhalten daran zu koppeln. Eingaben sollen nach Möglichkeit sofort lokal sichtbar sein; Netzwerklatenz darf die lokale Steuerung nicht unnötig verzögern.

## 7. Levelgenerierung

### Zielbild

Jeder Durchlauf erhält einen Seed. Gleicher Seed, gleiche Generatorversion und gleiche Spielregeln erzeugen dieselbe Levelstruktur. Ein Seed allein garantiert keine Kompatibilität zwischen unterschiedlichen Generatorversionen.

### MVP-Verfahren

1. Im Singleplayer legt der Client Seed, Generatorversion und Regelparameter lokal fest. Im Multiplayer legt der Server sie fest.
2. Ein deterministischer Generator setzt handgebaute Segmente mit definierten Ein- und Ausgängen zusammen.
3. Segmente enthalten Metadaten zu Verbindungen, Oberflächen, Gefahren, Checkpoints und benötigten Bewegungsfähigkeiten.
4. Der Generator prüft strukturelle Verbindungen sowie vorab definierte Erreichbarkeitsbedingungen. Ungültige Kandidaten werden verworfen; die Zahl der Versuche ist begrenzt.
5. Schlägt die Generierung wiederholt fehl, wird auf ein bekanntes gültiges Level zurückgegriffen und dies protokolliert.
6. Im Multiplayer sendet der Server Seed, Version und einen Hash der kanonisch serialisierten Leveldaten. Der Client erzeugt dieselben Daten und prüft den Hash; bei Abweichung wird der Start mit verständlicher Fehlermeldung verhindert. Im Singleplayer entfallen Serverabgleich und Netzwerkverbindung.

**Wichtig:** Strukturprüfungen allein beweisen keine spielerische Lösbarkeit. Segmentübergänge werden zusätzlich mit den tatsächlichen Bewegungswerten automatisiert und manuell getestet. Eine vollständige mathematische Lösbarkeitsgarantie ist für den MVP nicht zugesagt.

### Gestaltungsregeln

- Lesbare Start- und Zielbereiche sowie eine nachvollziehbare Hauptroute.
- Frühzeitiges Einführen der benötigten Mechaniken vor anspruchsvolleren Kombinationen.
- Checkpoints in angemessenen Abständen; genaue Platzierung wird getestet.
- Gefahren und haftbare Flächen sind auch ohne Farbwahrnehmung unterscheidbar.
- Schwierigkeit, Segmentanzahl und Checkpoint-Abstände sind konfigurierbare Parameter.

## 8. Technische Architektur

### Client

- TypeScript und Phaser 3 als Browser-Engine; Phaser übernimmt Darstellung, Szenen, Eingaben und gegebenenfalls geeignete Kollisionserkennung.
- TypeScript wird mit aktivierter strikter Typprüfung verwendet. Der Build und die automatisierten Prüfungen melden Typfehler.
- Build als statische Dateien, zum Beispiel mit Vite.
- Szenen oder gleichwertige Zustände für Hauptmenü, Lobby, Spiel und Abschluss.
- Geteilte, möglichst reine Spiellogik für Bewegungsregeln, Levelgenerator und Datentypen.
- Die sichtbare lokale Figur nutzt Prediction; andere Figuren werden anhand von Serverzuständen interpoliert.

### Server

- Node.js mit TypeScript und WebSocket-Server, z. B. `ws`; kein Phaser-Renderer auf dem Server.
- Autoritative Verwaltung von Lobbys, Spielzuständen, Seed, Checkpoints und Zielankünften.
- Fester Simulationstakt. Der Server verarbeitet gültige Spielereingaben und prüft Zustandsübergänge; Clients übermitteln keine verbindlichen Positionen.
- Serverseitige Validierung von Nachrichtenformat, Größe, Rate und Raumzugehörigkeit. Ungültige Nachrichten werden verworfen; Missbrauch wird begrenzt.
- Flüchtiger In-Memory-Zustand für den MVP. Ein Neustart oder eine Ersetzung der Instanz beendet laufende Lobbys; persistente Sitzungen und mehrere Instanzen sind nicht zugesagt.
- HTTP-Endpunkt für Health-Checks und WebSocket-Upgrade am von der Hosting-Umgebung vorgegebenen Port.

### Geteilte Simulation

Bewegung, Kollisionsregeln und Leveldaten müssen auf Client und Server dieselbe fachliche Grundlage verwenden. Phaser-Arcade-Physik darf nicht stillschweigend nur auf dem Client laufen, wenn der Server autoritativ sein soll. Vor Implementierung wird entschieden, ob eine gemeinsame, engine-unabhängige Kollisions- und Bewegungsbibliothek oder eine nachweislich serverseitig nutzbare Lösung eingesetzt wird.

Ein fester Zeitschritt allein garantiert keine bitgenaue Deterministik auf allen JavaScript-Laufzeiten. Der MVP nutzt serverseitige Korrekturen und testet Abweichungen; Seed und Hash sichern die Übereinstimmung der Leveldaten, nicht automatisch jede Physikberechnung.

### Vorgeschlagene Projektstruktur

```text
client/       Phaser-Spiel und Benutzeroberfläche
server/       HTTP-/WebSocket-Server und Raumverwaltung
shared/       Protokoll, Bewegungsregeln und Levelgenerator
assets/       Bilder, Audio und Quelldateien
```

Die tatsächliche Struktur und Paketverwaltung werden bei der Einrichtung festgelegt.

## 9. Netzwerkprotokoll und Synchronisation

- Transport: WebSocket; in Produktion `wss://` über HTTPS. Lokal kann `ws://` verwendet werden.
- Jede Nachricht hat einen Typ und eine Protokollversion. Client und Server teilen sich TypeScript-Protokolltypen. Eingehende Payloads werden zusätzlich zur Laufzeit validiert und als nicht vertrauenswürdig behandelt; TypeScript allein prüft keine Netzwerkdaten.
- Der Client sendet Eingaben mit fortlaufender Sequenznummer, etwa Richtung sowie Sprung-, Rutsch- und Haftzustand. Der Server verarbeitet sie nach definierten Tick-Regeln.
- Der Server sendet regelmäßige Snapshots mit Server-Tick, Spielerzuständen und zuletzt verarbeiteter Eingabesequenz. Lobby- und Spielereignisse werden separat übertragen.
- Der lokale Client simuliert Eingaben voraus, vergleicht Serverzustände und führt noch nicht bestätigte Eingaben erneut aus. Korrekturen sollen sichtbar möglichst wenig stören, ohne gültige Kollisionen zu verletzen.
- Andere Figuren werden mit kleinem Interpolationspuffer dargestellt. Zielwerte für Tickrate, Snapshotrate und Puffer werden im Prototyp unter realistischen Netzbedingungen ermittelt.
- Bei Verbindungsabbruch wird der Spielerstatus kenntlich gemacht. **MVP-Annahme:** Wiederverbindung erfolgt über erneuten Lobbybeitritt; eine nahtlose Wiederaufnahme ist nicht garantiert. Die Zielregel bei Abbruch wird noch festgelegt.
- Latenz, Paketverzögerung und Verbindungsverlust werden getestet. WebSocket nutzt TCP: Verzögerte Daten können spätere Daten aufhalten; Prediction behebt keine dauerhafte Verbindungsstörung.

## 10. Deployment und Betrieb

### GitHub Pages

- Der Client wird als statischer Build über GitHub Actions veröffentlicht.
- Der Build berücksichtigt den Repository-Unterpfad über eine passende Base-URL; Assets werden nicht ungeprüft relativ zur Domainwurzel geladen.
- Die öffentliche Server-URL wird per Build-Konfiguration gesetzt. Sie ist kein Geheimnis.
- Ein sauberer Fehlerzustand erklärt, wenn der Server nicht erreichbar ist oder Client und Server inkompatible Versionen verwenden. Der Singleplayer bleibt davon unabhängig nutzbar.

### Railway

- Der Server wird aus einem Dockerfile gebaut und als Railway-Service betrieben.
- Er bindet an `0.0.0.0` und den per `PORT` vorgegebenen Port. Derselbe Dienst beantwortet Health-Checks und WebSocket-Upgrades.
- HTTPS/WSS-Terminierung und WebSocket-Unterstützung der gewählten Railway-Konfiguration werden beim Deployment praktisch geprüft.
- Origin-Prüfung erfolgt über eine konfigurierte Allowlist, etwa für die GitHub-Pages-Adresse und lokale Entwicklung. Lobbycodes sind keine Zugangskontrolle gegen gezielte Angriffe.
- Keine Secrets im Client oder im Repository. Betriebsparameter und gegebenenfalls Secrets kommen aus der Serverumgebung.
- Logs enthalten technische Fehler und Ereignisse, aber keine unnötigen personenbezogenen Daten. Hostingkosten, Schlafverhalten und Ressourcenlimits hängen vom gewählten Railway-Tarif ab und werden vor Veröffentlichung geprüft.

## 11. Qualitätsziele und Tests

| Bereich | Vorläufiges Abnahmekriterium |
|---|---|
| Steuerung | Alle Kernaktionen funktionieren konsistent bei unterschiedlichen Bildwiederholraten; keine bekannten Blocker an Wand-/Deckenecken in den Testleveln. |
| Simulation | Unit-Tests decken zentrale Zustandsübergänge, Pufferzeiten, Respawn und Kollisionen ab. Client und Server verwenden dieselben Regeln. |
| Generierung | Eine definierte Seed-Suite erzeugt reproduzierbar identische Leveldaten und den gleichen Hash; Fallback und Fehlermeldung bei Versionsabweichung funktionieren. |
| Spielbarkeit | Testpersonen können jedes freigegebene Segment und seine vorgesehenen Übergänge mit den aktuellen Bewegungswerten bewältigen. |
| Singleplayer | Nach dem Laden des Clients lässt sich bei nicht erreichbarem Spielserver ein Level starten, spielen und abschließen; es wird keine Serververbindung benötigt. |
| Multiplayer | 2–4 Browser können derselben Lobby beitreten, dieselbe Levelversion sehen, unabhängig sterben und das Ziel erreichen. |
| Netzwerk | Prediction und Korrektur werden mit künstlicher Latenz, Jitter und Verbindungsabbrüchen geprüft; akzeptable Grenzwerte werden nach Prototyping festgelegt. |
| Betrieb | Ein per GitHub Pages ausgelieferter Build verbindet sich per WSS mit einem auf Railway laufenden Docker-Service. |
| Zugänglichkeit | Kernelemente sind nicht allein durch Farbe unterscheidbar; Bedienelemente und Fehlertexte sind lesbar. |

Zielbrowser sind aktuelle Desktop-Versionen von Chrome, Firefox und Safari, soweit verfügbar. Konkrete Mindestversionen und Leistungsbudgets werden später festgelegt.

## 12. Empfohlene Meilensteine

1. **Movement-Vertical-Slice:** Eine Flasche, handgebauter Testraum, alle Kernbewegungen und zentral einstellbare Werte; zuerst lokal testen.
2. **Figuren und IK:** Drei wählbare Erscheinungsbilder, visuelle Gliedmaßen und Animationen ohne Einfluss auf die Physik.
3. **Netzwerkfundament:** Gemeinsame Simulation, autoritativer Server, Lobby, Prediction und Korrektur in einem festen Testlevel.
4. **Generierung:** Segmentbibliothek, Seed, Hash, Validierung, Fallback und Checkpoints.
5. **Deployment und Härtung:** Docker, Railway, GitHub Actions/Pages, Tests unter Netzwerkstörungen und verständliche Fehlerzustände.

Diese Reihenfolge ist ein Vorschlag. Spätestens vor Abschluss des ersten Meilensteins sollte ein technischer Netzwerk-Spike die Tragfähigkeit der gemeinsamen Simulation prüfen.

## 13. Offene Entscheidungen

1. **Spielmodus:** Kooperativer Durchlauf, Wettrennen, optional beides oder ein anderes Ziel?
2. **Lobbygröße und Abschluss:** Wie viele Personen sollen gleichzeitig spielen und wann endet ein Level, besonders nach Verbindungsabbrüchen?
3. **Haften:** Automatisches Greifen und Lösen mit der Rutschtaste sind gesetzt. Soll die Haftdauer unbegrenzt sein und auch Bewegung entlang von Wänden möglich sein?
4. **Rutschen:** Die Flasche bleibt beim Rutschen ungestaucht und die Hitbox zunächst unverändert. Sollen niedrige Durchgänge später gesondert unterstützt werden?
5. **Checkpoints:** Wo und wie häufig? Sollen Spieler unabhängig oder gemeinsam respawnen?
6. **Zielplattformen:** Reicht Desktop-Tastatur zuerst? Welche Priorität haben Gamepad und Smartphone-Touch?
7. **Visueller Stil:** Wie sollen die drei Flaschen aussehen? Gibt es eigene Vorlagen oder Bilder des Originals?
8. **Levelgefühl:** Eher kurze, präzise Räume oder längere zusammenhängende Strecken? Wie stark soll die Schwierigkeit variieren?
9. **Audio und Barrierefreiheit:** Welche Musik-, Sound- und Komfortfunktionen sind bereits für eine erste Veröffentlichung erforderlich?
10. **Öffentlicher Betrieb:** Gewünschte Domain, Kostenrahmen, Datenschutzanforderungen und Umgang mit missbräuchlichen Lobbyversuchen?
