import { useState } from 'preact/hooks';
import { inbox, send } from '../app/net';
import { LangCtx, Mark, Enter, useT, IconCheck } from './kit';
import type { Lang } from '../core/types';

// What a relative sees when they open an anonymous invitation. They learn that someone in the
// family invited them; the clinic learns that the invitation is genuine and unused. Nobody learns who sent it.

export function RelativePage({ token }: { token: string }) {
  const [lang, setLang] = useState<Lang>('ar');
  const gene = new URLSearchParams(location.hash.split('?')[1] ?? '').get('g');
  return (
    <LangCtx.Provider value={{ lang, digits: 'latn' }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} class="phone">
        <header class="top">
          <Mark size={30} /><span class="wordmark">{lang === 'ar' ? 'صلة' : 'Silah'}</span><span class="grow" />
          <button class="chip" onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}>{lang === 'ar' ? 'EN' : 'ع'}</button>
        </header>
        <Body token={token} gene={gene} />
      </div>
    </LangCtx.Provider>
  );
}

function Body({ token, gene }: { token: string; gene: string | null }) {
  const t = useT();
  const [state, setState] = useState<'idle' | 'checking' | 'ok' | 'invalid' | 'spent'>('idle');
  const redeem = async () => {
    setState('checking');
    const me = `r:${crypto.randomUUID()}`;
    await send(me, 'clinic', 'invite.redeem', { token });
    for (let i = 0; i < 40; i++) {
      await new Promise(r => setTimeout(r, 300));
      const reply = (await inbox(me))[0];
      if (reply) { setState((reply.body as any).outcome); return; }
    }
    setState('invalid');
  };
  return (
    <main class="page">
      <Enter k={state}>
        <p class="eyebrow">{t({ en: 'An invitation from your family', ar: 'دعوة من عائلتك' })}</p>
        <h1>{t({ en: 'Someone who cares about you thought you should know.', ar: 'شخص يهتم بك رأى أن من حقك أن تعرف.' })}</h1>
        <p>{t({ en: 'A relative of yours has learned they carry a gene change that can matter for children. Relatives often carry the same change without knowing, and carriers are healthy.', ar: 'علم أحد أقاربك أنه يحمل تغيّراً جينياً قد يهم الأطفال. وكثيراً ما يحمل الأقارب التغيّر نفسه دون أن يعلموا، والحاملون أصحّاء.' })}</p>
        {gene && <p class="row"><span class="chip saffron num">{gene}</span><span class="small muted">{t({ en: 'The gene they chose to mention', ar: 'الجين الذي اختار ذكره' })}</span></p>}
        <div class="pool palm stack" style={{ '--gap': '8px' } as any}>
          <p><b>{t({ en: 'This invitation does not say who sent it.', ar: 'لا تذكر هذه الدعوة من أرسلها.' })}</b></p>
          <p class="small">{t({ en: 'The clinic can check that it is genuine. It cannot tell which relative sent it.', ar: 'تستطيع العيادة التأكد من أنها أصلية، لكنها لا تستطيع معرفة القريب الذي أرسلها.' })}</p>
        </div>
        {state === 'idle' && <button class="btn primary full" onClick={redeem}>{t({ en: 'Use this invitation', ar: 'استخدام هذه الدعوة' })}</button>}
        {state === 'checking' && <p class="muted">{t({ en: 'Checking with the clinic…', ar: 'جارٍ التحقق مع العيادة…' })}</p>}
        {state === 'ok' && (
          <div class="stack">
            <p class="chip palm"><IconCheck size={15} /> {t({ en: 'Invitation accepted', ar: 'قُبلت الدعوة' })}</p>
            <p>{t({ en: 'You can now book a carrier test at any premarital screening centre or with your family doctor. Bring this phone; the invitation is on it.', ar: 'يمكنك الآن حجز فحص الحمل الجيني في أي مركز لفحص ما قبل الزواج أو لدى طبيب الأسرة. أحضر هذا الهاتف، فالدعوة محفوظة عليه.' })}</p>
          </div>
        )}
        {state === 'spent' && <p class="chip saffron">{t({ en: 'This invitation has already been used.', ar: 'استُخدمت هذه الدعوة من قبل.' })}</p>}
        {state === 'invalid' && <p class="chip madder">{t({ en: 'This invitation could not be verified.', ar: 'تعذّر التحقق من هذه الدعوة.' })}</p>}
        <p class="tiny muted">{t({ en: 'Silah prototype. Fictional demonstration.', ar: 'نموذج أولي لتطبيق صلة، عرض خيالي.' })}</p>
      </Enter>
    </main>
  );
}
