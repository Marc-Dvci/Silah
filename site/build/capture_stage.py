"""Captures the product page's hero: the guided story at step 4 (Mariam reads her result, with the clinic beside her),
with the phones in English and in Arabic, from the live demo, straight to site/assets/img as WebP.
Usage: python site/build/capture_stage.py [base_url]"""
import io, os, sys
from PIL import Image
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'https://marc-dvci.github.io/Silah/demo/'
ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OUT = os.path.join(ROOT, 'site', 'assets', 'img')

with sync_playwright() as p:
    b = p.chromium.launch()
    for name, language in [('stage', 'English'), ('ar-stage', 'العربية')]:
        ctx = b.new_context(viewport={'width': 1600, 'height': 1000}, device_scale_factor=2)
        pg = ctx.new_page()
        pg.goto(BASE + '#/'); pg.wait_for_timeout(5000)
        pg.get_by_role('button', name='Reset demo').click(); pg.wait_for_timeout(3000)
        pg.get_by_role('button', name=language, exact=True).click(); pg.wait_for_timeout(1500)
        pg.get_by_role('button', name='Start the story').click(); pg.wait_for_timeout(3000)
        for _ in range(3):
            pg.get_by_role('button', name='Next step').click(); pg.wait_for_timeout(3500)
        im = Image.open(io.BytesIO(pg.screenshot())).convert('RGB').resize((1800, 1125), Image.LANCZOS)
        im.save(os.path.join(OUT, name + '.webp'), 'WEBP', quality=84, method=6)
        print(name, im.size)
        ctx.close()
    b.close()
