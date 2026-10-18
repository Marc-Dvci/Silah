import { useMemo } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { revoke, setDigits, setLang, setBig, partnerOf } from '../../app/person';
import { activeGrants, verifyLedger } from '../../core/crypto/receipts';
import { fromB64url } from '../../core/crypto/sign';
import { PERSONAS, personaById } from '../../app/demo';
import { Enter, Receipt, Toggle, go, useT, IconSeal } from '../kit';
import { Back } from './shell';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

const SUBJECT: Record<string, { en: string; ar: string }> = {
  'couple-check': { en: 'Couple check on your existing genome', ar: 'فحص ثنائي على جينومك الموجود' },
  'finding': { en: 'A carrier finding', ar: 'نتيجة حمل لجين' },
  'birth-plan': { en: 'Birth plan', ar: 'خطة الولادة' },
  'teachback': { en: 'Your check answers', ar: 'إجابات التحقق' },
  'brief': { en: 'Your summary for the counsellor', ar: 'ملخصك للمستشار' },
  'invitation': { en: 'Anonymous invitations', ar: 'دعوات مجهولة المصدر' },
};

export function Privacy({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const ok = useMemo(() => verifyLedger(s.ledger, fromB64url(s.kp.pk)), [s.ledger.length]);
  const active = activeGrants(s.ledger, new Date());
  const seqOf = (at: string, kind: string) => s.ledger.find(e => e.payload.at === at && e.payload.subject.kind === kind)?.payload.seq;
  const partner = partnerOf(s.id);
  const received = s.received.filter(r => !r.revoked);
  return (
    <main class="page">
      <Enter k="privacy">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'What you shared', ar: 'ما شاركتِه', arM: 'ما شاركته' })}</span></div>
        <h1>{t({ en: 'Your genetic information stays on this phone.', ar: 'تبقى معلوماتك الجينية على هذا الهاتف.' })}</h1>
        <p class="muted">{t({ en: 'It is encrypted here, with a key this phone keeps. Below is everything you have agreed to share. Each line is a signed record you can withdraw.', ar: 'وهي مشفّرة هنا بمفتاح يحتفظ به هذا الهاتف. وفي ما يلي كل ما وافقتِ على مشاركته، وكل سطر سجلّ موقّع يمكنك سحبه.', arM: 'وهي مشفّرة هنا بمفتاح يحتفظ به هذا الهاتف. وفي ما يلي كل ما وافقت على مشاركته، وكل سطر سجلّ موقّع يمكنك سحبه.' })}</p>

        <section class="stack" style={{ '--gap': '4px' } as any}>
          {active.length === 0 && <p class="muted">{t({ en: 'Nothing is shared.', ar: 'لا شيء مُشارَك.' })}</p>}
          {active.map(g => {
            const seq = seqOf(g.at, g.subject.kind);
            return (
              <Receipt key={g.at}>
                <b>{t(SUBJECT[g.subject.kind])}{g.subject.gene ? ` · ${g.subject.gene}` : ''}</b><br />
                {recipientLabel(g.recipient, t)} · {scopeLabel(g.scope, t)}
                {g.expires && <> · {t({ en: 'ends', ar: 'ينتهي' })} {new Date(g.expires).toLocaleDateString('en-GB')}</>}
                <br /><button class="link" onClick={() => seq !== undefined && act(st => revoke(st, seq))}>{g.action === 'consent' ? t({ en: 'Withdraw', ar: 'سحب الموافقة' }) : t({ en: 'Stop sharing', ar: 'إيقاف المشاركة' })}</button>
              </Receipt>
            );
          })}
        </section>

        {received.length > 0 && (
          <section class="stack">
            <h2>{t({ en: 'Shared with you', ar: 'شوركت معك' })}</h2>
            {received.map(r => (
              <div key={r.seq} class="pool palm">
                <p><b>{personaById(partner ?? '') ? t(personaById(partner!)!.name) : r.fromName}</b> {t({ en: `chose to share: carrier of ${r.gene}.`, ar: `اختار مشاركة: حامل لتغيّر في الجين ${r.gene}.`, arM: `اختارت مشاركة: حاملة لتغيّر في الجين ${r.gene}.` })}</p>
                <p class="small muted">{t({ en: 'You tested negative for this gene. Your counsellor can explain what the small remaining chance means.', ar: 'جاءت نتيجتك سلبية لهذا الجين، ويمكن لمستشارك شرح ما يعنيه الاحتمال الصغير المتبقي.' })}</p>
              </div>
            ))}
          </section>
        )}

        <p class="row small" style={{ color: ok.ok ? 'var(--palm)' : 'var(--madder)', gap: '6px' }}>
          <IconSeal size={18} /> {ok.ok
            ? t({ en: `${s.ledger.length} signed records, chain intact.`, ar: `${s.ledger.length} سجلات موقّعة، والسلسلة سليمة.` })
            : t({ en: `Record ${ok.brokenAt} does not match. Show this to your counsellor.`, ar: `السجل ${ok.brokenAt} لا يطابق. اعرضيه على مستشارك.`, arM: `السجل ${ok.brokenAt} لا يطابق. اعرضه على مستشارك.` })}
        </p>

        <section class="stack">
          <h2>{t({ en: 'Settings', ar: 'الإعدادات' })}</h2>
          <div class="row"><span class="grow">{t({ en: 'العربية', ar: 'العربية' })}</span><Toggle on={s.lang === 'ar'} label="Arabic" onChange={v => act(st => setLang(st, v ? 'ar' : 'en'))} /></div>
          <div class="row"><span class="grow">{t({ en: 'Larger text', ar: 'نص أكبر' })}</span><Toggle on={!!s.big} label={t({ en: 'Larger text', ar: 'نص أكبر' })} onChange={v => act(st => setBig(st, v))} /></div>
          {s.lang === 'ar' && <div class="row"><span class="grow">{t({ en: 'Arabic-Indic digits', ar: 'الأرقام الهندية (١٢٣)' })}</span><Toggle on={s.digits === 'arab'} label="digits" onChange={v => act(st => setDigits(st, v ? 'arab' : 'latn'))} /></div>}
        </section>

        <section class="stack">
          <p class="eyebrow">{t({ en: 'Demonstration', ar: 'عرض توضيحي' })}</p>
          <p class="small muted">{t({ en: 'Silah is a prototype with a fictional family. Switch to another person’s phone:', ar: 'صلة نموذج أولي مع عائلة خيالية. انتقل إلى هاتف شخص آخر:' })}</p>
          <div class="row wrap">
            {PERSONAS.map(p => <button key={p.id} class={`chip ${p.id === s.id ? 'indigo' : ''}`} onClick={() => go(`p/${p.id}`)}>{t(p.name)}</button>)}
            <button class="chip" onClick={() => go('c/queue')}>{t({ en: 'Clinic (simulated)', ar: 'العيادة (محاكاة)' })}</button>
          </div>
        </section>
      </Enter>
    </main>
  );
}

function recipientLabel(r: string, t: (x: any) => string): string {
  if (r.startsWith('p:')) { const p = personaById(r.slice(2)); return p ? t(p.name) : r; }
  const map: Record<string, { en: string; ar: string }> = {
    'DoH genomics service': { en: 'DoH genomics service', ar: 'خدمة الجينوم في دائرة الصحة' },
    'Corniche Hospital maternity': { en: 'Corniche Hospital maternity', ar: 'قسم الولادة في مستشفى الكورنيش' },
    'Genetic counsellor': { en: 'Your genetic counsellor', ar: 'مستشارك الوراثي' },
  };
  return map[r] ? t(map[r]) : r;
}

/** Receipts store their scope in English; show it in the reader's language. */
function scopeLabel(scope: string, t: (x: any) => string): string {
  const fixed: Record<string, { en: string; ar: string }> = {
    'carrier findings on the premarital panel, for this couple only': { en: 'carrier findings on the premarital panel, for this couple only', ar: 'نتائج الحمل للجينات في لوحة ما قبل الزواج، لهذين الزوجين فقط' },
    'teach-back results and questions asked in Silah': { en: 'your check answers and the questions you asked in Silah', ar: 'إجابات التحقق والأسئلة التي طُرحت في صلة' },
    'blinded requests only; the clinic cannot link invitations to you': { en: 'blinded requests only; the clinic cannot link invitations to you', ar: 'طلبات معمّاة فقط، ولا تستطيع العيادة ربط الدعوات بك' },
  };
  if (fixed[scope]) return t(fixed[scope]);
  const gene = scope.match(/^([A-Z0-9, ]+?) carrier status only$/);
  if (gene) return t({ en: `${gene[1]} carrier status only`, ar: `حالة الحمل للجين ${gene[1]} فقط` });
  const plan = scope.match(/^([A-Z0-9, ]+?) only, this pregnancy$/);
  if (plan) return t({ en: `${plan[1]} only, this pregnancy`, ar: `${plan[1]} فقط، لهذا الحمل` });
  return scope;
}
