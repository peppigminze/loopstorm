import { loadData } from './load.js';
import { createRun, stepRun, choosePerk } from '../logic/run.js';
import { createBot, botThink } from '../logic/bot.js';
const data = loadData();
const w = createRun({ data, zoneId: 'leere', seed: 4 });
w.stats.maxHp = 1e9; w.p.hp = 1e9; w.bossAt = 1e9; w.t = 200;
const bot = createBot(0.8, 1), inp = { mx: 0, my: 0, special: false };
for (let i = 0; i < 1200; i++) { if (w.pendingChoice) choosePerk(w, 0); botThink(bot, w, 1 / 60, inp); stepRun(w, 1 / 60, inp); w.evN = 0; }
const t0 = performance.now(); let n = 0;
for (let i = 0; i < 1200; i++) { if (w.pendingChoice) choosePerk(w, 0); botThink(bot, w, 1 / 60, inp); stepRun(w, 1 / 60, inp); w.evN = 0; n++; }
console.log('alive', w.alive, 'bullets', w.bullets.filter((b) => b.on).length, 'ms/step', ((performance.now() - t0) / n).toFixed(3), 'tail', w.tLen);
