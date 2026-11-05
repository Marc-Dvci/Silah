"""A person's own report, through the real UI, headless: they bring their own report (PDF), confirms what was
read, reads the result with what is uncertain, gets a plain-language explanation that passed the verifier, books
counselling directly (place, format, language, time) with the physician summary attached, the clinic sees the
appointment and the summary, the summary prints and exports as FHIR; two phones pair through the relay, share a
finding live, and the link ends on both.

Usage: python tests/e2e/own.py [base_url] [relay_url]
  needs the app (npm run dev) and, for pairing, the relay (cd relay && npx wrangler dev --port 8787).
  Screenshots in the system temp folder, silah_own.
"""
import sys, os, json, tempfile, urllib.request
from playwright.sync_api import sync_playwright

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
RELAY = sys.argv[2] if len(sys.argv) > 2 else 'http://127.0.0.1:8787'
OUT = os.path.join(tempfile.gettempdir(), 'silah_own')
os.makedirs(OUT, exist_ok=True)
errors, n, passed = [], [0], [0]

def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    passed[0] += 1
    print('ok  ', msg)

def relay_up():
    try:
        # Cloudflare refuses Python's default user agent; browsers are unaffected.
        req = urllib.request.Request(RELAY + '/v1/health', headers={'User-Agent': 'silah-e2e'})
        return json.load(urllib.request.urlopen(req, timeout=5)).get('ok')
    except Exception:
        return False

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2, locale='en-GB', accept_downloads=True)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' and 'relay' not in m.text and '8080' not in m.text else None)

    def shot(page, name, wait=600):
        page.wait_for_timeout(wait)
        n[0] += 1
        page.screenshot(path=f'{OUT}/{n[0]:02d}_{name}.png', full_page=True)

    # 1. Own result: landing, then the sample PDF read on the phone.
    pg.goto(BASE + '#/p/me'); pg.wait_for_timeout(2500)
    check(pg.get_by_text('Silah can read your own premarital genetic result').count() == 1, 'own-result landing')
    pg.get_by_role('button', name='Add my result').click(); pg.wait_for_timeout(600)
    pg.get_by_role('button', name='Aisha: cousins, both carry a change in HBB').click()
    pg.get_by_text('Is this what your report says?').wait_for(timeout=15000)
    shot(pg, 'confirm')
    check(pg.locator('input[aria-label="Gene"]').count() == 3, 'three findings read from the PDF')
    genes = [pg.locator('input[aria-label="Gene"]').nth(i).input_value() for i in range(3)]
    check(genes == ['HBB', 'GJB2', 'MEFV'], f'genes read: {genes}')
    check(pg.locator('input[aria-label="Change (c.)"]').first.input_value() == 'NM_000518.5:c.20A>T', 'HGVS read with transcript')
    check(pg.get_by_role('radio', name='Not compatible (at risk)').get_attribute('aria-checked') == 'true', 'couple status read: at risk')
    pg.get_by_role('button', name='Yes, this is what my report says').click(); pg.wait_for_timeout(1500)

    # 2. The result, labelled as entered, with what is uncertain.
    check(pg.get_by_text('Read from your PDF report and confirmed by you').count() == 1, 'result labelled as entered from the PDF, not lab-signed')
    check(pg.get_by_text('sickle', exact=False).count() >= 1, 'HbS + beta-plus gives sickle beta-thalassaemia')
    check(pg.get_by_text('What is still uncertain').count() == 1, 'uncertainty section present')
    check(pg.get_by_text('The lab says its test finds about 95%').count() == 1, 'detection stated by the report is used')
    check(pg.get_by_text('If it finds 99% of them').count() == 1, 'range card computed by the kernel')
    check(pg.get_by_text('These numbers come from what was read from your report').count() == 1, 'entry uncertainty card')
    shot(pg, 'result')

    # 3. Plain-language explanation: the stored one for the sample, re-checked on the phone.
    panel = pg.locator('#focus-explain')
    if panel.get_by_text('Written by').count():
        sentences = panel.locator('button.cite').count()
        check(sentences >= 2, f'explanation shows {sentences} checked sentences')
        panel.locator('button.cite').first.click(); pg.wait_for_timeout(300)
        check(panel.get_by_text('Checked against this fixed text from your result').count() == 1, 'each sentence opens the fixed text it was checked against')
    else:
        check(panel.get_by_role('button', name='Explain in plain words').count() == 1, 'explain button offered (no stored explanation)')
    panel.scroll_into_view_if_needed(); shot(pg, 'explain')

    # 4. Direct booking with the summary attached.
    pg.goto(BASE + '#/p/me/book'); pg.wait_for_timeout(1200)
    check(pg.get_by_text('The DoH standard (Appendix 13) names this clinic').count() >= 1, 'Appendix 13 routing shown')
    pg.get_by_role('radio', name='A woman').click(); pg.wait_for_timeout(300)
    slot = pg.locator('button.chip.num').first
    slot_label = slot.inner_text()
    slot.click(); pg.wait_for_timeout(300)
    pg.get_by_role('switch', name='Send summary').click()
    shot(pg, 'book_pick')
    pg.get_by_role('button', name='Book this time').click(); pg.wait_for_timeout(2500)
    check(pg.get_by_text('Booked:').count() >= 1, f'booking confirmed by the clinic ({slot_label})')
    check(pg.get_by_text('Your summary went with the booking.').count() == 1, 'summary sent with the booking')
    with pg.expect_download() as d:
        pg.get_by_role('button', name='Add to my calendar').click()
    ics = open(d.value.path(), encoding='utf-8').read()
    check('BEGIN:VEVENT' in ics and 'TRIGGER:-P1D' in ics, 'calendar file downloaded')
    shot(pg, 'booked')

    # 5. The clinic: appointment, self-referred case, summary.
    pg.set_viewport_size({'width': 1440, 'height': 900})
    pg.goto(BASE + '#/c/appointments'); pg.wait_for_timeout(1500)
    check(pg.get_by_text('Summary attached').count() >= 1, 'clinic appointments list shows the booking with its summary')
    shot(pg, 'clinic_appointments')
    pg.locator('.queue-row').first.click(); pg.wait_for_timeout(1200)
    check(pg.get_by_text('Self-referred', exact=False).count() >= 1, 'self-referred case opened from the appointment')
    check(pg.get_by_text('check the original report before relying on any figure').count() == 1, 'agenda warns the result was entered by the person')
    pg.get_by_role('button', name='Read summary').click(); pg.wait_for_timeout(500)
    check(pg.get_by_text('Pre-counselling summary').count() >= 1, 'clinic reads the summary')
    check(pg.get_by_text('Entered by the patient from their own report', exact=False).count() >= 1, 'summary says the result was entered by the patient')
    shot(pg, 'clinic_summary')

    # 6. The printable summary and its FHIR export.
    pg.goto(BASE + '#/s/me'); pg.wait_for_timeout(1500)
    check(pg.get_by_role('button', name='Print or save as PDF').count() == 1, 'printable summary page')
    with pg.expect_download() as d:
        pg.get_by_role('button', name='Download for the health record (FHIR)').click()
    fhir = json.load(open(d.value.path(), encoding='utf-8'))
    check(fhir['resourceType'] == 'Bundle' and fhir['type'] == 'document' and fhir['entry'][0]['resource']['resourceType'] == 'Composition', 'FHIR document bundle with a Composition first')
    pg.emulate_media(media='print'); shot(pg, 'summary_print'); pg.emulate_media(media='screen')
    pg.pdf(path=f'{OUT}/summary.pdf', format='A4')
    check(os.path.getsize(f'{OUT}/summary.pdf') > 10000, 'summary prints to A4 PDF')

    # 7. Two phones, paired through the relay.
    if relay_up():
        pg.set_viewport_size({'width': 412, 'height': 900})
        pg.goto(BASE + '#/p/me/partner'); pg.wait_for_timeout(1000)
        pg.get_by_role('button', name='Make a link for my partner').click()
        pg.locator('img[alt="QR code with the pairing link"]').wait_for(timeout=20000)
        check(pg.locator('img[alt="QR code with the pairing link"]').count() == 1, 'pairing QR code shown')
        # The link is what the share button sends; without a share sheet it is copied to the clipboard.
        pg.evaluate("() => { Object.defineProperty(navigator, 'share', { value: undefined, configurable: true }); }")
        ctx.grant_permissions(['clipboard-read', 'clipboard-write'])
        pg.get_by_role('button', name='Send the link').click(); pg.wait_for_timeout(300)
        link = pg.evaluate('() => navigator.clipboard.readText()')
        check('#/pair/' in link, 'pairing link made')

        ctx2 = b.new_context(viewport={'width': 412, 'height': 900}, locale='en-GB')
        p2 = ctx2.new_page()
        p2.on('pageerror', lambda e: errors.append('partner: ' + str(e)))
        p2.goto(BASE + '#/p/me'); p2.wait_for_timeout(2000)
        p2.goto(BASE + '#/p/me/import'); p2.wait_for_timeout(800)
        p2.get_by_role('button', name='Rashid: Aisha’s partner').click()
        p2.get_by_text('Is this what your report says?').wait_for(timeout=15000)
        p2.get_by_role('button', name='Yes, this is what my report says').click(); p2.wait_for_timeout(1200)
        p2.goto(link); p2.wait_for_timeout(1500)
        p2.get_by_role('button', name='Link my phone').click(); p2.wait_for_timeout(4000)
        pg.wait_for_timeout(4000)
        check(pg.get_by_text('Linked with Rashid', exact=False).count() == 1, 'host sees the partner linked')
        shot(pg, 'paired_host')
        pg.goto(BASE + '#/p/me/result/own'); pg.wait_for_timeout(1200)
        pg.locator('#focus-own .toggle').first.click(); pg.wait_for_timeout(1500)
        p2.goto(BASE + '#/p/me/partner'); p2.wait_for_timeout(7000)
        check(p2.get_by_text('Aisha Khalfan (sample) carries a change in GJB2').count() == 1, 'partner phone receives the shared finding live')
        shot(p2, 'paired_guest_received')
        pg.goto(BASE + '#/p/me/partner'); pg.wait_for_timeout(1000)
        pg.get_by_role('button', name='End the link and stop all sharing').click(); pg.wait_for_timeout(1500)
        p2.wait_for_timeout(7000)
        check(p2.get_by_text('Link your phone with your partner’s.').count() == 1, 'the link ends on the partner phone too')
        shot(p2, 'unpaired_guest')
        ctx2.close()
    else:
        print('skip pairing: relay not reachable at', RELAY)

    b.close()

real = [e for e in errors if 'Failed to load resource' not in e]
print(f'\n{passed[0]} checks passed', '' if not real else f'; page errors: {real}')
sys.exit(1 if real else 0)
