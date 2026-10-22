// Ausrüstung: Seltenheiten, Affixe, Uniques, Bewertung, Zerlegen
import { pickWeighted, range } from './rng.js';

export const SLOTS = ['kern', 'schweif', 'huelle'];
export const SLOT_NAME = { kern: 'Kern', schweif: 'Schweif', huelle: 'Hülle' };

// Stat-Gewichte zum Vergleichen von Items (≈ "Wert pro Einheit")
const W = { loopDmg: 10, tailDmg: 5, tailLen: 0.9, speed: 9, maxHp: 0.35, armor: 2.5, regen: 6, crit: 60, critMult: 12, magnet: 0.06,
  dustMult: 7, xpMult: 4, sparkDmg: 4, sparkRate: 9, specialCd: -6, catchBonus: 40, lootLuck: 15, goldChance: 40, collector: 1, loopSlow: 2 };

export function rollRarity(data, rng, luck = 0, minRar = 0) {
  const rs = data.items.rarities;
  let sum = 0;
  const ws = rs.map((r, i) => { const v = i < minRar ? 0 : r.w * (i === 0 ? 1 : 1 + luck * (1 + i * 0.6)); sum += v; return v; });
  let x = rng() * sum;
  for (let i = 0; i < ws.length; i++) { x -= ws[i]; if (x <= 0) return i; }
  return rs.length - 1;
}

function rollMod(def, rng, scale) {
  if (def.p) return { s: def.s, p: Math.round(range(rng, def.p[0], def.p[1]) * scale * 1000) / 1000 };
  return { s: def.s, a: Math.round(range(rng, def.a[0], def.a[1]) * scale * 100) / 100 };
}

export function rollItem(data, rng, ilvl, luck, uid, minRar = 0, forceSlot = null) {
  const bases = forceSlot ? data.items.bases.filter((b) => b.slot === forceSlot) : data.items.bases;
  const base = bases[Math.floor(rng() * bases.length)];
  const rar = rollRarity(data, rng, luck, minRar);
  const rd = data.items.rarities[rar];
  const scale = 1 + 0.17 * (ilvl - 1);
  const mods = [rollMod(base.imp, rng, scale * (1 + rar * 0.12))];
  const pool = data.items.affixes.filter((a) => a.s !== base.imp.s);
  for (let i = 0; i < rd.affixes && pool.length; i++) {
    const k = Math.floor(rng() * pool.length);
    mods.push(rollMod(pool[k], rng, scale * (1 + rar * 0.1)));
    pool.splice(k, 1);
  }
  let unique = null, uname = null;
  if (rd.unique) { const u = data.items.uniques[Math.floor(rng() * data.items.uniques.length)]; unique = u.flag; uname = u.name; }
  return { uid, base: base.id, slot: base.slot, name: uname ? uname + ' · ' + base.name : base.name, rar, ilvl, mods, unique, isNew: true };
}

export function itemScore(it) {
  let s = 0;
  for (const m of it.mods) s += (m.p !== undefined ? m.p * 100 * (W[m.s] || 1) / 10 : m.a * (W[m.s] || 1));
  if (it.unique) s += 25;
  return Math.round(s * 10) / 10;
}

export function salvageValue(it) {
  return { dust: Math.round(8 * (it.rar + 1) * (it.rar + 1) * (1 + 0.25 * (it.ilvl - 1))), shards: it.rar >= 3 ? it.rar - 1 : 0 };
}

export function rerollCost(it) { return 1 + it.rar; }

export const ILVL_MAX = 30;
export function upgradeCost(it) { return Math.round(60 * Math.pow(1.4, it.ilvl)); }
// Aufwerten: Gegenstandsstufe +1, alle Werte wachsen proportional mit
export function upgradeMods(it) {
  const f = (1 + 0.17 * it.ilvl) / (1 + 0.17 * (it.ilvl - 1));
  for (const m of it.mods) { if (m.p !== undefined) m.p = Math.round(m.p * f * 1000) / 1000; else m.a = Math.round(m.a * f * 100) / 100; }
  it.ilvl++;
}
