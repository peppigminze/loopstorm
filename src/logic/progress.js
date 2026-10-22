// Meta-Fortschritt: Belohnungen, Konto-Level, Talente, Ausrüstung, Freischaltungen, Offline-Ertrag
import { mulberry32 } from './rng.js';
import { computeStats } from './stats.js';
import { rollItem, itemScore, salvageValue, rerollCost, SLOTS, upgradeCost, upgradeMods, ILVL_MAX } from './loot.js';
import { updateMissions, updateSideDaily, checkMilestones, checkAchievements, getValue, ensureMissions } from './missions.js';

export const INV_MAX = 40;
export function xpNext(lvl) { return Math.round(90 * Math.pow(lvl, 1.6)); }
export function skillCost(node, rank) { return node.shards ? node.cost : Math.round(node.cost * Math.pow(node.grow, rank)); }

export function zoneUnlocked(data, save, zoneId) {
  const i = data.zones.findIndex((z) => z.id === zoneId);
  if (i <= 0) return i === 0;
  const prev = save.zones[data.zones[i - 1].id];
  return !!(prev && prev.best >= 1);
}
export function maxIntensity(save, zoneId) { const z = save.zones[zoneId]; return Math.min(3, (z ? z.best : 0) + 1); }
export function classUnlocked(data, save, id) { const c = data.classMap[id]; return !!c && save.level >= c.unlockLevel; }

export function canBuySkill(data, save, id) {
  const n = data.skillMap[id];
  if (!n) return { ok: false, why: 'unbekannt' };
  const r = save.skills[id] || 0;
  if (r >= n.max) return { ok: false, why: 'max' };
  if (n.req && !(save.skills[n.req] > 0)) return { ok: false, why: 'gesperrt' };
  const cost = skillCost(n, r);
  if (n.shards ? save.shards < cost : save.dust < cost) return { ok: false, why: 'zu teuer', cost };
  return { ok: true, cost };
}

export function buySkill(data, save, id) {
  const c = canBuySkill(data, save, id);
  if (!c.ok) return c;
  const n = data.skillMap[id];
  if (n.shards) save.shards -= c.cost; else save.dust -= c.cost;
  save.skills[id] = (save.skills[id] || 0) + 1;
  return c;
}

export function equipItem(save, uid) {
  const it = save.inventory.find((x) => x.uid === uid);
  if (!it) return false;
  save.equipped[it.slot] = uid; it.isNew = false;
  return true;
}

export function salvageItem(save, uid) {
  const i = save.inventory.findIndex((x) => x.uid === uid);
  if (i < 0) return null;
  const it = save.inventory[i];
  if (save.equipped[it.slot] === uid) return null;
  const v = salvageValue(it);
  save.dust += v.dust; save.shards += v.shards;
  save.inventory.splice(i, 1);
  return v;
}

export function salvageBelow(save, rar) {
  let dust = 0, shards = 0, n = 0;
  for (const it of save.inventory.slice()) {
    if (it.rar <= rar && save.equipped[it.slot] !== it.uid) { const v = salvageItem(save, it.uid); if (v) { dust += v.dust; shards += v.shards; n++; } }
  }
  return { dust, shards, n };
}

export function rerollItem(data, save, uid, rng) {
  const it = save.inventory.find((x) => x.uid === uid);
  if (!it) return null;
  const cost = rerollCost(it);
  if (save.shards < cost) return null;
  save.shards -= cost;
  const fresh = rollItem(data, rng, it.ilvl, 0, it.uid, it.rar, it.slot);
  fresh.rar = Math.max(fresh.rar, it.rar);
  Object.assign(it, fresh, { isNew: false });
  return it;
}

export function upgradeItem(save, uid) {
  const it = save.inventory.find((x) => x.uid === uid);
  if (!it || it.ilvl >= ILVL_MAX) return null;
  const c = upgradeCost(it);
  if (save.dust < c) return null;
  save.dust -= c; upgradeMods(it);
  return it;
}

export function autoEquip(save) {
  let changed = 0;
  for (const slot of SLOTS) {
    let best = null, bs = -1;
    for (const it of save.inventory) if (it.slot === slot) { const s = itemScore(it); if (s > bs) { bs = s; best = it; } }
    if (best && save.equipped[slot] !== best.uid) { save.equipped[slot] = best.uid; changed++; }
  }
  return changed;
}

export function addItem(save, it) {
  if (save.inventory.length >= INV_MAX) {
    // schwächstes nicht ausgerüstetes Item automatisch zerlegen
    let worst = null, ws = 1e9;
    for (const x of save.inventory) if (Object.values(save.equipped).indexOf(x.uid) < 0) { const s = itemScore(x) + x.rar * 50; if (s < ws) { ws = s; worst = x; } }
    if (worst) salvageItem(save, worst.uid); else return false;
  }
  save.inventory.push(it);
  save.newItems = (save.newItems || 0) + 1;
  return true;
}

export function metaStats(data, save, cls) { return computeStats(data, save, cls || save.cls, null); }

// Wendet ein Run-Ergebnis an und liefert eine Zusammenfassung für den Ergebnis-Screen
export function applyRunResult(data, save, r, rng = mulberry32((Date.now() & 0xffffff) ^ (r.seed || 0)), now = Date.now()) {
  const sum = { dust: r.dust, xp: r.xp, shards: r.shards, levelsGained: 0, items: [], rewards: [], unlocks: [], prevLevel: save.level, xpBefore: save.xp };
  const L = save.life;
  for (const k of ['kills', 'loops', 'elites', 'bosses', 'dust', 'runs', 'time', 'perks', 'odClears', 'synergies', 'goldKills', 'events', 'noHitBoss', 'revives']) L[k] = (L[k] || 0) + (r[k] || 0);
  L.bestCatch = Math.max(L.bestCatch, r.bestCatch); L.bestCombo = Math.max(L.bestCombo, r.bestCombo);
  if (r.victory) L.wins++; else L.deaths++;
  save.dust += r.dust; save.shards += r.shards;
  // Zonen
  const zone = data.zoneMap[r.zoneId];
  if (r.victory && r.bosses > 0) {
    const z = save.zones[r.zoneId] || (save.zones[r.zoneId] = { best: 0, clears: 0 });
    const wasBest = z.best;
    z.clears++;
    if (r.intensity > z.best) z.best = r.intensity;
    if (wasBest === 0) {
      const ni = data.zones.indexOf(zone) + 1;
      if (ni < data.zones.length) sum.unlocks.push('Neuer Sektor: ' + data.zones[ni].name);
    }
    if (r.intensity > wasBest && r.intensity < 3) sum.unlocks.push(`${zone.name}: Intensität ${r.intensity + 1}`);
  }
  // Konto-Level
  const classesBefore = data.classes.filter((c) => save.level >= c.unlockLevel).map((c) => c.id);
  save.xp += r.xp;
  while (save.xp >= xpNext(save.level)) { save.xp -= xpNext(save.level); save.level++; sum.levelsGained++; }
  for (const c of data.classes) if (save.level >= c.unlockLevel && !classesBefore.includes(c.id)) sum.unlocks.push('Neue Klasse: ' + c.name);
  // Beute
  const st = computeStats(data, save, r.classId, null);
  const zi = data.zones.indexOf(zone);
  const ilvl = zi * 3 + r.intensity;
  const n = r.chests;
  for (let i = 0; i < n; i++) {
    const it = rollItem(data, rng, ilvl, st.lootLuck, save.nextUid++, r.bosses > 0 && i === 0 ? 1 : 0);
    if (addItem(save, it)) { sum.items.push(it); L.items = (L.items || 0) + 1; }
  }
  // Erstes Item direkt ausrüsten, wenn Slot leer (spart Klicks am Anfang)
  for (const it of sum.items) if (save.equipped[it.slot] == null) save.equipped[it.slot] = it.uid;
  save.runs = (save.runs || 0) + 1;
  // Ziele
  sum.rewards.push(...updateMissions(data, save, r, rng, now));
  sum.rewards.push(...updateSideDaily(data, save, r, rng, now));
  sum.rewards.push(...checkMilestones(data, save));
  sum.rewards.push(...checkAchievements(data, save));
  // Level durch Missions-XP? (Missionen geben nur Staub/Splitter) – nochmals Value-Missionen prüfen
  sum.rewards.push(...updateMissions(data, save, null, rng, now));
  return sum;
}

// Nach Menü-Aktionen (Kauf, Ausrüsten) Value-basierte Ziele prüfen
export function checkMeta(data, save, rng = mulberry32(Date.now() & 0xffffff)) {
  const out = [];
  out.push(...updateMissions(data, save, null, rng));
  out.push(...updateSideDaily(data, save, null, rng));
  out.push(...checkAchievements(data, save));
  return out;
}

export function offlineGain(data, save, now = Date.now()) {
  const mins = (now - (typeof save.lastSeen === 'number' ? save.lastSeen : now)) / 60000;
  if (!(mins >= 3)) return 0;
  const st = computeStats(data, save, save.cls, null);
  const rate = (0.4 + st.collector) * (1 + getValue(data, save, 'zonesCleared') * 0.8);
  return Math.floor(Math.min(mins, 480) * rate);
}

export { ensureMissions };
