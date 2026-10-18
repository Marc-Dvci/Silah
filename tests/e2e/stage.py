"""Plays the whole story on the desktop stage by pressing Next only, and checks each screen has content,
that the clinic follows the demo couple, and that the stage's language switch reaches the phone."""
import sys
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
fails = []
def check(ok, what):
    print('ok  ' if ok else 'FAIL', what); ok or fails.append(what)
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/'); pg.wait_for_timeout(5000)
    pg.get_by_role('button', name='Reset demo').click(); pg.wait_for_timeout(3000)
    pg.get_by_role('button', name='Start the story').click(); pg.wait_for_timeout(3000)
    phone = pg.frame_locator('iframe[title="Person\'s phone"]')
    clinic = pg.frame_locator('iframe[title="Health-system side"]')
    for i in range(2, 11):
        pg.get_by_role('button', name='Next step').click(); pg.wait_for_timeout(3500)
        txt = phone.locator('main').first.inner_text()
        check(len(txt) > 40, f'step {i}: phone shows content ({txt[:50].strip()!r})'.replace('\n', ' '))
        if i in (4, 5, 6):
            check('Mariam & Saeed' in clinic.locator('.queue-row.sel').inner_text(), f'step {i}: clinic brief shows Mariam & Saeed')
        pg.screenshot(path=f'D:/tmp/silah_shots/stage_{i:02d}.png')
    pg.get_by_role('button', name='English').click(); pg.wait_for_timeout(3000)
    check(phone.locator('html').get_attribute('lang') == 'en' or phone.locator('[dir="ltr"]').count() > 0, 'language switch: phone in English')
    check(phone.get_by_text('Compatible', exact=False).count() > 0, 'language switch: Fatima’s result readable in English')
    pg.screenshot(path='D:/tmp/silah_shots/stage_11_english.png')
    pg.set_viewport_size({'width': 1280, 'height': 900}); pg.wait_for_timeout(800)
    sw = pg.evaluate('document.documentElement.scrollWidth')
    check(sw <= 1280, f'no horizontal scroll at 1280 px (scrollWidth {sw})')
    pg.screenshot(path='D:/tmp/silah_shots/stage_12_1280.png')
    check(not errs, f'no page errors {errs[:3]}')
    b.close()
print('ALL PASS' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
