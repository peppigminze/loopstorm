# Browser-Test mit Playwright: lädt Spiel, prüft Konsole, spielt kurz, macht Screenshots
import sys, time, subprocess, os
from playwright.sync_api import sync_playwright
target = sys.argv[1] if len(sys.argv) > 1 else 'src'
root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
srv = None
if target == 'src':
    srv = subprocess.Popen(['python3', '-m', 'http.server', '8765'], cwd=root, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
    time.sleep(0.8); url = 'http://localhost:8765/index.html'
else:
    url = 'file://' + os.path.abspath(target)
errors = []
out = '/tmp/shots'; os.makedirs(out, exist_ok=True)
with sync_playwright() as p:
    for (name, vp, mobile) in [('desk', {'width': 1280, 'height': 760}, False), ('mobile', {'width': 390, 'height': 800}, True)]:
        b = p.chromium.launch()
        ctx = b.new_context(viewport=vp, is_mobile=mobile, has_touch=mobile, device_scale_factor=2 if mobile else 1)
        pg = ctx.new_page()
        pg.on('console', lambda m: errors.append(f'{name}: {m.text}') if m.type == 'error' else None)
        pg.on('pageerror', lambda e: errors.append(f'{name} PAGEERROR: {e}'))
        pg.goto(url); time.sleep(1.5)
        pg.screenshot(path=f'{out}/{name}_menu.png')
        for t in ['talente', 'ausruestung', 'ziele', 'mehr', 'flug']:
            pg.click(f'[data-act="tab"][data-id="{t}"]'); time.sleep(0.15)
            if name == 'desk' and t in ('talente', 'ziele'): pg.screenshot(path=f'{out}/{name}_{t}.png')
        pg.click('[data-act="start"]', force=True); time.sleep(0.5)
        # Kreise fliegen
        keys = ['KeyD', 'KeyS', 'KeyA', 'KeyW']
        t0 = time.time(); i = 0
        while time.time() - t0 < 9:
            k = keys[i % 4]; pg.keyboard.down(k); time.sleep(0.35); pg.keyboard.up(k); i += 1
            st = pg.evaluate('(() => { const r = window.__LOOPSTORM__.run; return r ? {c: !!r.pendingChoice, o: r.over, od: r.pendingOverdrive} : null })()')
            if st and st['c']: pg.keyboard.press('Digit1')
        pg.screenshot(path=f'{out}/{name}_run.png')
        info = pg.evaluate('(() => { const r = window.__LOOPSTORM__.run; return {mode: window.__LOOPSTORM__.mode, t: r && r.t, loops: r && r.c.loops, kills: r && r.c.kills, hp: r && r.p.hp, lvl: r && r.lvl} })()')
        print(name, info)
        # Run beenden -> Ergebnis
        pg.evaluate('window.__LOOPSTORM__.run.p.hp = -1')
        time.sleep(0.8)
        pg.screenshot(path=f'{out}/{name}_results.png')
        mode = pg.evaluate('window.__LOOPSTORM__.mode'); print(name, 'mode nach Tod:', mode)
        pg.keyboard.press('Enter'); time.sleep(0.5)
        print(name, 'nach Enter:', pg.evaluate('window.__LOOPSTORM__.mode'))
        # Pause
        pg.keyboard.press('Escape'); time.sleep(0.3)
        pg.screenshot(path=f'{out}/{name}_pause.png')
        print(name, 'save dust', pg.evaluate('window.__LOOPSTORM__.save.dust'), 'runs', pg.evaluate('window.__LOOPSTORM__.save.life.runs'))
        b.close()
if srv: srv.terminate()
print('ERRORS:', len(errors))
for e in errors[:20]: print(' ', e)
