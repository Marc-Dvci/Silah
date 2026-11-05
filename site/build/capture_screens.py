"""Captures the product page's screenshots of the own-report screens (own result, plain-words explanation,
booking, linking phones, the physician summary, the clinic's appointments) from the built app, in English and Arabic,
straight to site/assets/img as WebP. Run `npx vite preview --port 4173` first, then: python site/build/capture_screens.py"""
import io, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:4173/'
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'site', 'assets', 'img')

def save(png, name, width):
    im = Image.open(io.BytesIO(png)).convert('RGB')
    if im.width > width:
        im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=84, method=6)
    print(name, im.size)

def to(pg, sel):
    pg.evaluate("s => { const e = document.querySelector(s); if (e) window.scrollTo({ top: e.getBoundingClientRect().top + scrollY - 70 }); }", sel)
    pg.wait_for_timeout(700)

with sync_playwright() as p:
    b = p.chromium.launch()
    for lang, locale in [('en', 'en-GB'), ('ar', 'ar-AE')]:
        ctx = b.new_context(viewport={'width': 390, 'height': 844}, device_scale_factor=2, locale=locale)
        pg = ctx.new_page()
        pg.goto(BASE + '#/p/me/import'); pg.wait_for_timeout(2500)
        pg.locator('.pool.soft .link').first.click()
        pg.locator('input[aria-label]').first.wait_for(timeout=15000); pg.wait_for_timeout(900)
        save(pg.screenshot(), f'{lang}-import', 640)
        pg.locator('.btn.primary.full').last.click(); pg.wait_for_timeout(1800)
        to(pg, '#focus-explain')
        save(pg.screenshot(), f'{lang}-explain', 640)
        pg.goto(BASE + '#/p/me/book'); pg.wait_for_timeout(1500)
        pg.locator('button.chip.num').first.click(); pg.wait_for_timeout(500)
        to(pg, 'section:nth-of-type(3)')
        save(pg.screenshot(), f'{lang}-book', 640)
        pg.goto(BASE + '#/p/me/partner'); pg.wait_for_timeout(1200)
        pg.locator('.btn.primary.full').first.click()
        pg.locator('img[src^="data:image"]').first.wait_for(timeout=15000); pg.wait_for_timeout(800)
        save(pg.screenshot(), f'{lang}-partner', 640)
        if lang == 'en':
            pg.set_viewport_size({'width': 1100, 'height': 900})
            pg.goto(BASE + '#/s/me'); pg.wait_for_timeout(1500)
            save(pg.screenshot(), 'summary-doc', 1600)
            pg.set_viewport_size({'width': 1440, 'height': 900})
            # Book once, so the clinic has an appointment with its summary.
            pg.set_viewport_size({'width': 390, 'height': 844})
            pg.goto(BASE + '#/p/me/book'); pg.wait_for_timeout(1200)
            pg.locator('button.chip.num').first.click(); pg.wait_for_timeout(300)
            pg.get_by_role('switch', name='Send summary').click()
            pg.get_by_role('button', name='Book this time').click(); pg.wait_for_timeout(2500)
            pg.set_viewport_size({'width': 1440, 'height': 900})
            pg.goto(BASE + '#/c/appointments'); pg.wait_for_timeout(1500)
            save(pg.screenshot(), 'clinic-appointments', 1600)
        ctx.close()
    b.close()
