# Einrichtung eigener Domains (CNAME) für deine Apps

Da du GitHub Pages nutzt, ist der Weg über `CNAME` der einfachste und stabilste. Wir leiten die Subdomain einfach direkt zu GitHub um.

## 1. Bei IONOS (DNS einrichten)

Du musst die Subdomains **nicht** löschen (falls sie schon da sind). Du musst sie nur **bearbeiten**. Falls sie weg sind, erstelle sie neu.

**Für Moppedtagebuch:**
1.  Logge dich bei IONOS ein -> Bereich **Domains & SSL**.
2.  Klicke auf deine Domain `vjbackhaus.de`.
3.  Gehe auf den Reiter **DNS**.
4.  Klicke auf **Record hinzufügen**.
5.  Wähle den Typ **CNAME**.
6.  Fülle es so aus:
    *   **Host Name:** `mopped`
    *   **Zeigt auf:** `Jobacke.github.io`
    *   *TTL:* 1 Stunde (Standard lassen)
7.  Speichern.

**Für AppDate:**
*   Wiederhole das gleiche, aber mit Host Name `appdate` (zeigt auch auf `Jobacke.github.io`).

## 2. GitHub Konfiguration

Ich habe für "Moppedtagebuch" bereits eine wichtige Datei namens `CNAME` in deinen Code gelegt (`public/CNAME`). Das sichert die Einstellung dauerhaft.

**Führe jetzt einmalig diese Schritte im Browser durch:**

1.  Gehe zu deinem Repository auf GitHub (Jobacke/Moppedtagebuch).
2.  Klicke oben auf **Settings**.
3.  Klicke links im Menü auf **Pages**.
4.  Scrolle runter zu **Custom domain**.
5.  Trage ein: `mopped.vjbackhaus.de`
6.  Klicke auf **Save**.
7.  Warte kurz und setze dann den Haken bei **Enforce HTTPS** (damit es sicher ist).

Wiederhole das gleiche für dein AppDate-Repository (dort `appdate.vjbackhaus.de` eintragen).

## Wichtig zu wissen
Es kann bis zu **24 Stunden** dauern, bis die DNS-Änderungen weltweit aktiv sind. Meistens geht es aber schon nach 15-30 Minuten. Solange könnte die App unter der neuen Adresse noch nicht erreichbar sein.
