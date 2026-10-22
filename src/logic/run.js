// Kern-Simulation eines Runs. Reine Logik, kein DOM. Wird von Spiel UND Simulations-Bot genutzt.
import { mulberry32, pickWeighted, shuffle } from './rng.js';
import { computeStats } from './stats.js';

export const ARENA_W = 2600, ARENA_H = 2000;
export const TAIL_CAP = 512;
const SPACING = 10, PR = 13, MIN_LOOP_AREA = 1400;
export const EV = { HIT: 1, KILL: 2, LOOP: 3, PICK: 4, HURT: 5, LEVEL: 6, BOSS: 7, BOSSDIE: 8, SPECIAL: 9, SHOOT: 10, EXPLODE: 11,
  SHOCK: 12, CHAIN: 13, EVENT: 14, TELE: 15, CUT: 16, CHEST: 17, HEAL: 18, SYNERGY: 19, WAVE: 20, CRIT: 21, REVIVE: 22, OD: 23, GOLDESC: 24, CORE: 25 };

const mkEnemy = () => ({ on: false, def: null, x: 0, y: 0, vx: 0, vy: 0, hp: 0, maxHp: 0, r: 10, spd: 0, dmg: 0, elite: false, boss: false,
  t: 0, cd: 0, cd2: 0, state: 0, flash: 0, burnT: 0, burnD: 0, slowT: 0, freezeT: 0, ang: 0, alpha: 1, tx: 0, ty: 0, pcd: null,
  spiralT: 0, sang: 0, pullT: 0, scd: 0, xp: 0, dust: 0, lr: 1, hitT: 0 });
const mkBullet = () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, r: 5, dmg: 0, life: 0, big: false });
const mkSpark = () => ({ on: false, x: 0, y: 0, vx: 0, vy: 0, dmg: 0, life: 0, pierce: false, hits: 0 });
const mkPick = () => ({ on: false, kind: 0, x: 0, y: 0, vx: 0, vy: 0, val: 0, mag: false, t: 0 });
const mkHaz = () => ({ on: false, x: 0, y: 0, r: 0, t: 0, max: 0, dmg: 0, edmg: 0, kind: 0 });
const mkEv = () => ({ type: 0, x: 0, y: 0, a: 0, b: 0 });
const mkFlash = () => ({ pts: new Float32Array(TAIL_CAP * 2 + 4), n: 0, t: 0, catch: 0, echoT: 0, cx: 0, cy: 0, minx: 0, miny: 0, maxx: 0, maxy: 0, net: false });
function pool(n, f) { const a = new Array(n); for (let i = 0; i < n; i++) a[i] = f(); return a; }

export const PICK = { XP: 0, DUST: 1, HEART: 2, CHEST: 3, GOLD: 4, SHARD: 5 };

export function createRun(opts) {
  const { data, save = null, classId = 'komet', zoneId = data.zones[0].id, intensity = 1, seed = (Math.random() * 1e9) | 0, tutorial = false } = opts;
  const zone = data.zoneMap[zoneId];
  const zi = data.zones.indexOf(zone);
  const diff = zone.diff * Math.pow(1.5, intensity - 1);
  const w = {
    data, save, rng: mulberry32(seed), seed, zone, zi, intensity, diff, classId, tutorial,
    dmgScale: Math.sqrt(diff), perks: {}, stats: null,
    t: 0, over: false, result: null, bossAt: tutorial ? 95 : 120, boss: null, bossDone: false, bossDeadT: 0, bossHit: false,
    overdrive: false, odEnd: 0, odStartDust: 0, odChestT: 0, pendingChoice: null, pendingOverdrive: false,
    p: { x: ARENA_W / 2, y: ARENA_H / 2, vx: 0, vy: 0, hp: 100, inv: 1.2, dirX: 1, dirY: 0, scd: 0, dashT: 0, netT: 0, revived: false, pullX: 0, pullY: 0 },
    tx: new Float32Array(TAIL_CAP), ty: new Float32Array(TAIL_CAP), tStart: 0, tLen: 0,
    enemies: pool(420, mkEnemy), bullets: pool(500, mkBullet), sparks: pool(220, mkSpark), picks: pool(520, mkPick), haz: pool(40, mkHaz),
    evs: pool(400, mkEv), evN: 0, flashes: pool(6, mkFlash), flashI: 0, caught: [],
    alive: 0, spawnAcc: 0, waveT: 30, tailTick: 0, sparkAcc: 0,
    lvl: 1, xp: 0, xpNext: 6, dust: 0, combo: 0, comboT: 0, event: null, eventAt: 0, eventsDone: 0, frenzyT: 0, rainT: 0,
    c: { kills: 0, loops: 0, elites: 0, bosses: 0, bestCatch: 0, bestCombo: 0, perks: 0, chests: 0, shards: 0, synergies: 0, goldKills: 0,
      events: 0, noHitBoss: 0, revives: 0, dmgTaken: 0, xpTotal: 0, odClears: 0 },
    synSeen: {}, lastSyn: null
  };
  w.stats = computeStats(data, save, classId, w.perks);
  w.p.hp = w.stats.maxHp;
  w.eventAt = w.rng() < (tutorial ? 0 : 0.45) ? 35 + w.rng() * 65 : 9999;
  w.tx[0] = w.p.x; w.ty[0] = w.p.y; w.tLen = 1;
  return w;
}

export function emit(w, type, x, y, a = 0, b = 0) {
  if (w.evN >= w.evs.length) return;
  const e = w.evs[w.evN++]; e.type = type; e.x = x; e.y = y; e.a = a; e.b = b;
}

function tailIdx(w, i) { return (w.tStart + i) % TAIL_CAP; }

// ---------- Spawning ----------
export function spawnEnemy(w, def, x, y, elite = false) {
  if (w.alive >= 300 && !(def.ai === 'gold')) return null;
  let e = null;
  for (let i = 0; i < w.enemies.length; i++) if (!w.enemies[i].on) { e = w.enemies[i]; break; }
  if (!e) return null;
  const tScale = 1 + w.t / 160;
  e.on = true; e.def = def; e.boss = false; e.elite = elite;
  e.x = Math.max(20, Math.min(ARENA_W - 20, x)); e.y = Math.max(20, Math.min(ARENA_H - 20, y));
  e.vx = 0; e.vy = 0; e.t = 0; e.state = 0; e.cd = 1 + w.rng() * 2; e.cd2 = 0; e.flash = 0; e.burnT = 0; e.slowT = 0; e.freezeT = 0;
  e.ang = w.rng() * 6.283; e.alpha = 1; e.evElite = false; e.spiralT = 0; e.pullT = 0; e.pcd = null; e.hitT = 0;
  e.maxHp = e.hp = def.hp * w.diff * tScale * (w.overdrive ? 1.5 : 1) * (elite ? 4.5 : 1);
  e.r = def.r * (elite ? 1.45 : 1);
  e.spd = def.spd * (0.88 + 0.24 * w.rng()) * (elite ? 0.9 : 1);
  e.dmg = def.dmg * 0.7 * w.dmgScale * (1 + w.t / 300) * (elite ? 1.4 : 1);
  e.xp = def.xp * (elite ? 6 : 1);
  e.dust = def.dust * 0.45 * w.zone.dustMult * (elite ? 8 : 1);
  e.lr = def.loopResist || 1;
  e.tx = 220 + w.rng() * 120;
  w.alive++;
  return e;
}

function spawnAround(w, def, dist, elite) {
  const a = w.rng() * 6.283;
  return spawnEnemy(w, def, w.p.x + Math.cos(a) * dist, w.p.y + Math.sin(a) * dist, elite);
}

function spawnBoss(w) {
  const def = w.data.bossMap[w.zone.boss];
  const a = w.rng() * 6.283;
  const e = spawnEnemy(w, def, w.p.x + Math.cos(a) * 520, w.p.y + Math.sin(a) * 520, false);
  if (!e) return;
  e.boss = true; e.maxHp = e.hp = def.hp * w.diff * 0.8; e.r = def.r; e.spd = def.spd; e.dmg = def.dmg * w.dmgScale;
  e.xp = 40; e.dust = 60 * w.zone.dustMult; e.lr = 3;
  e.pcd = def.patterns.map((p) => p.cd * (0.5 + w.rng() * 0.5));
  w.boss = e; w.bossHit = false; w.bossSpawnT = w.t;
  emit(w, EV.BOSS, e.x, e.y);
}

function updateSpawning(w, dt) {
  if (w.bossDone && !w.overdrive) return;
  let rate = (1.0 + w.t * 0.042) * w.zone.density;
  if (w.tutorial && w.t < 40) rate *= w.t < 4 ? 0 : 0.5;
  if (w.boss) rate *= 0.35;
  if (w.overdrive) rate *= 2;
  if (w.frenzyT > 0) rate *= 2;
  const cap = w.overdrive ? 230 : 170;
  w.spawnAcc += rate * dt;
  const pool = w.zone.enemies;
  while (w.spawnAcc >= 1) {
    w.spawnAcc -= 1;
    if (w.alive >= cap) { w.spawnAcc = 0; break; }
    let tries = 0, ent = null;
    do { ent = pickWeighted(w.rng, pool); tries++; } while (ent.from > w.t && tries < 6);
    if (ent.from > w.t) ent = pool[0];
    const eliteChance = w.tutorial ? 0 : Math.min(0.035, 0.008 + w.t * 0.00008 + (w.intensity - 1) * 0.006 + (w.overdrive ? 0.006 : 0));
    spawnAround(w, ent.def, (w.tutorial && w.t < 45 ? 380 : 640) + w.rng() * 160, w.rng() < eliteChance);
  }
  // Wellen: Ring aus Schwärmern – perfekte Schleifen-Gelegenheit
  w.waveT -= dt;
  if (w.waveT <= 0 && !w.boss) {
    w.waveT = 28;
    if (!(w.tutorial && w.t < 40)) {
      const n = 10 + Math.min(14, Math.floor(w.t / 15));
      const def = w.data.enemyMap.swarm;
      for (let i = 0; i < n; i++) {
        const a = (i / n) * 6.283;
        spawnEnemy(w, def, w.p.x + Math.cos(a) * 360, w.p.y + Math.sin(a) * 360, false);
      }
      emit(w, EV.WAVE, w.p.x, w.p.y, n);
    }
  }
}

// ---------- Kampf ----------
function fireBullet(w, x, y, ang, spd, dmg, big = false) {
  for (let i = 0; i < w.bullets.length; i++) {
    const b = w.bullets[i];
    if (b.on) continue;
    b.on = true; b.x = x; b.y = y; b.vx = Math.cos(ang) * spd; b.vy = Math.sin(ang) * spd; b.dmg = dmg; b.r = big ? 9 : 5; b.life = 5; b.big = big;
    return b;
  }
  return null;
}

function fireSpark(w, x, y, ang, dmg) {
  for (let i = 0; i < w.sparks.length; i++) {
    const s = w.sparks[i];
    if (s.on) continue;
    s.on = true; s.x = x; s.y = y; s.vx = Math.cos(ang) * 560; s.vy = Math.sin(ang) * 560; s.dmg = dmg; s.life = 1.1;
    s.pierce = !!w.stats.flags.pierce; s.hits = 0;
    return s;
  }
  return null;
}

export function dropPick(w, kind, x, y, val) {
  for (let i = 0; i < w.picks.length; i++) {
    const p = w.picks[i];
    if (p.on) continue;
    const a = w.rng() * 6.283, s = 40 + w.rng() * 110;
    p.on = true; p.kind = kind; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.val = val; p.mag = false; p.t = 0;
    return p;
  }
  // Pool voll: direkt gutschreiben
  if (kind === PICK.DUST || kind === PICK.GOLD) w.dust += val;
  else if (kind === PICK.XP) gainXp(w, val);
  return null;
}

function comboMult(w) { return 1 + Math.min(w.combo, 100) * 0.005; }

function hurtPlayer(w, dmg, x, y) {
  const p = w.p;
  if (p.inv > 0 || p.dashT > 0 || w.over) return false;
  const a = w.stats.armor;
  const real = dmg * (1 - a / (a + 25));
  p.hp -= real; p.inv = 0.9; w.c.dmgTaken += real;
  if (w.boss) w.bossHit = true;
  const dx = p.x - x, dy = p.y - y, d = Math.hypot(dx, dy) || 1;
  p.vx += dx / d * 260; p.vy += dy / d * 260;
  emit(w, EV.HURT, p.x, p.y, real);
  return true;
}

export function damageEnemy(w, e, dmg, src, canCrit) {
  if (!e.on) return;
  let crit = false;
  if (canCrit && w.rng() < w.stats.crit) { dmg *= w.stats.critMult; crit = true; }
  e.hp -= dmg; e.flash = 0.09;
  if (src !== 3 || dmg > 4) emit(w, crit ? EV.CRIT : EV.HIT, e.x, e.y - e.r, dmg, src);
  if (e.hp <= 0) killEnemy(w, e, src);
}

function killEnemy(w, e, src) {
  e.on = false; w.alive--;
  const c = w.c;
  c.kills++;
  w.combo++; w.comboT = 3;
  if (w.combo > c.bestCombo) c.bestCombo = w.combo;
  emit(w, EV.KILL, e.x, e.y, e.r, e.elite ? 2 : e.boss ? 3 : 1);
  if (e.def.id === 'gold') { c.goldKills++; }
  if (e.elite) { c.elites++; if (w.rng() < (e.evElite ? 1 : 0.5)) dropPick(w, PICK.CHEST, e.x, e.y, 1); }
  if (e.boss) { onBossDeath(w, e); return; }
  const dm = w.stats.dustMult * comboMult(w) * (w.frenzyT > 0 ? 2 : 1);
  if (e.xp > 0) dropPick(w, PICK.XP, e.x, e.y, e.xp);
  const dust = e.dust * dm;
  if (e.def.id === 'gold') { for (let i = 0; i < 12; i++) dropPick(w, PICK.GOLD, e.x, e.y, dust / 12); }
  else if (w.rng() < w.stats.goldChance) dropPick(w, PICK.GOLD, e.x, e.y, dust * 5);
  else dropPick(w, PICK.DUST, e.x, e.y, dust);
  if (w.rng() < 0.012) dropPick(w, PICK.HEART, e.x, e.y, 20);
  if (e.def.ai === 'splitter') {
    const sd = w.data.enemyMap.splitling;
    for (let i = 0; i < 2; i++) spawnEnemy(w, sd, e.x + (i ? 12 : -12), e.y, false);
  } else if (e.def.ai === 'bomber') {
    for (let i = 0; i < 8; i++) fireBullet(w, e.x, e.y, i * 0.785 + e.ang, 170, e.dmg * 0.7);
    emit(w, EV.EXPLODE, e.x, e.y, 60);
  }
  if (src === 1 && w.stats.flags.chain) chainFrom(w, e.x, e.y, 2);
}

function chainFrom(w, x, y, n) {
  for (let k = 0; k < n; k++) {
    let best = null, bd = 190 * 190;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.on || e.boss || e.hitT === w.t) continue;
      const d = (e.x - x) ** 2 + (e.y - y) ** 2;
      if (d < bd) { bd = d; best = e; }
    }
    if (!best) return;
    best.hitT = w.t;
    emit(w, EV.CHAIN, x, y, best.x, best.y);
    if (w.stats.flags.chainBurn) { best.burnT = 3; best.burnD = w.stats.loopDmg * 0.3; }
    damageEnemy(w, best, w.stats.loopDmg * 0.45, 4, false);
  }
}

function shockwave(w, x, y, r, dmg) {
  emit(w, EV.SHOCK, x, y, r);
  const r2 = r * r;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.on) continue;
    const dx = e.x - x, dy = e.y - y;
    if (dx * dx + dy * dy < r2) {
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      if (!e.boss) { e.vx += dx / d * 300; e.vy += dy / d * 300; }
      damageEnemy(w, e, dmg, 5, true);
    }
  }
}

// ---------- Schweif & Schleifen ----------
function segInter(ax, ay, bx, by, cx, cy, dx, dy, out) {
  const rx = bx - ax, ry = by - ay, sx = dx - cx, sy = dy - cy;
  const den = rx * sy - ry * sx;
  if (Math.abs(den) < 1e-9) return false;
  const qx = cx - ax, qy = cy - ay;
  const t = (qx * sy - qy * sx) / den, u = (qx * ry - qy * rx) / den;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  out[0] = ax + t * rx; out[1] = ay + t * ry;
  return true;
}
const _X = [0, 0];

function pointInPoly(pts, n, x, y) {
  let inside = false;
  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = pts[i * 2], yi = pts[i * 2 + 1], xj = pts[j * 2], yj = pts[j * 2 + 1];
    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) inside = !inside;
  }
  return inside;
}

function addTailPoint(w, x, y) {
  if (w.tLen < TAIL_CAP) { const i = tailIdx(w, w.tLen); w.tx[i] = x; w.ty[i] = y; w.tLen++; }
  else { w.tStart = (w.tStart + 1) % TAIL_CAP; const i = tailIdx(w, w.tLen - 1); w.tx[i] = x; w.ty[i] = y; }
  const maxLen = w.stats.tailLen;
  while (w.tLen > maxLen) { w.tStart = (w.tStart + 1) % TAIL_CAP; w.tLen--; }
  checkLoop(w);
}

function checkLoop(w) {
  const n = w.tLen;
  if (n < 6) return;
  const a = tailIdx(w, n - 2), b = tailIdx(w, n - 1);
  const ax = w.tx[a], ay = w.ty[a], bx = w.tx[b], by = w.ty[b];
  for (let j = n - 4; j >= 0; j--) {
    const c = tailIdx(w, j), d = tailIdx(w, j + 1);
    if (!segInter(ax, ay, bx, by, w.tx[c], w.ty[c], w.tx[d], w.ty[d], _X)) continue;
    // Polygon: X, P[j+1..n-2]
    const f = w.flashes[w.flashI]; w.flashI = (w.flashI + 1) % w.flashes.length;
    const pts = f.pts; let k = 0;
    pts[k++] = _X[0]; pts[k++] = _X[1];
    for (let i = j + 1; i <= n - 2; i++) { const q = tailIdx(w, i); pts[k++] = w.tx[q]; pts[k++] = w.ty[q]; }
    const cnt = k / 2;
    let area = 0, cx = 0, cy = 0, minx = 1e9, miny = 1e9, maxx = -1e9, maxy = -1e9;
    for (let i = 0, jj = cnt - 1; i < cnt; jj = i++) {
      area += (pts[jj * 2] * pts[i * 2 + 1] - pts[i * 2] * pts[jj * 2 + 1]);
      cx += pts[i * 2]; cy += pts[i * 2 + 1];
      if (pts[i * 2] < minx) minx = pts[i * 2]; if (pts[i * 2] > maxx) maxx = pts[i * 2];
      if (pts[i * 2 + 1] < miny) miny = pts[i * 2 + 1]; if (pts[i * 2 + 1] > maxy) maxy = pts[i * 2 + 1];
    }
    area = Math.abs(area) / 2;
    if (area < MIN_LOOP_AREA) return;
    f.n = cnt; f.cx = cx / cnt; f.cy = cy / cnt; f.minx = minx; f.miny = miny; f.maxx = maxx; f.maxy = maxy; f.t = 0.6;
    f.net = w.p.netT > 0;
    f.echoT = w.stats.flags.echo ? 0.35 : 0;
    resolveLoop(w, f, 1);
    // Schweif bis auf Kopf kürzen
    w.tStart = tailIdx(w, n - 1); w.tLen = 1;
    return;
  }
}

function resolveLoop(w, f, power) {
  const caught = w.caught; caught.length = 0;
  const st = w.stats;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.on) continue;
    if (e.x < f.minx - e.r || e.x > f.maxx + e.r || e.y < f.miny - e.r || e.y > f.maxy + e.r) continue;
    if (pointInPoly(f.pts, f.n, e.x, e.y) || (e.boss && distToPolyCenter(f, e))) caught.push(e);
  }
  // Pickups in der Schleife einsammeln
  for (let i = 0; i < w.picks.length; i++) {
    const p = w.picks[i];
    if (p.on && p.x > f.minx && p.x < f.maxx && p.y > f.miny && p.y < f.maxy && pointInPoly(f.pts, f.n, p.x, p.y)) p.mag = true;
  }
  const n = caught.length;
  f.catch = n;
  if (power === 1) {
    w.c.loops++;
    if (n > w.c.bestCatch) w.c.bestCatch = n;
    emit(w, EV.LOOP, f.cx, f.cy, n, f.n);
  }
  if (n === 0 && power === 1) return;
  const base = st.loopDmg * (1 + st.catchBonus * Math.max(0, n - 1)) * power * (f.net ? 1.5 : 1);
  for (let i = 0; i < n; i++) {
    const e = caught[i];
    const dmg = base * e.lr;
    if (f.net) e.freezeT = 2;
    if (st.loopSlow > 0) e.slowT = 2.5;
    if (st.flags.burn) { e.burnT = 3; e.burnD = st.loopDmg * 0.25; }
    damageEnemy(w, e, dmg, 1, true);
  }
  if (power === 1) {
    if (st.flags.vamp) { const h = 2 + n * 0.6; w.p.hp = Math.min(st.maxHp, w.p.hp + h); emit(w, EV.HEAL, w.p.x, w.p.y, h); }
    if (st.flags.shock) shockwave(w, f.cx, f.cy, st.flags.bigShock ? 260 : 150, st.loopDmg * 0.5);
    if (st.flags.sparkLoop) {
      const k = st.flags.starfire ? 16 : 8;
      for (let i = 0; i < k; i++) fireSpark(w, f.cx, f.cy, i / k * 6.283, st.sparkDmg * 1.2);
    }
  }
}

function distToPolyCenter(f, e) {
  // Boss gilt als gefangen, wenn sein Zentrum knapp ausserhalb, aber die Schleife ihn grösstenteils umschliesst
  const dx = e.x - f.cx, dy = e.y - f.cy;
  return dx * dx + dy * dy < (e.r * 0.6) ** 2;
}

function cutTailAt(w, idx) {
  // entfernt alles bis einschliesslich idx (älterer Teil)
  const k = idx + 1;
  if (k >= w.tLen) return;
  w.tStart = tailIdx(w, k); w.tLen -= k;
}

// ---------- Spieler ----------
function updatePlayer(w, dt, input) {
  const p = w.p, st = w.stats;
  let mx = input.mx || 0, my = input.my || 0;
  const m = Math.hypot(mx, my);
  if (m > 1) { mx /= m; my /= m; }
  let spd = st.speed * (p.dashT > 0 ? 2.4 : 1);
  const tvx = mx * spd, tvy = my * spd;
  const k = Math.min(1, dt * (m > 0.05 ? 9 : 5));
  p.vx += (tvx - p.vx) * k + p.pullX * dt; p.vy += (tvy - p.vy) * k + p.pullY * dt;
  p.pullX = 0; p.pullY = 0;
  p.x += p.vx * dt; p.y += p.vy * dt;
  if (p.x < PR) { p.x = PR; p.vx = Math.abs(p.vx) * 0.3; } if (p.x > ARENA_W - PR) { p.x = ARENA_W - PR; p.vx = -Math.abs(p.vx) * 0.3; }
  if (p.y < PR) { p.y = PR; p.vy = Math.abs(p.vy) * 0.3; } if (p.y > ARENA_H - PR) { p.y = ARENA_H - PR; p.vy = -Math.abs(p.vy) * 0.3; }
  const sp = Math.hypot(p.vx, p.vy);
  if (sp > 20) { p.dirX = p.vx / sp; p.dirY = p.vy / sp; }
  if (p.inv > 0) p.inv -= dt;
  if (p.dashT > 0) p.dashT -= dt;
  if (p.netT > 0) p.netT -= dt;
  if (p.scd > 0) p.scd -= dt;
  if (st.regen > 0 && p.hp < st.maxHp) p.hp = Math.min(st.maxHp, p.hp + st.regen * dt);
  // Schweif
  const li = tailIdx(w, w.tLen - 1);
  const dx = p.x - w.tx[li], dy = p.y - w.ty[li];
  const d2 = dx * dx + dy * dy;
  if (d2 >= SPACING * SPACING) {
    const d = Math.sqrt(d2);
    if (d > SPACING * 3) { // Teleport/Knockback: Schweif nicht verbinden
      w.tStart = 0; w.tLen = 1; w.tx[0] = p.x; w.ty[0] = p.y;
    } else addTailPoint(w, p.x, p.y);
  }
  // Spezial
  if (input.special && p.scd <= 0) useSpecial(w);
}

function useSpecial(w) {
  const p = w.p, st = w.stats;
  p.scd = st.specialCd;
  if (st.special === 'dash') { p.dashT = 0.32; p.inv = Math.max(p.inv, 0.42); }
  else if (st.special === 'net') { p.netT = 3; }
  else if (st.special === 'nova') {
    for (let i = 0; i < 16; i++) fireSpark(w, p.x, p.y, i / 16 * 6.283, st.sparkDmg * 1.5);
    shockwave(w, p.x, p.y, 190, st.loopDmg * 1.1);
  }
  emit(w, EV.SPECIAL, p.x, p.y, 0, st.special === 'dash' ? 0 : st.special === 'net' ? 1 : 2);
}

// ---------- Gegner-KI ----------
function steer(e, tx, ty, spd, dt, k = 3) {
  const dx = tx - e.x, dy = ty - e.y, d = Math.hypot(dx, dy) || 1;
  const f = Math.min(1, dt * k);
  e.vx += (dx / d * spd - e.vx) * f; e.vy += (dy / d * spd - e.vy) * f;
}

function updateEnemies(w, dt) {
  const p = w.p, rng = w.rng;
  const tailTick = (w.tailTick -= dt) <= 0;
  if (tailTick) w.tailTick = 0.1;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.on) continue;
    e.t += dt;
    if (e.flash > 0) e.flash -= dt;
    if (e.burnT > 0) {
      e.burnT -= dt;
      e.burnAcc = (e.burnAcc || 0) + dt;
      if (e.burnAcc >= 0.5) { e.burnAcc = 0; damageEnemy(w, e, e.burnD * 0.5, 3, false); if (!e.on) continue; }
    }
    let sf = 1;
    if (e.freezeT > 0) { e.freezeT -= dt; sf = 0; } else if (e.slowT > 0) { e.slowT -= dt; sf = 1 - Math.max(0.5, w.stats.loopSlow); }
    const dx = p.x - e.x, dy = p.y - e.y, d = Math.hypot(dx, dy) || 1;
    const def = e.def;
    if (e.boss) bossAI(w, e, dt, dx, dy, d, sf);
    else switch (def.ai) {
      case 'chase': case 'splitter': steer(e, p.x, p.y, e.spd, dt); break;
      case 'swarm': {
        const j = Math.sin(e.t * 5 + e.ang) * 0.7;
        steer(e, p.x - dy / d * j * 80, p.y + dx / d * j * 80, e.spd, dt, 4); break;
      }
      case 'dart':
        if (e.state === 0) { steer(e, p.x, p.y, e.spd, dt); e.cd -= dt; if (e.cd <= 0 && d < 380) { e.state = 1; e.cd2 = 0.55; e.ang = Math.atan2(dy, dx); } }
        else if (e.state === 1) { e.vx *= 0.85; e.vy *= 0.85; e.cd2 -= dt; if (e.cd2 <= 0) { e.state = 2; e.cd2 = 0.55; e.vx = Math.cos(e.ang) * e.spd * 6; e.vy = Math.sin(e.ang) * e.spd * 6; } }
        else { e.cd2 -= dt; if (e.cd2 <= 0) { e.state = 0; e.cd = 2.2 + rng(); } }
        break;
      case 'shooter': {
        const want = d > 360 ? 1 : d < 270 ? -1 : 0;
        steer(e, e.x + dx / d * want * 100 - dy / d * 60, e.y + dy / d * want * 100 + dx / d * 60, e.spd, dt);
        e.cd -= dt;
        if (e.cd <= 0 && d < 600) { e.cd = 2.3 + rng() * 0.6; fireBullet(w, e.x, e.y, Math.atan2(dy, dx), 220, e.dmg * 0.8); emit(w, EV.SHOOT, e.x, e.y); }
        break;
      }
      case 'orbit': {
        e.tx = Math.max(90, e.tx - dt * 14);
        const a = Math.atan2(-dy, -dx) + dt * e.spd / e.tx;
        steer(e, p.x + Math.cos(a + 0.35) * e.tx, p.y + Math.sin(a + 0.35) * e.tx, e.spd, dt, 4);
        break;
      }
      case 'mine':
        e.vx *= 0.9; e.vy *= 0.9;
        if (e.state === 0 && d < 115) { e.state = 1; e.cd2 = 0.75; }
        if (e.state === 1) {
          e.cd2 -= dt;
          if (e.cd2 <= 0) {
            emit(w, EV.EXPLODE, e.x, e.y, 120);
            if (d < 120 + PR) hurtPlayer(w, e.dmg, e.x, e.y);
            for (let k = 0; k < 10; k++) fireBullet(w, e.x, e.y, k * 0.628, 150, e.dmg * 0.5);
            e.on = false; w.alive--; continue;
          }
        }
        break;
      case 'leech': {
        e.cd -= dt;
        if (e.cd <= 0) {
          e.cd = 0.3;
          let bi = -1, bd = 1e12;
          for (let k = 0; k < w.tLen - 3; k += 2) { const q = tailIdx(w, k); const dd = (w.tx[q] - e.x) ** 2 + (w.ty[q] - e.y) ** 2; if (dd < bd) { bd = dd; bi = k; } }
          if (bi >= 0 && bd < 400 * 400) { const q = tailIdx(w, bi); e.tx = w.tx[q]; e.ty = w.ty[q]; e.state = 1; } else e.state = 0;
        }
        if (e.state === 1) {
          steer(e, e.tx, e.ty, e.spd * 1.15, dt, 5);
          // Schweif anfressen
          for (let k = 0; k < w.tLen - 3; k++) {
            const q = tailIdx(w, k);
            if ((w.tx[q] - e.x) ** 2 + (w.ty[q] - e.y) ** 2 < (e.r + 5) ** 2) { emit(w, EV.CUT, w.tx[q], w.ty[q]); cutTailAt(w, k); e.state = 0; e.cd = 1.2; break; }
          }
        } else steer(e, p.x, p.y, e.spd, dt);
        break;
      }
      case 'blink':
        steer(e, p.x, p.y, e.spd, dt); e.cd -= dt;
        if (e.cd <= 0 && d < 700) {
          e.cd = 3 + rng() * 2;
          emit(w, EV.TELE, e.x, e.y);
          const a = rng() * 6.283; e.x = Math.max(20, Math.min(ARENA_W - 20, p.x + Math.cos(a) * 190)); e.y = Math.max(20, Math.min(ARENA_H - 20, p.y + Math.sin(a) * 190));
          e.vx = 0; e.vy = 0; emit(w, EV.TELE, e.x, e.y);
        }
        break;
      case 'spawner':
        steer(e, p.x, p.y, e.spd, dt); e.cd -= dt;
        if (e.cd <= 0 && d < 750) { e.cd = 4.2; for (let k = 0; k < 3; k++) spawnEnemy(w, w.data.enemyMap.mite, e.x + (k - 1) * 14, e.y + 10, false); }
        break;
      case 'healer': {
        e.cd -= dt;
        steer(e, p.x + (e.tx - 280) * 2, p.y, e.spd, dt);
        if (d < 250) steer(e, e.x - dx, e.y - dy, e.spd, dt);
        if (e.cd <= 0) {
          e.cd = 2.2; emit(w, EV.HEAL, e.x, e.y, 0, 1);
          for (let k = 0; k < w.enemies.length; k++) {
            const o = w.enemies[k];
            if (o.on && !o.boss && o !== e && (o.x - e.x) ** 2 + (o.y - e.y) ** 2 < 150 * 150) o.hp = Math.min(o.maxHp, o.hp + o.maxHp * 0.2);
          }
        }
        break;
      }
      case 'bomber': steer(e, p.x, p.y, e.spd, dt); break;
      case 'sniper':
        if (e.state === 0) {
          const want = d > 560 ? 1 : d < 420 ? -1 : 0;
          steer(e, e.x + dx / d * want * 100, e.y + dy / d * want * 100, e.spd, dt);
          e.cd -= dt; if (e.cd <= 0 && d < 750) { e.state = 1; e.cd2 = 1.0; }
        } else {
          e.vx *= 0.8; e.vy *= 0.8; e.ang = Math.atan2(dy, dx); e.cd2 -= dt;
          if (e.cd2 <= 0) { e.state = 0; e.cd = 3.5 + rng(); fireBullet(w, e.x, e.y, e.ang, 560, e.dmg, true); emit(w, EV.SHOOT, e.x, e.y, 1); }
        }
        break;
      case 'magnet':
        steer(e, p.x, p.y, e.spd, dt);
        if (d < 430) { p.pullX += -dx / d * 140; p.pullY += -dy / d * 140; }
        break;
      case 'phantom':
        steer(e, p.x, p.y, e.spd, dt);
        e.alpha = Math.max(0.12, Math.min(1, 1.25 - d / 380));
        break;
      case 'turret':
        e.vx *= 0.9; e.vy *= 0.9; e.cd -= dt;
        if (d < 680 && e.cd <= 0) {
          e.cd = 0.32; e.ang += 0.42; e.state++;
          fireBullet(w, e.x, e.y, e.ang, 160, e.dmg * 0.7);
          if (e.state % 14 === 0) e.cd = 2.2;
        }
        break;
      case 'kamikaze': steer(e, p.x, p.y, e.spd, dt, 2); break;
      case 'gold': {
        steer(e, e.x - dx, e.y - dy, e.spd * (d < 300 ? 1 : 0.6), dt, 2);
        if (e.x < 60 || e.x > ARENA_W - 60) e.vx += (ARENA_W / 2 - e.x) * dt * 3;
        if (e.y < 60 || e.y > ARENA_H - 60) e.vy += (ARENA_H / 2 - e.y) * dt * 3;
        if (e.t > 14) { emit(w, EV.GOLDESC, e.x, e.y); e.on = false; w.alive--; continue; }
        break;
      }
      default: steer(e, p.x, p.y, e.spd, dt);
    }
    e.x += e.vx * dt * sf; e.y += e.vy * dt * sf;
    if (e.x < 10) e.x = 10; else if (e.x > ARENA_W - 10) e.x = ARENA_W - 10;
    if (e.y < 10) e.y = 10; else if (e.y > ARENA_H - 10) e.y = ARENA_H - 10;
    // Kontakt mit Spieler
    if (d < e.r + PR && e.def.ai !== 'gold') {
      if (p.dashT > 0 && !e.boss) { damageEnemy(w, e, w.stats.tailDmg * 2, 2, true); if (!e.on) continue; }
      else if (hurtPlayer(w, e.dmg, e.x, e.y)) {
        if (w.stats.flags.thorns) damageEnemy(w, e, w.stats.loopDmg * 1.5 + e.maxHp * 0.15 * (e.boss ? 0 : 1), 2, false);
        if (def.ai === 'kamikaze' && e.on) { emit(w, EV.EXPLODE, e.x, e.y, 50); e.on = false; w.alive--; continue; }
        if (!e.on) continue;
        if (!e.boss) { e.vx -= dx / d * 200; e.vy -= dy / d * 200; }
      }
    }
    // Schweif-Kontakt (10 Hz)
    if (tailTick && w.tLen > 3) {
      const rr = (e.r + 7) ** 2;
      for (let k = 0; k < w.tLen - 2; k += 1) {
        const q = tailIdx(w, k);
        const ex = w.tx[q] - e.x, ey = w.ty[q] - e.y;
        if (ex * ex + ey * ey < rr) { damageEnemy(w, e, w.stats.tailDmg * 0.1, 2, true); break; }
      }
    }
  }
}

function bossAI(w, e, dt, dx, dy, d, sf) {
  const def = e.def, p = w.p, rng = w.rng;
  const enr = e.hp < e.maxHp * 0.5 ? 0.66 : 1;
  if (e.state === 2) { e.vx *= 0.9; e.vy *= 0.9; e.cd2 -= dt; if (e.cd2 <= 0) { e.state = 1; e.cd2 = 0.75; e.vx = Math.cos(e.ang) * e.spd * 6.5; e.vy = Math.sin(e.ang) * e.spd * 6.5; } }
  else if (e.state === 1) { e.cd2 -= dt; if (e.cd2 <= 0) e.state = 0; }
  else {
    const tv = d > 280 ? e.spd : d < 170 ? -e.spd * 0.6 : e.spd * 0.2;
    const f = Math.min(1, dt * 2);
    e.vx += ((dx / d) * tv - (dy / d) * e.spd * 0.4 - e.vx) * f; e.vy += ((dy / d) * tv + (dx / d) * e.spd * 0.4 - e.vy) * f;
  }
  if (sf === 0) return;
  for (let i = 0; i < def.patterns.length; i++) {
    e.pcd[i] -= dt;
    if (e.pcd[i] > 0) continue;
    const pt = def.patterns[i];
    e.pcd[i] = pt.cd * enr * (0.85 + rng() * 0.3);
    switch (pt.type) {
      case 'ring': { const o = rng() * 6.283; const n = Math.round(pt.n * (enr < 1 ? 1.3 : 1)); for (let k = 0; k < n; k++) fireBullet(w, e.x, e.y, o + k / n * 6.283, 165, e.dmg * 0.6); emit(w, EV.SHOOT, e.x, e.y, 2); break; }
      case 'aimed': { const a = Math.atan2(dy, dx); for (let k = 0; k < pt.n; k++) fireBullet(w, e.x, e.y, a + (k - (pt.n - 1) / 2) * 0.17, 270, e.dmg * 0.6); emit(w, EV.SHOOT, e.x, e.y, 2); break; }
      case 'spiral': e.spiralT = pt.dur; break;
      case 'charge': e.state = 2; e.cd2 = 0.7; e.ang = Math.atan2(dy, dx); emit(w, EV.TELE, e.x, e.y, 1, e.ang); break;
      case 'summon': { const sd = w.data.enemyMap[pt.enemy]; for (let k = 0; k < pt.n; k++) { const a = k / pt.n * 6.283; spawnEnemy(w, sd, e.x + Math.cos(a) * (e.r + 30), e.y + Math.sin(a) * (e.r + 30), false); } break; }
      case 'nova': addHazard(w, p.x + p.vx * 0.5, p.y + p.vy * 0.5, 130, 1.15, e.dmg * 1.2, 0, 1); break;
      case 'pull': e.pullT = pt.dur; break;
      case 'blink': { emit(w, EV.TELE, e.x, e.y); const a = rng() * 6.283; e.x = Math.max(80, Math.min(ARENA_W - 80, p.x + Math.cos(a) * 300)); e.y = Math.max(80, Math.min(ARENA_H - 80, p.y + Math.sin(a) * 300)); emit(w, EV.TELE, e.x, e.y); const o = rng() * 6.283; for (let k = 0; k < 10; k++) fireBullet(w, e.x, e.y, o + k * 0.628, 150, e.dmg * 0.5); break; }
    }
  }
  if (e.spiralT > 0) {
    e.spiralT -= dt; e.scd -= dt;
    if (e.scd <= 0) { e.scd = 0.085; e.sang += 0.37; fireBullet(w, e.x, e.y, e.sang, 180, e.dmg * 0.5); fireBullet(w, e.x, e.y, e.sang + 3.1416, 180, e.dmg * 0.5); }
  }
  if (e.pullT > 0) { e.pullT -= dt; p.pullX += -dx / d * 170; p.pullY += -dy / d * 170; }
}

export function addHazard(w, x, y, r, t, dmg, edmg, kind) {
  for (let i = 0; i < w.haz.length; i++) {
    const h = w.haz[i];
    if (h.on) continue;
    h.on = true; h.x = x; h.y = y; h.r = r; h.t = t; h.max = t; h.dmg = dmg; h.edmg = edmg; h.kind = kind;
    return h;
  }
  return null;
}

function updateHazards(w, dt) {
  for (let i = 0; i < w.haz.length; i++) {
    const h = w.haz[i];
    if (!h.on) continue;
    h.t -= dt;
    if (h.t > 0) continue;
    h.on = false;
    emit(w, EV.EXPLODE, h.x, h.y, h.r);
    const p = w.p;
    if ((p.x - h.x) ** 2 + (p.y - h.y) ** 2 < (h.r + PR) ** 2) hurtPlayer(w, h.dmg, h.x, h.y);
    if (h.edmg > 0) {
      for (let k = 0; k < w.enemies.length; k++) {
        const e = w.enemies[k];
        if (e.on && (e.x - h.x) ** 2 + (e.y - h.y) ** 2 < (h.r + e.r) ** 2) damageEnemy(w, e, h.edmg, 5, false);
      }
    }
  }
}

// ---------- Projektile & Pickups ----------
function updateProjectiles(w, dt) {
  const p = w.p, st = w.stats;
  for (let i = 0; i < w.bullets.length; i++) {
    const b = w.bullets[i];
    if (!b.on) continue;
    b.x += b.vx * dt; b.y += b.vy * dt; b.life -= dt;
    if (b.life <= 0 || b.x < -50 || b.y < -50 || b.x > ARENA_W + 50 || b.y > ARENA_H + 50) { b.on = false; continue; }
    if ((b.x - p.x) ** 2 + (b.y - p.y) ** 2 < (b.r + PR - 3) ** 2) { if (hurtPlayer(w, b.dmg, b.x, b.y)) b.on = false; }
  }
  // Auto-Funken
  if (st.sparkRate > 0) {
    w.sparkAcc += st.sparkRate * dt;
    while (w.sparkAcc >= 1) {
      w.sparkAcc -= 1;
      let best = null, bd = 520 * 520;
      for (let k = 0; k < w.enemies.length; k++) {
        const e = w.enemies[k];
        if (!e.on) continue;
        const dd = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
        if (dd < bd) { bd = dd; best = e; }
      }
      if (best) { fireSpark(w, p.x, p.y, Math.atan2(best.y - p.y, best.x - p.x) + (w.rng() - 0.5) * 0.15, st.sparkDmg); emit(w, EV.SHOOT, p.x, p.y, 3); }
    }
  }
  for (let i = 0; i < w.sparks.length; i++) {
    const s = w.sparks[i];
    if (!s.on) continue;
    s.x += s.vx * dt; s.y += s.vy * dt; s.life -= dt;
    if (s.life <= 0) { s.on = false; continue; }
    for (let k = 0; k < w.enemies.length; k++) {
      const e = w.enemies[k];
      if (!e.on) continue;
      if ((e.x - s.x) ** 2 + (e.y - s.y) ** 2 < (e.r + 5) ** 2) {
        damageEnemy(w, e, s.dmg, 4, true);
        s.hits++;
        if (!s.pierce || s.hits >= 4) { s.on = false; break; }
      }
    }
  }
}

function gainXp(w, v) {
  const g = v * w.stats.xpMult;
  w.xp += g; w.c.xpTotal += g;
}

function updatePicks(w, dt) {
  const p = w.p, st = w.stats, m2 = st.magnet * st.magnet;
  const all = w.bossDeadT > 0;
  for (let i = 0; i < w.picks.length; i++) {
    const q = w.picks[i];
    if (!q.on) continue;
    q.t += dt;
    const dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
    if (!q.mag && (d2 < m2 || all)) q.mag = true;
    if (q.mag) {
      const d = Math.sqrt(d2) || 1, s = 260 + q.t * 120 + (all ? 600 : 0);
      q.vx += (dx / d * s * 2.2 - q.vx) * Math.min(1, dt * 8); q.vy += (dy / d * s * 2.2 - q.vy) * Math.min(1, dt * 8);
    } else { q.vx *= 1 - Math.min(1, dt * 3); q.vy *= 1 - Math.min(1, dt * 3); }
    q.x += q.vx * dt; q.y += q.vy * dt;
    if (d2 < 22 * 22) {
      q.on = false;
      switch (q.kind) {
        case PICK.XP: gainXp(w, q.val); break;
        case PICK.DUST: case PICK.GOLD: w.dust += q.val; if (w.overdrive) w.odDust = (w.odDust || 0) + q.val; break;
        case PICK.HEART: p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.2); emit(w, EV.HEAL, p.x, p.y, st.maxHp * 0.2); break;
        case PICK.CHEST: w.c.chests++; emit(w, EV.CHEST, p.x, p.y); break;
        case PICK.SHARD: w.c.shards += q.val; break;
      }
      emit(w, EV.PICK, q.x, q.y, q.kind, q.val);
    }
  }
  if (w.xp >= w.xpNext && !w.pendingChoice && !w.over) levelUp(w);
}

// ---------- Run-Level & Perks ----------
function levelUp(w) {
  w.xp -= w.xpNext;
  w.lvl++;
  w.xpNext = Math.round(6 + w.lvl * 3.2 + Math.pow(w.lvl, 1.65) * 0.9);
  const opts = [];
  for (const pk of w.data.perkList) if ((w.perks[pk.id] || 0) < pk.max) opts.push(pk.id);
  if (!opts.length) return;
  shuffle(w.rng, opts);
  // Synergie-nahe Perks bevorzugen: verschiebe Perks, die eine Synergie vervollständigen, nach vorne
  const fl = w.stats.flags;
  for (let i = 0; i < opts.length; i++) {
    const pk = w.data.perkMap[opts[i]];
    if (!fl[pk.flag] && w.data.synergies.some((s) => s.req.includes(pk.flag) && s.req.every((f) => f === pk.flag || fl[f])) && w.rng() < 0.6) {
      const t = opts[0]; opts[0] = opts[i]; opts[i] = t; break;
    }
  }
  w.pendingChoice = opts.slice(0, fl.extraChoice ? 4 : 3);
  emit(w, EV.LEVEL, w.p.x, w.p.y, w.lvl);
}

export function choosePerk(w, idx) {
  if (!w.pendingChoice) return;
  const id = w.pendingChoice[Math.max(0, Math.min(w.pendingChoice.length - 1, idx | 0))];
  w.pendingChoice = null;
  w.perks[id] = (w.perks[id] || 0) + 1;
  w.c.perks++;
  const oldMax = w.stats.maxHp;
  w.stats = computeStats(w.data, w.save, w.classId, w.perks);
  if (w.stats.maxHp > oldMax) w.p.hp += w.stats.maxHp - oldMax;
  w.p.hp = Math.min(w.p.hp, w.stats.maxHp);
  for (const s of w.stats.synergies) if (!w.synSeen[s]) { w.synSeen[s] = true; w.c.synergies++; w.lastSyn = s; emit(w, EV.SYNERGY, w.p.x, w.p.y); }
  w.p.inv = Math.max(w.p.inv, 0.8);
  if (w.xp >= w.xpNext) levelUp(w);
}

// ---------- Boss, Events, Overdrive ----------
function onBossDeath(w, e) {
  w.c.bosses++;
  if (!w.bossHit) w.c.noHitBoss++;
  w.boss = null; w.bossDone = true; w.bossDeadT = 1.6; w.bossTime = w.t - w.bossSpawnT;
  w.c.shards += 1 + w.zi + (w.intensity - 1);
  emit(w, EV.BOSSDIE, e.x, e.y, e.r);
  const dust = e.dust * w.stats.dustMult * comboMult(w);
  for (let i = 0; i < 30; i++) dropPick(w, PICK.DUST, e.x, e.y, dust / 30);
  dropPick(w, PICK.CHEST, e.x, e.y, 1); dropPick(w, PICK.CHEST, e.x, e.y, 1);
  for (let i = 0; i < w.bullets.length; i++) w.bullets[i].on = false;
  for (let i = 0; i < w.enemies.length; i++) { const o = w.enemies[i]; if (o.on) { o.on = false; w.alive--; emit(w, EV.KILL, o.x, o.y, o.r, 0); } }
  for (let i = 0; i < w.haz.length; i++) w.haz[i].on = false;
}

function startEvent(w) {
  const ev = pickWeighted(w.rng, w.data.events);
  w.event = ev; w.eventsDone++; w.c.events++;
  emit(w, EV.EVENT, w.p.x, w.p.y, w.data.events.indexOf(ev));
  const p = w.p;
  if (ev.id === 'gold') spawnAround(w, w.data.enemyMap.gold, 300, false);
  else if (ev.id === 'rain') w.rainT = 8;
  else if (ev.id === 'elite') { for (let i = 0; i < 3; i++) { const ent = pickWeighted(w.rng, w.zone.enemies); const e = spawnAround(w, ent.def, 420, true); if (e) e.evElite = true; } }
  else if (ev.id === 'meteor') w.meteorT = 9;
  else if (ev.id === 'frenzy') w.frenzyT = 10;
}

function updateEvents(w, dt) {
  if (!w.event && w.t >= w.eventAt && !w.boss && !w.bossDone) startEvent(w);
  if (w.rainT > 0) {
    w.rainT -= dt;
    w.rainAcc = (w.rainAcc || 0) + dt * 14;
    while (w.rainAcc >= 1) { w.rainAcc--; const p = dropPick(w, PICK.DUST, w.p.x + (w.rng() - 0.5) * 700, w.p.y + (w.rng() - 0.5) * 500, 2 * w.zone.dustMult * w.stats.dustMult); if (p) { p.vx = 0; p.vy = 30; } }
  }
  if (w.meteorT > 0) {
    w.meteorT -= dt;
    w.metAcc = (w.metAcc || 0) + dt * 2.2;
    while (w.metAcc >= 1) { w.metAcc--; addHazard(w, w.p.x + (w.rng() - 0.5) * 800, w.p.y + (w.rng() - 0.5) * 600, 90 + w.rng() * 50, 1.3, 14 * w.dmgScale, w.stats.loopDmg * 3, 2); }
  }
  if (w.frenzyT > 0) w.frenzyT -= dt;
}

export function decideOverdrive(w, go) {
  if (!w.pendingOverdrive) return;
  w.pendingOverdrive = false;
  if (go) {
    w.overdrive = true; w.odEnd = w.t + 60; w.odStartDust = w.dust; w.odDust = 0; w.odChestT = 20;
    w.bossDone = true; w.p.inv = 1.5;
    emit(w, EV.OD, w.p.x, w.p.y);
  } else endRun(w, true);
}

function endRun(w, victory) {
  if (w.over) return;
  w.over = true;
  let dust = w.dust;
  let odClear = false;
  if (w.overdrive) {
    const od = w.odDust || 0;
    if (victory) { dust += od; odClear = true; } else dust -= od * 0.5;
  }
  const c = w.c;
  w.result = {
    victory, zoneId: w.zone.id, intensity: w.intensity, classId: w.classId, time: Math.round(w.t), seed: w.seed,
    kills: c.kills, loops: c.loops, elites: c.elites, bosses: c.bosses, dust: Math.round(dust), xp: Math.round(c.xpTotal * 0.6 + c.bosses * 40 + w.t * 0.3),
    shards: c.shards, chests: c.chests, bestCatch: c.bestCatch, bestCombo: c.bestCombo, perks: c.perks, synergies: c.synergies,
    goldKills: c.goldKills, events: c.events, noHitBoss: c.noHitBoss, revives: c.revives, odClears: odClear ? 1 : 0,
    overdrive: w.overdrive, runs: 1, lvl: w.lvl, dmgTaken: Math.round(c.dmgTaken), perkList: Object.assign({}, w.perks), bossTime: Math.round(w.bossTime || 0), reachedBoss: w.bossSpawnT > 0
  };
}

export function abortRun(w) { endRun(w, false); }

// ---------- Hauptschritt ----------
export function stepRun(w, dt, input) {
  if (w.over || w.pendingChoice || w.pendingOverdrive) return;
  w.t += dt;
  if (w.comboT > 0) { w.comboT -= dt; if (w.comboT <= 0) w.combo = 0; }
  updatePlayer(w, dt, input);
  updateSpawning(w, dt);
  updateEnemies(w, dt);
  updateProjectiles(w, dt);
  updateHazards(w, dt);
  updatePicks(w, dt);
  updateEvents(w, dt);
  // Echo-Schleifen
  for (let i = 0; i < w.flashes.length; i++) {
    const f = w.flashes[i];
    if (f.t > 0) f.t -= dt;
    if (f.echoT > 0) { f.echoT -= dt; if (f.echoT <= 0) { f.t = 0.5; emit(w, EV.LOOP, f.cx, f.cy, -1, 0); resolveLoop(w, f, 0.6); } }
  }
  if (!w.boss && !w.bossDone && w.t >= w.bossAt) spawnBoss(w);
  // Kernbruch: nach 50 s verliert der Boss stetig LP – Bosskämpfe bleiben kurz
  if (w.boss && w.t - w.bossSpawnT > 50) {
    const b = w.boss;
    if (!w.coreBreak) { w.coreBreak = true; emit(w, EV.CORE, b.x, b.y); }
    b.hp -= b.maxHp * 0.011 * dt;
    if (b.hp <= 0) { b.hp = 1; damageEnemy(w, b, 2, 3, false); }
  }
  if (w.bossDeadT > 0) { w.bossDeadT -= dt; if (w.bossDeadT <= 0 && !w.overdrive) w.pendingOverdrive = true; }
  if (w.overdrive) {
    w.odChestT -= dt;
    if (w.odChestT <= 0) { w.odChestT = 20; w.c.chests++; emit(w, EV.CHEST, w.p.x, w.p.y); }
    if (w.t >= w.odEnd) { endRun(w, true); return; }
  }
  if (w.p.hp <= 0) {
    if (w.stats.flags.revive && !w.p.revived) {
      w.p.revived = true; w.p.hp = w.stats.maxHp * 0.5; w.p.inv = 2.5; w.c.revives++;
      emit(w, EV.REVIVE, w.p.x, w.p.y);
      shockwave(w, w.p.x, w.p.y, 320, w.stats.loopDmg * 2);
      for (let i = 0; i < w.bullets.length; i++) w.bullets[i].on = false;
    } else endRun(w, false);
  }
}

// Hilfen für Renderer/Bot
export function tailPoint(w, i, out) { const q = tailIdx(w, i); out[0] = w.tx[q]; out[1] = w.ty[q]; return out; }
