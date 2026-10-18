"""The on-device model inside the browser: download Gemma 4 E2B (ONNX, WebGPU), then answer a free
question through the verifier. Uses a persistent profile so the model is cached after the first run.
Usage: python tests/e2e/webgpu.py [base]"""
import sys, time
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context('D:/tmp/pw_webgpu', headless=True, args=['--enable-unsafe-webgpu', '--use-angle=d3d11'],
                                               viewport={'width': 412, 'height': 900})
    pg = ctx.new_page()
    logs = []; pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.goto(BASE + '#/p/noura/ask'); pg.wait_for_timeout(4000)
    t0 = time.time()
    pg.get_by_role('button', name='Download the on-device model (about 3 GB)').click()
    # wait until the model is ready: the download button disappears and the "answered by" note appears
    pg.wait_for_selector('text=Free questions are answered by', timeout=1_500_000)
    print(f'model ready in {time.time() - t0:.0f} s')
    for q in ['Will my baby be able to live a normal life if she has SMA?', 'Should we have another baby after this one?']:
        t1 = time.time()
        pg.get_by_role('textbox').fill(q)
        pg.get_by_role('button', name='Ask', exact=True).click()
        pg.wait_for_function('document.querySelectorAll(".bubble.silah").length >= 1 && !document.querySelector(".bubble.silah .muted")', timeout=300_000)
        pg.wait_for_timeout(1500)
        print(f'{q} -> {time.time() - t1:.1f} s')
    print('\n'.join(t for t in pg.locator('.bubble.silah').all_inner_texts()))
    pg.screenshot(path='D:/tmp/silah_shots/15_webgpu_answer.png', full_page=True)
    print('\n'.join(l for l in logs if 'error' in l.lower())[:2000])
    ctx.close()
