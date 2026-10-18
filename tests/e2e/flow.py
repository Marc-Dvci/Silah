"""End-to-end demo story through the real UI, headless.

Outreach -> both partners consent -> signed bundles -> result -> teach-back -> brief shared ->
booking -> partner shares a private finding -> anonymous invitations -> relative redeems (and
cannot redeem twice) -> birth plan -> clinic sees exactly what was shared.

Usage: python tests/e2e/flow.py [base_url]   (screenshots in D:/tmp/silah_flow)
"""
import sys, os
from playwright.sync_api import sync_playwright, expect

BASE = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:5173/'
OUT = 'D:/tmp/silah_flow'
os.makedirs(OUT, exist_ok=True)
errors, n = [], [0]

def check(cond, msg):
    if not cond:
        raise AssertionError(msg)
    print('ok  ', msg)

with sync_playwright() as p:
    b = p.chromium.launch()
    ctx = b.new_context(viewport={'width': 412, 'height': 900}, device_scale_factor=2)
    pg = ctx.new_page()
    pg.on('pageerror', lambda e: errors.append(str(e)))
    pg.on('console', lambda m: errors.append(m.text) if m.type == 'error' else None)

    def shot(name, wait=700):
        pg.wait_for_timeout(wait)
        n[0] += 1
        pg.screenshot(path=f'{OUT}/{n[0]:02d}_{name}.png', full_page=True)

    def goto(h, wait=1200):
        pg.goto(BASE + h)
        pg.wait_for_timeout(wait)

    # Fresh world: a new browser context starts with empty storage, so the demo seeds itself.
    goto('#/c/outreach', 3000)
    pg.set_viewport_size({'width': 1440, 'height': 900})
    pg.get_by_role('button', name='Send invitations to the top 3').click()
    pg.wait_for_timeout(800)
    check(pg.get_by_text('Invited').count() >= 1, 'clinic sent outreach invitations')
    shot('clinic_outreach')
    pg.set_viewport_size({'width': 412, 'height': 900})

    # Mariam agrees (Arabic UI)
    goto('#/p/mariam', 2500)
    expect(pg.get_by_text('دعوة من دائرة الصحة')).to_be_visible(timeout=8000)
    shot('mariam_invitation')
    pg.get_by_role('button', name='أوافق على الفحص الثنائي').click()
    pg.wait_for_timeout(1200)
    check(pg.get_by_text('فحصكما الثنائي في الطريق').count() == 1, 'Mariam waits for her partner')

    # Saeed agrees
    goto('#/p/saeed', 2500)
    pg.get_by_role('button', name='أوافق على الفحص الثنائي').click()
    pg.wait_for_timeout(4000)

    # Mariam's result arrives, signed
    goto('#/p/mariam', 3500)
    expect(pg.get_by_text('نتيجتكما معاً').first).to_be_visible(timeout=10000)
    shot('mariam_home')
    goto('#/p/mariam/result', 2000)
    check(pg.get_by_text('تم التحقق منها على هذا الهاتف').count() == 1, 'bundle signature verified on the phone')
    check(pg.get_by_text('SMN1').count() >= 1, 'shared gene SMN1 shown')
    check(pg.get_by_text('CYP21A2').count() == 0, "Saeed's private CYP21A2 finding is not on Mariam's phone")
    check(pg.get_by_text('MEFV').count() >= 1, "Mariam sees her own MEFV finding")
    shot('mariam_result')

    # Teach-back, all correct
    goto('#/p/mariam/check', 1200)
    pg.locator('button.choice').first.click(); pg.get_by_role('button', name='التالي').click()
    pg.get_by_role('button', name='غير صحيح').click(); pg.get_by_role('button', name='التالي').click()
    pg.get_by_role('button', name='غير صحيح').click(); pg.get_by_role('button', name='التالي').click()
    pg.get_by_role('button', name='صحيح', exact=True).click(); pg.get_by_role('button', name='إنهاء').click()
    pg.wait_for_timeout(900)
    check(pg.get_by_text('الصورة واضحة لديك تماماً').count() == 1, 'teach-back 4/4')
    shot('mariam_teachback')

    # Ask: a FAQ answer and a hard route
    goto('#/p/mariam/ask', 1200)
    pg.get_by_role('textbox').fill('إذا كان طفلنا الأول سليماً، هل يكون الثاني بأمان؟')
    pg.get_by_role('button', name='اسأل').click(); pg.wait_for_timeout(1200)
    check(pg.get_by_text('الاحتمال نفسه في كل حمل').count() >= 1, 'FAQ answered from cards')
    pg.get_by_role('textbox').fill('هل يجوز فحص الأجنة؟')
    pg.get_by_role('button', name='اسأل').click(); pg.wait_for_timeout(1200)
    check(pg.get_by_text('عالم دين تثق به').count() == 1, 'religious question routed to a scholar')
    shot('mariam_ask')

    # Counsellor: share brief, book
    goto('#/p/mariam/counsellor', 1500)
    pg.get_by_role('button', name='مشاركة هذا مع مستشاري').click(); pg.wait_for_timeout(800)
    pg.get_by_role('button', name='حجز موعد استشارة').click(); pg.wait_for_timeout(4000)
    goto('#/p/mariam/counsellor', 2000)
    check(pg.get_by_text('موعدك').count() >= 1, 'appointment confirmed by the clinic')
    shot('mariam_counsellor')

    # Saeed shares his private CYP21A2 finding with Mariam
    goto('#/p/saeed/result', 2500)
    pg.get_by_role('switch').first.click(); pg.wait_for_timeout(1000)
    goto('#/p/mariam/privacy', 2500)
    check(pg.get_by_text('CYP21A2').count() >= 1, 'Mariam receives the finding Saeed chose to share')
    shot('mariam_privacy')

    # Anonymous invitations
    goto('#/p/mariam/family', 1500)
    pg.get_by_role('button', name='تجهيز 3 دعوات').click(); pg.wait_for_timeout(5000)
    goto('#/p/mariam/family', 2000)
    tokens = pg.locator('a[href^="#/r/"]')
    check(tokens.count() == 1, 'three blind-signed invitations finalised')
    href = tokens.first.get_attribute('href')
    shot('mariam_family')
    goto(href, 1500)
    pg.get_by_role('button', name='استخدام هذه الدعوة').click(); pg.wait_for_timeout(3000)
    check(pg.get_by_text('قُبلت الدعوة').count() == 1, 'relative redeems the invitation')
    shot('relative_redeemed')
    goto('#/p/mariam', 800)
    pg.reload()
    goto(href, 1500)
    pg.get_by_role('button', name='استخدام هذه الدعوة').click(); pg.wait_for_timeout(3000)
    check(pg.get_by_text('استُخدمت هذه الدعوة من قبل').count() == 1, 'second use is refused')

    # Noura's birth plan
    goto('#/p/noura/birth', 2500)
    pg.get_by_role('switch').click(); pg.wait_for_timeout(2500)
    check(pg.get_by_text('Corniche Hospital, maternity').count() >= 1, 'birth plan receipt shown')
    shot('noura_birth')

    # Clinic side
    pg.set_viewport_size({'width': 1440, 'height': 900})
    goto('#/c/queue/C-2019-0412', 2500)
    check(pg.get_by_text('Mariam & Saeed').count() >= 1, 'EGP couple appears in the counselling queue')
    check(pg.get_by_text('4/4').count() == 1, "counsellor sees Mariam's shared teach-back")
    brief = pg.locator('.pool').filter(has_text='Pre-visit brief')
    check('MEFV' not in brief.inner_text() and 'CYP21A2' not in brief.inner_text(), "the brief never shows either partner's private findings")
    shot('clinic_brief')
    goto('#/c/births', 2000)
    check(pg.get_by_text('Noura').count() >= 1, 'maternity sees the birth plan')
    shot('clinic_births')
    goto('#/c/invites', 2000)
    check(pg.get_by_text('No redemption can be linked to any issuance').count() == 1, 'issuance and redemption logs unlinkable')
    shot('clinic_invites')
    goto('#/c/pathway', 1500)
    shot('clinic_pathway')
    b.close()

bad = [e for e in errors if 'favicon' not in e]
print('console errors:', bad[:10] if bad else 'none')
