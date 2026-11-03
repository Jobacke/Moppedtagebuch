# Projekt- & Workspace-Regeln

## 1. Automatische Erhöhung der Versionsnummer
- Bei **jeder** Anpassung an einer App (Code-, Funktions- oder UI-Änderung) **muss** die sichtbare Versionsnummer der App automatisch um `1` erhöht werden (z. B. `v1.3` -> `v1.4` bzw. `1.3.0` -> `1.4.0`).
- **Im Projekt Moppedtagebuch (`tagebuch.vjbackhaus.de`):**
  1. Quellcode-Pfad: `/Users/johannes/Library/Mobile Documents/com~apple~CloudDocs/Documents/Dokumente – MacBook Air von Johannes/Moppedtagebuch`
  2. Vor jedem Build/Deploy (`npm run deploy`) die Version sowohl im Header-Badge in `src/App.jsx` als auch in `package.json` um `1` hochzählen.
  3. Änderungen anschließend per `npm run deploy` veröffentlichen und per `git commit` & `git push` sichern.
