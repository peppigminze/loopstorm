// Alle Sounds per WebAudio-Synthese. Keine Dateien.
export function createAudio() {
  let ac = null, master = null, sfxBus = null, musBus = null, noiseBuf = null, comp = null;
  const st = { sound: true, music: true, zoneMusic: null, step: 0, nextT: 0, timer: 0, intensity: 0 };
  const last = {};

  function ensure() {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return false;
      ac = new AC();
      comp = ac.createDynamicsCompressor(); comp.threshold.value = -14; comp.ratio.value = 6;
      master = ac.createGain(); master.gain.value = 0.8;
      sfxBus = ac.createGain(); sfxBus.gain.value = st.sound ? 0.55 : 0;
      musBus = ac.createGain(); musBus.gain.value = st.music ? 0.22 : 0;
      sfxBus.connect(comp); musBus.connect(comp); comp.connect(master); master.connect(ac.destination);
      noiseBuf = ac.createBuffer(1, ac.sampleRate * 0.5, ac.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ac.state === 'suspended') ac.resume();
    return true;
  }

  function tone(f, dur, type = 'sine', vol = 0.2, slide = 0, delay = 0, bus = sfxBus) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(Math.max(20, slide), t + dur);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(vol, t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g); g.connect(bus); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.2, freq = 1200, delay = 0, type = 'lowpass', bus = sfxBus) {
    if (!ac) return;
    const t = ac.currentTime + delay;
    const s = ac.createBufferSource(), f = ac.createBiquadFilter(), g = ac.createGain();
    s.buffer = noiseBuf; f.type = type; f.frequency.value = freq;
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    s.connect(f); f.connect(g); g.connect(bus); s.start(t); s.stop(t + dur);
  }
  function gate(name, gap) {
    const now = ac ? ac.currentTime : 0;
    if (last[name] && now - last[name] < gap) return false;
    last[name] = now; return true;
  }

  const sfx = {
    hit(p = 1) { if (gate('hit', 0.035)) tone(300 + p * 80, 0.05, 'square', 0.05, 160); },
    kill(p = 1) { if (gate('kill', 0.03)) { tone(520 + Math.random() * 80 + p * 30, 0.08, 'triangle', 0.09, 900); noise(0.06, 0.05, 3000); } },
    loop(n) {
      if (!gate('loop', 0.05)) return;
      const base = 330 * Math.pow(1.06, Math.min(n, 24));
      [0, 4, 7, 12].forEach((s, i) => tone(base * Math.pow(2, s / 12), 0.22 + i * 0.04, 'triangle', 0.11, 0, i * 0.035));
      noise(0.25, 0.08 + Math.min(n, 20) * 0.006, 1800);
    },
    echo() { if (gate('echo', 0.05)) tone(660, 0.18, 'sine', 0.06, 990); },
    pick(c) { if (gate('pick', 0.028)) tone(880 * Math.pow(1.03, Math.min(c, 40) % 24), 0.05, 'sine', 0.05); },
    gold() { if (gate('gold', 0.04)) { tone(1320, 0.1, 'sine', 0.07); tone(1760, 0.12, 'sine', 0.05, 0, 0.05); } },
    level() { [0, 4, 7, 11, 14].forEach((s, i) => tone(440 * Math.pow(2, s / 12), 0.25, 'triangle', 0.1, 0, i * 0.05)); },
    hurt() { if (gate('hurt', 0.1)) { tone(180, 0.25, 'sawtooth', 0.14, 60); noise(0.18, 0.15, 600); } },
    special(k) { if (k === 0) { noise(0.25, 0.12, 2400, 0, 'bandpass'); tone(300, 0.25, 'sawtooth', 0.06, 900); } else if (k === 1) { tone(200, 0.4, 'triangle', 0.1, 600); } else { noise(0.4, 0.2, 900); tone(140, 0.4, 'square', 0.1, 50); } },
    boss() { tone(55, 1.4, 'sawtooth', 0.18, 40); tone(82, 1.4, 'sawtooth', 0.1, 60, 0.1); noise(1, 0.12, 300); },
    bossdie() { for (let i = 0; i < 6; i++) { noise(0.5, 0.2, 1500 - i * 200, i * 0.12); tone(300 - i * 30, 0.4, 'square', 0.07, 60, i * 0.12); } [0, 7, 12, 16, 19].forEach((s, i) => tone(330 * Math.pow(2, s / 12), 0.6, 'triangle', 0.1, 0, 0.6 + i * 0.08)); },
    explode(r = 60) { if (gate('exp', 0.06)) { noise(0.3 + r / 400, 0.18, 500 + r * 2); tone(90, 0.3, 'sine', 0.15, 40); } },
    shoot(k) { if (gate('shoot' + k, k === 3 ? 0.06 : 0.09)) { if (k === 3) tone(1200, 0.04, 'square', 0.025, 1800); else if (k === 1) tone(900, 0.2, 'sawtooth', 0.06, 200); else tone(500, 0.06, 'square', 0.03, 300); } },
    chain() { if (gate('chain', 0.05)) noise(0.08, 0.08, 5000, 0, 'highpass'); },
    shock() { if (gate('shock', 0.08)) { tone(120, 0.3, 'sine', 0.14, 50); noise(0.2, 0.08, 800); } },
    chest() { [0, 5, 9, 12].forEach((s, i) => tone(660 * Math.pow(2, s / 12), 0.15, 'square', 0.05, 0, i * 0.06)); },
    synergy() { [0, 7, 12, 19, 24].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.4, 'sine', 0.09, 0, i * 0.07)); },
    event() { [0, 3, 7, 10, 15].forEach((s, i) => tone(523 * Math.pow(2, s / 12), 0.18, 'triangle', 0.08, 0, i * 0.06)); },
    cut() { if (gate('cut', 0.15)) { tone(400, 0.2, 'sawtooth', 0.08, 90); } },
    tele() { if (gate('tele', 0.08)) tone(1500, 0.12, 'sine', 0.04, 300); },
    heal() { if (gate('heal', 0.2)) tone(700, 0.2, 'sine', 0.05, 1100); },
    ui() { tone(700, 0.05, 'triangle', 0.06, 900); },
    buy() { tone(523, 0.08, 'triangle', 0.08); tone(784, 0.12, 'triangle', 0.08, 0, 0.06); },
    deny() { tone(200, 0.12, 'square', 0.05, 150); },
    win() { [0, 4, 7, 12, 16, 19, 24].forEach((s, i) => tone(392 * Math.pow(2, s / 12), 0.35, 'triangle', 0.09, 0, i * 0.08)); },
    lose() { [12, 7, 3, 0].forEach((s, i) => tone(220 * Math.pow(2, s / 12), 0.4, 'triangle', 0.08, 0, i * 0.15)); },
    count() { if (gate('count', 0.04)) tone(1000 + Math.random() * 300, 0.03, 'square', 0.025); },
    od() { tone(110, 1, 'sawtooth', 0.15, 440); noise(0.8, 0.1, 2000); }
  };

  // Mini-Sequencer: Bass + Arpeggio + Hi-Hat, Skala pro Zone, Intensität steigt im Bosskampf
  function schedule() {
    if (!ac || !st.zoneMusic || !st.music) return;
    const spb = 60 / (st.intensity >= 2 ? 138 : 118) / 4;
    while (st.nextT < ac.currentTime + 0.25) {
      const s = st.step % 32, m = st.zoneMusic, sc = m.scale;
      const t = st.nextT - ac.currentTime;
      const bar = Math.floor(st.step / 16) % 4, prog = [0, 3, 1, 4][bar] % sc.length;
      if (s % 4 === 0) tone(m.root * Math.pow(2, sc[prog] / 12) * (s % 8 === 0 ? 1 : 2), spb * 3.5, 'triangle', 0.16, 0, Math.max(0, t), musBus);
      if (st.intensity >= 1 && s % 2 === 1) noise(0.04, 0.05, 7000, Math.max(0, t), 'highpass', musBus);
      if (s % 3 === 0 || (st.intensity >= 2 && s % 2 === 0)) {
        const n = sc[(st.step * 7 + bar) % sc.length] + 12 * (1 + (s % 6 === 0 ? 1 : 0));
        tone(m.root * 2 * Math.pow(2, n / 12), spb * 1.6, 'sine', 0.05, 0, Math.max(0, t), musBus);
      }
      if (st.intensity >= 2 && s % 8 === 0) tone(60, 0.18, 'sine', 0.2, 40, Math.max(0, t), musBus);
      st.nextT += spb; st.step++;
    }
  }

  return {
    unlock() { ensure(); },
    play(name, a, b) { if (!ac || !st.sound) return; const f = sfx[name]; if (f) f(a, b); },
    setSound(v) { st.sound = v; if (sfxBus) sfxBus.gain.value = v ? 0.55 : 0; },
    setMusic(v) { st.music = v; if (musBus) musBus.gain.value = v ? 0.22 : 0; },
    music(zoneMusic, intensity = 0) {
      st.zoneMusic = zoneMusic; st.intensity = intensity;
      if (!ac) return;
      if (!st.timer) st.timer = setInterval(schedule, 90);
      if (st.nextT < ac.currentTime) st.nextT = ac.currentTime + 0.05;
    },
    setIntensity(i) { st.intensity = i; },
    stopMusic() { st.zoneMusic = null; },
    get ready() { return !!ac; }
  };
}
