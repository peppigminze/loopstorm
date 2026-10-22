// Simulations-Bot: steuert einen Run wie ein Mensch (kreisen um Gegnergruppen, ausweichen, sammeln).
// skill 0..1: Reaktionszeit, Präzision und Ausweichen.
import { ARENA_W, ARENA_H } from './run.js';

export function createBot(skill = 0.6, seed = 1) {
  let s = seed >>> 0;
  const rnd = () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
  return { skill, rnd, t: 0, mx: 0, my: 0, dir: rnd() < 0.5 ? 1 : -1, cx: 0, cy: 0, hasC: false, lap: 0, special: false, flip: 0 };
}

export function botThink(bot, w, dt, out) {
  bot.t -= dt;
  out.special = false;
  if (bot.t > 0) { out.mx = bot.mx; out.my = bot.my; return out; }
  bot.t = 0.05 + (1 - bot.skill) * 0.2;
  const p = w.p, st = w.stats;
  // Zielzentrum: Boss oder Schwerpunkt naher Gegner
  let cx = 0, cy = 0, n = 0, near = 0;
  let target = w.boss;
  for (let i = 0; i < w.enemies.length; i++) {
    const e = w.enemies[i];
    if (!e.on) continue;
    const d2 = (e.x - p.x) ** 2 + (e.y - p.y) ** 2;
    if (d2 < 140 * 140) near++;
    if (e.def.id === 'gold' && d2 < 700 * 700) target = e;
    if (d2 < 420 * 420) { cx += e.x; cy += e.y; n++; }
  }
  let mx = 0, my = 0;
  const tailR = Math.max(55, (st.tailLen * 10) / 6.283 * 0.78);
  if (target) { cx = target.x; cy = target.y; n = Math.max(n, 1); }
  else if (n > 0) { cx /= n; cy /= n; }
  if (n > 0) {
    // Kreiszentrum festhalten, bis eine Runde geflogen ist – so entstehen echte Schleifen
    bot.lap -= bot.t;
    const R = target ? Math.min(tailR, target.r + 60) : Math.min(tailR, 75 + n * 5);
    if (!bot.hasC || bot.lap <= 0 || target) {
      // neues Zentrum: Richtung Gegner-Schwerpunkt, aber höchstens R vom Spieler entfernt
      let vx = cx - p.x, vy = cy - p.y; const vd = Math.hypot(vx, vy) || 1;
      const dist = target ? vd : Math.min(vd, R);
      bot.cx = p.x + vx / vd * dist; bot.cy = p.y + vy / vd * dist; bot.hasC = true;
      bot.lap = (6.283 * R) / st.speed * (1.1 + bot.rnd() * 0.4);
    }
    const dx = p.x - bot.cx, dy = p.y - bot.cy, d = Math.hypot(dx, dy) || 1;
    const tx = -dy / d * bot.dir, ty = dx / d * bot.dir;
    const rad = (R - d) / R;
    mx = tx + dx / d * rad * 1.6; my = ty + dy / d * rad * 1.6;
  } else {
    bot.hasC = false;
    // Pickups oder Arena-Mitte
    let best = null, bd = 1e12;
    for (let i = 0; i < w.picks.length; i++) { const q = w.picks[i]; if (!q.on) continue; const d2 = (q.x - p.x) ** 2 + (q.y - p.y) ** 2; if (d2 < bd) { bd = d2; best = q; } }
    if (best) { mx = best.x - p.x; my = best.y - p.y; }
    else { mx = ARENA_W / 2 - p.x + Math.cos(w.t) * 300; my = ARENA_H / 2 - p.y + Math.sin(w.t) * 300; }
  }
  // Ausweichen vor Kugeln/Gefahren (abhängig vom Skill)
  const look = 70 + bot.skill * 90;
  let ax = 0, ay = 0;
  for (let i = 0; i < w.bullets.length; i++) {
    const b = w.bullets[i];
    if (!b.on) continue;
    const dx = p.x - b.x, dy = p.y - b.y, d2 = dx * dx + dy * dy;
    if (d2 > look * look) continue;
    if (dx * b.vx + dy * b.vy <= 0) continue;
    const d = Math.sqrt(d2) || 1;
    const sideX = -b.vy, sideY = b.vx, sl = Math.hypot(sideX, sideY) || 1;
    const sgn = (dx * sideX + dy * sideY) >= 0 ? 1 : -1;
    ax += sideX / sl * sgn * (look / d); ay += sideY / sl * sgn * (look / d);
  }
  for (let i = 0; i < w.haz.length; i++) {
    const h = w.haz[i];
    if (!h.on) continue;
    const dx = p.x - h.x, dy = p.y - h.y, d = Math.hypot(dx, dy) || 1;
    if (d < h.r + 40) { ax += dx / d * 3; ay += dy / d * 3; }
  }
  const dodge = 0.35 + bot.skill * 0.9;
  mx += ax * dodge; my += ay * dodge;
  // Niedrige LP: Abstand halten
  if (p.hp < st.maxHp * 0.3 && n > 0 && !target) {
    const dx = p.x - cx, dy = p.y - cy, d = Math.hypot(dx, dy) || 1;
    mx += dx / d * 0.8; my += dy / d * 0.8;
  }
  // Wände meiden
  if (p.x < 120) mx += 1.5; if (p.x > ARENA_W - 120) mx -= 1.5;
  if (p.y < 120) my += 1.5; if (p.y > ARENA_H - 120) my -= 1.5;
  // Ungenauigkeit
  const noise = (1 - bot.skill) * 0.9;
  mx += (bot.rnd() - 0.5) * noise; my += (bot.rnd() - 0.5) * noise;
  const m = Math.hypot(mx, my) || 1;
  bot.mx = mx / m; bot.my = my / m;
  out.mx = bot.mx; out.my = bot.my;
  if (p.scd <= 0 && (near >= 4 || (p.hp < st.maxHp * 0.35 && near >= 1) || (w.boss && st.special !== 'dash'))) out.special = bot.rnd() < 0.3 + bot.skill * 0.6;
  bot.flip -= 0.05 + (1 - bot.skill) * 0.2;
  if (bot.flip < -30) { bot.flip = 0; bot.dir = -bot.dir; }
  return out;
}

// Perk-Wahl: bevorzugt Schaden/Synergien, mit Zufall
const PRIO = { wucht: 5, lang: 4, fang: 4, glut: 4, kette: 4, schock: 4, echo: 4, vital: 3, regen: 3, klinge: 3, krit: 3, funken: 3, stern: 3, vampir: 3, tempo: 2, panzer: 2, magnet: 2, gier: 2, zeit: 2, dorn: 2 };
export function botPickPerk(bot, w) {
  const opts = w.pendingChoice;
  let best = 0, bs = -1;
  for (let i = 0; i < opts.length; i++) {
    const sc = (PRIO[opts[i]] || 1) + bot.rnd() * 3;
    if (sc > bs) { bs = sc; best = i; }
  }
  return best;
}
