# Tiefer Browser-Test: Boss, Level-Up, Overdrive, Performance, kaputter Speicher, Touch
import sys, time, os
from playwright.sync_api import sync_playwright
url = 'file://' + os.path.abspath(sys.argv[1] if len(sys.argv) > 1 else 'dist/index.html')
errs = []
G = 'window.__LOOPSTORM__'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 390, 'height': 800}, is_mobile=True, has_touch=True, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type == 'error' else None)
    # kaputter Spielstand
    pg.add_init_script("if (!sessionStorage.getItem('x')) { sessionStorage.setItem('x','1'); localStorage.setItem('loopstorm_save_v1','{kaputt'); }")
    pg.goto(url); time.sleep(1)
    print('corrupt -> level', pg.evaluate(G + '.save.level'), 'backup', pg.evaluate("!!localStorage.getItem('loopstorm_save_v1_corrupt')"))
    pg.evaluate(G + '.save.tutorialDone = true')
    pg.click('[data-act="start"]', force=True); time.sleep(0.3)
    # Touch-Joystick: Kreis ziehen
    cx, cy = 195, 500
    pg.touchscreen.tap(cx, cy)
    import math
    cdp = ctx.new_cdp_session(pg)
    def touch(t, x, y):
        cdp.send('Input.dispatchTouchEvent', {'type': t, 'touchPoints': [] if t == 'touchEnd' else [{'x': x, 'y': y}]})
    touch('touchStart', cx, cy)
    for i in range(120):
        a = i * 0.05; touch('touchMove', cx + math.cos(a) * 50, cy + math.sin(a) * 50); time.sleep(0.02)
    touch('touchEnd', 0, 0)
    print('touch loops', pg.evaluate(G + '.run.c.loops'), 'moved to', pg.evaluate('[' + G + '.run.p.x|0,' + G + '.run.p.y|0]'))
    # Performance unter Last
    pg.evaluate(G + '.run.t = 100; ' + G + '.run.p.inv = 999; ' + G + '.run.stats.maxHp = 1e9; ' + G + '.run.p.hp = 1e9')
    time.sleep(4)
    fps = pg.evaluate('new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else r(n / 2); }; requestAnimationFrame(f); })')
    print('alive', pg.evaluate(G + '.run.alive'), 'fps (headless, mobil dpr2)', fps)
    # Level-up
    for _ in range(30):
        if pg.evaluate('!!' + G + '.run.pendingChoice'):
            pg.screenshot(path='/tmp/shots/levelup.png'); pg.click('.perk >> nth=0'); break
        time.sleep(0.2)
    print('perks', pg.evaluate(G + '.run.c.perks'))
    time.sleep(16)
    print('boss?', pg.evaluate('!!' + G + '.run.boss'), 't', pg.evaluate(G + '.run.t|0'))
    pg.screenshot(path='/tmp/shots/boss.png')
    for _ in range(10):
        if pg.evaluate('!!' + G + '.run.pendingChoice'): pg.click('.perk >> nth=0')
        time.sleep(0.1)
    pg.evaluate(G + '.run.t = Math.max(' + G + '.run.t, ' + G + '.run.bossAt)'); time.sleep(1)
    print('boss jetzt?', pg.evaluate('!!' + G + '.run.boss'))
    pg.evaluate("(() => { const b = " + G + ".run.boss; if (b) { b.hp = 2; b.burnT = 5; b.burnD = 50; } })()")
    # Boss über Schweif-Treffer sterben lassen: direkt Schaden über Event simulieren
    for _ in range(40):
        if pg.evaluate('!!' + G + '.run.pendingOverdrive'): break
        if pg.evaluate('!!' + G + '.run.pendingChoice'): pg.click('.perk >> nth=0')
        time.sleep(0.2)
    print('overdrive-frage', pg.evaluate('!!' + G + '.run.pendingOverdrive'))
    pg.screenshot(path='/tmp/shots/od.png')
    if pg.evaluate('!!' + G + '.run.pendingOverdrive'):
        pg.click('.go'); time.sleep(1)
        pg.evaluate(G + '.run.t = ' + G + '.run.odEnd - 0.5'); time.sleep(1.5)
        for _ in range(10):
            if pg.evaluate('!!(' + G + '.run && ' + G + '.run.pendingChoice)'): pg.click('.perk >> nth=0')
            time.sleep(0.2)
    print('mode', pg.evaluate(G + '.mode'), 'victory', pg.evaluate(G + '.run && ' + G + '.run.result && ' + G + '.run.result.victory'))
    pg.screenshot(path='/tmp/shots/res2.png')
    print('zones', pg.evaluate('JSON.stringify(' + G + '.save.zones)'), 'items', pg.evaluate(G + '.save.inventory.length'))
    pg.click('[data-act="tomenu"]'); time.sleep(0.4)
    pg.click('[data-act="tab"][data-id="ausruestung"]'); time.sleep(0.3)
    pg.click('.inv .item >> nth=0') if pg.evaluate("document.querySelectorAll('.inv .item').length") else None
    time.sleep(0.2); pg.screenshot(path='/tmp/shots/gear.png')
    b.close()
print('ERRORS', len(errs)); [print(' ', e) for e in errs[:10]]
