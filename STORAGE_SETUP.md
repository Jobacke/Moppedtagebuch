# WICHTIG: Speicher (Storage) aktivieren!

Damit die Fotogalerie funktioniert, musst du bei Firebase einmal auf "Starten" klicken.

1.  Gehe auf [console.firebase.google.com](https://console.firebase.google.com/).
2.  Wähle dein Projekt **Moppedtagebuch**.
3.  Klicke im linken Menü auf **"Erstellen"** -> **"Storage"**.
4.  Klicke auf **"Los gehts"** (Get Started).
5.  Wähle **"Im Testmodus starten"** (Start in production mode ist auch OK, aber wir müssen die Regeln anpassen).
    *   Am besten: Wenn dort steht "Regeln für Cloud Storage", kopiere das hier hinein:
    
    ```javascript
    rules_version = '2';
    service firebase.storage {
      match /b/{bucket}/o {
        match /users/{userId}/{allPaths=**} {
          allow read, write: if request.auth != null && request.auth.uid == userId;
        }
      }
    }
    ```
    
6.  Klicke auf **"Fertig"** (Done).

Das war's! Sobald du das erledigt hast, kannst du in der App Bilder hochladen. 📸
