import type { Escalation } from '../../app/person';
import { IconCheck, useT } from '../kit';

/** What has actually happened to a request for a person: sent, received by the clinic, seen by a counsellor.
 *  It never says more than the clinic has confirmed. */
export function EscalationStatus({ e, lang }: { e?: Escalation; lang: 'ar' | 'en' }) {
  const t = useT();
  if (!e) return null;
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === 'ar' ? 'ar-AE-u-nu-latn' : 'en-GB', { hour: '2-digit', minute: '2-digit' });
  const line = (color: string, text: string, icon = false) => (
    <p class="small row" role="status" style={{ color, gap: '6px', alignItems: 'flex-start' }}>{icon && <IconCheck size={15} />}<span>{text}</span></p>
  );
  if (e.seen) return line('var(--palm)', t({ en: `Seen by a counsellor at ${time(e.seen)}.`, ar: `اطّلع عليه أحد المستشارين الساعة ${time(e.seen)}.` }), true);
  if (e.received) return line('var(--indigo)', t({ en: `Received by the counselling clinic at ${time(e.received)}. No counsellor has seen it yet.`, ar: `وصل إلى عيادة الاستشارة الوراثية الساعة ${time(e.received)}، ولم يطّلع عليه أي مستشار بعد.` }));
  return line('var(--ink-2)', t({ en: 'Waiting for the clinic to receive it. If you are in danger, call 999 or 998.', ar: 'بانتظار وصوله إلى العيادة. إذا كان هناك خطر، يُرجى الاتصال بالرقم 999 أو 998.' }));
}
