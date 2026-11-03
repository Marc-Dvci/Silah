import { useEffect, useState } from 'preact/hooks';
import QRCode from 'qrcode';
import type { PersonState } from '../../app/person';
import { currentView, endPairing, joinPairing, nameOf, startPairing, syncPairing, partnerOf, savePerson } from '../../app/person';
import { pairToken } from '../../core/crypto/pairing';
import { usePerson } from '../hooks';
import { Enter, IconCheck, IconShare, Mark, Receipt, go, useT, LangCtx } from '../kit';
import { Back } from './shell';
import { fmtWhen } from './book';
import { siteById } from '../../core/booking';

type Act = (f: (st: PersonState) => Promise<void>) => Promise<void>;

// Pairing with the partner's phone: a link (or QR code) carries the room and the key; the relay carries only
// encrypted messages. The DoH standard's own disclosure form (Appendix 9a/9b) asks each person whether to inform
// the other party; this is the digital version of that choice, revocable at any time.

export const pairLink = (s: PersonState) => s.pairing ? `${location.origin}${location.pathname}#/pair/${pairToken(s.pairing)}` : '';

export function Partner({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const p = s.pairing && !s.pairing.ended ? s.pairing : undefined;
  const [qr, setQr] = useState('');
  const [copied, setCopied] = useState(false);
  const link = pairLink(s);
  useEffect(() => { if (link && !p?.partner) QRCode.toDataURL(link, { margin: 1, width: 220, color: { dark: '#1B1F33', light: '#F8F9FD' } }).then(setQr); }, [link, p?.partner]);
  useEffect(() => {
    if (!p) return;
    const i = setInterval(() => act(async st => { if (await syncPairing(st, true)) await savePerson(st); }), 3000);
    return () => clearInterval(i);
  }, [p?.room]);

  // The demo family's partners share in the same browser; this page is for real phones.
  if (partnerOf(s.id)) {
    return (
      <main class="page"><Enter k="partner-demo">
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Your partner', ar: 'شريكك' })}</span></div>
        <p class="muted">{t({ en: 'In the demo family, both phones are in this browser, so sharing reaches the partner directly. To pair two real phones, use “Use my own result”.', ar: 'في عائلة العرض، الهاتفان في هذا المتصفح، فتصل المشاركة إلى الشريك مباشرة. ولربط هاتفين حقيقيين يُرجى اختيار «استخدام نتيجتي».' })}</p>
      </Enter></main>
    );
  }

  const share = async () => {
    try {
      if (navigator.share) await navigator.share({ title: 'Silah', text: s.lang === 'ar' ? 'افتح هذا الرابط لربط هاتفينا في تطبيق صلة' : 'Open this link to pair our phones in Silah', url: link });
      else { await navigator.clipboard.writeText(link); setCopied(true); }
    } catch { /* the person closed the share sheet */ }
  };

  return (
    <main class="page">
      <Enter k={p ? (p.partner ? 'paired' : 'pairing') : 'pair'}>
        <div class="row"><Back to={base} /><span class="eyebrow">{t({ en: 'Your partner', ar: 'شريكك' })}</span></div>
        {!p ? (
          <>
            <h1>{t({ en: 'Link your phone with your partner’s.', ar: 'اربطي هاتفكِ بهاتف شريككِ.', arM: 'اربط هاتفك بهاتف شريكتك.' })}</h1>
            <p class="muted">{t({ en: 'Then you can each choose to share a finding, see it arrive on the other phone at once, and stop sharing at any time. The DoH form asks each partner whether to inform the other; this is that choice, one finding at a time.', ar: 'بعد ذلك يستطيع كل منكما أن يختار مشاركة نتيجة، فتصل إلى الهاتف الآخر فوراً، ويمكن إيقاف المشاركة في أي وقت. يسأل نموذج دائرة الصحة كل طرف عمّا إذا كان يريد إعلام الطرف الآخر، وهذا هو الاختيار نفسه، نتيجةً بنتيجة.' })}</p>
            <div class="pool soft stack" style={{ '--gap': '8px' } as any}>
              {[
                { en: 'Nothing is shared by linking. You choose each item.', ar: 'الربط وحده لا يشارك شيئاً، وأنتِ تختارين كل عنصر.', arM: 'الربط وحده لا يشارك شيئاً، وأنت تختار كل عنصر.' },
                { en: 'Messages are encrypted on this phone. The key is in the link, never on the server.', ar: 'تُشفَّر الرسائل على هذا الهاتف، والمفتاح في الرابط لا على الخادم.' },
                { en: 'Ending the link deletes the messages on the relay and stops all sharing.', ar: 'إنهاء الربط يحذف الرسائل من خادم الربط ويوقف كل مشاركة.' },
              ].map((x, i) => <p key={i} class="small row" style={{ alignItems: 'flex-start' }}><span class="dot" style={{ color: 'var(--palm)', marginTop: '9px' }} /><span>{t(x)}</span></p>)}
            </div>
            <button class="btn primary full" onClick={() => act(async st => { await startPairing(st); })}>{t({ en: 'Make a link for my partner', ar: 'إنشاء رابط لشريكي', arM: 'إنشاء رابط لشريكتي' })}</button>
          </>
        ) : !p.partner ? (
          <>
            <h1>{t({ en: 'Show this to your partner.', ar: 'اعرضي هذا على شريككِ.', arM: 'اعرض هذا على شريكتك.' })}</h1>
            <p class="muted">{t({ en: 'They scan it with their phone camera, or open the link you send. Silah opens on their phone and the two phones are linked.', ar: 'يمسحه الطرف الآخر بكاميرا هاتفه، أو يفتح الرابط الذي ترسلينه، فيُفتح تطبيق صلة على هاتفه ويرتبط الهاتفان.', arM: 'يمسحه الطرف الآخر بكاميرا هاتفه، أو يفتح الرابط الذي ترسله، فيُفتح تطبيق صلة على هاتفه ويرتبط الهاتفان.' })}</p>
            {qr && <img src={qr} width={220} height={220} alt={t({ en: 'QR code with the pairing link', ar: 'رمز QR يحمل رابط الربط' })} style={{ display: 'block', margin: '0 auto', borderRadius: '12px' }} />}
            <button class="btn calm full" onClick={share}>{copied ? <IconCheck size={18} /> : <IconShare size={18} />} {copied ? t({ en: 'Link copied', ar: 'نُسخ الرابط' }) : t({ en: 'Send the link', ar: 'إرسال الرابط' })}</button>
            <p class="tiny muted">{t({ en: 'Waiting for your partner… To try it on one computer, open the link in a private window.', ar: 'بانتظار الطرف الآخر… لتجربة ذلك على حاسوب واحد، افتحي الرابط في نافذة خاصة.', arM: 'بانتظار الطرف الآخر… لتجربة ذلك على حاسوب واحد، افتح الرابط في نافذة خاصة.' })}</p>
            {p.lastError && <p class="tiny muted">{t({ en: 'The relay cannot be reached just now; messages wait on this phone and go when it can.', ar: 'تعذّر الوصول إلى خادم الربط الآن، وتنتظر الرسائل على هذا الهاتف حتى يمكن إرسالها.' })}</p>}
            <button class="link" onClick={() => act(st => endPairing(st))}>{t({ en: 'Cancel', ar: 'إلغاء' })}</button>
          </>
        ) : (
          <Linked s={s} act={act} base={base} />
        )}
      </Enter>
    </main>
  );
}

function Linked({ s, act, base }: { s: PersonState; act: Act; base: string }) {
  const t = useT();
  const p = s.pairing!;
  const got = s.received.filter(r => r.from.startsWith('pair:'));
  const view = currentView(s);
  const pb = s.partnerBooking;
  return (
    <>
      <h1>{t({ en: `Linked with ${p.partner!.name || 'your partner'}.`, ar: `هاتفك مرتبط بهاتف ${p.partner!.name || 'الطرف الآخر'}.` })}</h1>
      <p class="row small" style={{ color: 'var(--palm)', gap: '6px' }}><span class="dot" /> {p.lastError ? t({ en: 'Offline: changes will go when the connection returns.', ar: 'غير متصل: ستُرسل التغييرات عند عودة الاتصال.' }) : t({ en: 'Live. What either of you shares appears on the other phone within seconds.', ar: 'متصل. ما يشاركه أي منكما يظهر على الهاتف الآخر خلال ثوانٍ.' })}</p>

      <section class="stack" style={{ '--gap': '8px' } as any}>
        <h3>{t({ en: 'What your partner shared with you', ar: 'ما شاركه الطرف الآخر معك' })}</h3>
        {got.length === 0 && <p class="small muted">{t({ en: 'Nothing yet.', ar: 'لا شيء بعد.' })}</p>}
        {got.map(r => (
          <div key={`${r.from}-${r.seq}`} class={`pool ${r.revoked ? 'soft' : 'saffron'}`}>
            <p class="small">{r.revoked
              ? t({ en: `${r.fromName || 'Your partner'} stopped sharing ${r.gene}.`, ar: `أوقف ${r.fromName || 'الطرف الآخر'} مشاركة ${r.gene}.` })
              : t({ en: `${r.fromName || 'Your partner'} carries a change in ${r.gene}.`, ar: `${r.fromName || 'الطرف الآخر'} يحمل تغيّراً في الجين ${r.gene}.` })}</p>
            {!r.revoked && view && !view.shared.some(x => x.gene === r.gene) && <p class="tiny muted">{t({ en: 'You do not carry a change in this gene on your result, so it is not a shared gene. Your counsellor can say what it means for you.', ar: 'لا تُظهر نتيجتك تغيّراً لديك في هذا الجين، لذلك ليس جيناً مشتركاً. ويستطيع المستشار أن يوضّح ما يعنيه ذلك.' })}</p>}
          </div>
        ))}
        {pb && <p class="small">{t({ en: `Appointment shared by your partner: ${fmtWhen(pb.slot, 'en')}${pb.siteId ? `, ${siteById(pb.siteId)?.name.en}` : ''}.`, ar: `موعد شاركه الطرف الآخر: ${fmtWhen(pb.slot, 'ar')}${pb.siteId ? `، ${siteById(pb.siteId)?.name.ar}` : ''}.` })}</p>}
      </section>

      <p class="small">{t({ en: 'To share one of your own findings, open your result and turn on its switch.', ar: 'لمشاركة إحدى نتائجكِ، افتحي نتيجتكِ وفعّلي المفتاح الخاص بها.', arM: 'لمشاركة إحدى نتائجك، افتح نتيجتك وفعّل المفتاح الخاص بها.' })} <button class="link" onClick={() => go(`${base}/result/own`)}>{t({ en: 'My findings', ar: 'نتائجي' })}</button></p>
      <Receipt>{t({ en: `Linked since ${new Date(p.since).toLocaleDateString('en-GB')}. End-to-end encrypted; the relay holds only ciphertext and deletes it after 30 days.`, ar: `مرتبط منذ ${new Date(p.since).toLocaleDateString('en-GB')}. التشفير من طرف إلى طرف، ولا يحفظ خادم الربط إلا نصاً مشفّراً يحذفه بعد 30 يوماً.` })}</Receipt>
      <button class="btn calm full" onClick={() => act(st => endPairing(st))}>{t({ en: 'End the link and stop all sharing', ar: 'إنهاء الربط وإيقاف كل مشاركة' })}</button>
    </>
  );
}

/** Opened from the partner's link: confirm, then join on this phone's own-result profile. */
export function JoinPair({ token }: { token: string }) {
  const { s, act } = usePerson('me');
  const [done, setDone] = useState<boolean | null>(null);
  if (!s) return <div class="phone" style={{ alignItems: 'center', justifyContent: 'center' }}><Mark size={64} /></div>;
  const lang = s.lang;
  const t = (x: { en: string; ar: string }) => x[lang];
  return (
    <LangCtx.Provider value={{ lang, digits: s.digits, sex: s.profile?.sex }}>
      <div dir={lang === 'ar' ? 'rtl' : 'ltr'} lang={lang} class="phone">
        <main class="page"><Enter k="join">
          <div class="row"><Mark size={30} /><span class="wordmark">{lang === 'ar' ? 'صلة' : 'Silah'}</span></div>
          <h1>{t({ en: 'Your partner wants to link phones.', ar: 'يريد الطرف الآخر ربط هاتفيكما.' })}</h1>
          <p class="muted">{t({ en: 'Linking shares nothing by itself. Each of you chooses what to share, one finding at a time, and can stop at any time.', ar: 'الربط وحده لا يشارك شيئاً. يختار كل منكما ما يشاركه، نتيجةً بنتيجة، ويمكنه التوقف في أي وقت.' })}</p>
          {done === false && <div class="pool saffron"><p class="small">{t({ en: 'This link is not valid. Ask your partner for a new one.', ar: 'هذا الرابط غير صالح، ويُرجى طلب رابط جديد من الطرف الآخر.' })}</p></div>}
          <button class="btn primary full" onClick={async () => {
            let ok = false;
            await act(async st => { ok = await joinPairing(st, token); });
            setDone(ok);
            if (ok) go(currentView(s) ? 'p/me/partner' : 'p/me/import');
          }}>{t({ en: 'Link my phone', ar: 'ربط هاتفي' })}</button>
          <button class="link" onClick={() => go('p/me')}>{t({ en: 'Not now', ar: 'ليس الآن' })}</button>
          <p class="tiny muted">{t({ en: `This phone: ${nameOf(s) || 'not set up yet'}. If you have not added your own result, Silah asks for it next.`, ar: `هذا الهاتف: ${nameOf(s) || 'لم يُعدّ بعد'}. وإذا لم تُضَف نتيجة بعد، فسيطلبها التطبيق في الخطوة التالية.` })}</p>
        </Enter></main>
      </div>
    </LangCtx.Provider>
  );
}
