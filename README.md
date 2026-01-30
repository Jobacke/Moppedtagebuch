# Moppedtagebuch - Kawasaki Versys 1000 SE

Eine moderne Web-App (PWA) zur Verwaltung aller Daten rund um deine Kawasaki Versys 1000 SE (M-N 594).

## Features

- **🔒 Pin-Sperre**: Sicherer und einfacher Zugriffsschutz (Default Pin: `1234`).
- **⚙️ Technische Daten**: Alle wichtigen Spezifikationen auf einen Blick (im "Bearbeiten"-Modus änderbar).
- **💰 Finanzen**: Erfassung von Ausgaben (Tanken, Versicherung, etc.).
- **🔧 Service & Wartung**: Digitales Scheckheft für Wartungsarbeiten.
- **📦 Zubehör**: Verwaltung von Anbauteilen mit Preisen und Kaufdatum.
- **📱 PWA-Ready**: Kann auf dem Smartphone "zum Home-Bildschirm" hinzugefügt werden und fühlt sich wie eine native App an.
- **🌙 Dark Mode**: Optimiert für OLED-Screens und nächtliche Nutzung.

## Installation & Start

1. **Abhängigkeiten installieren:**
   ```bash
   npm install
   ```

2. **Lokal starten:**
   ```bash
   npm run dev
   ```
   Die App ist dann unter `http://localhost:5173` erreichbar.

## Deployment auf GitHub Pages

Die App ist bereits für das Hosting auf GitHub Pages konfiguriert.

1. Erstelle ein neues Repository auf GitHub mit dem Namen `Moppedtagebuch`.
2. Verknüpfe den lokalen Ordner mit dem Repository:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/DEIN_USERNAME/Moppedtagebuch.git
   git push -u origin main
   ```
3. Deployment starten:
   ```bash
   npm run deploy
   ```
   
**Wichtig:** Falls dein Repository anders heißt als `Moppedtagebuch`, musst du in der Datei `vite.config.js` den Wert für `base` entsprechend anpassen (z.B. `/DeinRepoName/`).

## Anpassungen

- **Pin ändern**: Der Pin wird aktuell im LocalStorage gespeichert. Die Logik befindet sich in `src/App.jsx`.
- **Icon**: Das App-Icon liegt unter `public/icon.png`.

## Tech Stack

- React (Vite)
- CSS Modules / Glassmorphism Design
- Lucide React Icons
- LocalStorage für Datenhaltung (Client-Side Only)
