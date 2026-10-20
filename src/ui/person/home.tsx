import { useState } from 'preact/hooks';
import type { PersonState } from '../../app/person';
import { currentView, respondToInvitation, coupleOf } from '../../app/person';
import { personaById } from '../../app/demo';
import { Enter, Step, go, useT, Receipt, Mark } from '../kit';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

export function Home({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const me = personaById(s.id);
  const view = currentView(s);
  const name = me ? t(me.name) : '';

  if (s.invitation?.status === 'pending') return <Invitation s={s} act={act} />;

  if (!view) {
    return (
      <main class="page">
        <Enter k="empty">
          <p class="eyebrow">{t({ en: `Hello ${me?.name.en ?? ''}`, ar: `مرحباً ${me?.name.ar ?? ''}` })}</p>
          <h1>{s.invitation?.status === 'consented'
            ? t({ en: 'Your couple check is on its way.', ar: 'فحصكما الثنائي في طريقه إليكما.' })
            : t({ en: 'Nothing to read yet.', ar: 'لا يوجد ما تقرئينه بعد.', arM: 'لا يوجد ما تقرؤه بعد.' })}</h1>
          <p class="muted">{s.invitation?.status === 'consented'
            ? t({ en: 'It starts once both of you have agreed. The result arrives here, signed by the lab, and stays on this phone.', ar: 'يبدأ الفحص بعد موافقتكما كليكما. تصل النتيجة إلى هنا موقّعة من المختبر، وتبقى على هذا الهاتف.' })
            : t({ en: 'When a result or an invitation arrives, it appears here.', ar: 'عندما تصل نتيجة أو دعوة، ستظهر هنا.' })}</p>
          <div style={{ opacity: .35, display: 'flex', justifyContent: 'center', paddingTop: '40px' }}><Mark size={120} /></div>
        </Enter>
      </main>
    );
  }

  const atRisk = view.status === 'at-risk';
  const couple = coupleOf(s.id);
  const has = (st: string) => s.pathway.some(p => p.state === st);
  const showBirth = view.birthPlanConditions.length > 0;
  const steps: { key: string; done: boolean; title: string; sub: string; to: string }[] = [
    {
      key: 'result', done: has('notified'),
      title: t({ en: 'Your result, together', ar: 'نتيجتكما معاً' }),
      sub: atRisk
        ? t({ en: `You and ${partnerName(s)} carry a change in the same gene.`, ar: `أنتِ و${partnerName(s, 'ar')} تحملان تغيّراً في الجين نفسه.`, arM: `أنت و${partnerName(s, 'ar')} تحملان تغيّراً في الجين نفسه.` })
        : t({ en: 'No shared gene was found. Small chances remain.', ar: 'لم يُعثر على جين مشترك، وتبقى احتمالات صغيرة.' }),
      to: 'result',
    },
    {
      key: 'check', done: !!s.teachback && s.teachback.correct === s.teachback.total,
      title: t({ en: 'Make sure it is clear', ar: 'تأكدي من وضوح الصورة', arM: 'تأكد من وضوح الصورة' }),
      sub: s.teachback
        ? t({ en: `You explained back ${s.teachback.correct} of ${s.teachback.total} points.`, ar: `أجبتِ إجابة صحيحة عن ${s.teachback.correct} من ${s.teachback.total} أسئلة.`, arM: `أجبت إجابة صحيحة عن ${s.teachback.correct} من ${s.teachback.total} أسئلة.` })
        : t({ en: 'Four short questions to check the picture is clear.', ar: 'أربعة أسئلة قصيرة للتأكد من وضوح الصورة.' }),
      to: 'check',
    },
    ...(atRisk ? [{
      key: 'options', done: has('counselling-booked'),
      title: t({ en: 'Your options', ar: 'خياراتكما' }),
      sub: t({ en: 'What the programme offers. The choice stays yours.', ar: 'ما يقدّمه البرنامج، والقرار يبقى لكما.' }),
      to: 'options',
    }] : []),
    ...(showBirth ? [{
      key: 'birth', done: !!s.birthPlan?.active,
      title: t({ en: 'A plan for birth', ar: 'خطة للولادة' }),
      sub: couple?.pregnancyDue
        ? t({ en: 'Whatever you decided, a test in the first days can matter.', ar: 'مهما كان قراركما، قد يُحدث فحص في الأيام الأولى فرقاً.' })
        : t({ en: 'For a future pregnancy: what can be done at birth.', ar: 'لحمل قادم: ما يمكن فعله عند الولادة.' }),
      to: 'birth',
    }] : []),
    {
      key: 'family', done: s.invites.tokens.length > 0,
      title: t({ en: 'Your family', ar: 'عائلتك' }),
      sub: t({ en: 'Invite relatives to test, without saying it came from you.', ar: 'ادعي أقاربك للفحص دون أن تذكري أن الدعوة منك.', arM: 'ادعُ أقاربك للفحص دون أن تذكر أن الدعوة منك.' }),
      to: 'family',
    },
    {
      key: 'counsellor', done: s.booking?.status === 'confirmed' || has('counselled'),
      title: t({ en: 'Your counsellor', ar: 'مستشارك الوراثي' }),
      sub: s.booking?.slot
        ? t({ en: `Booked: ${fmtSlot(s.booking.slot, 'en')}`, ar: `موعدك: ${fmtSlot(s.booking.slot, 'ar')}` })
        : t({ en: 'A person who already knows your result.', ar: 'شخص يعرف نتيجتك مسبقاً.' }),
      to: 'counsellor',
    },
  ];
  const firstOpen = steps.findIndex(x => !x.done);

  return (
    <main class="page">
      <Enter k="home">
        <div>
          <p class="eyebrow">{t({ en: `Hello ${name}`, ar: `مرحباً ${name}` })}</p>
          <h1 style={{ marginTop: '6px' }}>{t({ en: 'Take it at your own pace.', ar: 'خذي وقتك.', arM: 'خذ وقتك.' })}</h1>
          <p class="muted" style={{ marginTop: '8px' }}>{t({ en: 'Everything here stays on this phone. Nothing is shared unless you choose to share it.', ar: 'كل ما هنا يبقى على هذا الهاتف، ولا يُشارَك شيء إلا إذا اخترتِ ذلك.', arM: 'كل ما هنا يبقى على هذا الهاتف، ولا يُشارَك شيء إلا إذا اخترت ذلك.' })}</p>
        </div>
        <div class="thread">
          {steps.map((x, i) => (
            <Step key={x.key} state={x.done ? 'done' : i === firstOpen ? 'now' : 'next'} title={x.title} sub={x.sub} onClick={() => go(`${base}/${x.to}`)} />
          ))}
        </div>
      </Enter>
    </main>
  );
}

export function partnerName(s: PersonState, lang: 'en' | 'ar' = 'en'): string {
  const c = coupleOf(s.id);
  const pid = c ? (c.a === s.id ? c.b : c.a) : undefined;
  return pid ? personaById(pid)!.name[lang] : '';
}

export function fmtSlot(iso: string, lang: 'en' | 'ar'): string {
  return new Date(iso).toLocaleString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
}

function Invitation({ s, act }: { s: PersonState; act: Act }) {
  const t = useT();
  const [busy, setBusy] = useState(false);
  const inv = s.invitation!;
  const partner = partnerName(s, s.lang);
  return (
    <main class="page">
      <Enter k="invite">
        <p class="eyebrow">{t({ en: 'An invitation from the Department of Health', ar: 'دعوة من دائرة الصحة' })}</p>
        <h1>{t({ en: `A couple check for you and ${partner}, before your next pregnancy.`, ar: `فحص ثنائي لكِ ول${partner} قبل حملكما القادم.`, arM: `فحص ثنائي لك ول${partner} قبل حملكما القادم.` })}</h1>
        <p class="muted">{t({
          en: 'You married before genetic testing became part of premarital screening. Your genomes were already read by the Emirati Genome Programme, so there is no new blood test: only a check of the genes that matter for children.',
          ar: 'تزوجتما قبل أن يصبح الفحص الجيني جزءاً من فحص ما قبل الزواج. وقد سبق أن حلّل برنامج الجينوم الإماراتي جينومَيكما، فلا حاجة إلى فحص دم جديد، بل يقتصر الأمر على فحص الجينات المهمة لصحة الأطفال.',
        })}</p>
        <div class="pool stack">
          <h3>{t({ en: 'What happens if you agree', ar: 'ماذا يحدث إذا وافقتِ', arM: 'ماذا يحدث إذا وافقت' })}</h3>
          {[
            { en: 'Both of you have to agree. If one says no, nothing is checked.', ar: 'يجب أن يوافق كلاكما، وإذا رفض أحدكما فلن يُفحص شيء.' },
            { en: 'Only the 563 genes of the premarital panel are looked at, for this couple only.', ar: 'تُفحص الجينات الـ563 في لوحة ما قبل الزواج فقط، ولكما وحدكما.' },
            { en: 'You each see your own result. Your partner sees only the genes you both carry.', ar: 'يرى كل منكما نتيجته، ولا يرى شريكك إلا الجينات التي تحملانها كلاكما.', arM: 'يرى كل منكما نتيجته، ولا ترى شريكتك إلا الجينات التي تحملانها كلاكما.' },
            { en: 'A genetic counsellor sees the result only if you both carry a change in the same gene.', ar: 'لا يرى المستشار الوراثي النتيجة إلا إذا كنتما تحملان تغيّراً في الجين نفسه.' },
          ].map((x, i) => <p key={i} class="row" style={{ alignItems: 'flex-start' }}><span class="dot" style={{ color: 'var(--saffron)', marginTop: '10px' }} /><span>{t(x)}</span></p>)}
        </div>
        <p class="muted small">{t({ en: 'Saying no changes nothing in your care. You can also say yes later.', ar: 'الرفض لا يغيّر شيئاً في رعايتك، ويمكنك الموافقة لاحقاً أيضاً.' })}</p>
        <div class="stack" style={{ '--gap': '10px' } as any}>
          <button class="btn primary full" disabled={busy} onClick={async () => { setBusy(true); await act(st => respondToInvitation(st, true)); }}>
            {t({ en: 'I agree to the couple check', ar: 'أوافق على الفحص الثنائي' })}
          </button>
          <button class="btn calm full" disabled={busy} onClick={() => act(st => respondToInvitation(st, false))}>
            {t({ en: 'Not now', ar: 'ليس الآن' })}
          </button>
        </div>
        <Receipt>
          {t({ en: 'Agreeing creates a signed consent on this phone. You can withdraw it from “What you shared”.', ar: 'الموافقة تُنشئ إقراراً موقّعاً على هذا الهاتف، ويمكنك سحبه من صفحة «ما شاركتِه».', arM: 'الموافقة تُنشئ إقراراً موقّعاً على هذا الهاتف، ويمكنك سحبه من صفحة «ما شاركته».' })}
        </Receipt>
        <p class="tiny muted">{t({ en: `Invitation received ${new Date(inv.at).toLocaleDateString('en-GB')}. Invited because you told us you are related and planning a pregnancy; no genetic data was used to choose you.`, ar: `استُلمت الدعوة في ${new Date(inv.at).toLocaleDateString('en-GB')}. وُجّهت إليكما لأنكما ذكرتما أنكما قريبان وتخططان للإنجاب، ولم تُستخدم أي بيانات جينية في اختياركما.` })}</p>
      </Enter>
    </main>
  );
}
