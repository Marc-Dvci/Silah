"""Headless walk through the person app; screenshots to D:/tmp/silah_shots. Usage: python shots.py [base_url]"""
import sys, time
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
OUT = 'D:/tmp/silah_shots'
errors = []

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on('console', lambda m: errors.append(f'{m.type}: {m.text}') if m.type in ('error', 'warning') else None)
    pg.on('pageerror', lambda e: errors.append(f'pageerror: {e}'))
    def shot(name, wait=900):
        pg.wait_for_timeout(wait)
        pg.screenshot(path=f'{OUT}/{name}.png', full_page=True)
    pg.goto(BASE + '#/p/noura'); shot('01_noura_home', 2500)
    pg.goto(BASE + '#/p/noura/result'); shot('02_noura_result', 1500)
    pg.goto(BASE + '#/p/noura/birth'); shot('03_noura_birth')
    pg.goto(BASE + '#/p/fatima'); shot('04_fatima_home')
    pg.goto(BASE + '#/p/fatima/result'); shot('05_fatima_result', 1500)
    pg.goto(BASE + '#/c/queue'); pg.set_viewport_size({'width': 1440, 'height': 900}); shot('06_clinic_queue', 1500)
    b.close()
print('\n'.join(errors[:30]) or 'no console errors')
