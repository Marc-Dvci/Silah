"""Assembles the Pages site as the workflow does (product page at the root, app under /demo/), serves it under
/Silah/, and checks both languages: every request succeeds, no page error, no sideways scroll on a phone, no WCAG 2.2 AA
violation (axe-core), and the demo opens from the page. Needs `npm run build` first. Usage: python tests/e2e/site.py"""
import sys, os, shutil, tempfile, threading, functools
from http.server import ThreadingHTTPServer, SimpleHTTPRequestHandler
sys.stdout.reconfigure(encoding='utf-8')
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
tmp = tempfile.mkdtemp()
site = os.path.join(tmp, 'Silah')
os.makedirs(site)
for f in ('index.html', 'ar.html'):
    shutil.copy(os.path.join(ROOT, 'site', f), site)
shutil.copytree(os.path.join(ROOT, 'site', 'assets'), os.path.join(site, 'assets'))
shutil.copytree(os.path.join(ROOT, 'dist'), os.path.join(site, 'demo'))

class Quiet(SimpleHTTPRequestHandler):
    def log_message(self, *a): pass
srv = ThreadingHTTPServer(('127.0.0.1', 0), functools.partial(Quiet, directory=tmp))
threading.Thread(target=srv.serve_forever, daemon=True).start()
BASE = f'http://127.0.0.1:{srv.server_address[1]}/Silah/'

fails = []
def check(ok, what):
    print('ok  ' if ok else 'FAIL', what); ok or fails.append(what)

with sync_playwright() as p:
    b = p.chromium.launch()
    for page, lang, demo_label in [('', 'en', 'Open the live demo'), ('ar.html', 'ar', 'افتح العرض التجريبي')]:
        for w in (1440, 390):
            pg = b.new_page(viewport={'width': w, 'height': 900})
            bad = []
            pg.on('response', lambda r: bad.append(f'{r.status} {r.url}') if r.status >= 400 else None)
            pg.on('pageerror', lambda e: bad.append(str(e)))
            pg.goto(BASE + page); pg.wait_for_timeout(800)
            pg.evaluate('() => new Promise(r => { let y = 0; const t = setInterval(() => { scrollBy(0, 700); y += 700; if (y > document.body.scrollHeight) { clearInterval(t); r(); } }, 40); })')
            pg.wait_for_timeout(1500)
            check(pg.evaluate('document.documentElement.lang') == lang, f'{lang} {w}px: lang attribute')
            check(pg.evaluate('document.documentElement.scrollWidth') <= w, f'{lang} {w}px: no sideways scroll')
            broken = pg.evaluate('[...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.src)')
            check(not broken, f'{lang} {w}px: every image loads {broken[:2]}')
            check(not bad, f'{lang} {w}px: no failed request or page error {bad[:2]}')
            if w == 1440:
                pg.add_script_tag(path=os.path.join(ROOT, 'node_modules', 'axe-core', 'axe.min.js'))
                v = pg.evaluate("axe.run(document, {runOnly: {type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']}}).then(r => r.violations.map(v => v.id))")
                check(not v, f'{lang}: 0 WCAG 2.2 AA violations {v}')
            pg.close()
        pg = b.new_page(viewport={'width': 1440, 'height': 900})
        pg.goto(BASE + page); pg.get_by_role('link', name=demo_label).first.click(); pg.wait_for_timeout(4000)
        check(pg.url.endswith('/Silah/demo/') and 'Mariam' in pg.locator('body').inner_text(), f'{lang}: the demo opens from the page')
        pg.close()
    b.close()
srv.shutdown(); shutil.rmtree(tmp, ignore_errors=True)
print('ALL PASS' if not fails else f'{len(fails)} FAILED')
sys.exit(1 if fails else 0)
