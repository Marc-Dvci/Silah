"""The built app keeps working with the network off, after one online visit. Usage: python offline.py [base]"""
import os, sys, tempfile
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 900})
    pg = ctx.new_page()
    pg.goto(BASE + '#/p/noura'); pg.wait_for_timeout(4000)
    pg.evaluate('navigator.serviceWorker.ready')
    pg.reload(); pg.wait_for_timeout(2500)          # now controlled by the service worker
    ctx.set_offline(True)
    pg.goto(BASE + '#/p/noura/result'); pg.wait_for_timeout(3000)
    ok = pg.get_by_text('Spinal muscular atrophy (SMA)').count() > 0
    pg.screenshot(path=os.path.join(tempfile.gettempdir(), 'silah_offline_result.png'))
    print('offline result renders:', ok)
    # A report read on the phone with the network off: the PDF reader and the sample reports are cached.
    pg.goto(BASE + '#/p/me/import'); pg.wait_for_timeout(1500)
    pg.locator('.pool.soft .link').first.click()
    try:
        pg.locator('input[aria-label="Gene"]').first.wait_for(timeout=15000)
        ok2 = pg.locator('input[aria-label="Gene"]').count() == 3
    except Exception:
        ok2 = False
    print('offline PDF report read on the phone:', ok2)
    b.close()
    sys.exit(0 if ok and ok2 else 1)
