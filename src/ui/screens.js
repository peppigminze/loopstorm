// DOM-Menüs und Overlays. Ein einziger delegierter Click-Handler über data-act.
import { computeStats, modText, STAT_LABEL } from '../logic/stats.js';
import { itemScore, salvageValue, rerollCost, SLOTS, SLOT_NAME, upgradeCost, ILVL_MAX } from '../logic/loot.js';
import { canBuySkill, skillCost, zoneUnlocked, maxIntensity, classUnlocked, xpNext, INV_MAX } from '../logic/progress.js';
import { nearestGoals, missionCur, getValue, todayStr } from '../logic/missions.js';

const fmt = (n) => Math.floor(n).toLocaleString('de-CH');
const ROMAN = ['', 'I', 'II', 'III'];

export function createScreens(root, api) {
  const { data } = api;
  let tab = 'flug', selItem = null, selSkill = null, resetArm = 0;
  const S = () => api.save();

  root.innerHTML = '<div id="menu" class="menu hidden"></div><div id="overlay" class="overlay hidden"></div><div id="toasts"></div>';
  const menu = root.querySelector('#menu'), ov = root.querySelector('#overlay'), toasts = root.querySelector('#toasts');

  function toast(text, color = '#fff') {
    const el = document.createElement('div'); el.className = 'toast'; el.style.borderColor = color; el.textContent = text;
    toasts.appendChild(el);
    setTimeout(() => el.classList.add('out'), 2300); setTimeout(() => el.remove(), 2800);
  }

  function goalsHtml(goals) {
    return goals.map((g) => {
      const f = Math.min(1, g.cur / g.target);
      return `<div class="goal ${g.kind}"><div class="gl"><span>${g.label}</span><b>${fmt(Math.min(g.cur, g.target))}/${fmt(g.target)}</b></div><div class="gbar"><i style="width:${(f * 100).toFixed(1)}%"></i></div></div>`;
    }).join('');
  }

  function header() {
    const s = S(), need = xpNext(s.level);
    return `<header class="top"><div class="brand"><svg viewBox="0 0 40 40" aria-hidden="true"><path d="M6 30 C 2 10, 30 2, 32 18 S 14 34, 20 20 S 36 8, 38 6" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round"/></svg><span>LOOPSTORM</span></div>
      <div class="wallet"><span class="dust">✦ ${fmt(s.dust)}</span><span class="shard">◆ ${fmt(s.shards)}</span>
      <span class="lvl" title="Konto-Level">Lv ${s.level}<i style="width:${Math.min(100, s.xp / need * 100).toFixed(1)}%"></i></span></div></header>`;
  }

  function tabs() {
    const s = S();
    const canSkill = data.skillNodes.some((n) => canBuySkill(data, s, n.id).ok);
    const items = [['flug', 'Flug'], ['talente', 'Talente' + (canSkill ? ' •' : '')], ['ausruestung', 'Ausrüstung' + (s.newItems ? ` (${s.newItems})` : '')], ['ziele', 'Ziele'], ['mehr', 'Mehr']];
    return `<nav class="tabs">${items.map(([id, l]) => `<button data-act="tab" data-id="${id}" class="${tab === id ? 'on' : ''}">${l}</button>`).join('')}</nav>`;
  }

  // ---------------- Tabs ----------------
  function viewFlug() {
    const s = S();
    const zones = data.zones.map((z, i) => {
      const un = zoneUnlocked(data, s, z.id), best = (s.zones[z.id] && s.zones[z.id].best) || 0, sel = s.zone === z.id;
      const mi = maxIntensity(s, z.id);
      const pills = un ? [1, 2, 3].map((k) => `<button data-act="int" data-z="${z.id}" data-i="${k}" class="pill ${sel && s.intensity === k ? 'on' : ''}" ${k > mi ? 'disabled' : ''}>${ROMAN[k]}${best >= k ? '★' : ''}</button>`).join('') : '';
      return `<div class="zone ${sel ? 'sel' : ''} ${un ? '' : 'locked'}" data-act="zone" data-id="${z.id}" style="--za:${z.pal.accent};--zb:${z.pal.bg};--zc:${z.pal.bg2}">
        <div class="zn"><small>Sektor ${i + 1}</small><b>${un ? z.name : '???'}</b></div>
        <p>${un ? z.desc : 'Besiege den Boss des vorherigen Sektors.'}</p>
        <div class="zi">${pills}</div></div>`;
    }).join('');
    const classes = data.classes.map((c) => {
      const un = classUnlocked(data, s, c.id);
      return `<button class="cls ${s.cls === c.id ? 'sel' : ''}" data-act="cls" data-id="${c.id}" ${un ? '' : 'disabled'} style="--cc:${c.color}">
        <b>${c.name}</b><span>${un ? c.desc : 'Ab Konto-Level ' + c.unlockLevel}</span></button>`;
    }).join('');
    const z = data.zoneMap[s.zone];
    return `<section class="flug">
      <h2>Sektoren</h2><div class="zones">${zones}</div>
      <h2>Klasse</h2><div class="classes">${classes}</div>
      <h2>Fast geschafft</h2><div class="goals">${goalsHtml(nearestGoals(data, s, 3))}</div>
      <button class="start" data-act="start" style="--za:${z.pal.accent}">Abflug: ${z.name} ${ROMAN[s.intensity]}<small>Enter</small></button>
    </section>`;
  }

  function viewTalente() {
    const s = S();
    const cols = data.skills.branches.map((b) => {
      const nodes = data.skillNodes.filter((n) => n.b === b.id);
      const rows = [0, 1, 2, 3].map((r) => `<div class="srow">${nodes.filter((n) => n.row === r).map((n) => {
        const rank = s.skills[n.id] || 0, c = canBuySkill(data, s, n.id), lock = n.req && !(s.skills[n.req] > 0);
        const cost = rank >= n.max ? 'MAX' : (n.shards ? '◆ ' : '✦ ') + fmt(skillCost(n, rank));
        return `<button class="node ${lock ? 'locked' : ''} ${c.ok ? 'can' : ''} ${rank >= n.max ? 'max' : ''} ${selSkill === n.id ? 'sel' : ''}" data-act="skill" data-id="${n.id}">
          <b>${n.name}</b><span>${rank}/${n.max}</span><em>${cost}</em></button>`;
      }).join('')}</div>`).join('');
      return `<div class="branch" style="--bc:${b.color}"><h3>${b.name}</h3>${rows}</div>`;
    }).join('');
    let detail = '<p class="hint">Tippe ein Talent an. Talente gelten für alle Klassen.</p>';
    if (selSkill) {
      const n = data.skillMap[selSkill], rank = s.skills[n.id] || 0, c = canBuySkill(data, s, n.id);
      const why = c.why === 'gesperrt' ? 'Benötigt ' + data.skillMap[n.req].name : c.why === 'max' ? 'Maximal ausgebaut' : c.why === 'zu teuer' ? 'Nicht genug ' + (n.shards ? 'Splitter' : 'Staub') : '';
      detail = `<div class="sdetail"><div><b>${n.name}</b> <small>${rank}/${n.max}</small><p>${n.desc}${rank ? ` – aktuell ${n.mods.map((m) => modText({ s: m.s, a: m.a !== undefined ? m.a * rank : undefined, p: m.p !== undefined ? m.p * rank : undefined })).join(', ') || 'aktiv'}` : ''}</p></div>
        <button class="buy" data-act="buy" data-id="${n.id}" ${c.ok ? '' : 'disabled'}>${c.ok ? 'Kaufen ' + (n.shards ? '◆ ' : '✦ ') + fmt(c.cost) : why}</button></div>`;
    }
    return `<section class="talente"><div class="tree">${cols}</div>${detail}</section>`;
  }

  function itemTile(it, s) {
    const rd = data.items.rarities[it.rar], eq = s.equipped[it.slot] === it.uid;
    return `<button class="item ${selItem === it.uid ? 'sel' : ''}" data-act="item" data-id="${it.uid}" style="--rc:${rd.color}">
      <span class="slot">${SLOT_NAME[it.slot]}</span><b>${it.name}</b><small>Stufe ${it.ilvl} · Wert ${itemScore(it)}</small>${eq ? '<i class="eq">●</i>' : ''}${it.isNew ? '<i class="nw">neu</i>' : ''}</button>`;
  }

  function viewAusruestung() {
    const s = S();
    const st = computeStats(data, s, s.cls, null);
    const eq = SLOTS.map((sl) => {
      const it = s.inventory.find((x) => x.uid === s.equipped[sl]);
      return it ? itemTile(it, s) : `<div class="item empty"><span class="slot">${SLOT_NAME[sl]}</span><b>leer</b><small>Truhen von Elites & Bossen</small></div>`;
    }).join('');
    const keys = ['maxHp', 'loopDmg', 'tailDmg', 'tailLen', 'speed', 'armor', 'regen', 'crit', 'critMult', 'sparkRate', 'dustMult', 'lootLuck'];
    const stats = keys.map((k) => `<div><span>${STAT_LABEL[k]}</span><b>${['crit', 'lootLuck'].includes(k) ? Math.round(st[k] * 100) + '%' : k === 'dustMult' || k === 'critMult' ? '×' + st[k].toFixed(2) : k === 'regen' || k === 'sparkRate' ? st[k].toFixed(1) : Math.round(st[k])}</b></div>`).join('');
    const flags = Object.keys(st.flags).map((f) => { const u = data.items.uniques.find((x) => x.flag === f); const n = data.skillNodes.find((x) => x.flag === f); return `<em>${u ? u.name : n ? n.name : f}</em>`; }).join('');
    const inv = s.inventory.slice().sort((a, b) => b.rar - a.rar || itemScore(b) - itemScore(a)).filter((it) => s.equipped[it.slot] !== it.uid).map((it) => itemTile(it, s)).join('');
    let detail = '';
    const it = s.inventory.find((x) => x.uid === selItem);
    if (it) {
      const rd = data.items.rarities[it.rar], cur = s.inventory.find((x) => x.uid === s.equipped[it.slot]);
      const diff = cur && cur !== it ? itemScore(it) - itemScore(cur) : null;
      const u = it.unique ? data.items.uniques.find((x) => x.flag === it.unique) : null;
      const sv = salvageValue(it), isEq = s.equipped[it.slot] === it.uid;
      detail = `<div class="idetail" style="--rc:${rd.color}"><div class="ih"><b>${it.name}</b><small>${rd.name} · ${SLOT_NAME[it.slot]} · Stufe ${it.ilvl}</small></div>
        <ul>${it.mods.map((m, i) => `<li class="${i ? '' : 'imp'}">${modText(m)}</li>`).join('')}${u ? `<li class="uniq">${u.desc}</li>` : ''}</ul>
        ${diff !== null ? `<p class="cmp ${diff >= 0 ? 'up' : 'down'}">${diff >= 0 ? '▲' : '▼'} ${Math.abs(diff).toFixed(1)} Wertung gegenüber ausgerüstet</p>` : ''}
        <div class="ibtn"><button data-act="equip" data-id="${it.uid}" ${isEq ? 'disabled' : ''}>${isEq ? 'Ausgerüstet' : 'Ausrüsten'}</button>
        <button data-act="salvage" data-id="${it.uid}" ${isEq ? 'disabled' : ''}>Zerlegen +✦${sv.dust}${sv.shards ? ' +◆' + sv.shards : ''}</button>
        <button data-act="upgrade" data-id="${it.uid}" ${it.ilvl < ILVL_MAX && s.dust >= upgradeCost(it) ? '' : 'disabled'}>${it.ilvl >= ILVL_MAX ? 'Max. Stufe' : 'Aufwerten ✦' + fmt(upgradeCost(it))}</button>
        <button data-act="reroll" data-id="${it.uid}" ${s.shards >= rerollCost(it) ? '' : 'disabled'}>Umschmieden ◆${rerollCost(it)}</button></div></div>`;
    }
    return `<section class="ausr"><div class="equipped">${eq}</div>${detail}
      <details class="stats"><summary>Werte (${data.classMap[s.cls].name})</summary><div class="sgrid">${stats}</div><div class="flags">${flags}</div></details>
      <div class="invh"><h2>Inventar ${s.inventory.length}/${INV_MAX}</h2><div><button data-act="autoequip">Bestes ausrüsten</button><button data-act="salvall">Gewöhnliche zerlegen</button></div></div>
      <div class="inv">${inv || '<p class="hint">Noch leer. Elitegegner (goldener Ring) und Bosse lassen Truhen fallen.</p>'}</div></section>`;
  }

  function missionCard(m, s) {
    const cur = missionCur(data, s, m, null), f = Math.min(1, cur / m.target);
    return `<div class="mcard ${m.kind} ${m.done ? 'done' : ''}"><div><b>${m.name}</b><p>${m.desc}</p></div>
      <div class="mr">${m.reward.dust ? '✦' + fmt(m.reward.dust) : ''} ${m.reward.shards ? '◆' + m.reward.shards : ''}</div>
      <div class="gbar"><i style="width:${(f * 100).toFixed(1)}%"></i></div><small>${m.done ? 'Erledigt' : fmt(Math.min(cur, m.target)) + ' / ' + fmt(m.target)}</small></div>`;
  }

  function viewZiele() {
    const s = S();
    const main = s.main ? missionCard(s.main, s) : '<p class="hint">Alle Hauptmissionen erledigt. Legende!</p>';
    const now = new Date(), mid = new Date(now); mid.setHours(24, 0, 0, 0);
    const hrs = Math.floor((mid - now) / 3600000), mins = Math.floor((mid - now) / 60000) % 60;
    const ms = data.missions.milestones.map((m) => {
      const t = s.ms[m.key] || 0, v = getValue(data, s, m.key), next = m.tiers[t];
      return `<div class="ms"><b>${m.name} ${ROMAN[Math.min(t, 3)] || t}</b><span>${next ? fmt(v) + ' / ' + fmt(next) : 'abgeschlossen'}</span><div class="gbar"><i style="width:${next ? Math.min(100, v / next * 100) : 100}%"></i></div></div>`;
    }).join('');
    const ach = data.achievements.map((a) => `<div class="ach ${s.ach[a.id] ? 'got' : ''}" title="${a.desc}"><b>${a.name}</b><small>${a.desc}</small></div>`).join('');
    const nAch = data.achievements.filter((a) => s.ach[a.id]).length;
    return `<section class="ziele">
      <h2>Hauptmission</h2>${main}
      <h2>Aufträge</h2>${s.side.map((m) => missionCard(m, s)).join('')}
      <h2>Täglich <small>neu in ${hrs} h ${mins} min</small></h2>${s.daily ? s.daily.list.map((m) => missionCard(m, s)).join('') : ''}
      <h2>Meilensteine</h2><div class="mss">${ms}</div>
      <h2>Erfolge ${nAch}/${data.achievements.length}</h2><div class="achs">${ach}</div></section>`;
  }

  function viewMehr() {
    const s = S(), L = s.life, set = s.settings;
    const stat = [['Runs', L.runs], ['Siege', L.wins], ['Gegner besiegt', L.kills], ['Schleifen', L.loops], ['Bester Fang', L.bestCatch], ['Beste Combo', L.bestCombo],
      ['Elites', L.elites], ['Bosse', L.bosses], ['Staub gesammelt', Math.round(L.dust)], ['Flugzeit', Math.round(L.time / 60) + ' min'], ['Overdrives überlebt', L.odClears], ['Goldkometen', L.goldKills]];
    const tog = (k, label) => `<label class="tog"><input type="checkbox" data-act="set" data-k="${k}" ${set[k] ? 'checked' : ''}><span>${label}</span></label>`;
    return `<section class="mehr">
      <h2>So wird gespielt</h2>
      <div class="howto"><p><b>Fliegen:</b> WASD/Pfeiltasten oder irgendwo auf den Bildschirm tippen und ziehen.</p>
      <p><b>Schleifen:</b> Kreuze deinen eigenen Schweif. Alles im Kreis explodiert – je mehr Gegner, desto mehr Schaden pro Gegner.</p>
      <p><b>Spezial:</b> Leertaste / Knopf unten rechts / zweiter Finger.</p>
      <p><b>Lila Schweiffresser</b> knabbern deinen Schweif an. Weiche Kugeln aus, sammle Staub, öffne Truhen.</p>
      <p><b>Nach dem Boss:</b> Sichern oder Overdrive – 60 Sekunden mehr, doppelte Beute, aber Tod kostet die Hälfte.</p></div>
      <h2>Einstellungen</h2><div class="sets">${tog('sound', 'Soundeffekte')}${tog('music', 'Musik')}${tog('shake', 'Bildschirmwackeln')}${tog('demo', 'Demo im Menü-Hintergrund')}
      <label class="tog"><input type="checkbox" data-act="set" data-k="lowq" ${set.quality === 'tief' ? 'checked' : ''}><span>Sparmodus (schwache Geräte)</span></label></div>
      <h2>Statistik</h2><div class="sgrid">${stat.map(([a, b]) => `<div><span>${a}</span><b>${typeof b === 'number' ? fmt(b) : b}</b></div>`).join('')}</div>
      <h2>Spielstand</h2><button class="danger" data-act="reset">${resetArm ? 'Wirklich alles löschen? Nochmal tippen' : 'Spielstand zurücksetzen'}</button>
      <p class="hint">Gespeichert wird automatisch im Browser. LOOPSTORM · v1.0</p></section>`;
  }

  function renderMenu() {
    const body = tab === 'flug' ? viewFlug() : tab === 'talente' ? viewTalente() : tab === 'ausruestung' ? viewAusruestung() : tab === 'ziele' ? viewZiele() : viewMehr();
    const sc = menu.querySelector('.body') ? menu.querySelector('.body').scrollTop : 0;
    menu.innerHTML = header() + `<div class="body">${body}</div>` + tabs();
    const b = menu.querySelector('.body'); if (b) b.scrollTop = sc;
  }

  // ---------------- Overlays ----------------
  function showLevelUp(w) {
    const st = w.stats;
    const cards = w.pendingChoice.map((id, i) => {
      const p = data.perkMap[id], n = w.perks[id] || 0;
      const syn = data.synergies.find((s) => s.req.includes(p.flag) && !st.flags[s.flag] && s.req.every((f) => f === p.flag || st.flags[f]));
      return `<button class="perk" data-act="perk" data-i="${i}"><kbd>${i + 1}</kbd><b>${p.name}</b><span>${p.desc}</span><small>${p.max > 1 ? 'Stufe ' + (n + 1) + '/' + p.max : 'Einzigartig'}</small>${syn ? `<em>→ Synergie: ${syn.name}</em>` : ''}</button>`;
    }).join('');
    ov.innerHTML = `<div class="modal lvl"><h1>Stufe ${w.lvl}</h1><p>Wähle ein Upgrade</p><div class="perks">${cards}</div></div>`;
    ov.classList.remove('hidden');
  }

  function showPause(w) {
    const set = S().settings;
    ov.innerHTML = `<div class="modal pause"><h1>Pause</h1>
      <div class="pstats"><span>Zeit ${Math.floor(w.t)} s</span><span>✦ ${fmt(w.dust)}</span><span>${w.c.kills} besiegt</span><span>${w.c.loops} Schleifen</span></div>
      <div class="pperks">${Object.keys(w.perks).map((id) => `<em>${data.perkMap[id].name}${w.perks[id] > 1 ? ' ×' + w.perks[id] : ''}</em>`).join('')}${w.stats.synergies.map((id) => `<em class="syn">${data.synergies.find((s) => s.id === id).name}</em>`).join('')}</div>
      <button class="primary" data-act="resume">Weiter <small>Esc</small></button>
      <div class="sets"><label class="tog"><input type="checkbox" data-act="set" data-k="sound" ${set.sound ? 'checked' : ''}><span>Sound</span></label>
      <label class="tog"><input type="checkbox" data-act="set" data-k="music" ${set.music ? 'checked' : ''}><span>Musik</span></label>
      <label class="tog"><input type="checkbox" data-act="set" data-k="shake" ${set.shake ? 'checked' : ''}><span>Wackeln</span></label></div>
      <button class="danger" data-act="abort">Run aufgeben (Beute behalten)</button></div>`;
    ov.classList.remove('hidden');
  }

  function showOverdrive(w) {
    ov.innerHTML = `<div class="modal od"><h1>Boss besiegt!</h1><p>Du hast ✦ ${fmt(w.dust)} und ${w.c.chests} Truhen gesammelt.</p>
      <div class="odbtns"><button class="bank" data-act="od" data-v="0"><b>Sichern</b><span>Beute einstreichen und heimfliegen</span><small>1</small></button>
      <button class="go" data-act="od" data-v="1"><b>OVERDRIVE</b><span>60 s Chaos. Staub darin zählt doppelt, alle 20 s eine Truhe. Stirbst du, verlierst du die Hälfte davon.</span><small>2</small></button></div></div>`;
    ov.classList.remove('hidden');
  }

  function showResults(r, sum, goals) {
    const s = S();
    const title = r.victory ? (r.odClears ? 'OVERDRIVE ÜBERLEBT' : 'SEKTOR BEFREIT') : 'ZERSTÖRT';
    const items = sum.items.map((it) => { const rd = data.items.rarities[it.rar]; return `<div class="loot" style="--rc:${rd.color}"><b>${it.name}</b><small>${rd.name}</small></div>`; }).join('');
    const rewards = sum.rewards.map((x) => `<li>${x.label}<span>${x.dust ? '+✦' + fmt(x.dust) : ''} ${x.shards ? '+◆' + x.shards : ''}</span></li>`).join('');
    const unlocks = sum.unlocks.map((u) => `<li class="unl">${u}</li>`).join('');
    ov.innerHTML = `<div class="modal res ${r.victory ? 'win' : 'lose'}"><h1>${title}</h1>
      <div class="rgrid"><div><span>Staub</span><b class="cnt" data-to="${r.dust}">0</b></div><div><span>Erfahrung</span><b class="cnt" data-to="${r.xp}">0</b></div>
      <div><span>Besiegt</span><b>${fmt(r.kills)}</b></div><div><span>Schleifen</span><b>${r.loops}</b></div><div><span>Bester Fang</span><b>${r.bestCatch}</b></div><div><span>Beste Combo</span><b>${r.bestCombo}</b></div>
      <div><span>Zeit</span><b>${Math.floor(r.time / 60)}:${String(r.time % 60).padStart(2, '0')}</b></div><div><span>Splitter</span><b>${r.shards}</b></div></div>
      ${sum.levelsGained ? `<p class="lvup">Konto-Level ${s.level}!</p>` : ''}
      ${unlocks ? `<ul class="rew">${unlocks}</ul>` : ''}
      ${items ? `<h2>Beute</h2><div class="loots">${items}</div>` : ''}
      ${rewards ? `<h2>Erledigt</h2><ul class="rew">${rewards}</ul>` : ''}
      <h2>Fast geschafft</h2><div class="goals">${goalsHtml(goals)}</div>
      <div class="rbtn"><button class="primary" data-act="again">Noch ein Run <small>Enter</small></button><button data-act="tomenu">Menü</button></div></div>`;
    ov.classList.remove('hidden');
    // Zähl-Animation
    const els = ov.querySelectorAll('.cnt'); const t0 = performance.now();
    const tick = (now) => {
      const f = Math.min(1, (now - t0) / 900), e = 1 - Math.pow(1 - f, 3);
      els.forEach((el) => { el.textContent = fmt(+el.dataset.to * e); });
      if (f < 1) { api.audio.play('count'); requestAnimationFrame(tick); }
    };
    requestAnimationFrame(tick);
    ov.querySelectorAll('.loot').forEach((el, i) => { el.style.animationDelay = (0.5 + i * 0.18) + 's'; });
  }

  function showOffline(gain, mins) {
    ov.innerHTML = `<div class="modal off"><h1>Willkommen zurück</h1><p>Deine Sammler waren ${mins >= 60 ? Math.floor(mins / 60) + ' h ' : ''}${Math.floor(mins % 60)} min unterwegs.</p>
      <p class="big">+✦ ${fmt(gain)}</p><button class="primary" data-act="closeov">Einsammeln</button></div>`;
    ov.classList.remove('hidden');
  }

  function hideOverlay() { ov.classList.add('hidden'); ov.innerHTML = ''; }

  // ---------------- Events ----------------
  root.addEventListener('click', (e) => {
    const el = e.target.closest('[data-act]');
    if (!el || el.disabled) return;
    api.audio.unlock();
    const act = el.dataset.act, id = el.dataset.id, s = S();
    if (act !== 'set') api.audio.play('ui');
    switch (act) {
      case 'tab': tab = id; selItem = null; resetArm = 0; if (id === 'ausruestung') { s.newItems = 0; } renderMenu(); break;
      case 'zone': if (zoneUnlocked(data, s, id)) { s.zone = id; s.intensity = Math.min(s.intensity, maxIntensity(s, id)); api.persist(); renderMenu(); api.zoneChanged(); } break;
      case 'int': e.stopPropagation(); s.zone = el.dataset.z; s.intensity = +el.dataset.i; api.persist(); renderMenu(); api.zoneChanged(); break;
      case 'cls': if (classUnlocked(data, s, id)) { s.cls = id; api.persist(); renderMenu(); } break;
      case 'start': api.startRun(); break;
      case 'skill': selSkill = id; renderMenu(); break;
      case 'buy': { const r = api.buySkill(id); if (r.ok) { api.audio.play('buy'); } else api.audio.play('deny'); renderMenu(); break; }
      case 'item': selItem = selItem === +id ? null : +id; const it = s.inventory.find((x) => x.uid === +id); if (it) it.isNew = false; renderMenu(); break;
      case 'equip': api.equip(+id); api.audio.play('buy'); renderMenu(); break;
      case 'salvage': { const v = api.salvage(+id); if (v) toast(`Zerlegt: +✦${v.dust}${v.shards ? ' +◆' + v.shards : ''}`); selItem = null; renderMenu(); break; }
      case 'reroll': api.reroll(+id); api.audio.play('chest'); renderMenu(); break;
      case 'upgrade': if (api.upgrade(+id)) api.audio.play('buy'); else api.audio.play('deny'); renderMenu(); break;
      case 'autoequip': { const n = api.autoEquip(); toast(n ? `${n} Gegenstände ausgerüstet` : 'Bereits optimal'); renderMenu(); break; }
      case 'salvall': { const v = api.salvageCommons(); toast(v.n ? `${v.n} zerlegt: +✦${v.dust}` : 'Nichts zu zerlegen'); renderMenu(); break; }
      case 'reset': if (!resetArm) { resetArm = 1; renderMenu(); setTimeout(() => { resetArm = 0; }, 4000); } else { resetArm = 0; api.resetSave(); tab = 'flug'; renderMenu(); } break;
      case 'perk': api.choosePerk(+el.dataset.i); break;
      case 'resume': api.resume(); break;
      case 'abort': api.abort(); break;
      case 'od': api.overdrive(el.dataset.v === '1'); break;
      case 'again': api.again(); break;
      case 'tomenu': api.toMenu(); break;
      case 'closeov': hideOverlay(); renderMenu(); break;
    }
  });
  root.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.act !== 'set') return;
    api.setSetting(el.dataset.k, el.checked);
  });

  return {
    renderMenu, showLevelUp, showPause, showOverdrive, showResults, showOffline, hideOverlay, toast,
    showMenu() { menu.classList.remove('hidden'); renderMenu(); },
    hideMenu() { menu.classList.add('hidden'); },
    get tab() { return tab; },
    overlayOpen() { return !ov.classList.contains('hidden'); },
    overlayKind() { const m = ov.querySelector('.modal'); return m ? m.classList[1] : null; },
    clickOverlay(sel) { const b = ov.querySelector(sel); if (b && !b.disabled) b.click(); }
  };
}
