// Werteberechnung: Klasse -> Talente -> Ausrüstung -> Run-Perks -> Synergien
export const STAT_KEYS = ['maxHp', 'speed', 'tailLen', 'loopDmg', 'tailDmg', 'magnet', 'crit', 'critMult', 'regen', 'armor', 'dustMult', 'xpMult',
  'sparkRate', 'sparkDmg', 'specialCd', 'catchBonus', 'lootLuck', 'goldChance', 'collector', 'loopSlow'];

export const STAT_LABEL = {
  maxHp: 'max. LP', speed: 'Tempo', tailLen: 'Schweiflänge', loopDmg: 'Schleifenschaden', tailDmg: 'Schweifschaden', magnet: 'Sammelradius',
  crit: 'Krit-Chance', critMult: 'Krit-Schaden', regen: 'LP/s', armor: 'Rüstung', dustMult: 'Staub', xpMult: 'Erfahrung', sparkRate: 'Funken/s',
  sparkDmg: 'Funkenschaden', specialCd: 'Spezial-Abklingzeit', catchBonus: 'Fangbonus', lootLuck: 'Beuteglück', goldChance: 'Gold-Chance',
  collector: 'Staub/Min offline', loopSlow: 'Verlangsamung'
};
const PCT_STATS = { crit: 1, catchBonus: 1, lootLuck: 1, goldChance: 1, loopSlow: 1 };

export function modText(m) {
  const lab = STAT_LABEL[m.s] || m.s;
  if (m.p !== undefined) return (m.p >= 0 ? '+' : '') + Math.round(m.p * 100) + '% ' + lab;
  if (PCT_STATS[m.s]) return '+' + Math.round(m.a * 1000) / 10 + '% ' + lab;
  if (m.s === 'critMult') return '+' + Math.round(m.a * 100) + '% ' + lab;
  const v = Math.abs(m.a) < 10 ? Math.round(m.a * 10) / 10 : Math.round(m.a);
  return (v >= 0 ? '+' : '') + v + ' ' + lab;
}

export function computeStats(data, save, classId, perkStacks, out) {
  const cls = data.classMap[classId] || data.classes[0];
  const add = {}, pct = {};
  for (const k of STAT_KEYS) { add[k] = 0; pct[k] = 0; }
  const flags = {};
  const apply = (m, n) => {
    if (!(m.s in add)) return;
    if (m.p !== undefined) pct[m.s] += m.p * n; else add[m.s] += m.a * n;
  };
  if (save) {
    for (const node of data.skillNodes) {
      const r = (save.skills && save.skills[node.id]) | 0;
      if (r > 0) { for (const m of node.mods) apply(m, r); if (node.flag) flags[node.flag] = true; }
    }
    if (save.equipped && save.inventory) {
      for (const slot of ['kern', 'schweif', 'huelle']) {
        const uid = save.equipped[slot];
        if (uid == null) continue;
        const it = save.inventory.find((x) => x.uid === uid);
        if (!it) continue;
        for (const m of it.mods) apply(m, 1);
        if (it.unique) flags[it.unique] = true;
      }
    }
  }
  if (perkStacks) {
    for (const id in perkStacks) {
      const p = data.perkMap[id]; const n = perkStacks[id];
      if (!p || !n) continue;
      for (const m of p.mods) apply(m, n);
      flags[p.flag] = true;
    }
  }
  const syn = [];
  for (const s of data.synergies) {
    if (s.req.every((f) => flags[f])) { syn.push(s.id); flags[s.flag] = true; for (const m of s.mods) apply(m, 1); }
  }
  const st = out || {};
  for (const k of STAT_KEYS) st[k] = ((cls.base[k] || 0) + add[k]) * (1 + pct[k]);
  st.crit = Math.min(0.75, st.crit);
  st.specialCd = Math.max(1.2, st.specialCd);
  st.tailLen = Math.round(Math.min(400, st.tailLen));
  st.loopSlow = Math.min(0.85, st.loopSlow);
  st.flags = flags;
  st.synergies = syn;
  st.color = cls.color;
  st.special = cls.special;
  st.classId = cls.id;
  return st;
}
