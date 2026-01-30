# Anleitung: Apps bei IONOS hosten (via GitHub Actions)

Hier ist der professionelle Weg, deine Apps (**Moppedtagebuch** und **AppDate**) automatisch bei IONOS zu veröffentlichen.

Wir nutzen **GitHub Actions**, damit der Code bei jedem "Push" automatisch gebaut und auf deinen IONOS-Webspace hochgeladen wird.

---

## Schritt 1: Bei IONOS vorbereiten (für JEDE App)

Für eine saubere Struktur empfehle ich **Subdomains**.

1.  Logge dich bei IONOS ein.
2.  Gehe zu **Domains & SSL** -> **Subdomains**.
3.  Erstelle eine Subdomain für die App (z.B. `mopped.deine-domain.de` oder `appdate.deine-domain.de`).
4.  Gehe zu **Hosting** -> **Webspace (SFTP/SSH)**.
5.  Erstelle einen neuen **SFTP-Benutzer** (oder nutze einen vorhandenen).
    *   *Tipp:* Du kannst für jede App einen eigenen Ordner im Webspace anlegen (z.B. `/apps/mopped` und `/apps/appdate`).
    *   Stelle in den Domain-Einstellungen sicher, dass die Subdomain `mopped...` auf den Ordner `/apps/mopped` zeigt!

**Du brauchst gleich:**
*   **Server-Adresse** (meist `hosting-xxxx.ionos.de` oder einfach deine Domain)
*   **SFTP-Benutzername**
*   **SFTP-Passwort**

---

## Schritt 2: GitHub Repository vorbereiten

Damit GitHub den Zugriff auf IONOS hat, hinterlegen wir die Zugangsdaten sicher als "Secrets".

1.  Gehe auf GitHub in das Repository deiner App (z.B. `Moppedtagebuch`).
2.  Klicke auf **Settings** (oben) -> **Secrets and variables** (links) -> **Actions**.
3.  Klicke auf **"New repository secret"** und lege folgende 3 Geheimnisse an:

| Name | Wert (Beispiel) |
|------|-----------------|
| `IONOS_SERVER` | `hosting-1234.ionos.de` (Dein IONOS Server) |
| `IONOS_USERNAME` | `u12345678` (Dein SFTP-Nutzer) |
| `IONOS_PASSWORD` | `DeinGeheimesPasswort` |

---

## Schritt 3: Den automatischen Ablauf ("Workflow") anlegen

Ich habe dir im Ordner `.github/workflows/` bereits eine Datei `deploy-ionos.yml` angelegt.
Dieser Workflow macht folgendes:
1.  Baut die App (`npm run build`).
2.  Lädt den fertigen Ordner `dist` auf deinen IONOS Server hoch.

**Wichtig:** Falls du die App in einem Unterordner bei IONOS hast (nicht direkt im Hauptverzeichnis des SFTP-Users), musst du in der Datei `deploy-ionos.yml` den Pfad bei `remote-dir` anpassen!

---

## Schritt 4: Vite Konfiguration (Wichtig!)

Damit die App auf einer eigenen Domain (z.B. `mopped.meinedomain.de`) läuft, muss der "Base Path" auf `/` (Wurzelverzeichnis) gestellt werden.

Ich habe die Datei `vite.config.js` bereits für dich angepasst, sodass sie standardmäßig `/` nutzt.

---

## Wiederholung für "AppDate"
Führe die gleichen Schritte einfach für dein anderes Projekt durch:
1. IONOS: Subdomain & Ordner anlegen.
2. GitHub: Secrets im AppDate-Repo hinterlegen.
3. Code: Workflow-Datei kopieren und `vite.config.js` anpassen.
