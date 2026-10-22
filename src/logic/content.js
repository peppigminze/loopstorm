// Bereitet Rohdaten (JSON) für schnellen Zugriff auf
export const DATA_FILES = ['classes', 'zones', 'enemies', 'bosses', 'perks', 'items', 'skills', 'missions', 'achievements', 'events'];

export function prepareData(raw) {
  const d = Object.assign({}, raw);
  const map = (arr) => { const m = {}; for (const x of arr) m[x.id] = x; return m; };
  d.classMap = map(d.classes);
  d.zoneMap = map(d.zones);
  d.enemyMap = map(d.enemies);
  d.bossMap = map(d.bosses);
  d.perkList = d.perks.perks;
  d.synergies = d.perks.synergies;
  d.perkMap = map(d.perkList);
  d.skillNodes = d.skills.nodes;
  d.skillMap = map(d.skillNodes);
  d.baseMap = map(d.items.bases);
  d.eventMap = map(d.events);
  for (const z of d.zones) {
    for (const e of z.enemies) {
      if (!d.enemyMap[e.id]) throw new Error('Unbekannter Gegner ' + e.id + ' in ' + z.id);
      e.def = d.enemyMap[e.id];
    }
    if (!d.bossMap[z.boss]) throw new Error('Unbekannter Boss ' + z.boss);
  }
  for (const b of d.bosses) for (const p of b.patterns) if (p.enemy && !d.enemyMap[p.enemy]) throw new Error('Boss-Add fehlt ' + p.enemy);
  return d;
}
