"""WCAG 2.2 AA scan (axe-core) of every person screen in both languages and of the clinic screens.
Usage: python tests/e2e/a11y.py [base]  (needs the dev server and a seeded demo; runs the story first)"""
import sys, json
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
AXE = open('node_modules/axe-core/axe.min.js', encoding='utf-8').read()
pages = [('noura', p) for p in ['', 'result', 'check', 'options', 'birth', 'family', 'counsellor', 'privacy', 'ask']] + \
        [('fatima', p) for p in ['', 'result', 'privacy']] + [('mariam', '')]
total = {}
JS = r"""async () => { const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a','wcag2aa','wcag21a','wcag21aa','wcag22aa'] } }); return r.violations.map(v => ({ id: v.id, impact: v.impact, n: v.nodes.length, help: v.help, sample: v.nodes.slice(0, 2).map(n => n.target.join(' ') + ' :: ' + (n.failureSummary || '').slice(0, 160)) })); }"""
with sync_playwright() as pw:
    b = pw.chromium.launch()
    pg = b.new_page(viewport={'width': 412, 'height': 900})
    def scan(url, label):
        pg.goto(BASE + url); pg.wait_for_timeout(1800)
        pg.add_script_tag(content=AXE)
        res = pg.evaluate(JS)
        for v in res:
            key = v['id']; total.setdefault(key, {'impact': v['impact'], 'help': v['help'], 'where': []})
            total[key]['where'].append(f"{label} ({v['n']})"); total[key].setdefault('sample', v['sample'])
    for who, page in pages:
        scan(f'#/p/{who}/{page}', f'{who}/{page or "home"}')
    pg.goto(BASE + '#/p/noura/privacy'); pg.wait_for_timeout(1500)
    pg.set_viewport_size({'width': 1440, 'height': 900})
    for c in ['queue', 'outreach', 'births', 'invites', 'pathway']:
        scan(f'#/c/{c}', f'clinic/{c}')
    b.close()
print(json.dumps(total, indent=1, ensure_ascii=False))
print('violations:', len(total))
