// Canvas-Renderer: Welt, Effekte, HUD. Glow über vorgerenderte Sprites (kein shadowBlur -> mobil flüssig).
import { ARENA_W, ARENA_H, PICK } from '../logic/run.js';
import { mulberry32 } from '../logic/rng.js';

const TAU = Math.PI * 2;
const SHAPES = {};
(function () {
  const poly = (n, rot = -Math.PI / 2, inner = 0) => {
    const a = [];
    const m = inner ? n * 2 : n;
    for (let i = 0; i < m; i++) { const r = inner && i % 2 ? inner : 1; const t = rot + i / m * TAU; a.push(Math.cos(t) * r, Math.sin(t) * r); }
    return new Float32Array(a);
  };
  SHAPES.tri = poly(3); SHAPES.square = poly(4, Math.PI / 4); SHAPES.diamond = new Float32Array([0, -1.25, 0.8, 0, 0, 1.25, -0.8, 0]);
  SHAPES.hex = poly(6, 0); SHAPES.star = poly(5, -Math.PI / 2, 0.48); SHAPES.plus = new Float32Array([-0.35, -1, 0.35, -1, 0.35, -0.35, 1, -0.35, 1, 0.35, 0.35, 0.35, 0.35, 1, -0.35, 1, -0.35, 0.35, -1, 0.35, -1, -0.35, -0.35, -0.35]);
  SHAPES.shield = new Float32Array([0, -1.1, 0.95, -0.6, 0.85, 0.4, 0, 1.1, -0.85, 0.4, -0.95, -0.6]);
})();

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d', { alpha: false });
  const R = { W: 0, H: 0, dpr: 1, zoom: 1, cam: { x: ARENA_W / 2, y: ARENA_H / 2 }, quality: 1, glowCache: new Map(), vignette: null, deco: {}, stars: null, layout: {}, t: 0 };

  function glow(color, r) {
    const key = color + r;
    let c = R.glowCache.get(key);
    if (c) return c;
    c = document.createElement('canvas'); c.width = c.height = r * 2;
    const g = c.getContext('2d'), gr = g.createRadialGradient(r, r, 0, r, r, r);
    gr.addColorStop(0, color); gr.addColorStop(0.25, color + 'aa'); gr.addColorStop(1, color + '00');
    g.fillStyle = gr; g.fillRect(0, 0, r * 2, r * 2);
    R.glowCache.set(key, c);
    return c;
  }

  R.resize = (lowQ) => {
    R.dpr = Math.min(window.devicePixelRatio || 1, lowQ ? 1 : 2);
    R.W = canvas.clientWidth || innerWidth; R.H = canvas.clientHeight || innerHeight;
    canvas.width = Math.round(R.W * R.dpr); canvas.height = Math.round(R.H * R.dpr);
    R.zoom = Math.max(0.52, Math.min(1.15, Math.min(R.W, R.H) / 680));
    const v = document.createElement('canvas'); v.width = 256; v.height = 256;
    const g = v.getContext('2d'), gr = g.createRadialGradient(128, 128, 60, 128, 128, 180);
    gr.addColorStop(0, 'rgba(255,0,40,0)'); gr.addColorStop(1, 'rgba(255,0,40,0.75)');
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256); R.vignette = v;
    const small = R.W < 600;
    R.layout = {
      pause: { x: R.W - 52, y: 10, w: 42, h: 42 },
      special: { x: R.W - (small ? 62 : 74), y: R.H - (small ? 72 : 84), r: small ? 36 : 40 },
      small
    };
  };

  function makeStars(zone) {
    const rng = mulberry32(zone.id.length * 991 + zone.diff * 100);
    const s = [];
    for (let i = 0; i < 160; i++) s.push({ x: rng(), y: rng(), z: 0.15 + rng() * 0.5, s: rng() < 0.1 ? 2 : 1 });
    const deco = [];
    for (let i = 0; i < 110; i++) deco.push({ x: rng() * ARENA_W, y: rng() * ARENA_H, r: 20 + rng() * 70, a: rng() * TAU, v: (rng() - 0.5) * 0.6, k: rng() });
    return { s, deco, id: zone.id };
  }

  function drawBackground(w, ox, oy, k) {
    const z = w.zone, pal = z.pal, d = R.dpr;
    if (!R.stars || R.stars.id !== z.id) R.stars = makeStars(z);
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = pal.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
    // Nebel-Flecken (parallax)
    ctx.globalCompositeOperation = 'lighter';
    const neb = glow(pal.bg2, 128);
    for (let i = 0; i < 5; i++) {
      const st = R.stars.s[i];
      const sx = ((st.x * 2400 - R.cam.x * 0.2) % 2400 + 2400) % 2400 - 400, sy = ((st.y * 1800 - R.cam.y * 0.2) % 1800 + 1800) % 1800 - 400;
      ctx.globalAlpha = 0.9; ctx.drawImage(neb, sx * d, sy * d, 900 * d, 900 * d);
    }
    // Sterne
    ctx.fillStyle = pal.star;
    const W = canvas.width, H = canvas.height;
    for (const st of R.stars.s) {
      const x = ((st.x * W * 1.3 - R.cam.x * st.z * k) % W + W) % W, y = ((st.y * H * 1.3 - R.cam.y * st.z * k) % H + H) % H;
      ctx.globalAlpha = 0.25 + st.z; ctx.fillRect(x, y, st.s * d, st.s * d);
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
    // Welt-Raster
    ctx.setTransform(k, 0, 0, k, ox, oy);
    const vx0 = R.cam.x - R.W / 2 / R.zoom - 40, vx1 = R.cam.x + R.W / 2 / R.zoom + 40, vy0 = R.cam.y - R.H / 2 / R.zoom - 40, vy1 = R.cam.y + R.H / 2 / R.zoom + 40;
    ctx.strokeStyle = pal.grid; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.55;
    ctx.beginPath();
    const G = 160;
    for (let x = Math.max(0, Math.floor(vx0 / G) * G); x <= Math.min(ARENA_W, vx1); x += G) { ctx.moveTo(x, Math.max(0, vy0)); ctx.lineTo(x, Math.min(ARENA_H, vy1)); }
    for (let y = Math.max(0, Math.floor(vy0 / G) * G); y <= Math.min(ARENA_H, vy1); y += G) { ctx.moveTo(Math.max(0, vx0), y); ctx.lineTo(Math.min(ARENA_W, vx1), y); }
    ctx.stroke(); ctx.globalAlpha = 1;
    drawDeco(w, vx0, vx1, vy0, vy1);
    // Arena-Rand
    ctx.strokeStyle = pal.accent; ctx.lineWidth = 4; ctx.globalAlpha = 0.5 + Math.sin(R.t * 2) * 0.15;
    ctx.strokeRect(0, 0, ARENA_W, ARENA_H); ctx.globalAlpha = 1;
    return [vx0, vx1, vy0, vy1];
  }

  function drawDeco(w, x0, x1, y0, y1) {
    const pal = w.zone.pal, t = R.t, kind = w.zone.deco;
    ctx.lineWidth = 2;
    for (const o of R.stars.deco) {
      if (o.x < x0 - o.r || o.x > x1 + o.r || o.y < y0 - o.r || o.y > y1 + o.r) continue;
      switch (kind) {
        case 'rocks': {
          ctx.fillStyle = pal.bg2; ctx.strokeStyle = pal.grid; ctx.beginPath();
          for (let i = 0; i < 7; i++) { const a = o.a + i / 7 * TAU + t * o.v * 0.1, rr = o.r * (0.6 + ((i * 37 + o.k * 100) % 10) / 25); ctx.lineTo(o.x + Math.cos(a) * rr, o.y + Math.sin(a) * rr); }
          ctx.closePath(); ctx.globalAlpha = 0.38; ctx.fill(); ctx.stroke(); break;
        }
        case 'bubbles': ctx.strokeStyle = o.k < 0.5 ? pal.accent : pal.star; ctx.globalAlpha = 0.14; ctx.beginPath(); ctx.arc(o.x, o.y + Math.sin(t + o.a) * 12, o.r * (0.9 + Math.sin(t * 1.3 + o.a) * 0.1), 0, TAU); ctx.stroke(); break;
        case 'crystals': {
          ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.18 + Math.sin(t * 2 + o.a) * 0.08; ctx.beginPath();
          const c = Math.cos(o.a), s = Math.sin(o.a);
          ctx.moveTo(o.x + c * o.r, o.y + s * o.r); ctx.lineTo(o.x - s * o.r * 0.25, o.y + c * o.r * 0.25); ctx.lineTo(o.x - c * o.r, o.y - s * o.r); ctx.lineTo(o.x + s * o.r * 0.25, o.y - c * o.r * 0.25); ctx.closePath(); ctx.stroke(); break;
        }
        case 'embers': { const yy = o.y - ((t * 30 * (0.5 + o.k)) % 200); ctx.fillStyle = o.k < 0.5 ? pal.accent : pal.star; ctx.globalAlpha = 0.35 * (1 - ((t * 30 * (0.5 + o.k)) % 200) / 200); ctx.fillRect(o.x, yy, 3, 3); break; }
        case 'prisms': {
          ctx.strokeStyle = o.k < 0.5 ? pal.accent : pal.star; ctx.globalAlpha = 0.2; ctx.beginPath();
          for (let i = 0; i < 3; i++) { const a = o.a + t * o.v + i / 3 * TAU; ctx.lineTo(o.x + Math.cos(a) * o.r, o.y + Math.sin(a) * o.r); }
          ctx.closePath(); ctx.stroke(); break;
        }
        case 'void': { const ph = (t * 0.3 + o.k) % 1; ctx.strokeStyle = pal.accent; ctx.globalAlpha = 0.16 * (1 - ph); ctx.beginPath(); ctx.arc(o.x, o.y, o.r * ph * 1.6, 0, TAU); ctx.stroke(); break; }
      }
    }
    ctx.globalAlpha = 1;
  }

  function shapePath(sh, x, y, r, ang) {
    ctx.beginPath();
    if (sh === 'circle' || sh === 'eye' || sh === 'ring') { ctx.arc(x, y, r, 0, TAU); return; }
    const p = SHAPES[sh] || SHAPES.hex, c = Math.cos(ang), s = Math.sin(ang);
    for (let i = 0; i < p.length; i += 2) { const px = p[i] * r, py = p[i + 1] * r; ctx.lineTo(x + px * c - py * s, y + px * s + py * c); }
    ctx.closePath();
  }

  function drawEnemies(w, v) {
    const [x0, x1, y0, y1] = v;
    for (let i = 0; i < w.enemies.length; i++) {
      const e = w.enemies[i];
      if (!e.on || e.x < x0 - 80 || e.x > x1 + 80 || e.y < y0 - 80 || e.y > y1 + 80) continue;
      const def = e.def, sh = def.shape, col = def.color;
      const ang = sh === 'tri' || sh === 'diamond' ? Math.atan2(e.vy, e.vx) + Math.PI / 2 : e.t * 0.8 + e.ang;
      ctx.globalAlpha = e.alpha;
      if (e.boss) {
        const pulse = 1 + Math.sin(R.t * 4) * 0.04;
        ctx.globalCompositeOperation = 'lighter';
        const g = glow(col, 64); ctx.drawImage(g, e.x - e.r * 2, e.y - e.r * 2, e.r * 4, e.r * 4);
        ctx.globalCompositeOperation = 'source-over';
        ctx.strokeStyle = col; ctx.lineWidth = 3;
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.35, R.t, R.t + 4.5); ctx.stroke();
        ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 1.6, -R.t * 0.7, -R.t * 0.7 + 2.5); ctx.stroke();
        if (e.state === 2) { ctx.strokeStyle = '#ff3050'; ctx.globalAlpha = 0.5 + Math.sin(R.t * 30) * 0.3; ctx.lineWidth = e.r; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 700, e.y + Math.sin(e.ang) * 700); ctx.stroke(); ctx.globalAlpha = 1; }
        shapePath(sh, e.x, e.y, e.r * pulse, R.t * 0.4);
        ctx.fillStyle = e.flash > 0 ? '#ffffff' : '#0b0612'; ctx.fill();
        ctx.lineWidth = 5; ctx.strokeStyle = col; ctx.stroke();
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.32 * pulse, 0, TAU); ctx.fill();
        continue;
      }
      // Telegraphs
      if (def.ai === 'sniper' && e.state === 1) { ctx.strokeStyle = '#ff3050'; ctx.lineWidth = 1.5; ctx.globalAlpha = 0.4 + (1 - e.cd2) * 0.5; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 900, e.y + Math.sin(e.ang) * 900); ctx.stroke(); ctx.globalAlpha = e.alpha; }
      if (def.ai === 'dart' && e.state === 1) { ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.globalAlpha = 0.5; ctx.beginPath(); ctx.moveTo(e.x, e.y); ctx.lineTo(e.x + Math.cos(e.ang) * 200, e.y + Math.sin(e.ang) * 200); ctx.stroke(); ctx.globalAlpha = e.alpha; }
      if (def.ai === 'mine' && e.state === 1) { ctx.strokeStyle = '#ff3050'; ctx.globalAlpha = 0.6; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(e.x, e.y, 120, 0, TAU); ctx.stroke(); ctx.globalAlpha = e.alpha; }
      if (def.ai === 'magnet') { ctx.strokeStyle = col; ctx.globalAlpha = 0.12; ctx.lineWidth = 2; const ph = (R.t * 0.8) % 1; ctx.beginPath(); ctx.arc(e.x, e.y, 430 * (1 - ph), 0, TAU); ctx.stroke(); ctx.globalAlpha = e.alpha; }
      if (e.elite) { ctx.strokeStyle = '#ffd700'; ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(e.x, e.y, e.r + 7, R.t * 3, R.t * 3 + 4.2); ctx.stroke(); }
      shapePath(sh, e.x, e.y, e.r, ang);
      const frozen = e.freezeT > 0;
      ctx.fillStyle = e.flash > 0 ? '#ffffff' : frozen ? '#cfefff' : col;
      ctx.fill();
      ctx.lineWidth = 2; ctx.strokeStyle = e.burnT > 0 ? '#ff6a3d' : 'rgba(0,0,0,0.45)'; ctx.stroke();
      if (sh === 'eye') { ctx.fillStyle = '#1a0420'; ctx.beginPath(); ctx.arc(e.x + Math.cos(ang) * 3, e.y + Math.sin(ang) * 3, e.r * 0.45, 0, TAU); ctx.fill(); }
      if (sh === 'ring') { ctx.fillStyle = '#120a24'; ctx.beginPath(); ctx.arc(e.x, e.y, e.r * 0.5, 0, TAU); ctx.fill(); }
      if (e.elite || (e.hp < e.maxHp && e.maxHp > 40 * w.diff)) {
        const bw = e.r * 2; ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, bw, 4);
        ctx.fillStyle = e.elite ? '#ffd700' : col; ctx.fillRect(e.x - bw / 2, e.y - e.r - 12, bw * Math.max(0, e.hp / e.maxHp), 4);
      }
    }
    ctx.globalAlpha = 1;
  }

  const _tp = [0, 0];
  function drawTail(w) {
    const n = w.tLen, col = w.stats.color;
    if (n < 2) return;
    const net = w.p.netT > 0;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.globalCompositeOperation = 'lighter';
    const seg = 4;
    for (let s = 0; s < seg; s++) {
      const a = Math.floor(s * (n - 1) / seg), b = Math.floor((s + 1) * (n - 1) / seg);
      ctx.beginPath();
      for (let i = a; i <= b; i++) { const q = (w.tStart + i) % 512; if (i === a) ctx.moveTo(w.tx[q], w.ty[q]); else ctx.lineTo(w.tx[q], w.ty[q]); }
      const f = (s + 1) / seg;
      ctx.strokeStyle = net ? '#e6d0ff' : col; ctx.globalAlpha = 0.16 * f; ctx.lineWidth = (net ? 18 : 14) * (0.5 + f * 0.5); ctx.stroke();
      ctx.globalAlpha = 0.85 * f; ctx.lineWidth = 3 * (0.5 + f * 0.6); ctx.stroke();
    }
    ctx.lineTo(w.p.x, w.p.y); ctx.stroke();
    // Schliess-Hinweis: Punkt auf dem Schweif, der nah am Kopf ist
    let best = -1, bd = 46 * 46;
    for (let i = 0; i < n - 10; i += 2) { const q = (w.tStart + i) % 512; const d = (w.tx[q] - w.p.x) ** 2 + (w.ty[q] - w.p.y) ** 2; if (d < bd) { bd = d; best = q; } }
    if (best >= 0) {
      ctx.globalAlpha = 0.6 + Math.sin(R.t * 20) * 0.3; ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(w.tx[best], w.ty[best], 9 + Math.sin(R.t * 20) * 2, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1; ctx.globalCompositeOperation = 'source-over';
  }

  function drawFlashes(w) {
    for (const f of w.flashes) {
      if (f.t <= 0 || f.n < 3) continue;
      const a = f.t / 0.6;
      ctx.beginPath();
      for (let i = 0; i < f.n; i++) ctx.lineTo(f.pts[i * 2], f.pts[i * 2 + 1]);
      ctx.closePath();
      ctx.globalCompositeOperation = 'lighter';
      ctx.fillStyle = f.net ? '#cfa6ff' : w.stats.color; ctx.globalAlpha = 0.3 * a * a; ctx.fill();
      ctx.strokeStyle = '#ffffff'; ctx.globalAlpha = 0.9 * a; ctx.lineWidth = 3 + (1 - a) * 6; ctx.stroke();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.globalAlpha = 1;
  }

  function drawPlayer(w) {
    const p = w.p, col = w.stats.color;
    if (p.inv > 0 && p.dashT <= 0 && Math.floor(R.t * 20) % 2 === 0 && !w.over) return;
    ctx.globalCompositeOperation = 'lighter';
    const g = glow(col, 48); const s = p.dashT > 0 ? 90 : 64;
    ctx.drawImage(g, p.x - s / 2, p.y - s / 2, s, s);
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffffff'; ctx.beginPath(); ctx.arc(p.x, p.y, 9, 0, TAU); ctx.fill();
    ctx.fillStyle = col; ctx.beginPath();
    ctx.moveTo(p.x + p.dirX * 16, p.y + p.dirY * 16); ctx.lineTo(p.x - p.dirY * 6, p.y + p.dirX * 6); ctx.lineTo(p.x + p.dirY * 6, p.y - p.dirX * 6); ctx.fill();
    if (p.netT > 0) { ctx.strokeStyle = '#cfa6ff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(p.x, p.y, 20 + Math.sin(R.t * 12) * 3, 0, TAU); ctx.stroke(); }
  }

  function drawPicks(w, v) {
    const [x0, x1, y0, y1] = v, pal = w.zone.pal;
    ctx.globalCompositeOperation = 'lighter';
    for (let i = 0; i < w.picks.length; i++) {
      const q = w.picks[i];
      if (!q.on || q.x < x0 || q.x > x1 || q.y < y0 || q.y > y1) continue;
      switch (q.kind) {
        case PICK.XP: ctx.fillStyle = '#8fffc8'; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); break;
        case PICK.DUST: ctx.fillStyle = pal.star; ctx.beginPath(); ctx.arc(q.x, q.y, 3.5, 0, TAU); ctx.fill(); break;
        case PICK.GOLD: { const g = glow('#ffd700', 24); ctx.drawImage(g, q.x - 12, q.y - 12, 24, 24); ctx.fillStyle = '#fff6b0'; ctx.fillRect(q.x - 3, q.y - 3, 6, 6); break; }
        case PICK.HEART: ctx.fillStyle = '#ff4d6d'; ctx.fillRect(q.x - 7, q.y - 2.5, 14, 5); ctx.fillRect(q.x - 2.5, q.y - 7, 5, 14); break;
        case PICK.CHEST: { const g = glow('#ffd700', 40); const b = 1 + Math.sin(R.t * 6) * 0.1; ctx.drawImage(g, q.x - 30 * b, q.y - 30 * b, 60 * b, 60 * b); ctx.fillStyle = '#ffd700'; ctx.fillRect(q.x - 9, q.y - 7, 18, 14); ctx.fillStyle = '#7a4a00'; ctx.fillRect(q.x - 9, q.y - 1, 18, 2); break; }
      }
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  function drawProjectiles(w, v) {
    const [x0, x1, y0, y1] = v;
    ctx.globalCompositeOperation = 'lighter';
    const gb = glow('#ff3a6e', 20);
    for (let i = 0; i < w.bullets.length; i++) {
      const b = w.bullets[i];
      if (!b.on || b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue;
      const s = b.big ? 34 : 22; ctx.drawImage(gb, b.x - s / 2, b.y - s / 2, s, s);
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = '#ffe0ea';
    for (let i = 0; i < w.bullets.length; i++) { const b = w.bullets[i]; if (!b.on || b.x < x0 || b.x > x1 || b.y < y0 || b.y > y1) continue; ctx.beginPath(); ctx.arc(b.x, b.y, b.r * 0.6, 0, TAU); ctx.fill(); }
    ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = '#ffd66b'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath();
    for (let i = 0; i < w.sparks.length; i++) { const s = w.sparks[i]; if (!s.on) continue; ctx.moveTo(s.x, s.y); ctx.lineTo(s.x - s.vx * 0.025, s.y - s.vy * 0.025); }
    ctx.stroke();
    ctx.globalCompositeOperation = 'source-over';
    // Gefahrenzonen
    for (let i = 0; i < w.haz.length; i++) {
      const h = w.haz[i];
      if (!h.on) continue;
      const f = 1 - h.t / h.max;
      ctx.fillStyle = h.kind === 2 ? '#ffab40' : '#ff3050'; ctx.globalAlpha = 0.12 + f * 0.25;
      ctx.beginPath(); ctx.arc(h.x, h.y, h.r * f, 0, TAU); ctx.fill();
      ctx.globalAlpha = 0.7; ctx.strokeStyle = ctx.fillStyle; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(h.x, h.y, h.r, 0, TAU); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  }

  function drawFx(fx) {
    ctx.globalCompositeOperation = 'lighter';
    for (const p of fx.parts) {
      if (!p.on) continue;
      ctx.globalAlpha = p.life / p.max; ctx.fillStyle = p.color;
      const s = p.size * (0.5 + 0.5 * p.life / p.max); ctx.fillRect(p.x - s / 2, p.y - s / 2, s, s);
    }
    for (const g of fx.rings) {
      if (!g.on) continue;
      const f = 1 - g.life / g.max, e = 1 - (1 - f) * (1 - f);
      ctx.globalAlpha = (1 - f) * 0.9; ctx.strokeStyle = g.color; ctx.lineWidth = g.w * (1 - f) + 1;
      ctx.beginPath(); ctx.arc(g.x, g.y, g.r + (g.r2 - g.r) * e, 0, TAU); ctx.stroke();
    }
    for (const l of fx.lines) {
      if (!l.on) continue;
      ctx.globalAlpha = l.life / l.max; ctx.strokeStyle = l.color; ctx.lineWidth = 3;
      ctx.beginPath(); ctx.moveTo(l.x, l.y);
      const mx = (l.x + l.x2) / 2 + (Math.random() - 0.5) * 30, my = (l.y + l.y2) / 2 + (Math.random() - 0.5) * 30;
      ctx.lineTo(mx, my); ctx.lineTo(l.x2, l.y2); ctx.stroke();
    }
    ctx.globalCompositeOperation = 'source-over';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (const t of fx.texts) {
      if (!t.on) continue;
      const f = 1 - t.life / t.max, pop = f < 0.15 ? 0.6 + f / 0.15 * 0.6 : 1.2 - Math.min(0.2, (f - 0.15));
      ctx.globalAlpha = Math.min(1, t.life / t.max * 2.5);
      ctx.font = `800 ${Math.round(t.size * pop)}px ${FONT}`;
      ctx.lineWidth = 3; ctx.strokeStyle = 'rgba(0,0,0,0.7)'; ctx.strokeText(t.text, t.x, t.y);
      ctx.fillStyle = t.color; ctx.fillText(t.text, t.x, t.y);
    }
    ctx.globalAlpha = 1;
  }

  // ---------------- HUD ----------------
  function bar(x, y, w, h, f, col, bg = 'rgba(0,0,0,0.5)') {
    ctx.fillStyle = bg; ctx.fillRect(x, y, w, h);
    ctx.fillStyle = col; ctx.fillRect(x, y, w * Math.max(0, Math.min(1, f)), h);
  }
  function txt(s, x, y, size, col = '#fff', align = 'left', weight = 700) {
    ctx.font = `${weight} ${size}px ${FONT}`; ctx.textAlign = align; ctx.textBaseline = 'middle';
    ctx.fillStyle = col; ctx.fillText(s, x, y);
  }
  const fmtT = (t) => { t = Math.max(0, Math.ceil(t)); return Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); };
  R.fmtT = fmtT;

  function drawHud(w, fx, inp, hud) {
    const d = R.dpr, W = R.W, H = R.H, L = R.layout, st = w.stats, p = w.p, pal = w.zone.pal;
    ctx.setTransform(d, 0, 0, d, 0, 0);
    // Vignette bei wenig LP
    const low = p.hp / st.maxHp;
    if (low < 0.35 || fx.hurtT > 0) { ctx.globalAlpha = Math.max(fx.hurtT * 1.5, (0.35 - low) * 2.2 * (0.8 + Math.sin(R.t * 6) * 0.2)); ctx.drawImage(R.vignette, 0, 0, W, H); ctx.globalAlpha = 1; }
    if (fx.flash > 0) { ctx.globalAlpha = Math.min(0.5, fx.flash * 0.35); ctx.fillStyle = fx.flashColor; ctx.fillRect(0, 0, W, H); ctx.globalAlpha = 1; }
    const bw = Math.min(210, W * 0.34);
    // LP
    bar(14, 14, bw, 13, p.hp / st.maxHp, low < 0.3 ? '#ff4060' : '#7dff8a');
    txt(Math.ceil(Math.max(0, p.hp)) + ' / ' + Math.round(st.maxHp), 20, 21, 10, '#0b1a0e', 'left', 800);
    bar(14, 30, bw, 5, w.xp / w.xpNext, '#8fffc8');
    txt('Stufe ' + w.lvl, 14 + bw, 44, 10, '#8fffc8', 'right', 800);
    // Ziele
    if (hud.goals) {
      let y = 60;
      for (const g of hud.goals) {
        const f = Math.min(1, g.cur / g.target), done = f >= 1;
        ctx.globalAlpha = 0.85;
        txt((done ? '✓ ' : '') + g.label, 14, y, 10.5, done ? '#7dff8a' : g.kind === 'main' ? '#ffe9a8' : '#d8d8f0', 'left', 600);
        bar(14, y + 8, Math.min(150, bw * 0.75), 3, f, done ? '#7dff8a' : pal.accent);
        txt(Math.floor(Math.min(g.cur, g.target)) + '/' + g.target, 14 + Math.min(150, bw * 0.75) + 6, y + 9, 9, '#aab', 'left', 600);
        y += 24;
      }
      ctx.globalAlpha = 1;
    }
    // Timer / Boss
    const cx = W / 2;
    if (w.boss) {
      const b = w.boss, bbw = Math.min(420, W * 0.56);
      txt(b.def.name, cx, 18, 13, pal.accent, 'center', 800);
      bar(cx - bbw / 2, 28, bbw, 9, b.hp / b.maxHp, w.coreBreak && Math.floor(R.t * 6) % 2 ? '#ff7ff0' : pal.accent);
    } else if (w.overdrive) {
      txt('OVERDRIVE ' + fmtT(w.odEnd - w.t), cx, 20, 16, '#ff4d6d', 'center', 900);
      txt('Doppelte Beute – Tod kostet die Hälfte', cx, 38, 10, '#ffb0c0', 'center', 600);
    } else if (!w.bossDone) {
      txt(fmtT(w.t), cx, 20, 18, '#fff', 'center', 800);
      const left = w.bossAt - w.t;
      txt('Boss in ' + fmtT(left), cx, 40, 11, left < 15 ? '#ff6a6a' : '#bbc', 'center', 600);
    }
    if (w.frenzyT > 0) txt('RASEREI ' + Math.ceil(w.frenzyT) + 's', cx, 58, 11, '#ffd700', 'center', 800);
    // Staub + Pause
    const P = L.pause;
    ctx.fillStyle = 'rgba(0,0,0,0.35)'; ctx.fillRect(P.x, P.y, P.w, P.h);
    ctx.fillStyle = '#fff'; ctx.fillRect(P.x + 14, P.y + 12, 5, 18); ctx.fillRect(P.x + 23, P.y + 12, 5, 18);
    txt('✦ ' + Math.floor(w.dust).toLocaleString('de-CH'), P.x - 10, 22, 15, pal.star, 'right', 800);
    if (w.c.chests > 0) txt('▣ ' + w.c.chests, P.x - 10, 42, 12, '#ffd700', 'right', 800);
    // Combo
    if (w.combo >= 5) {
      const s = 1 + Math.max(0, fx.comboPulse) * 0.25;
      ctx.save(); ctx.translate(W - 70, H * 0.36); ctx.scale(s, s);
      txt('×' + w.combo, 0, 0, 30, w.combo >= 100 ? '#ff4d6d' : w.combo >= 40 ? '#ffd700' : '#fff', 'center', 900);
      txt('COMBO', 0, 22, 10, '#bbc', 'center', 700);
      ctx.restore();
      bar(W - 100, H * 0.36 + 34, 60, 3, w.comboT / 3, '#fff');
    }
    // Fang-Text
    if (fx.catchText) {
      const c = fx.catchText, f = 1 - c.t / c.max, sc = f < 0.12 ? 0.5 + f / 0.12 * 0.8 : 1.3 - Math.min(0.3, f * 0.4);
      ctx.save(); ctx.globalAlpha = Math.min(1, c.t * 3); ctx.translate(cx, H * 0.3); ctx.scale(sc, sc);
      const big = c.n >= 15, col = c.n >= 25 ? '#ff4d6d' : big ? '#ffd700' : '#fff';
      ctx.font = `900 ${big ? 40 : 30}px ${FONT}`; ctx.textAlign = 'center'; ctx.lineWidth = 6; ctx.strokeStyle = 'rgba(0,0,0,0.6)';
      const label = c.n + (c.n >= 25 ? ' – UNFASSBAR!' : c.n >= 15 ? ' – RIESENFANG!' : c.n >= 8 ? ' – STARK!' : ' GEFANGEN');
      ctx.strokeText(label, 0, 0); ctx.fillStyle = col; ctx.fillText(label, 0, 0);
      ctx.restore();
    }
    // Banner
    if (fx.banner) {
      const b = fx.banner, f = 1 - b.t / b.max, a = Math.min(1, f * 6, b.t * 2.5);
      ctx.globalAlpha = a;
      const sl = (1 - Math.min(1, f * 5)) * 40;
      ctx.fillStyle = 'rgba(0,0,0,0.45)'; ctx.fillRect(0, H * 0.2 - 30, W, b.sub ? 64 : 48);
      txt(b.text, cx + sl, H * 0.2 - 6, Math.min(34, W / 14), b.color, 'center', 900);
      if (b.sub) txt(b.sub, cx - sl, H * 0.2 + 20, 12, '#dde', 'center', 600);
      ctx.globalAlpha = 1;
    }
    // Offscreen-Pfeile (Boss, Gold, Truhen)
    const arrow = (x, y, col) => {
      const sx = (x - R.cam.x) * R.zoom + W / 2, sy = (y - R.cam.y) * R.zoom + H / 2;
      if (sx > 20 && sx < W - 20 && sy > 20 && sy < H - 20) return;
      const a = Math.atan2(sy - H / 2, sx - W / 2), ex = Math.max(28, Math.min(W - 28, sx)), ey = Math.max(70, Math.min(H - 28, sy));
      ctx.save(); ctx.translate(ex, ey); ctx.rotate(a); ctx.fillStyle = col; ctx.beginPath(); ctx.moveTo(12, 0); ctx.lineTo(-8, -8); ctx.lineTo(-8, 8); ctx.fill(); ctx.restore();
    };
    if (w.boss) arrow(w.boss.x, w.boss.y, pal.accent);
    for (const e of w.enemies) if (e.on && (e.def.id === 'gold' || e.elite)) arrow(e.x, e.y, '#ffd700');
    // Spezialknopf
    const S = L.special, ready = p.scd <= 0;
    ctx.globalAlpha = inp.usedTouch || L.small ? 0.9 : 0.55;
    ctx.fillStyle = ready ? 'rgba(255,255,255,0.14)' : 'rgba(0,0,0,0.35)'; ctx.beginPath(); ctx.arc(S.x, S.y, S.r, 0, TAU); ctx.fill();
    ctx.strokeStyle = ready ? st.color : '#667'; ctx.lineWidth = 4; ctx.beginPath();
    ctx.arc(S.x, S.y, S.r - 2, -Math.PI / 2, -Math.PI / 2 + TAU * (1 - Math.max(0, p.scd) / st.specialCd)); ctx.stroke();
    txt(hud.specialName || 'Spezial', S.x, S.y - (L.small ? 0 : 5), 11, ready ? '#fff' : '#99a', 'center', 800);
    if (!L.small && !inp.usedTouch) txt('Leertaste', S.x, S.y + 10, 9, '#aab', 'center', 600);
    ctx.globalAlpha = 1;
    // Joystick
    if (inp.joy.active) {
      ctx.globalAlpha = 0.35; ctx.strokeStyle = '#fff'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(inp.joy.bx, inp.joy.by, inp.JR, 0, TAU); ctx.stroke();
      ctx.globalAlpha = 0.6; ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(inp.joy.kx, inp.joy.ky, 22, 0, TAU); ctx.fill();
      ctx.globalAlpha = 1;
    }
    // Tutorial
    if (hud.hint) {
      const a = Math.min(1, hud.hintT * 2);
      ctx.globalAlpha = a; ctx.fillStyle = 'rgba(0,0,0,0.55)';
      let fs = L.small ? 15 : 17;
      ctx.font = `700 ${fs}px ${FONT}`;
      let tw = ctx.measureText(hud.hint).width;
      if (tw > W - 40) { fs = Math.max(10, fs * (W - 40) / tw); ctx.font = `700 ${fs}px ${FONT}`; tw = ctx.measureText(hud.hint).width; }
      ctx.fillRect(cx - tw / 2 - 16, H - (L.small ? 150 : 120), tw + 32, 40);
      txt(hud.hint, cx, H - (L.small ? 130 : 100), fs, '#fff', 'center', 700);
      ctx.globalAlpha = 1;
    }
  }

  R.render = (w, fx, inp, hud, dt, demo = false) => {
    R.t += dt;
    const p = w.p;
    const lead = demo ? 0 : 0.18;
    const tx = p.x + p.vx * lead, ty = p.y + p.vy * lead;
    const k0 = Math.min(1, dt * 6);
    R.cam.x += (tx - R.cam.x) * k0; R.cam.y += (ty - R.cam.y) * k0;
    const k = R.dpr * R.zoom;
    const sx = fx.shake ? (Math.random() - 0.5) * fx.shake : 0, sy = fx.shake ? (Math.random() - 0.5) * fx.shake : 0;
    const ox = R.dpr * (R.W / 2 + sx) - R.cam.x * k, oy = R.dpr * (R.H / 2 + sy) - R.cam.y * k;
    const v = drawBackground(w, ox, oy, k);
    drawPicks(w, v);
    drawFlashes(w);
    drawTail(w);
    drawEnemies(w, v);
    drawProjectiles(w, v);
    drawPlayer(w);
    drawFx(fx);
    if (!demo) drawHud(w, fx, inp, hud);
    else { ctx.setTransform(1, 0, 0, 1, 0, 0); }
  };

  R.hitTest = (x, y) => {
    const L = R.layout;
    if (x >= L.pause.x - 6 && x <= L.pause.x + L.pause.w + 6 && y >= L.pause.y - 6 && y <= L.pause.y + L.pause.h + 6) return 'pause';
    if ((x - L.special.x) ** 2 + (y - L.special.y) ** 2 < (L.special.r + 10) ** 2) return 'special';
    return null;
  };
  return R;
}

export const FONT = '"Avenir Next", "Segoe UI", "Trebuchet MS", system-ui, sans-serif';
