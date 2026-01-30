# Anleitung zur Einrichtung von Google Firebase

Um deine App mit einer echten Datenbank und Benutzerverwaltung auszustatten, nutzen wir **Google Firebase**. Das ist für private Projekte in der Regel **kostenlos**.

Folge diesen Schritten genau:

## 1. Projekt erstellen
1. Gehe auf [console.firebase.google.com](https://console.firebase.google.com/) und melde dich mit deinem Google-Konto an.
2. Klicke auf **"Projekt hinzufügen"**.
3. Gib dem Projekt einen Namen (z.B. `Moppedtagebuch`).
4. Google Analytics kannst du deaktivieren (vereinfacht das Setup).
5. Klicke auf **"Projekt erstellen"**.

## 2. App registrieren
1. Sobald das Projekt bereit ist, klicke in der Übersicht auf das **Web-Symbol** `</>` (es sieht aus wie Code-Klammern).
2. Gib der App einen Kosenamen (z.B. `Mopped Web`).
3. **Wichtig:** Setze **keinen** Haken bei "Firebase Hosting" (das machen wir ja schon über GitHub).
4. Klicke auf **"App registrieren"**.

## 3. Konfiguration kopieren
Dir wird nun ein Code-Block angezeigt (`const firebaseConfig = { ... }`).
**Kopiere diesen gesamten Block** (oder nur die Werte in den geschweiften Klammern) und **poste ihn mir hier als Antwort**.

Er sieht ungefähr so aus:
```javascript
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "moppedtagebuch.firebaseapp.com",
  projectId: "moppedtagebuch",
  storageBucket: "moppedtagebuch.appspot.com",
  messagingSenderId: "...",
  appId: "..."
};
```

## 4. Authentifizierung aktivieren (Login)
1. Klicke im linken Menü auf **"Erstellen"** -> **"Authentication"**.
2. Klicke auf **"Los gehts"**.
3. Wähle bei den Anmelde-Methoden **"E-Mail/Passwort"** aus.
4. Aktiviere den Schalter **"E-Mail/Passwort"** (den ersten Schalter).
5. Klicke auf **"Speichern"**.

## 5. Datenbank erstellen (Firestore)
1. Klicke im linken Menü auf **"Erstellen"** -> **"Firestore Database"**.
2. Klicke auf **"Datenbank erstellen"**.
3. Wähle als Standort **"eur3 (europe-west)"** (oder "nam5 (us-central)", das ist egal, aber Europa ist schneller).
4. Wähle im nächsten Schritt **"Im Testmodus starten"**.
   * *Hinweis: Das erlaubt erst mal jedem (also deiner App), Daten zu schreiben. Wir sichern das später ab.*
5. Klicke auf **"Erstellen"**.

---

**Sobald du mir die `firebaseConfig` Daten geschickt hast, baue ich den Login und die Datenbank-Anbindung in deine App ein!** 🚀
