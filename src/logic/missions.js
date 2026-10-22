// Missionen (Haupt, Neben, Täglich), Meilensteine, Achievements und "fast erreichte Ziele"
import { mulberry32, hashStr, shuffle } from './rng.js';

const LIFE_KEYS = ['kills', 'loops', 'elites', 'bosses', 'dust', 'runs', 'time', 'perks', 'odClears', 'synergies', 'goldKills', 'events', 'noHitBoss', 'revives'];

export function getValue(data, save, key) {
  switch (key) {
    case 'level': return save.level;
    case 'skillRanks': { let n = 0; for (const k in save.skills) n += save.skills[k]; return n; }
    case 'equippedCount': return ['kern', 'schweif', 'huelle'].filter((s) => save.equipped[s] != null).length;
    case 'bestRarity': return save.inventory.reduce((m, it) => Math.max(m, it.rar), -1);
    case 'zonesCleared': return data.zones.filter((z) => (save.zones[z.id] && save.zones[z.id].best) >= 1).length;
    case 'classesUnlocked': return data.classes.filter((c) => save.level >= c.unlockLevel).length;
    case 'bestCatch': return save.life.bestCatch;
    case 'bestCombo': return save.life.bestCombo;
  }
  if (key.startsWith('clear_')) { const z = save.zones[key.slice(6)]; return z ? z.best || 0 : 0; }
  return save.life[key] || 0;
}

export function missionCur(data, save, m, live) {
  if (m.mode === 'value') return getValue(data, save, m.key);
  const lv = live ? (live[m.key] || 0) : 0;
  if (m.mode === 'best') return Math.max(m.prog, lv);
  return m.prog + lv;
}

function scaledTarget(t, lvl) { return Math.max(1, Math.round(t.base * (1 + t.grow * (lvl - 1)))); }
function rewardFor(target, kind, lvl) {
  const dust = Math.round((25 + 18 * Math.pow(lvl, 1.35)) * (kind === 'daily' ? 2.5 : 1));
  return { dust, shards: kind === 'daily' ? 1 : 0 };
}

function makeSide(data, save, rng, used, kind = 'side', mult = 1) {
  const tpls = data.missions.side.filter((t) => !used.includes(t.key));
  const t = tpls[Math.floor(rng() * tpls.length)] || data.missions.side[0];
  const target = Math.max(1, Math.round(scaledTarget(t, save.level) * (t.mode === 'best' ? Math.min(mult, 1.3) : mult)));
  return { kind, key: t.key, mode: t.mode, name: t.name, desc: t.desc.replace('{n}', target), target, prog: 0, reward: rewardFor(target, kind, save.level), done: false };
}

export function todayStr(now = Date.now()) {
  const d = new Date(now);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

export function ensureMissions(data, save, rng, now = Date.now()) {
  const main = data.missions.main;
  if (!save.main && save.mainIdx < main.length) {
    const m = main[save.mainIdx];
    save.main = { kind: 'main', id: m.id, key: m.key, mode: m.mode, name: m.name, desc: m.desc, target: m.target, prog: 0, reward: m.reward, done: false };
  }
  while (save.side.length < 3) save.side.push(makeSide(data, save, rng, save.side.map((s) => s.key)));
  const day = todayStr(now);
  if (!save.daily || save.daily.date !== day) {
    const drng = mulberry32(hashStr('daily' + day));
    const list = [];
    for (let i = 0; i < data.missions.daily.count; i++) list.push(makeSide(data, save, drng, list.map((s) => s.key), 'daily', data.missions.daily.mult));
    save.daily = { date: day, list };
  }
}

function grant(save, reward, out, label) {
  if (reward.dust) save.dust += reward.dust;
  if (reward.shards) save.shards += reward.shards;
  out.push({ label, dust: reward.dust || 0, shards: reward.shards || 0 });
}

// Aktualisiert alle Ziele. run = Run-Ergebnis oder null (z.B. nach Kauf). Gibt erledigte Ziele zurück.
export function updateMissions(data, save, run, rng, now = Date.now()) {
  const done = [];
  ensureMissions(data, save, rng, now);
  const apply = (m) => {
    if (m.done) return false;
    if (run && m.mode === 'sum') m.prog += run[m.key] || 0;
    if (run && m.mode === 'best') m.prog = Math.max(m.prog, run[m.key] || 0);
    if (missionCur(data, save, m, null) >= m.target) { m.done = true; return true; }
    return false;
  };
  // Hauptmissionen können sich kaskadieren (z.B. value-basierte)
  for (let guard = 0; guard < 30 && save.main; guard++) {
    if (!apply(save.main)) break;
    grant(save, save.main.reward, done, 'Hauptmission: ' + save.main.name);
    save.mainIdx++; save.main = null;
    ensureMissions(data, save, rng, now);
    // Run-Werte zählen auch für die direkte Folgemission (Kaskaden fühlen sich gut an)
  }
  return done;
}

export function updateSideDaily(data, save, run, rng, now = Date.now()) {
  const done = [];
  ensureMissions(data, save, rng, now);
  for (let i = 0; i < save.side.length; i++) {
    const m = save.side[i];
    if (run && m.mode === 'sum') m.prog += run[m.key] || 0;
    if (run && m.mode === 'best') m.prog = Math.max(m.prog, run[m.key] || 0);
    if (missionCur(data, save, m, null) >= m.target) {
      grant(save, m.reward, done, 'Auftrag: ' + m.name);
      save.side[i] = makeSide(data, save, rng, save.side.map((s) => s.key));
    }
  }
  for (const m of save.daily.list) {
    if (m.done) continue;
    if (run && m.mode === 'sum') m.prog += run[m.key] || 0;
    if (run && m.mode === 'best') m.prog = Math.max(m.prog, run[m.key] || 0);
    if (missionCur(data, save, m, null) >= m.target) { m.done = true; grant(save, m.reward, done, 'Täglich: ' + m.name); }
  }
  return done;
}

export function checkMilestones(data, save) {
  const done = [];
  for (const ms of data.missions.milestones) {
    let tier = save.ms[ms.key] || 0;
    while (tier < ms.tiers.length && getValue(data, save, ms.key) >= ms.tiers[tier]) {
      const reward = { dust: Math.round(60 * Math.pow(3.2, tier)), shards: tier + 1 };
      tier++;
      grant(save, reward, done, `Meilenstein: ${ms.name} ${['I', 'II', 'III', 'IV', 'V', 'VI'][tier - 1]}`);
    }
    save.ms[ms.key] = tier;
  }
  return done;
}

export function checkAchievements(data, save) {
  const done = [];
  for (const a of data.achievements) {
    if (save.ach[a.id]) continue;
    if (getValue(data, save, a.key) >= a.target) { save.ach[a.id] = Date.now(); done.push({ label: 'Erfolg: ' + a.name, dust: 0, shards: 1 }); save.shards += 1; }
  }
  return done;
}

// Die n Ziele, die am nächsten an der Erfüllung sind. live = laufende Run-Zähler (optional)
export function nearestGoals(data, save, n = 3, live = null) {
  const list = [];
  const push = (label, cur, target, kind) => { if (target > 0 && cur < target) list.push({ label, cur, target, ratio: cur / target, kind }); };
  if (save.main) push(save.main.desc, missionCur(data, save, save.main, live), save.main.target, 'main');
  for (const m of save.side) push(m.desc, missionCur(data, save, m, live), m.target, 'side');
  if (save.daily) for (const m of save.daily.list) if (!m.done) push(m.desc, missionCur(data, save, m, live), m.target, 'daily');
  for (const ms of data.missions.milestones) {
    const tier = save.ms[ms.key] || 0;
    if (tier < ms.tiers.length) {
      const lv = live && LIFE_KEYS.includes(ms.key) ? (live[ms.key] || 0) : 0;
      push(`${ms.name}: ${ms.tiers[tier]} ${msLabel(ms.key)}`, getValue(data, save, ms.key) + lv, ms.tiers[tier], 'ms');
    }
  }
  list.sort((a, b) => b.ratio - a.ratio);
  const out = [];
  if (save.main) { const m = list.find((g) => g.kind === 'main'); if (m) out.push(m); }
  for (const g of list) { if (out.length >= n) break; if (!out.includes(g)) out.push(g); }
  return out;
}

function msLabel(k) { return { kills: 'Gegner', loops: 'Schleifen', dust: 'Staub', bosses: 'Bosse', runs: 'Runs', elites: 'Elites' }[k] || k; }
