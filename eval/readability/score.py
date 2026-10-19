"""Readability of Silah's explanations against the text couples read today (DoH Premarital Screening Standard V3,
Appendix 5: the information sheet signed before the genetic test, Arabic 5a and English 5b).

English: Flesch-Kincaid grade, Flesch Reading Ease and SMOG, the measures US health-literacy guidance uses
(NIH and CDC: grade 8 or lower; AMA: grade 6 or lower). Arabic: OSMAN (El-Haj and Rayson, LREC 2016), the open
Arabic readability formula; higher is easier, like Flesch. Both languages: words per sentence, and how chances are
written (percentages against "1 in N" natural frequencies, which IPDAS recommends).

Silah's texts are the 33 fixed explanations per language the app shows and narrates (scripts/collect-texts.mjs).
Needs `pip install textstat==0.7.13`. Run from the repo root: python eval/readability/score.py"""
import json, os, re, subprocess, sys
import textstat

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.dirname(os.path.abspath(__file__))

raw = subprocess.run(['node', 'scripts/collect-texts.mjs'], capture_output=True, text=True, encoding='utf-8', check=True).stdout
items = json.loads(raw)
silah = {lang: [it['text'] for it in items if it['lang'] == lang] for lang in ('en', 'ar')}
doh = {lang: [l.strip() for l in open(os.path.join(HERE, f'doh_appendix5_{lang}.txt'), encoding='utf-8') if l.strip()] for lang in ('en', 'ar')}

def sentences(texts):
    out = []
    for t in texts:
        out += [s.strip() for s in re.split(r'(?<=[.!?؟])\s+', t) if len(s.split()) >= 2]
    return out

def numbers(text):
    return {'percent': len(re.findall(r'\d\s?%|٪', text)), 'one_in_n': len(re.findall(r'\b\d+ (in|من) (كل )?\d', text))}

def measure(lang, texts):
    sents = sentences(texts)
    text = ' '.join(sents)
    words = sum(len(s.split()) for s in sents)
    r = {'sentences': len(sents), 'words': words, 'words_per_sentence': round(words / len(sents), 1),
         'long_sentences_over_25_words': sum(len(s.split()) > 25 for s in sents), **numbers(' '.join(texts))}
    if lang == 'en':
        textstat.set_lang('en_US')
        r.update({'flesch_kincaid_grade': round(textstat.flesch_kincaid_grade(text), 1),
                  'flesch_reading_ease': round(textstat.flesch_reading_ease(text), 1),
                  'smog': round(textstat.smog_index(text), 1)})
        r['hardest'] = sorted(((round(textstat.flesch_kincaid_grade(s), 1), s) for s in sents), reverse=True)[:5]
    else:
        letters = [len(re.sub(r'[^ء-ي]', '', w)) for s in sents for w in s.split()]
        letters = [n for n in letters if n]
        r.update({'osman': round(textstat.osman(text), 1), 'letters_per_word': round(sum(letters) / len(letters), 2)})
        r['hardest'] = sorted(((len(s.split()), s) for s in sents), reverse=True)[:5]
    return r

result = {f'{who}_{lang}': measure(lang, src[lang]) for who, src in (('silah', silah), ('doh', doh)) for lang in ('en', 'ar')}
json.dump(result, open(os.path.join(HERE, 'results.json'), 'w', encoding='utf-8'), ensure_ascii=False, indent=1)

rows = [('Sentences', 'sentences'), ('Words per sentence', 'words_per_sentence'), ('Sentences over 25 words', 'long_sentences_over_25_words'),
        ('Chances written as %', 'percent'), ('Chances written as "1 in N"', 'one_in_n')]
print('| | Silah EN | DoH EN | Silah AR | DoH AR |\n|---|---|---|---|---|')
for label, k in rows:
    print(f"| {label} | {result['silah_en'][k]} | {result['doh_en'][k]} | {result['silah_ar'][k]} | {result['doh_ar'][k]} |")
for label, k in (('Flesch-Kincaid grade (lower is easier)', 'flesch_kincaid_grade'), ('Flesch Reading Ease (higher is easier)', 'flesch_reading_ease'), ('SMOG grade', 'smog')):
    print(f"| {label} | {result['silah_en'][k]} | {result['doh_en'][k]} | | |")
for label, k in (('OSMAN (higher is easier)', 'osman'), ('Letters per word', 'letters_per_word')):
    print(f"| {label} | | | {result['silah_ar'][k]} | {result['doh_ar'][k]} |")
print('\nHardest Silah sentences (EN by grade, AR by length):')
for g, s in result['silah_en']['hardest'] + result['silah_ar']['hardest']:
    print(f'  {g}: {s}')
