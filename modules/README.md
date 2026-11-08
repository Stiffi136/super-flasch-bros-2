# Eigene Module

Exportiere ein Modul im lokalen Editor (`npm run editor`) als JSON und kopiere die Datei direkt in diesen Ordner, zum Beispiel `modules/mein-modul.json`. Starte das Spiel mit `npm run dev`. Nach dem Hinzufügen oder Entfernen einer Datei starte den Entwicklungsserver neu und lade die Seite neu. Für eine Veröffentlichung muss der Client neu gebaut und bereitgestellt werden.

Nur `*.json`-Dateien direkt in diesem Ordner werden geladen. Mindestens eine gültige Datei ist erforderlich. Bei fehlenden oder ungültigen Dateien oder doppelten IDs wird ein Fehler angezeigt. Der Generator verwendet ausschließlich diese Module; nicht jedes Modul muss bei jedem Seed vorkommen. Prüfe deine Module selbst auf Spielbarkeit und freie Übergänge.

Für Multiplayer benötigen alle Spieler denselben Spiel-Build und dieselben Module. Der Server muss auf dem aktuellen Stand sein und vergleicht deren Fingerabdruck beim Lobbybeitritt.
