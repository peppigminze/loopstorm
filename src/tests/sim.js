// Journey-Simulation: Bots spielen vom leeren Spielstand aus tausende Runs.
import { loadData } from './load.js';
import { createRun, stepRun, choosePerk, decideOverdrive } from '../logic/run.js';
import { createBot, botThink, botPickPerk } from '../logic/bot.js';
import { defaultSave } from '../logic/save.js';
import { upgradeItem, applyRunResult, buySkill, canBuySkill, autoEquip, salvageBelow, zoneUnlocked, maxIntensity, classUnlocked, skillCost, ensureMissions } from '../logic/progress.js';
import { mulberry32 } from '../logic/rng.js';
const data = loadData();
const JOURNEYS = +(process.argv[2] || 6), MAX_HOURS = +(process.argv[3] || 10), SKILL = +(process.argv[4] || 0.65);
const OVERHEAD = 18; // Sekunden Menü/Ergebnis pro Run
const DT = 1 / 30;

export function playRun(save, zoneId, intensity, cls, seed, skill) {
  const w = createRun({ data, save, classId: cls, zoneId, intensity, seed });
  const bot = createBot(skill, seed), inp = { mx: 0, my: 0, special: false };
  while (!w.over) {
    if (w.pendingChoice) choosePerk(w, botPickPerk(bot, w));
    if (w.pendingOverdrive) decideOverdrive(w, w.p.hp > w.stats.maxHp * 0.6 && bot.rnd() < 0.5);
    botThink(bot, w, DT, inp); stepRun(w, DT, inp); w.evN = 0;
  }
  return w.result;
}

function spend(save, log, tSec) {
  // Talente: günstigste kaufbare Stufe zuerst (Spieler-typisch), Splitter-Talente sobald möglich
  for (let g = 0; g < 200; g++) {
    let best = null, bc = 1e18;
    for (const n of data.skillNodes) { const c = canBuySkill(data, save, n.id); if (c.ok && (n.shards ? 0 : c.cost) < bc) { bc = n.shards ? 0 : c.cost; best = n; } }
    if (!best) break;
    buySkill(data, save, best.id);
    if (!log.firstSkill) log.firstSkill = tSec;
  }
  autoEquip(save);
  salvageBelow(save, 0);
  // Restlichen Staub in Aufwertungen (nur wenn Talente ausgereizt oder viel übrig)
  for (let g = 0; g < 50; g++) { const eq = Object.values(save.equipped).filter((u) => u != null).map((u) => save.inventory.find((x) => x.uid === u)).filter(Boolean).sort((a, b) => a.ilvl - b.ilvl)[0]; if (!eq || !upgradeItem(save, eq.uid)) break; }
}

function chooseTarget(save, state) {
  // Front: höchste freigeschaltete Zone/Intensität; nach 3 Niederlagen eine Stufe tiefer farmen
  const opts = [];
  for (const z of data.zones) if (zoneUnlocked(data, save, z.id)) for (let i = 1; i <= maxIntensity(save, z.id); i++) opts.push([z.id, i]);
  opts.sort((a, b) => (data.zones.findIndex((z) => z.id === a[0]) * 3 + a[1]) - (data.zones.findIndex((z) => z.id === b[0]) * 3 + b[1]));
  const front = opts[opts.length - 1];
  if (state.fails >= 3 && opts.length > 1) { state.fails = state.fails >= 5 ? 0 : state.fails; return opts[opts.length - 2]; }
  return front;
}

const allLogs = [];
const bossTimes = [];
const t0 = Date.now();
let totalRuns = 0;
for (let j = 0; j < JOURNEYS; j++) {
  const save = defaultSave(0);
  const rng = mulberry32(1000 + j + (+process.env.OFF || 0));
  ensureMissions(data, save, rng, 0);
  const log = { clears: {}, levelAt: {}, runs: 0, wins: 0, firstSkill: 0, firstRunDust: 0, timeline: [] };
  const state = { fails: 0 };
  let tSec = 0;
  while (tSec < MAX_HOURS * 3600) {
    const [zoneId, inten] = chooseTarget(save, state);
    const unlocked = data.classes.filter((c) => classUnlocked(data, save, c.id));
    const cls = unlocked[log.runs % unlocked.length].id;
    const r = playRun(save, zoneId, inten, cls, ((j + (+process.env.OFF || 0)) * 100000 + log.runs) | 0, SKILL);
    totalRuns++; log.runs++;
    tSec += r.time + OVERHEAD;
    if (log.runs === 1) log.firstRunDust = r.dust;
    if (r.bosses) bossTimes.push(r.bossTime);
    if (process.env.V) console.log(log.runs, zoneId+inten, cls, 'win', r.victory, 't', r.time, 'kills', r.kills, 'dust', r.dust, 'xp', r.xp, 'chests', r.chests, 'lvl', save.level, 'bank', Math.round(save.dust));
    const front = chooseTarget(save, { fails: 0 });
    const lv = save.level;
    applyRunResult(data, save, r, rng, 0);
    if (r.victory) { log.wins++; state.fails = 0; } else if (zoneId === front[0] && inten === front[1]) state.fails++;
    for (const z of data.zones) for (let i = 1; i <= 3; i++) { const k = z.id + i; if (!log.clears[k] && save.zones[z.id] && save.zones[z.id].best >= i) log.clears[k] = tSec; }
    if (save.level > lv) log.levelAt[save.level] = tSec;
    spend(save, log, tSec);
    if (log.runs % 25 === 0) log.timeline.push({ t: Math.round(tSec / 60), lvl: save.level, ranks: Object.values(save.skills).reduce((a, b) => a + b, 0), dust: Math.round(save.dust), zone: zoneId + inten, win: r.victory });
    if (save.zones.leere && save.zones.leere.best >= 3) break;
  }
  log.endMin = Math.round(tSec / 60); log.level = save.level; log.ranks = Object.values(save.skills).reduce((a, b) => a + b, 0);
  log.bestRar = save.inventory.reduce((m, it) => Math.max(m, it.rar), -1);
  allLogs.push(log);
  const fmt = (s) => s ? (s / 60).toFixed(0) + 'm' : '–';
  console.log(`J${j}: runs=${log.runs} winrate=${(log.wins / log.runs * 100).toFixed(0)}% lvl=${log.level} ranks=${log.ranks} firstRunDust=${log.firstRunDust} firstSkill=${log.firstSkill}s`);
  console.log('   clears: ' + data.zones.map((z) => z.id + ':' + [1, 2, 3].map((i) => fmt(log.clears[z.id + i])).join('/')).join('  '));
}
const secs = (Date.now() - t0) / 1000;
console.log(`\n${totalRuns} Runs in ${secs.toFixed(0)}s simuliert (${(totalRuns / secs).toFixed(1)} Runs/s)`);
const med = (arr) => { const a = arr.filter((x) => x).sort((x, y) => x - y); return a.length ? a[Math.floor(a.length / 2)] : null; };
const summary = {};
for (const z of data.zones) for (let i = 1; i <= 3; i++) { const v = med(allLogs.map((l) => l.clears[z.id + i])); summary[z.id + i] = v ? Math.round(v / 60) + 'm' : 'nie'; }
console.log('Median Zeit bis Clear:', JSON.stringify(summary));
bossTimes.sort((a, b) => a - b); console.log('Bosskampf-Dauer s: p25', bossTimes[bossTimes.length >> 2], 'median', bossTimes[bossTimes.length >> 1], 'p90', bossTimes[Math.floor(bossTimes.length * 0.9)]);
console.log('Median erstes Talent (s):', med(allLogs.map((l) => l.firstSkill)));
console.log('Timeline J0:', JSON.stringify(allLogs[0].timeline.slice(0, 40)));
