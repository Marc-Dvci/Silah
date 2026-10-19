"""Builds the product page's assets into site/assets: self-hosted fonts, screenshots resized to WebP, the film at
1080p with English captions, the submission deck, and QR codes. Run from the repo root:
    python site/build/build_assets.py
Inputs outside the repo (screenshots, film, deck) live in the challenge folder one level up."""
import os, shutil, subprocess, sys
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))   # silah/
CHALLENGE = os.path.dirname(ROOT)
SHOTS_EN = os.path.join(CHALLENGE, 'media', 'shots')
SHOTS_AR = os.path.join(ROOT, 'site', 'build', 'shots_ar')
OUT = os.path.join(ROOT, 'site', 'assets')
SITE_URL = 'https://marc-dvci.github.io/Silah/'
DEMO_URL = SITE_URL + 'demo/'
for d in ('fonts', 'img'):
    os.makedirs(os.path.join(OUT, d), exist_ok=True)

# fonts: only the weights the page uses
FS = os.path.join(ROOT, 'node_modules', '@fontsource')
for pkg, files in {
    'ibm-plex-sans': ['ibm-plex-sans-latin-400-normal.woff2', 'ibm-plex-sans-latin-500-normal.woff2', 'ibm-plex-sans-latin-600-normal.woff2'],
    'ibm-plex-sans-arabic': ['ibm-plex-sans-arabic-arabic-400-normal.woff2', 'ibm-plex-sans-arabic-arabic-500-normal.woff2', 'ibm-plex-sans-arabic-arabic-600-normal.woff2'],
    'ibm-plex-mono': ['ibm-plex-mono-latin-400-normal.woff2', 'ibm-plex-mono-latin-500-normal.woff2'],
    'reem-kufi': ['reem-kufi-arabic-600-normal.woff2', 'reem-kufi-latin-600-normal.woff2'],
}.items():
    for f in files:
        shutil.copy(os.path.join(FS, pkg, 'files', f), os.path.join(OUT, 'fonts', f))

def webp(src, name, width, crop=None):
    im = Image.open(src).convert('RGB')
    if crop: im = im.crop(crop)
    if im.width > width: im = im.resize((width, round(im.height * width / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, 'img', name + '.webp'), 'WEBP', quality=84, method=6)
    return im.size

# English phone screens (780 px wide at 2x) and wide screens
for src, name in [('p01_mariam_invitation_still', 'en-invitation'), ('p04_mariam_result_top', 'en-result'), ('p07_ask_top', 'en-ask'),
                  ('p11_family_still', 'en-family'), ('p18c_noura_birth_phone', 'en-birth'), ('p08_counsellor_still', 'en-counsellor'),
                  ('p20_fatima_result_still', 'en-fatima'), ('p10_mariam_privacy_still', 'en-privacy')]:
    print(name, webp(os.path.join(SHOTS_EN, src + '.png'), name, 640))
for src, name, w in [('s01_stage_result', 'stage', 1800), ('c03_queue_brief', 'clinic-queue', 1600), ('c01b_outreach_sim', 'clinic-outreach', 1600)]:
    print(name, webp(os.path.join(SHOTS_EN, src + '.png'), name, w))
# Arabic phone screens
print('ar stage', webp(os.path.join(SHOTS_AR, 'stage.png'), 'ar-stage', 1800))
for n in ['invitation', 'result', 'ask', 'family', 'birth', 'counsellor', 'fatima_result', 'privacy']:
    print('ar', n, webp(os.path.join(SHOTS_AR, n + '.png'), 'ar-' + n.replace('_result', ''), 640))

# film: 1080p H.264 for the web (captions are burnt in) and a poster from the closing card
film = os.path.join(CHALLENGE, 'film', 'Silah_film_1440p.mp4')
mp4 = os.path.join(OUT, 'silah-film.mp4')
if not os.path.exists(mp4):
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', film, '-vf', 'scale=1920:-2', '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
                    '-c:a', 'aac', '-b:a', '128k', '-movflags', '+faststart', mp4], check=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-ss', '139.5', '-i', film, '-frames:v', '1', '-vf', 'scale=1600:-2', os.path.join(OUT, 'img', 'film-poster.jpg')], check=True)

# deck
shutil.copy(os.path.join(CHALLENGE, 'deck', 'Silah_deck.pdf'), os.path.join(OUT, 'silah-deck.pdf'))

# QR codes: the demo (shown on the page for a phone) and the page itself (for the deck)
node = "const Q=require('qrcode');const [u,f]=process.argv.slice(1);Q.toFile(f,u,{type:f.endsWith('.svg')?'svg':'png',margin:1,width:600,errorCorrectionLevel:'M',color:{dark:'#1B1F33',light:'#FFFFFF'}},e=>{if(e)throw e})"
for url, f in [(DEMO_URL, os.path.join(OUT, 'img', 'qr-demo.svg')), (SITE_URL, os.path.join(ROOT, 'site', 'build', 'qr-site.png'))]:
    subprocess.run(['node', '-e', node, url, f], check=True, cwd=ROOT)
print('sizes (KB):', {f: os.path.getsize(os.path.join(OUT, f)) // 1024 for f in ('silah-film.mp4', 'silah-deck.pdf')})
