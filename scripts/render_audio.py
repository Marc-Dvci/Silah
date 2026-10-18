"""Pre-render narration for every fixed sentence with Microsoft neural voices (ar-AE-FatimaNeural,
en-GB-SoniaNeural) through edge-tts. Output: public/audio/<key>.mp3, key = sha256(lang|text)[:16].
Run from the repo root: python scripts/render_audio.py"""
import asyncio, json, os, subprocess, sys
import edge_tts

VOICE = {'ar': 'ar-AE-FatimaNeural', 'en': 'en-GB-SoniaNeural'}
OUT = 'public/audio'

async def main():
    raw = subprocess.run(['node', 'scripts/collect-texts.mjs'], capture_output=True, text=True, encoding='utf-8', check=True).stdout
    items = json.loads(raw)
    os.makedirs(OUT, exist_ok=True)
    done = 0
    for it in items:
        path = f"{OUT}/{it['key']}.mp3"
        if os.path.exists(path):
            continue
        await edge_tts.Communicate(it['text'], VOICE[it['lang']], rate='-6%').save(path)
        done += 1
    keep = {f"{it['key']}.mp3" for it in items}
    stale = [f for f in os.listdir(OUT) if f.endswith('.mp3') and f not in keep]
    for f in stale:
        os.remove(f'{OUT}/{f}')
    print(f'{len(items)} sentences, {done} rendered now, {len(stale)} stale files removed')

asyncio.run(main())
