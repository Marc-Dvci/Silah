import type { ComponentChildren } from 'preact';
import { useState } from 'preact/hooks';
import { LangCtx, Mark, IconEyeOff, IconChat, IconLock, go, useT } from '../kit';
import type { PersonState } from '../../app/person';
import { setLang } from '../../app/person';
import { personaById } from '../../app/demo';

export function PersonShell({ s, act, base, children, showAsk = true }: {
  s: PersonState; act: (f: (st: PersonState) => Promise<void>) => Promise<void>; base: string; children: ComponentChildren; showAsk?: boolean;
}) {
  const [hidden, setHidden] = useState(false);
  const dir = s.lang === 'ar' ? 'rtl' : 'ltr';
  return (
    <LangCtx.Provider value={{ lang: s.lang, digits: s.digits, sex: personaById(s.id)?.sex }}>
      <div dir={dir} lang={s.lang} class={`phone ${s.big ? 'big' : ''}`}>
        <Top s={s} act={act} base={base} onHide={() => setHidden(true)} />
        {children}
        {showAsk && <AskFab base={base} />}
        {hidden && <Veil onShow={() => setHidden(false)} />}
      </div>
    </LangCtx.Provider>
  );
}

function Top({ s, act, base, onHide }: { s: PersonState; act: any; base: string; onHide: () => void }) {
  const t = useT();
  return (
    <header class="top">
      <button class="row" style={{ all: 'unset', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }} onClick={() => go(base)} aria-label="Silah home">
        <Mark size={30} />
        <span class="wordmark">{s.lang === 'ar' ? 'صلة' : 'Silah'}</span>
      </button>
      <span class="grow" />
      <button class="chip palm" onClick={() => go(`${base}/privacy`)}>
        <IconLock size={15} /> {t({ en: 'Private', ar: 'خاص' })}
      </button>
      <button class="chip" onClick={() => act((st: PersonState) => setLang(st, st.lang === 'ar' ? 'en' : 'ar'))} aria-label={s.lang === 'ar' ? 'EN · English' : 'ع · العربية'} lang={s.lang === 'ar' ? 'en' : 'ar'}>
        {s.lang === 'ar' ? 'EN' : 'ع'}
      </button>
      <button class="chip" onClick={onHide} aria-label={t({ en: 'Hide screen', ar: 'إخفاء الشاشة' })} title={t({ en: 'Hide screen', ar: 'إخفاء الشاشة' })}>
        <IconEyeOff size={16} />
      </button>
    </header>
  );
}

function AskFab({ base }: { base: string }) {
  const t = useT();
  return (
    <button class="fab" onClick={() => go(`${base}/ask`)}>
      <IconChat size={20} /> {t({ en: 'Ask a question', ar: 'طرح سؤال' })}
    </button>
  );
}

/** Quick hide: a neutral screen for a shared home. */
function Veil({ onShow }: { onShow: () => void }) {
  const t = useT();
  return (
    <div class="hide-veil" onClick={onShow}>
      <Mark size={56} />
      <p class="small">{t({ en: 'Tap to return', ar: 'لمسة للعودة' })}</p>
    </div>
  );
}

export function Back({ to, label }: { to: string; label?: string }) {
  const t = useT();
  return (
    <button class="back" onClick={() => go(to)} aria-label={label ?? t({ en: 'Back', ar: 'رجوع' })}>
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M19 12H5M11 6l-6 6 6 6" /></svg>
    </button>
  );
}
