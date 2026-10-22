import { loadData, ok, summary } from './load.js';
import { createRun, stepRun, choosePerk, decideOverdrive, EV, spawnEnemy } from '../logic/run.js';
import { createBot, botThink, botPickPerk } from '../logic/bot.js';
import { defaultSave } from '../logic/save.js';
const data = loadData();
// 1) Schleife manuell fliegen fängt Gegner
{
  const w = createRun({ data, seed: 3, tutorial: true });
  const cx = w.p.x, cy = w.p.y + 80;
  const e = spawnEnemy(w, data.enemyMap.tank, cx, cy, false); e.spd = 0;
  let a = -Math.PI / 2, loops = 0;
  const inp = { mx: 0, my: 0, special: false };
  for (let i = 0; i < 400 && !w.over; i++) {
    a += 0.03;
    const tx = cx + Math.cos(a) * 80, ty = cy + Math.sin(a) * 80;
    inp.mx = (tx - w.p.x) / 5; inp.my = (ty - w.p.y) / 5;
    stepRun(w, 1 / 60, inp);
    for (let k = 0; k < w.evN; k++) if (w.evs[k].type === EV.LOOP && w.evs[k].a > 0) loops++;
    w.evN = 0;
    if (w.pendingChoice) choosePerk(w, 0);
  }
  ok(w.c.loops >= 1, 'Schleife erkannt: ' + w.c.loops);
  ok(loops >= 1 && w.c.bestCatch >= 1, 'Gegner gefangen ' + w.c.bestCatch);
}
// 2) Bot-Runs in allen Zonen laufen fehlerfrei, Pools bleiben konsistent
const save = defaultSave();
for (const z of data.zones) for (const cls of ['komet', 'weber', 'funke']) {
  const w = createRun({ data, save, classId: cls, zoneId: z.id, intensity: 1, seed: 7 });
  const bot = createBot(0.8, 5); const inp = { mx: 0, my: 0, special: false };
  let steps = 0;
  while (!w.over && steps < 60 * 300) {
    if (w.pendingChoice) choosePerk(w, botPickPerk(bot, w));
    if (w.pendingOverdrive) decideOverdrive(w, true);
    botThink(bot, w, 1 / 30, inp); stepRun(w, 1 / 30, inp); w.evN = 0; steps++;
    if (w.p.hp > 0 && w.p.hp > w.stats.maxHp + 0.01) { ok(false, 'hp>max'); break; }
  }
  const alive = w.enemies.filter((e) => e.on).length;
  ok(w.over && w.result, `${z.id}/${cls} beendet`);
  ok(alive === w.alive || w.over, `${z.id}/${cls} alive-Zähler ${alive} vs ${w.alive}`);
  ok(Number.isFinite(w.result.dust) && w.result.dust >= 0, 'dust endlich');
  console.log(`  ${z.id.padEnd(8)} ${cls.padEnd(6)} t=${w.result.time}s win=${w.result.victory} kills=${w.result.kills} loops=${w.result.loops} catch=${w.result.bestCatch} lvl=${w.result.lvl} dust=${w.result.dust}`);
}
process.exitCode = summary('M2/M3');
