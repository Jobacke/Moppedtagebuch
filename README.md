# Moppedtagebuch - Kawasaki Versys 1000 SE

Eine moderne Web-App (PWA) zur Verwaltung aller Daten rund um deine Kawasaki Versys 1000 SE (M-N 594).

## Features

- **🔐 Cloud Login**: Sichere Anmeldung via E-Mail & Passwort (Google Firebase).
- **☁️ Sync**: Deine Daten (Tanken, Service, Umbauten) werden sicher in der Cloud gespeichert und sind auf allen Geräten synchron.
- **⚙️ Technik**: Technische Daten & aktueller KM-Stand.
- **💰 Finanzen**: Ausgaben-Tracker mit Kategorien und Summen.
- **🔧 Service**: Digitales Scheckheft mit Erinnerung an den nächsten Service.
- **📦 Zubehör**: Verwaltung von Anbauteilen.
- **📱 PWA**: Installierbar als App auf Android & iOS.

## Einrichtung

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

2. **Lokal starten:**
   ```bash
   npm run dev
   ```
   Öffne dann `http://localhost:5173/Moppedtagebuch/`.

## Deployment

Die App wird automatisch via GitHub Pages bereitgestellt:
[https://Jobacke.github.io/Moppedtagebuch/](https://Jobacke.github.io/Moppedtagebuch/)

## Sicherheit

Die Datenbank regeln (Firestore Rules) sollten so eingestellt sein, dass nur der eigene Nutzer auf seine Daten zugreifen kann:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```
