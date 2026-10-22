// Speicherstand: Default, Validierung (robust gegen kaputte Daten), Laden/Speichern über injizierten Storage
export const SAVE_KEY = 'loopstorm_save_v1';

export function defaultSave(now = Date.now()) {
  return {
    v: 1, dust: 0, shards: 0, level: 1, xp: 0, skills: {}, inventory: [], equipped: { kern: null, schweif: null, huelle: null },
    nextUid: 1, cls: 'komet', zone: 'staub', intensity: 1, zones: {},
    life: { kills: 0, loops: 0, elites: 0, bosses: 0, dust: 0, runs: 0, time: 0, perks: 0, odClears: 0, synergies: 0, goldKills: 0,
      events: 0, noHitBoss: 0, revives: 0, bestCatch: 0, bestCombo: 0, deaths: 0, wins: 0, items: 0 },
    main: null, mainIdx: 0, side: [], daily: null, ms: {}, ach: {},
    settings: { sound: true, music: true, shake: true, quality: 'hoch', demo: true },
    tutorialDone: false, lastSeen: now, created: now, newItems: 0
  };
}

function fill(def, src) {
  if (src === null || typeof src !== 'object' || Array.isArray(src)) return def;
  const out = {};
  for (const k in def) {
    const d = def[k], s = src[k];
    if (d === null) out[k] = (s === undefined) ? null : s;
    else if (Array.isArray(d)) out[k] = Array.isArray(s) ? s : d;
    else if (typeof d === 'object') out[k] = (s && typeof s === 'object' && !Array.isArray(s)) ? (Object.keys(d).length ? fill(d, s) : s) : d;
    else if (typeof d === 'number') out[k] = (typeof s === 'number' && isFinite(s)) ? s : d;
    else if (typeof d === 'boolean') out[k] = typeof s === 'boolean' ? s : d;
    else out[k] = typeof s === typeof d ? s : d;
  }
  return out;
}

export function sanitizeSave(raw, data) {
  const s = fill(defaultSave(), raw);
  s.inventory = s.inventory.filter((it) => it && typeof it.uid === 'number' && Array.isArray(it.mods) && typeof it.slot === 'string'
    && (!data || data.baseMap[it.base]) && it.mods.every((m) => m && typeof m.s === 'string'));
  for (const slot of ['kern', 'schweif', 'huelle']) {
    const uid = s.equipped[slot];
    if (uid != null && !s.inventory.some((it) => it.uid === uid && it.slot === slot)) s.equipped[slot] = null;
  }
  const maxUid = s.inventory.reduce((m, it) => Math.max(m, it.uid), 0);
  if (s.nextUid <= maxUid) s.nextUid = maxUid + 1;
  if (data) {
    for (const k in s.skills) {
      const n = data.skillMap[k];
      if (!n || typeof s.skills[k] !== 'number') delete s.skills[k];
      else s.skills[k] = Math.max(0, Math.min(n.max, Math.floor(s.skills[k])));
    }
    if (!data.classMap[s.cls]) s.cls = 'komet';
    if (!data.zoneMap[s.zone]) s.zone = data.zones[0].id;
    for (const z in s.zones) if (!data.zoneMap[z] || typeof s.zones[z] !== 'object') delete s.zones[z];
    if (s.mainIdx > data.missions.main.length) s.mainIdx = data.missions.main.length;
  }
  s.intensity = Math.max(1, Math.min(3, Math.floor(s.intensity)));
  s.level = Math.max(1, Math.floor(s.level));
  s.dust = Math.max(0, s.dust); s.shards = Math.max(0, s.shards);
  if (!Array.isArray(s.side)) s.side = [];
  s.side = s.side.filter((m) => m && typeof m.key === 'string' && typeof m.target === 'number');
  if (s.main && (typeof s.main.key !== 'string')) s.main = null;
  if (s.daily && (!Array.isArray(s.daily.list) || typeof s.daily.date !== 'string')) s.daily = null;
  return s;
}

export function loadSave(storage, data) {
  let txt = null;
  try {
    txt = storage.getItem(SAVE_KEY);
    if (!txt) return { save: defaultSave(), fresh: true };
    return { save: sanitizeSave(JSON.parse(txt), data), fresh: false };
  } catch (e) {
    try { if (txt) storage.setItem(SAVE_KEY + '_corrupt', txt); } catch (e2) { /* egal */ }
    return { save: defaultSave(), fresh: true, corrupt: true };
  }
}

export function storeSave(storage, save) {
  try { save.lastSeen = Date.now(); storage.setItem(SAVE_KEY, JSON.stringify(save)); return true; } catch (e) { return false; }
}

export function memoryStorage() {
  const m = new Map();
  return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) };
}
