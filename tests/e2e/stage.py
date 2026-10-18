"""Plays the whole story on the desktop stage by pressing Next only, and checks each screen has content."""
import sys
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
with sync_playwright() as p:
    b = p.chromium.launch(); pg = b.new_page(viewport={'width': 1600, 'height': 1000})
    errs = []; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto(BASE + '#/'); pg.wait_for_timeout(5000)
    pg.get_by_role('button', name='Start the story').click(); pg.wait_for_timeout(3000)
    for i in range(2, 11):
        pg.get_by_role('button', name='Next step').click(); pg.wait_for_timeout(3500)
        phone = pg.frame_locator('iframe[title="Person\'s phone"]')
        txt = phone.locator('main').first.inner_text()
        print(i, len(txt), txt[:60].replace('\n', ' '))
        pg.screenshot(path=f'D:/tmp/silah_shots/stage_{i:02d}.png')
    print('errors:', errs[:5] or 'none')
    b.close()
