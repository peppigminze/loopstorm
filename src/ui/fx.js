// Visuelle Effekte mit Objekt-Pools. Übersetzt Simulations-Events in Partikel, Sounds, Shake & Hitstop.
import { EV, PICK } from '../logic/run.js';

const MAXP = 1400, MAXT = 90, MAXR = 40, MAXL = 24;

export function createFx(audio) {
  const parts = []; for (let i = 0; i < MAXP; i++) parts.push({ on: false, x: 0, y: 0, vx: 0, vy: 0, life: 0, max: 1, size: 2, color: '#fff', drag: 3 });
  const texts = []; for (let i = 0; i < MAXT; i++) texts.push({ on: false, x: 0, y: 0, vy: 0, life: 0, max: 1, text: '', color: '#fff', size: 14 });
  const rings = []; for (let i = 0; i < MAXR; i++) rings.push({ on: false, x: 0, y: 0, r: 0, r2: 0, life: 0, max: 1, color: '#fff', w: 3 });
  const lines = []; for (let i = 0; i < MAXL; i++) lines.push({ on: false, x: 0, y: 0, x2: 0, y2: 0, life: 0, max: 1, color: '#fff' });
  let pi = 0, ti = 0, ri = 0, li = 0;
  const fx = {
    parts, texts, rings, lines, shake: 0, shakeOn: true, hitstop: 0, flash: 0, flashColor: '#fff', quality: 1,
    banner: null, comboPulse: 0, hurtT: 0, lastLoop: 0, catchText: null,
    burst(x, y, n, color, speed = 200, size = 3, life = 0.6) {
      n = Math.ceil(n * fx.quality);
      for (let k = 0; k < n; k++) {
        const p = parts[pi]; pi = (pi + 1) % MAXP;
        const a = Math.random() * 6.283, s = speed * (0.3 + Math.random() * 0.9);
        p.on = true; p.x = x; p.y = y; p.vx = Math.cos(a) * s; p.vy = Math.sin(a) * s; p.life = p.max = life * (0.6 + Math.random() * 0.6);
        p.size = size * (0.6 + Math.random() * 0.8); p.color = color; p.drag = 3;
      }
    },
    text(x, y, text, color = '#fff', size = 14, life = 0.8) {
      const t = texts[ti]; ti = (ti + 1) % MAXT;
      t.on = true; t.x = x + (Math.random() - 0.5) * 10; t.y = y; t.vy = -60; t.life = t.max = life; t.text = text; t.color = color; t.size = size;
    },
    ring(x, y, r, r2, color, life = 0.45, w = 3) {
      const g = rings[ri]; ri = (ri + 1) % MAXR;
      g.on = true; g.x = x; g.y = y; g.r = r; g.r2 = r2; g.life = g.max = life; g.color = color; g.w = w;
    },
    line(x, y, x2, y2, color, life = 0.25) {
      const l = lines[li]; li = (li + 1) % MAXL;
      l.on = true; l.x = x; l.y = y; l.x2 = x2; l.y2 = y2; l.life = l.max = life; l.color = color;
    },
    addShake(v) { if (fx.shakeOn) fx.shake = Math.min(22, fx.shake + v); },
    showBanner(text, sub = '', color = '#fff', dur = 2.2) { fx.banner = { text, sub, color, t: dur, max: dur }; },
    update(dt) {
      for (let i = 0; i < MAXP; i++) { const p = parts[i]; if (!p.on) continue; p.life -= dt; if (p.life <= 0) { p.on = false; continue; } const d = 1 - Math.min(1, dt * p.drag); p.vx *= d; p.vy *= d; p.x += p.vx * dt; p.y += p.vy * dt; }
      for (let i = 0; i < MAXT; i++) { const t = texts[i]; if (!t.on) continue; t.life -= dt; if (t.life <= 0) { t.on = false; continue; } t.y += t.vy * dt; t.vy *= 1 - Math.min(1, dt * 3); }
      for (let i = 0; i < MAXR; i++) { const g = rings[i]; if (g.on && (g.life -= dt) <= 0) g.on = false; }
      for (let i = 0; i < MAXL; i++) { const l = lines[i]; if (l.on && (l.life -= dt) <= 0) l.on = false; }
      fx.shake = Math.max(0, fx.shake - dt * 40);
      if (fx.flash > 0) fx.flash -= dt * 3;
      if (fx.banner && (fx.banner.t -= dt) <= 0) fx.banner = null;
      if (fx.comboPulse > 0) fx.comboPulse -= dt * 4;
      if (fx.hurtT > 0) fx.hurtT -= dt;
      if (fx.catchText && (fx.catchText.t -= dt) <= 0) fx.catchText = null;
    },
    clear() { for (const a of [parts, texts, rings, lines]) for (const o of a) o.on = false; fx.banner = null; fx.shake = 0; fx.hitstop = 0; fx.catchText = null; },
    // Simulations-Events abarbeiten
    consume(w, silent = false) {
      const col = w.stats.color, pal = w.zone.pal, A = silent ? null : audio;
      for (let i = 0; i < w.evN; i++) {
        const e = w.evs[i];
        switch (e.type) {
          case EV.HIT: if (e.a >= 6 || e.b === 1) fx.text(e.x, e.y, String(Math.round(e.a)), e.b === 1 ? '#ffffff' : '#ffd6a8', e.b === 1 ? 15 : 11, 0.55); A && A.play('hit', e.b); break;
          case EV.CRIT: fx.text(e.x, e.y, Math.round(e.a) + '!', '#ffe14d', 19, 0.75); fx.burst(e.x, e.y, 4, '#ffe14d', 160, 2); A && A.play('hit', 3); break;
          case EV.KILL:
            fx.burst(e.x, e.y, e.b === 2 ? 26 : 9, e.b === 2 ? '#ffd700' : pal.accent, e.b === 2 ? 320 : 190, e.b === 2 ? 4 : 2.6, 0.55);
            if (e.b === 2) { fx.ring(e.x, e.y, 10, 90, '#ffd700', 0.5); fx.addShake(6); }
            A && A.play('kill', e.b); break;
          case EV.LOOP:
            if (e.a < 0) { fx.ring(e.x, e.y, 20, 140, col, 0.4, 2); A && A.play('echo'); break; }
            fx.lastLoop = 0.6;
            if (e.a > 0) {
              fx.ring(e.x, e.y, 10, 60 + e.a * 10, col, 0.5, 4);
              fx.burst(e.x, e.y, 10 + e.a * 2, col, 260, 3, 0.7);
              fx.addShake(Math.min(14, 2 + e.a * 0.9));
              fx.hitstop = Math.min(0.11, 0.015 + e.a * 0.007);
              if (e.a >= 3) fx.catchText = { n: e.a, t: 1.1, max: 1.1 };
            }
            A && A.play('loop', e.a); break;
          case EV.PICK:
            if (e.a === PICK.GOLD) A && A.play('gold');
            else if (e.a === PICK.DUST || e.a === PICK.XP) A && A.play('pick', w.combo);
            else if (e.a === PICK.HEART) { fx.text(e.x, e.y, '+LP', '#7dff8a', 16); A && A.play('heal'); }
            break;
          case EV.HURT: fx.addShake(9); fx.flash = 0.6; fx.flashColor = '#ff2040'; fx.hurtT = 0.4; fx.burst(e.x, e.y, 14, '#ff4060', 220, 3); fx.text(e.x, e.y - 20, '-' + Math.round(e.a), '#ff6070', 16); A && A.play('hurt'); break;
          case EV.LEVEL: fx.ring(e.x, e.y, 10, 160, '#ffffff', 0.6, 4); A && A.play('level'); break;
          case EV.BOSS: fx.showBanner(w.boss ? w.boss.def.name : 'BOSS', 'erscheint', w.zone.pal.accent, 2.6); fx.addShake(16); A && A.play('boss'); A && A.setIntensity(2); break;
          case EV.BOSSDIE: fx.hitstop = 0.25; fx.addShake(22); fx.flash = 1; fx.flashColor = '#ffffff'; for (let k = 0; k < 5; k++) fx.ring(e.x, e.y, 10, 120 + k * 80, k % 2 ? '#ffffff' : pal.accent, 0.6 + k * 0.15, 5); fx.burst(e.x, e.y, 120, pal.accent, 520, 5, 1.2); fx.showBanner('BOSS BESIEGT', '', '#ffffff', 2); A && A.play('bossdie'); A && A.setIntensity(1); break;
          case EV.SPECIAL: fx.ring(e.x, e.y, 10, e.b === 2 ? 190 : 70, col, 0.4, e.b === 2 ? 6 : 3); if (e.b === 2) fx.addShake(10); A && A.play('special', e.b); break;
          case EV.SHOOT: A && A.play('shoot', e.a); break;
          case EV.EXPLODE: fx.ring(e.x, e.y, 5, e.a, '#ffab40', 0.4, 5); fx.burst(e.x, e.y, 8 + e.a / 8, '#ffab40', e.a * 3, 3.5); fx.addShake(e.a / 14); A && A.play('explode', e.a); break;
          case EV.SHOCK: fx.ring(e.x, e.y, 10, e.a, '#ffffff', 0.35, 3); A && A.play('shock'); break;
          case EV.CHAIN: fx.line(e.x, e.y, e.a, e.b, '#bfe8ff', 0.22); A && A.play('chain'); break;
          case EV.EVENT: { const ev = w.data.events[e.a]; fx.showBanner(ev.name, ev.desc, '#ffd700', 3); A && A.play('event'); break; }
          case EV.TELE: fx.ring(e.x, e.y, 2, 30, '#c8d0ff', 0.3, 2); A && A.play('tele'); break;
          case EV.CUT: fx.burst(e.x, e.y, 14, '#e05cff', 200, 2.5); fx.text(e.x, e.y, 'SCHNITT', '#e05cff', 13); A && A.play('cut'); break;
          case EV.CHEST: fx.text(e.x, e.y - 30, 'TRUHE!', '#ffd700', 20, 1.2); fx.ring(e.x, e.y, 5, 80, '#ffd700', 0.5); A && A.play('chest'); break;
          case EV.HEAL: if (e.b === 1) fx.ring(e.x, e.y, 10, 150, '#7dff8a', 0.4, 2); else if (e.a >= 1) fx.text(e.x, e.y - 18, '+' + Math.round(e.a), '#7dff8a', 13); if (!e.b) A && A.play('heal'); break;
          case EV.SYNERGY: { const s = w.data.synergies.find((x) => x.id === w.lastSyn); fx.showBanner('SYNERGIE: ' + (s ? s.name : ''), s ? s.desc : '', '#7ffff3', 2.8); fx.ring(e.x, e.y, 10, 260, '#7ffff3', 0.8, 6); A && A.play('synergy'); break; }
          case EV.WAVE: fx.showBanner('WELLE', 'Kreise sie ein!', pal.accent, 1.4); break;
          case EV.REVIVE: fx.showBanner('ZWEITES LEBEN', '', '#7dff8a', 2); fx.flash = 1; fx.flashColor = '#7dff8a'; fx.ring(e.x, e.y, 10, 320, '#7dff8a', 0.7, 8); A && A.play('synergy'); break;
          case EV.OD: fx.showBanner('OVERDRIVE', '60 Sekunden. Doppelte Beute.', '#ff4d6d', 2.6); fx.flash = 0.8; fx.flashColor = '#ff4d6d'; A && A.play('od'); A && A.setIntensity(2); break;
          case EV.CORE: fx.showBanner('KERNBRUCH', 'Der Boss zerfällt – halte durch!', '#ff7ff0', 2.2); fx.addShake(8); A && A.play('cut'); break;
          case EV.GOLDESC: fx.text(e.x, e.y, 'ENTKOMMEN…', '#ffd700', 16, 1.4); break;
        }
      }
      w.evN = 0;
    }
  };
  return fx;
}
