"""Renders the README's architecture figure from architecture.html beside it, at 2x on white.
Usage: python docs/figures/render.py"""
import os
from playwright.sync_api import sync_playwright

HERE = os.path.dirname(os.path.abspath(__file__))

with sync_playwright() as p:
    b = p.chromium.launch()
    pg = b.new_page(viewport={'width': 900, 'height': 1000}, device_scale_factor=2)
    pg.goto('file:///' + os.path.join(HERE, 'architecture.html').replace(os.sep, '/'))
    pg.evaluate('document.fonts.ready')
    pg.wait_for_timeout(300)
    pg.locator('#fig').screenshot(path=os.path.join(HERE, 'architecture.png'))
    b.close()
print('written')
