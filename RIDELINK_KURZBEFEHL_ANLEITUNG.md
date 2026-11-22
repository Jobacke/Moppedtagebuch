# 🏍️ RideLink → Moppedtagebuch (iPhone-Kurzbefehl, Variante B)

Mit dieser Einrichtung überträgst du deinen aktuellen Kilometerstand direkt aus der **RideLink iPhone-App** komplett **lautlos im Hintergrund** in dein Moppedtagebuch (`tagebuch.vjbackhaus.de`) – ohne Safari zu öffnen und ohne Abtippen.

---

## Schritt 1: Google Apps Script aktualisieren & als Web-App bereitstellen (einmalig, ca. 2 Minuten)

1. Öffne dein bestehendes Bot-Projekt auf [script.google.com](https://script.google.com).
2. Ersetze den gesamten Code durch den neuen Inhalt aus `mopped_2tage_bot.gs` und speichere (`Cmd + S`).
   *(Deine bestehende Firebase-Verbindung bleibt über die gespeicherten Skript-Eigenschaften erhalten.)*
3. Klicke oben rechts auf **„Bereitstellen“ → „Neue Bereitstellung“**.
4. Klicke links auf das Zahnrad ⚙️ → **„Web-App“**:
   * **Beschreibung:** `RideLink KM-Webhook`
   * **Ausführen als:** `Ich (backhaus.johannes@gmail.com)`
   * **Zugriff:** `Jeder` *(notwendig, damit Apple Kurzbefehle zugreifen kann – abgesichert über deinen geheimen Token)*
5. Klicke auf **„Bereitstellen“** (evtl. einmalig Berechtigungen bestätigen) und **kopiere die Web-App-URL** (beginnt mit `https://script.google.com/macros/s/.../exec`).

### Kurzer Funktionstest im Browser
Öffne diese URL einmal im Browser (mit deiner kopierten Web-App-URL):
```text
DEINE_WEBAPP_URL?token=RL-7vK9mP4xN2qW8zB5cH3jF
```
Erwartete Antwort:
> `✅ Moppedtagebuch RideLink-Webhook aktiv! Versys 1000 SE steht aktuell bei ... km.`

---

## Schritt 2: iPhone-Kurzbefehl erstellen (einmalig, 4 Bausteine)

Öffne auf dem iPhone die App **„Kurzbefehle“** → oben rechts **`+`** → Namen vergeben: **`RideLink → Moppedtagebuch`**.

Füge nacheinander genau diese **4 Aktionen** hinzu:

1. **Bildschirmfoto aufnehmen**
2. **Text aus Bild extrahieren**
   * Eingabe: *Bildschirmfoto* (wird automatisch verknüpft)
3. **Inhalte von URL abrufen**
   * **URL:** Deine kopierte Google-Apps-Script-Web-App-URL einfügen
   * Tippe auf den kleinen Pfeil **`>`** für weitere Optionen:
     * **Methode:** `POST`
     * **Anfragetext:** `JSON`
     * Tippe zweimal auf **„Neues Feld hinzufügen“ → „Text“**:
       * Schlüssel: `token` → Text: `RL-7vK9mP4xN2qW8zB5cH3jF`
       * Schlüssel: `ocrText` → Text: *(Variable **Text aus Bild** auswählen)*
4. **Mitteilung anzeigen**
   * Text: *(Variable **Inhalte von URL** auswählen)*
   * Tippe auf **`>`** → Titel: `🏍️ Moppedtagebuch`

---

## Schritt 3: Komfort-Auslöser auf dem iPhone wählen

### Option A: 1-Tipp-Auslöser (volle Kontrolle)
* **Rückseite doppeltippen:** *Einstellungen → Bedienungshilfen → Tippen → Auf Rückseite tippen → Doppeltippen → `RideLink → Moppedtagebuch`*
* **Oder Action-Button / Kontrollzentrum:** Kurzbefehl direkt ins Kontrollzentrum legen.

**Anwendung:** RideLink öffnen (du landest direkt auf *„Fahrzeug“* mit *„Gesamtstrecke“*) → Doppeltipp auf die Rückseite → nach 1 Sekunde erscheint das Banner:
> `✅ Versys 1000 SE: 46.065 km (+281 km) gespeichert! • Service in 5.935 km • Akku: 12,3 V`

### Option B: Vollautomatisch beim Öffnen von RideLink (0-Tipp!)
1. Füge im Kurzbefehl bei **Inhalte von URL abrufen** ein 3. JSON-Feld hinzu:
   * Typ **Boolean**: Schlüssel `silentIfUnchanged` → **Wahr**
2. Setze vor **Mitteilung anzeigen** die Aktion **„Wenn“**:
   * `Wenn` *Inhalte von URL* **einen beliebigen Wert hat** → *Mitteilung anzeigen*
3. Öffne in **Kurzbefehle** unten den Tab **„Automation“** → **`+`** → **„App“**:
   * App: **RideLink** • **„Ist geöffnet“** • **„Sofort ausführen“**
   * Aktionen:
     1. **Warten:** `3 Sekunden` *(damit RideLink den aktuellen Stand fertig lädt)*
     2. **Kurzbefehl ausführen:** `RideLink → Moppedtagebuch`

**Ergebnis:** Immer wenn du RideLink öffnest und sich der Kilometerstand erhöht hat, wird er nach 3 Sekunden vollautomatisch ins Moppedtagebuch übertragen. Hat sich nichts geändert, passiert nichts und du wirst nicht durch Mitteilungen gestört.

---

## Eingebaute Sicherheitsmechanismen
* **Token-Schutz:** Ohne gültiges `WEBHOOK_SECRET` wird jede Anfrage abgelehnt.
* **Kein Rückwärts-Überschreiben:** Ein kleinerer Kilometerstand als im Tagebuch wird nicht gespeichert.
* **OCR-Schutz (Plausibilitäts-Stopp):** Falls iOS den Dezimalpunkt einmal überliest (z. B. `460649` statt `46064.9`), wird der Sprung automatisch blockiert.
* **Kein Doppel-Eintrag:** Bei unverändertem Kilometerstand wird nichts unnötig neu geschrieben.
