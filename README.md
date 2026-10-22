# LOOPSTORM

Du bist ein Komet. Dein Schweif ist deine Waffe: Kreuze ihn, und alles in der Schleife explodiert.
Browser-Action-Roguelite mit kurzen Runs (1–3 Min), 6 Sektoren × 3 Intensitäten, 3 Klassen, Talentbaum,
Loot in 5 Seltenheiten, Synergien, Bossen, Missionen und Overdrive-Risiko.

## Spielen
- `dist/index.html` ist eine einzige, selbständige Datei (kein Server, keine externen Dateien). Doppelklick genügt.
- Steuerung: WASD/Pfeile oder Ziehen auf dem Bildschirm · Leertaste/Shift/Knopf/zweiter Finger = Spezial · Esc/P = Pause · 1–4 = Upgrade wählen · Enter = Start / Noch ein Run.

## Entwicklung
```
npm test            # Logik-Tests + Syntaxcheck aller Module
npm run sim         # Journey-Simulation: node tests/sim.js <journeys> <stunden> <skill 0..1>
npm run bundle      # baut dist/index.html
python3 tests/browser.py dist/index.html        # Playwright-Smoke-Test (Desktop + Mobile)
python3 tests/browser_long.py dist/index.html   # Boss, Overdrive, Touch, kaputter Speicher
```
Quellversion lokal: `python3 -m http.server` im Projektordner, dann `http://localhost:8000`.

## Struktur
| Ordner | Inhalt |
|---|---|
| `data/` | Alle Inhalte als JSON: Klassen, Zonen, 22 Gegner, 6 Bosse, Perks & Synergien, Items, Talente, Missionen, Erfolge, Events |
| `logic/` | Reine Spiellogik ohne DOM: `run.js` (Simulation), `bot.js` (KI für Sim & Menü-Demo), `stats.js`, `loot.js`, `missions.js`, `progress.js`, `save.js`, `rng.js`, `content.js` |
| `ui/` | `render.js` (Canvas), `fx.js` (Partikel/Popups/Shake/Hitstop, gepoolt), `input.js`, `audio.js` (WebAudio-Synthese), `screens.js` (DOM-Menüs) |
| `tests/` | Node-Tests, Simulation, Benchmark, Playwright-Tests |
| `tools/bundle.js` | Bündelt Module + JSON + CSS zu einer HTML-Datei |

## Technik
- Feste Simulationsschritte (60 Hz), Objekt-Pools für Gegner, Kugeln, Funken, Pickups, Partikel, Events.
- Glow über vorgerenderte Sprites statt `shadowBlur`; Sparmodus reduziert Auflösung und Partikel.
- Spielstand in `localStorage` mit Validierung jedes Feldes; kaputte Stände werden gesichert (`…_corrupt`) und ersetzt.
- Offline-Ertrag (Sammler-Talent) bis 8 h.

## GitHub Pages
Im Repo liegt die gebündelte Datei bereits als `index.html` im Root, der Quellcode in `src/` (dort `npm test`, `npm run bundle`). Pages: Settings → Pages → Branch `main` / root.
