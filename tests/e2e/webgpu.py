"""The on-device model inside the browser: download Gemma 4 E2B (ONNX, WebGPU), then answer a free
question through the verifier. Uses a persistent profile so the model is cached after the first run, and the full Chromium build
(channel 'chromium'): the headless shell lacks dxil.dll, so Dawn cannot create a shader-f16 device.
Prints progress as it goes. Usage: python tests/e2e/webgpu.py [base]"""
import re, sys, time
sys.stdout.reconfigure(encoding="utf-8")
from playwright.sync_api import sync_playwright
BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
SHOT = 'D:/tmp/silah_shots/15_webgpu_answer.png'

def say(*a):
    print(*a, flush=True)

with sync_playwright() as p:
    ctx = p.chromium.launch_persistent_context('D:/tmp/pw_webgpu', channel='chromium', headless=True, args=['--enable-unsafe-webgpu', '--use-angle=d3d11'],
                                               viewport={'width': 412, 'height': 900})
    pg = ctx.new_page()
    logs = []; pg.on('console', lambda m: logs.append(f'{m.type}: {m.text}'))
    pg.goto(BASE + '#/p/noura/ask'); pg.wait_for_timeout(4000)
    say('webgpu adapter:', pg.evaluate("navigator.gpu ? navigator.gpu.requestAdapter().then(a => !!a) : false"))
    t0 = time.time()
    pg.locator('.pool button.chip').filter(has_text=re.compile('3 GB|3 غيغابايت')).click()
    ready = False
    while time.time() - t0 < 1500:
        pg.wait_for_timeout(10_000)
        if pg.locator('.pool').filter(has_text='(WebGPU)').count():
            ready = True; break
        chip = pg.locator('.pool button.chip').last
        note = pg.locator('.pool .tiny.muted')
        say(f'{time.time() - t0:5.0f} s  button={chip.inner_text() if chip.count() else "-"}  note={note.inner_text() if note.count() else "-"}')
        errs = [l for l in logs if l.startswith('error')]
        if note.count() or errs:
            say('\n'.join(errs[-10:])); break
    if not ready:
        say('model not ready'); say('\n'.join(logs[-20:])); ctx.close(); sys.exit(1)
    say(f'model ready in {time.time() - t0:.0f} s')
    for q in ['Will my baby be able to live a normal life if she has SMA?', 'Should we have another baby after this one?',
              'هل سيتمكن طفلي من عيش حياة طبيعية إذا كان مصاباً بضمور العضلات الشوكي؟']:
        t1 = time.time()
        n = pg.locator('.bubble.silah').count()
        pg.get_by_role('textbox').fill(q)
        pg.locator('.ask-bar button[type=submit]').click()
        pg.wait_for_function(f'document.querySelectorAll(".bubble.silah").length > {n} && ![...document.querySelectorAll(".bubble.silah")].at(-1).querySelector(".muted:only-child")', timeout=300_000)
        pg.wait_for_timeout(1500)
        say(f'{q} -> {time.time() - t1:.1f} s')
    say('\n---\n'.join(pg.locator('.bubble.silah').all_inner_texts()))
    pg.screenshot(path=SHOT, full_page=True)
    say('\n'.join(l for l in logs if l.startswith('error'))[:2000])
    ctx.close()
