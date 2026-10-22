# PLAN – Fortschrittsprotokoll

- [x] M1 Fundament: Ordnerstruktur, Daten-JSON, RNG, Stats, Save (robust), Content-Loader, Tests
- [x] M2 Kern-Simulation: Run-Welt, Bewegung, Schweif, Schleifen-Erkennung, Gegner-KI (22 Typen), Projektile, Pickups
- [x] M3 Run-Tiefe: Run-Level & Perks, Synergien, Spezialfähigkeiten, Bosse, Events, Overdrive, Run-Ergebnis
- [x] M4 Meta: Fortschritt, Loot/Seltenheiten, Talentbaum, Missionen/Daily/Meilensteine/Achievements, Offline + Sim-Bot
- [x] M5 Präsentation: Renderer, Partikel/Popups/Shake/Hitstop, Input (Touch+Tastatur), WebAudio
- [x] M6 Menüs & Flow: DOM-Screens (Flug, Talente, Ausrüstung, Ziele, Mehr), Level-Up, Pause, Overdrive, Ergebnis
- [x] M7 Balance: Sim-Journeys über tausende Runs, BALANCE.md
- [x] M8 Polish & Review: Tutorial, Einstellungen, Edge-Cases, Demo-Bot im Menü, Code-Review
- [x] M9 Bundle & Lieferung: Single-File index.html, Browser-Test (Playwright), ZIP, Publish

## Protokoll
- M1–M6: Tests grün (M1 12, M2/M3 56, M4 20 Checks), Playwright Desktop+Mobile ohne Konsolenfehler.
- M7: 5 Balance-Iterationen, Details in BALANCE.md.
- M8: Tutorial (6 Stufen), Pause/Einstellungen/Sparmodus, Kernbruch, Mobile-HUD/Header, Code-Review (toter Code, Combo-Puls, Gegner-Obergrenze, Profiling-Hook).
- M9: tools/bundle.js → dist/index.html (~192 KB), getestet per file:// inkl. Boss, Overdrive, Touch, kaputtem Speicher.
