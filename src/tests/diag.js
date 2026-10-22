import { loadData } from './load.js';
import { createRun, stepRun, choosePerk, decideOverdrive, EV } from '../logic/run.js';
import { createBot, botThink, botPickPerk } from '../logic/bot.js';
import { defaultSave } from '../logic/save.js';
const data = loadData();
const zone = process.argv[2] || 'staub', cls = process.argv[3] || 'komet', skill = +(process.argv[4] || 0.6);
let agg = { t: 0, win: 0, loops: 0, kills: 0, hurt: 0, dust: 0, catch: 0, lvl: 0 }; const N = 20;
for (let r = 0; r < N; r++) {
  const w = createRun({ data, save: defaultSave(), classId: cls, zoneId: zone, seed: r * 77 + 1 });
  const bot = createBot(skill, r + 9), inp = { mx: 0, my: 0, special: false };
  while (!w.over) {
    if (w.pendingChoice) choosePerk(w, botPickPerk(bot, w));
    if (w.pendingOverdrive) decideOverdrive(w, false);
    botThink(bot, w, 1 / 30, inp); stepRun(w, 1 / 30, inp);
    for (let k = 0; k < w.evN; k++) if (w.evs[k].type === EV.HURT) agg.hurt++;
    w.evN = 0;
  }
  const R = w.result; agg.t += R.time; agg.win += R.victory; agg.loops += R.loops; agg.kills += R.kills; agg.dust += R.dust; agg.catch += R.bestCatch; agg.lvl += R.lvl;
}
for (const k in agg) agg[k] = Math.round(agg[k] / N * 100) / 100;
console.log(zone, cls, skill, JSON.stringify(agg));
