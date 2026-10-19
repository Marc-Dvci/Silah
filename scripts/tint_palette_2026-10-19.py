"""One-off: replace the last pure whites, black shadow and brown phone frame with tints of the brand indigo, and
turn the product page's footer into a deep indigo band. Keeps CRLF. Run from the repo root."""
import re

def edit(path, pairs, regex=()):
    with open(path, encoding='utf-8', newline='') as f: s = f.read()
    for old, new, n in pairs:
        c = s.count(old)
        assert c == n, (path, old, c)
        s = s.replace(old, new)
    for pat, new in regex:
        s = re.sub(pat, new, s)
    with open(path, 'w', encoding='utf-8', newline='') as f: f.write(s)

WHITE_RGBA = (r'rgba\(255, ?255, ?255, ?', 'rgba(248, 249, 253, ')

edit('src/ui/styles.css', [
    ('  --white: #FFFFFF;\r\n', '  --surface: #F8F9FD;   /* the lightest step of the indigo scale: never pure white */\r\n  --on-dark: #F1F3FA;   /* text on indigo */\r\n  --deep: #161A30;      /* the darkest step: never pure black */\r\n', 1),
    ('radial-gradient(circle, #fff 0%', 'radial-gradient(circle, var(--surface) 0%', 1),
    ('.story-knot.done span { color: #fff; }', '.story-knot.done span { color: var(--ink); }', 1),
    ('color: #fff', 'color: var(--on-dark)', 4),
    ('background: #fff', 'background: var(--surface)', 7),
    ('linear-gradient(#fff, #f7f8fc)', 'linear-gradient(var(--surface), var(--on-dark))', 1),
    ('rgba(0,0,0,.15)', 'rgba(27, 31, 51, .18)', 1),
    ('border-radius: 54px; background: var(--goat)', 'border-radius: 54px; background: var(--deep)', 1),
], [WHITE_RGBA])

edit('src/ui/kit.tsx', [("non: '#FFFFFF'", "non: '#F8F9FD'", 1)])

edit('site/assets/site.css', [
    ('--white: #FFFFFF;', '--surface: #F8F9FD; --on-dark: #F1F3FA; --deep: #161A30;', 1),
    ('var(--white)', 'var(--surface)', 1),
    ('radial-gradient(circle, #fff 0%', 'radial-gradient(circle, var(--surface) 0%', 1),
    ('color: #fff', 'color: var(--on-dark)', 2),
    ('background: #fff', 'background: var(--surface)', 3),
    ('border: 9px solid var(--goat); background: var(--goat)', 'border: 9px solid var(--deep); background: var(--deep)', 1),
    ('footer { padding-block: 56px 70px; font-size: 14.5px; color: var(--ink-2); }',
     'footer { position: relative; padding-block: 62px 70px; font-size: 14.5px; color: #B9BFD3; background: var(--deep); }\r\n'
     'footer::before { content: \'\'; position: absolute; inset-inline: 0; top: 0; height: 6px; opacity: .9; background: repeating-linear-gradient(90deg, var(--madder) 0 8px, transparent 8px 14px, var(--saffron) 14px 18px, transparent 18px 24px, var(--indigo-2) 24px 32px, transparent 32px 38px); }\r\n'
     'footer b { color: var(--on-dark); font-weight: 600; }', 1),
], [WHITE_RGBA])

for page in ('site/index.html', 'site/ar.html'):
    edit(page, [('<b style="color:var(--ink)">', '<b>', 1)])
print('done')
