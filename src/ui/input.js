// Eingabe: Tastatur (WASD/Pfeile, Leertaste/Shift = Spezial, Esc/P = Pause) und Pointer (dynamischer Joystick)
export function createInput(canvas) {
  const keys = new Set();
  const inp = {
    mx: 0, my: 0, special: false, pause: false, enabled: true,
    joy: { active: false, id: -1, bx: 0, by: 0, kx: 0, ky: 0 },
    hitTest: null, // (x,y) => 'pause' | 'special' | null
    usedTouch: false, lastMove: 0,
    onKey: null
  };
  const JR = 58;
  addEventListener('keydown', (e) => {
    if (e.repeat) { if (['Space', 'ArrowUp', 'ArrowDown'].includes(e.code)) e.preventDefault(); return; }
    keys.add(e.code);
    if (e.code === 'Space' || e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.code === 'KeyK') inp.special = true;
    if (e.code === 'Escape' || e.code === 'KeyP') inp.pause = true;
    if (inp.onKey && inp.onKey(e)) e.preventDefault();
    if (e.code.startsWith('Arrow') || e.code === 'Space') e.preventDefault();
  });
  addEventListener('keyup', (e) => keys.delete(e.code));
  addEventListener('blur', () => { keys.clear(); inp.joy.active = false; });

  canvas.addEventListener('pointerdown', (e) => {
    if (!inp.enabled) return;
    inp.usedTouch = e.pointerType === 'touch';
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    const hit = inp.hitTest ? inp.hitTest(x, y) : null;
    if (hit === 'pause') { inp.pause = true; return; }
    if (hit === 'special') { inp.special = true; return; }
    if (!inp.joy.active) {
      inp.joy.active = true; inp.joy.id = e.pointerId; inp.joy.bx = inp.joy.kx = x; inp.joy.by = inp.joy.ky = y;
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
    } else {
      // zweiter Finger = Spezial
      inp.special = true;
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('pointermove', (e) => {
    if (!inp.joy.active || e.pointerId !== inp.joy.id) return;
    const r = canvas.getBoundingClientRect(), x = e.clientX - r.left, y = e.clientY - r.top;
    let dx = x - inp.joy.bx, dy = y - inp.joy.by;
    const d = Math.hypot(dx, dy);
    if (d > JR) { // Basis zieht mit (fühlt sich auf dem Handy besser an)
      inp.joy.bx += dx / d * (d - JR); inp.joy.by += dy / d * (d - JR);
      dx = x - inp.joy.bx; dy = y - inp.joy.by;
    }
    inp.joy.kx = x; inp.joy.ky = y;
    e.preventDefault();
  }, { passive: false });
  const end = (e) => { if (e.pointerId === inp.joy.id) { inp.joy.active = false; inp.joy.id = -1; } };
  canvas.addEventListener('pointerup', end);
  canvas.addEventListener('pointercancel', end);
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());

  inp.poll = () => {
    let x = 0, y = 0;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) x -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) x += 1;
    if (keys.has('KeyW') || keys.has('ArrowUp')) y -= 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) y += 1;
    if (inp.joy.active) {
      const dx = inp.joy.kx - inp.joy.bx, dy = inp.joy.ky - inp.joy.by, d = Math.hypot(dx, dy);
      if (d > 6) { x += dx / JR; y += dy / JR; }
    }
    const m = Math.hypot(x, y);
    if (m > 1) { x /= m; y /= m; }
    inp.mx = x; inp.my = y;
    if (m > 0.1) inp.lastMove = performance.now();
    return inp;
  };
  inp.reset = () => { keys.clear(); inp.joy.active = false; inp.special = false; inp.pause = false; inp.mx = inp.my = 0; };
  inp.JR = JR;
  return inp;
}
