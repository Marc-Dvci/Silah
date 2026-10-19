"""Plays the guided story with every phone in Arabic and saves the phone at each step, at 2x, for the Arabic
product page. Usage (dev server running): python site/build/capture_ar.py [base]"""
import sys, os
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'shots_ar')
os.makedirs(OUT, exist_ok=True)
PHONE = {'width': 390, 'height': 844}
errors = []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=2)
    pg = ctx.new_page(); pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.goto(BASE + '#/'); pg.wait_for_timeout(5000)
    pg.get_by_role('button', name='Reset demo').click(); pg.wait_for_timeout(3000)
    pg.get_by_role('button', name='العربية').click(); pg.wait_for_timeout(1500)
    pg.get_by_role('button', name='Start the story').click(); pg.wait_for_timeout(3000)
    ph = ctx.new_page(); ph.on('pageerror', lambda e: errors.append(str(e)))
    ph.set_viewport_size(PHONE)

    def still(route, name, scroll=0, wait=2200):
        ph.goto(BASE + route); ph.wait_for_timeout(wait)
        if scroll: ph.evaluate(f'window.scrollTo(0, {scroll})'); ph.wait_for_timeout(500)
        ph.screenshot(path=f'{OUT}/{name}.png', style='.fab { display: none !important; }')
        print('shot', name)

    still('#/p/mariam', 'invitation')            # step 1: Mariam's invitation, before she agrees
    for i in range(2, 11):
        pg.get_by_role('button', name='Next step').click(); pg.wait_for_timeout(3500)
        if i == 4: pg.screenshot(path=f'{OUT}/stage.png')   # Mariam reads her result; clinic beside it
        if i == 5: still('#/p/mariam/ask', 'ask')
    still('#/p/mariam/result', 'result')
    still('#/p/mariam/counsellor', 'counsellor')
    still('#/p/mariam/family', 'family')
    ph.set_viewport_size({'width': 390, 'height': 1010}); still('#/p/noura/birth', 'birth'); ph.set_viewport_size(PHONE)
    still('#/p/fatima/result', 'fatima_result', scroll=380)
    still('#/p/mariam/privacy', 'privacy')
    print('page errors:', errors or 'none')
    b.close()
