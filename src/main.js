// LOOPSTORM – Einstiegspunkt: verbindet Logik, Rendering, Input, Audio und Menüs.
import { DATA_FILES, prepareData } from './logic/content.js';
import { loadSave, storeSave, defaultSave, memoryStorage } from './logic/save.js';
import { createRun, stepRun, choosePerk, decideOverdrive, abortRun } from './logic/run.js';
import { createBot, botThink, botPickPerk } from './logic/bot.js';
import { applyRunResult, buySkill, equipItem, salvageItem, salvageBelow, rerollItem, upgradeItem, autoEquip, checkMeta, offlineGain, ensureMissions, zoneUnlocked, classUnlocked, maxIntensity } from './logic/progress.js';
import { nearestGoals } from './logic/missions.js';
import { mulberry32 } from './logic/rng.js';
import { createRenderer } from './ui/render.js';
import { createInput } from './ui/input.js';
import { createAudio } from './ui/audio.js';
import { createFx } from './ui/fx.js';
import { createScreens } from './ui/screens.js';

const STEP = 1 / 60;

async function loadData() {
  if (window.__DATA__) return window.__DATA__;
  const raw = {};
  await Promise.all(DATA_FILES.map(async (f) => { const r = await fetch('data/' + f + '.json'); raw[f] = await r.json(); }));
  return raw;
}

function getStorage() {
  try { const k = '__ls_test'; localStorage.setItem(k, '1'); localStorage.removeItem(k); return localStorage; } catch (e) { return memoryStorage(); }
}

async function boot() {
  const data = prepareData(await loadData());
  const storage = getStorage();
  const loaded = loadSave(storage, data);
  let save = loaded.save;
  const rng = mulberry32((Date.now() & 0xffffff) | 1);
  ensureMissions(data, save, rng);

  const canvas = document.getElementById('game');
  const R = createRenderer(canvas);
  const audio = createAudio();
  const fx = createFx(audio);
  const inp = createInput(canvas);
  inp.hitTest = (x, y) => (mode === 'run' ? R.hitTest(x, y) : null);

  let mode = 'menu', run = null, paused = false, acc = 0, lastRes = null;
  let demo = null, demoBot = null; const demoInp = { mx: 0, my: 0, special: false };
  const hud = { goals: null, goalT: 0, hint: null, hintT: 0, specialName: '' };
  const tut = { stage: 0, t: 0 };

  const persist = () => storeSave(storage, save);
  const applySettings = () => {
    audio.setSound(save.settings.sound); audio.setMusic(save.settings.music);
    fx.shakeOn = save.settings.shake;
    const low = save.settings.quality === 'tief';
    fx.quality = low ? 0.45 : 1;
    R.resize(low);
  };

  function newDemo() {
    const z = data.zoneMap[save.zone] || data.zones[0];
    demo = createRun({ data, save: null, classId: 'komet', zoneId: z.id, intensity: 1, seed: (Math.random() * 1e9) | 0 });
    demo.stats.maxHp = 1e9; demo.p.hp = 1e9; demo.bossAt = 1e9;
    demoBot = createBot(0.9, (Math.random() * 1e6) | 0);
  }

  const api = {
    data, save: () => save, audio, persist,
    zoneChanged() { if (save.settings.demo) newDemo(); audio.music(data.zoneMap[save.zone].music, 0); },
    startRun,
    buySkill(id) { const r = buySkill(data, save, id); if (r.ok) afterMeta(); return r; },
    equip(uid) { equipItem(save, uid); afterMeta(); },
    salvage(uid) { const v = salvageItem(save, uid); afterMeta(); return v; },
    reroll(uid) { rerollItem(data, save, uid, rng); afterMeta(); },
    upgrade(uid) { const r = upgradeItem(save, uid); if (r) afterMeta(); return r; },
    autoEquip() { const n = autoEquip(save); afterMeta(); return n; },
    salvageCommons() { const v = salvageBelow(save, 0); afterMeta(); return v; },
    resetSave() { save = defaultSave(); ensureMissions(data, save, rng); persist(); applySettings(); screens.toast('Neuer Spielstand'); },
    setSetting(k, v) {
      if (k === 'lowq') save.settings.quality = v ? 'tief' : 'hoch'; else save.settings[k] = v;
      applySettings(); persist();
      if (k === 'demo' && !v) demo = null; if (k === 'demo' && v) newDemo();
    },
    choosePerk(i) { if (run && run.pendingChoice) { choosePerk(run, i); screens.hideOverlay(); inp.reset(); if (run.pendingChoice) screens.showLevelUp(run); } },
    resume() { paused = false; screens.hideOverlay(); inp.reset(); },
    abort() { if (run) { paused = false; screens.hideOverlay(); abortRun(run); } },
    overdrive(go) { if (run && run.pendingOverdrive) { decideOverdrive(run, go); screens.hideOverlay(); inp.reset(); } },
    again() { screens.hideOverlay(); startRun(); },
    toMenu() { screens.hideOverlay(); toMenu(); }
  };
  const screens = createScreens(document.getElementById('ui'), api);

  function afterMeta() {
    const done = checkMeta(data, save, rng);
    for (const d of done) screens.toast(`${d.label} ${d.dust ? '+✦' + d.dust : ''} ${d.shards ? '+◆' + d.shards : ''}`, '#ffd700');
    persist();
  }

  function startRun() {
    audio.unlock();
    if (!zoneUnlocked(data, save, save.zone)) save.zone = data.zones[0].id;
    if (!classUnlocked(data, save, save.cls)) save.cls = 'komet';
    save.intensity = Math.min(save.intensity, maxIntensity(save, save.zone));
    const tutorial = !save.tutorialDone;
    run = createRun({ data, save, classId: save.cls, zoneId: save.zone, intensity: save.intensity, tutorial });
    R.cam.x = run.p.x; R.cam.y = run.p.y;
    hud.specialName = data.classMap[save.cls].specialName;
    tut.stage = tutorial ? 1 : 0; tut.t = 0; hud.hint = null;
    fx.clear(); acc = 0; paused = false; mode = 'run';
    screens.hideMenu(); screens.hideOverlay(); inp.reset();
    audio.music(run.zone.music, 1);
    document.body.classList.add('playing');
  }

  function finishRun() {
    const r = run.result;
    if (run.tutorial) save.tutorialDone = true;
    const sum = applyRunResult(data, save, r, rng);
    persist();
    lastRes = { r, sum };
    mode = 'results';
    audio.play(r.victory ? 'win' : 'lose');
    audio.setIntensity(0);
    screens.showResults(r, sum, nearestGoals(data, save, 3));
    document.body.classList.remove('playing');
  }

  function toMenu() {
    mode = 'menu'; run = null; paused = false; fx.clear();
    document.body.classList.remove('playing');
    if (save.settings.demo && save.settings.quality !== 'tief') newDemo(); else demo = null;
    audio.music(data.zoneMap[save.zone].music, 0);
    screens.showMenu();
  }

  // Tutorial in den ersten 60 Sekunden
  function updateTutorial(dt) {
    if (!tut.stage || !run) { hud.hint = null; return; }
    tut.t += dt;
    const set = (h) => { if (hud.hint !== h) { hud.hint = h; hud.hintT = 0; } hud.hintT += dt; };
    const touch = inp.usedTouch || R.layout.small;
    switch (tut.stage) {
      case 1: set(touch ? 'Tippe irgendwo hin und ziehe, um zu fliegen' : 'Fliege mit WASD oder den Pfeiltasten'); if (run.t > 1.5 && Math.hypot(run.p.vx, run.p.vy) > 100) { tut.stage = 2; tut.t = 0; } break;
      case 2: set('Fliege einen Kreis und kreuze deinen eigenen Schweif!'); if (run.c.loops >= 1) { tut.stage = 3; tut.t = 0; } break;
      case 3: set('Kreise Gegner ein – alles in der Schleife explodiert!'); if (run.c.bestCatch >= 2 || tut.t > 25) { tut.stage = 4; tut.t = 0; } break;
      case 4: set('Mehr Gegner pro Schleife = mehr Schaden. Sammle den Staub ✦'); if (tut.t > 5) { tut.stage = 5; tut.t = 0; } break;
      case 5: set((touch ? 'Knopf unten rechts' : 'Leertaste') + ': ' + hud.specialName + ' – rettet dich aus Gedränge'); if (tut.t > 5 || run.p.scd > 0) { tut.stage = 6; tut.t = 0; } break;
      case 6: set('Überlebe bis der Boss kommt. Viel Glück!'); if (tut.t > 3.5) { tut.stage = 0; hud.hint = null; } break;
    }
  }

  inp.onKey = (e) => {
    if (mode === 'run' && run) {
      if (run.pendingChoice && /^Digit[1-4]$/.test(e.code)) { api.choosePerk(+e.code.slice(5) - 1); return true; }
      if (run.pendingOverdrive && (e.code === 'Digit1' || e.code === 'Digit2')) { api.overdrive(e.code === 'Digit2'); return true; }
    }
    if (mode === 'results' && (e.code === 'Enter' || e.code === 'Space') && screens.overlayOpen()) { screens.clickOverlay('[data-act="again"]'); return true; }
    if (mode === 'menu' && e.code === 'Enter' && !screens.overlayOpen()) { startRun(); return true; }
    return false;
  };

  let last = performance.now(), errShown = false;
  const prof = { step: 0, render: 0 };
  let lastCombo = 0;
  function frame(now) {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    try {
      inp.poll();
      if (mode === 'run' && run) {
        if (inp.pause) { inp.pause = false; if (!run.pendingChoice && !run.pendingOverdrive && !run.over) { paused = !paused; if (paused) screens.showPause(run); else screens.hideOverlay(); } }
        if (!paused && !run.pendingChoice && !run.pendingOverdrive && !run.over) {
          if (fx.hitstop > 0) fx.hitstop -= dt;
          else {
            acc += dt; let n = 0;
            const ts = performance.now();
            while (acc >= STEP && n < 4) { stepRun(run, STEP, inp); acc -= STEP; n++; if (run.pendingChoice || run.over) break; }
            prof.step = prof.step * 0.95 + (performance.now() - ts) * 0.05;
            if (n >= 4) acc = 0;
            inp.special = false;
          }
          updateTutorial(dt);
        }
        fx.consume(run);
        if (Math.floor(run.combo / 10) > Math.floor(lastCombo / 10)) fx.comboPulse = 1;
        lastCombo = run.combo;
        if (run.pendingChoice && !screens.overlayOpen()) screens.showLevelUp(run);
        if (run.pendingOverdrive && !screens.overlayOpen()) screens.showOverdrive(run);
        if ((hud.goalT -= dt) <= 0) {
          hud.goalT = 0.5;
          const c = run.c;
          hud.goals = nearestGoals(data, save, 3, { kills: c.kills, loops: c.loops, elites: c.elites, bosses: c.bosses, dust: run.dust, time: run.t, perks: c.perks, synergies: c.synergies, bestCatch: c.bestCatch, bestCombo: c.bestCombo, goldKills: c.goldKills, events: c.events });
        }
        fx.update(dt);
        const tr = performance.now();
        R.render(run, fx, inp, hud, dt);
        prof.render = prof.render * 0.95 + (performance.now() - tr) * 0.05;
        if (run.over) finishRun();
      } else if (mode === 'results' && run) {
        fx.update(dt); R.render(run, fx, inp, { goals: null }, dt, true);
      } else {
        if (demo) {
          if (demo.pendingChoice) choosePerk(demo, botPickPerk(demoBot, demo));
          botThink(demoBot, demo, dt, demoInp); stepRun(demo, Math.min(dt, 1 / 30), demoInp);
          fx.consume(demo, true); fx.update(dt);
          if (demo.t > 150 || demo.over) newDemo();
          R.render(demo, fx, inp, {}, dt, true);
        } else {
          const ctx = canvas.getContext('2d'); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.fillStyle = data.zoneMap[save.zone].pal.bg; ctx.fillRect(0, 0, canvas.width, canvas.height);
        }
      }
    } catch (err) {
      if (!errShown) { errShown = true; console.error(err); screens.toast('Fehler: ' + err.message, '#ff4060'); }
    }
    requestAnimationFrame(frame);
  }

  addEventListener('resize', () => R.resize(save.settings.quality === 'tief'));
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) { persist(); if (mode === 'run' && run && !paused && !run.pendingChoice && !run.pendingOverdrive && !run.over) { paused = true; screens.showPause(run); } }
  });
  addEventListener('pagehide', persist);
  const unlock = () => { audio.unlock(); audio.music(mode === 'run' && run ? run.zone.music : data.zoneMap[save.zone].music, mode === 'run' ? 1 : 0); removeEventListener('pointerdown', unlock); removeEventListener('keydown', unlock); };
  addEventListener('pointerdown', unlock); addEventListener('keydown', unlock);

  applySettings();
  const gain = loaded.fresh ? 0 : offlineGain(data, save);
  const mins = (Date.now() - save.lastSeen) / 60000;
  if (loaded.corrupt) setTimeout(() => screens.toast('Spielstand war beschädigt – neu gestartet', '#ff4060'), 400);
  if (gain > 0) { save.dust += gain; screens.showOffline(gain, Math.min(mins, 480)); }
  persist();
  toMenu();
  if (!save.tutorialDone) screens.toast('Willkommen! Drücke „Abflug“.', '#8ff6ff');
  document.getElementById('boot').remove();
  requestAnimationFrame((t) => { last = t; frame(t); });
  window.__LOOPSTORM__ = { prof, get run() { return run; }, get mode() { return mode; }, get save() { return save; }, startRun, api };
}

boot().catch((e) => {
  const b = document.getElementById('boot');
  if (b) b.textContent = 'Fehler beim Laden: ' + e.message;
  console.error(e);
});
