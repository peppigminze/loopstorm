# BALANCE – Simulationsprotokoll

Werkzeug: `node tests/sim.js <journeys> <stunden> <skill>`. Ein Bot (logic/bot.js) spielt ab leerem Spielstand echte Runs mit
derselben Logik wie das Spiel (feste Schritte, 30 Hz), kauft Talente (günstigste zuerst), rüstet das Beste aus, zerlegt Gewöhnliches,
wertet auf und greift immer die höchste freie Stufe an (nach 3 Niederlagen eine Stufe tiefer farmen). Pro Run +18 s Menüzeit.
Insgesamt rund 5 000 simulierte Runs über 5 Iterationen.

## Ziele
- Erster Fortschritt < 2 min · erster Boss nach ~10 min · Leere I nach 2–4 h · Leere III (grosses Ziel) nach 7–12 h · Bosskampf ≤ ~1,5 min.

## Iterationen
| # | Problem | Änderung |
|---|---|---|
| A | Bot starb nach ~40 s, 12 Treffer/Run | Kontaktschaden ×0.7, Unverwundbarkeit 0.65→0.9 s; Bot fliegt Kreise um festes Zentrum |
| A2 | Ökonomie explodierte (1,4 Mio. Staub nach 1 h, Baum in 60 min voll), 45 Truhen in einem Run | Elite-Chance gedeckelt (≤3.5 %), nur 50 % Truhen, Combo-Bonus max ×1.5, Staub ×0.45, flachere Zonen-Multiplikatoren, Konto-XP ×0.3 |
| B | Zonen 1–5 in 1–2 h, Talentbaum (127 Ränge) nach 2 h voll, Staub ohne Zweck | Baum auf 201 Ränge / 1,07 Mio. Staub vertieft, Item-Aufwerten als endlose Staub-Senke |
| C | Leere III nach 3–5 h (zu schnell) | Zonen-Schwierigkeit 1→13 statt 1→8.2, Intensität ×1.5/Stufe, tiefe Talente teurer, Aufwerten ×1.4/Stufe |
| D | Bosskämpfe Median 60–165 s, p90 bis 300 s | Boss-LP ×0.65, Schleifenbonus ×3, „Kernbruch“ ab 35 s → überschoss (Leere III nach 3 h) |
| E | – | Kernbruch ab 50 s mit 1.1 %/s, Boss-LP ×0.8 → **aktuelle Werte** |

## Ergebnis Iteration E (4 Journeys, je 14 h, Bot-Skill 0.45 / 0.65 / 0.65 / 0.85)
| Messpunkt | Ergebnis |
|---|---|
| Erstes Talent gekauft | 62–91 s (nach dem ersten Run; erste Run-Upgrades schon nach ~15 s) |
| Brutstern (Sektor 1) | 8–12 min |
| Sektor 3 befreit | 29–50 min |
| Leere I | 1,7–4,5 h |
| Leere III | 6,9–9,2 h (3 von 4 Bots), 1 Bot nicht in 14 h |
| Talentbaum voll | ~4–6 h |
| Bosskampf-Dauer | p25 23–31 s · Median 44–89 s · p90 91–134 s |
| Siegquote | 6–16 % (Bot stürmt immer die Front – ein Mensch farmt mehr) |

## Bewertung
- „Erster Fortschritt < 2 min“ und „grosses Ziel braucht mehrere Stunden“ sind erfüllt.
- Siegquote an der Front ist niedrig; Niederlagen bringen aber volle Beute, deshalb fühlt sich jeder Run lohnend an. Nach Playtests ggf. Front-Schwierigkeit −10 %.
- Bosskämpfe am oberen Rand des Ziels; Kernbruch garantiert ein Ende spätestens ~140 s nach Spawn.
- Unsicherheit: Bot ≠ Mensch. Kreisen kann der Bot gut, Ausweichen schlechter.
