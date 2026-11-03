import type { L10n, Lang } from './types';

// Direct booking of genetic counselling. The places come from the DoH Premarital Screening Standard V3,
// Appendix 13 ("Genetic counselling institutions in Emirate of Abu Dhabi"); which ones Silah suggests first
// follows that appendix's referral instructions. Counsellors and their timetables are fictional: in a
// deployment the timetable would come from the hospitals' booking systems.

export type Format = 'in-person' | 'video' | 'phone';
export type SiteId = 'corniche-fmu' | 'corniche-fertility' | 'al-bateen' | 'skmc' | 'tawam' | 'ssmc';

export interface Site { id: SiteId; name: L10n; kind: 'counselling' | 'clinical-genetics' }

export const SITES: Site[] = [
  { id: 'corniche-fmu', kind: 'counselling', name: { en: 'Corniche Hospital, genetic counselling clinic (Fetal Medicine Unit)', ar: 'مستشفى الكورنيش، عيادة الاستشارة الوراثية (وحدة طب الأجنة)' } },
  { id: 'corniche-fertility', kind: 'counselling', name: { en: 'Corniche Fertility Centre, genetic counselling', ar: 'مركز الكورنيش للخصوبة، الاستشارة الوراثية' } },
  { id: 'al-bateen', kind: 'counselling', name: { en: 'Ambulatory Healthcare Services, Al Bateen, genetic counselling', ar: 'الخدمات العلاجية الخارجية في البطين، الاستشارة الوراثية' } },
  { id: 'skmc', kind: 'clinical-genetics', name: { en: 'Sheikh Khalifa Medical City, clinical genetics', ar: 'مدينة الشيخ خليفة الطبية، الوراثة السريرية' } },
  { id: 'tawam', kind: 'clinical-genetics', name: { en: 'Tawam Hospital, clinical genetics', ar: 'مستشفى توام، الوراثة السريرية' } },
  { id: 'ssmc', kind: 'counselling', name: { en: 'Sheikh Shakhbout Medical City, genetic counselling', ar: 'مدينة الشيخ شخبوط الطبية، الاستشارة الوراثية' } },
];
export const siteById = (id: string) => SITES.find(s => s.id === id);

export interface Counsellor { id: string; siteId: SiteId; sex: 'F' | 'M'; langs: Lang[]; formats: Format[]; role: 'counsellor' | 'geneticist' }

/** Fictional staff: what a timetable needs (sex, languages, formats), never a name. */
export const COUNSELLORS: Counsellor[] = [
  { id: 'fmu-1', siteId: 'corniche-fmu', sex: 'F', langs: ['ar', 'en'], formats: ['in-person', 'video', 'phone'], role: 'counsellor' },
  { id: 'fmu-2', siteId: 'corniche-fmu', sex: 'F', langs: ['en'], formats: ['in-person', 'video'], role: 'counsellor' },
  { id: 'cfc-1', siteId: 'corniche-fertility', sex: 'M', langs: ['ar', 'en'], formats: ['in-person', 'video'], role: 'counsellor' },
  { id: 'cfc-2', siteId: 'corniche-fertility', sex: 'F', langs: ['ar'], formats: ['in-person', 'phone'], role: 'counsellor' },
  { id: 'abt-1', siteId: 'al-bateen', sex: 'F', langs: ['ar', 'en'], formats: ['in-person', 'video', 'phone'], role: 'counsellor' },
  { id: 'skmc-1', siteId: 'skmc', sex: 'M', langs: ['en'], formats: ['in-person'], role: 'geneticist' },
  { id: 'skmc-2', siteId: 'skmc', sex: 'F', langs: ['ar', 'en'], formats: ['in-person', 'video'], role: 'geneticist' },
  { id: 'tawam-1', siteId: 'tawam', sex: 'M', langs: ['ar', 'en'], formats: ['in-person', 'phone'], role: 'geneticist' },
  { id: 'ssmc-1', siteId: 'ssmc', sex: 'F', langs: ['ar', 'en'], formats: ['in-person', 'video', 'phone'], role: 'counsellor' },
];
export const counsellorById = (id: string) => COUNSELLORS.find(c => c.id === id);

export interface SiteChoice { site: Site; recommended: boolean; reason: L10n }

export interface RoutingContext {
  status: 'at-risk' | 'compatible';
  sharedGenes: string[];
  /** A variant of uncertain significance, a homozygous finding or another finding a specialist sees first. */
  specialistFirst: boolean;
  pregnant: boolean;
}

const R = {
  incompatible: { en: 'The DoH standard (Appendix 13) names this clinic for couples with an incompatible result.', ar: 'يذكر معيار دائرة الصحة (الملحق 13) هذه العيادة للأزواج الذين جاءت نتيجتهم غير متوافقة.' },
  pregnant: { en: 'The Fetal Medicine Unit also cares for pregnancies, so it comes first while you are pregnant.', ar: 'تتابع وحدة طب الأجنة حالات الحمل أيضاً، لذلك تأتي أولاً ما دام هناك حمل.' },
  specialist: { en: 'Appendix 13 sends findings that need a specialist to the clinical geneticists at SKMC and Tawam.', ar: 'يحيل الملحق 13 النتائج التي تحتاج إلى مختص إلى أطباء الوراثة السريرية في مدينة الشيخ خليفة الطبية ومستشفى توام.' },
  available: { en: 'Appendix 13 lists genetic counselling at this hospital.', ar: 'يذكر الملحق 13 توفر الاستشارة الوراثية في هذا المستشفى.' },
};

/** Where to book, in the order Appendix 13 suggests for this result. Every site stays available. */
export function sitesFor(ctx: RoutingContext): SiteChoice[] {
  const order: SiteId[] = [];
  const first = new Set<SiteId>();
  const reason: Partial<Record<SiteId, L10n>> = {};
  const lead = (ids: SiteId[], why: L10n) => ids.forEach(id => { if (!order.includes(id)) order.push(id); first.add(id); reason[id] ??= why; });
  if (ctx.specialistFirst) lead(['skmc', 'tawam'], R.specialist);
  if (ctx.status === 'at-risk') {
    if (ctx.pregnant) lead(['corniche-fmu'], R.pregnant);
    lead(['corniche-fmu', 'corniche-fertility', 'al-bateen'], R.incompatible);
  } else if (!ctx.specialistFirst) {
    lead(['ssmc', 'skmc', 'tawam'], R.available);
  }
  for (const s of SITES) if (!order.includes(s.id)) order.push(s.id);
  return order.map(id => ({
    site: siteById(id)!,
    recommended: first.has(id),
    reason: reason[id] ?? (siteById(id)!.kind === 'clinical-genetics' ? R.specialist : ctx.status === 'at-risk' && ['corniche-fmu', 'corniche-fertility', 'al-bateen'].includes(id) ? R.incompatible : R.available),
  }));
}

/** Haemoglobin conditions: Appendix 13 also refers carriers to the assigned hospitals when indicated. */
export const HAEMOGLOBIN_NOTE: L10n = {
  en: 'For a haemoglobin condition, the counsellor can also refer you to the hospital assigned for these conditions.',
  ar: 'في حالات الهيموغلوبين، يستطيع المستشار أيضاً إحالتكما إلى المستشفى المخصص لهذه الحالات.',
};

// ---------- timetable ----------

export interface Slot {
  id: string;               // `${counsellorId}@${YYYYMMDDHHmm}` in Abu Dhabi time
  siteId: SiteId;
  counsellorId: string;
  start: string;            // ISO, UTC
  minutes: number;
  /** Held for urgent cases (pregnancy, distress, a near wedding) until the day before. */
  held: boolean;
}

export const SLOT_MINUTES = 45;
const GST = 4;   // Abu Dhabi is UTC+4 all year
const HOURS_WEEK = [8, 9, 10, 11, 13, 14];
const HOURS_FRI = [8, 9, 10];

/** Small stable hash, so the demo's "already booked" pattern is the same for every viewer and every reload. */
function h(s: string): number {
  let x = 2166136261;
  for (let i = 0; i < s.length; i++) { x ^= s.charCodeAt(i); x = Math.imul(x, 16777619); }
  return (x >>> 0) % 100;
}

const pad = (n: number) => String(n).padStart(2, '0');

/** Abu Dhabi calendar date (y, m, d) for a moment. */
function gstDate(t: Date): { y: number; m: number; d: number; dow: number } {
  const g = new Date(t.getTime() + GST * 3600e3);
  return { y: g.getUTCFullYear(), m: g.getUTCMonth(), d: g.getUTCDate(), dow: g.getUTCDay() };
}

export function slotId(counsellorId: string, start: Date): string {
  const g = new Date(start.getTime() + GST * 3600e3);
  return `${counsellorId}@${g.getUTCFullYear()}${pad(g.getUTCMonth() + 1)}${pad(g.getUTCDate())}${pad(g.getUTCHours())}${pad(g.getUTCMinutes())}`;
}

export function parseSlotId(id: string): Slot | undefined {
  const m = id.match(/^([a-z0-9-]+)@(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})$/);
  const c = m && counsellorById(m[1]);
  if (!m || !c) return undefined;
  const start = new Date(Date.UTC(+m[2], +m[3] - 1, +m[4], +m[5] - GST, +m[6]));
  return { id, siteId: c.siteId, counsellorId: c.id, start: start.toISOString(), minutes: SLOT_MINUTES, held: false };
}

export interface SlotQuery {
  siteId: SiteId;
  format?: Format;
  lang?: Lang;
  sex?: 'F' | 'M';
  urgent: boolean;
  now?: Date;
  days?: number;
  /** Slot ids already taken by bookings the demo knows of. */
  taken?: ReadonlySet<string>;
  /** Share of the timetable already booked by other patients, 0-100. */
  busy?: number;
}

/**
 * Free slots from tomorrow, Monday to Friday (Friday mornings only). Each counsellor's first slot on each of the
 * next three working days is held for urgent cases and shown only to them.
 */
export function slotsFor(q: SlotQuery): Slot[] {
  const now = q.now ?? new Date();
  const days = q.days ?? 14;
  const busy = q.busy ?? 55;
  const staff = COUNSELLORS.filter(c => c.siteId === q.siteId
    && (!q.format || c.formats.includes(q.format))
    && (!q.lang || c.langs.includes(q.lang))
    && (!q.sex || c.sex === q.sex));
  const out: Slot[] = [];
  let working = 0;
  for (let i = 1; i <= days; i++) {
    const day = gstDate(new Date(now.getTime() + i * 864e5));
    if (day.dow === 0 || day.dow === 6) continue;     // Saturday and Sunday
    working++;
    const hours = day.dow === 5 ? HOURS_FRI : HOURS_WEEK;
    for (const c of staff) {
      hours.forEach((hr, k) => {
        const start = new Date(Date.UTC(day.y, day.m, day.d, hr - GST, 0));
        const id = slotId(c.id, start);
        if (q.taken?.has(id)) return;
        const held = k === 0 && working <= 3;
        if (held && !q.urgent) return;
        if (!held && h(id) < busy) return;
        out.push({ id, siteId: c.siteId, counsellorId: c.id, start: start.toISOString(), minutes: SLOT_MINUTES, held });
      });
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start) || a.counsellorId.localeCompare(b.counsellorId));
}

export function counsellorLabel(c: Counsellor): L10n {
  const role = c.role === 'geneticist'
    ? { en: c.sex === 'F' ? 'Clinical geneticist (woman)' : 'Clinical geneticist (man)', ar: c.sex === 'F' ? 'طبيبة وراثة سريرية' : 'طبيب وراثة سريرية' }
    : { en: c.sex === 'F' ? 'Genetic counsellor (woman)' : 'Genetic counsellor (man)', ar: c.sex === 'F' ? 'مستشارة وراثية' : 'مستشار وراثي' };
  const langs = { en: c.langs.map(l => (l === 'ar' ? 'Arabic' : 'English')).join(' and '), ar: c.langs.map(l => (l === 'ar' ? 'العربية' : 'الإنجليزية')).join(' و') };
  return { en: `${role.en}, ${langs.en}`, ar: `${role.ar}، ${langs.ar}` };
}

export const FORMAT_LABEL: Record<Format, L10n> = {
  'in-person': { en: 'In person', ar: 'حضورياً' },
  'video': { en: 'Video call', ar: 'مكالمة فيديو' },
  'phone': { en: 'Phone call', ar: 'مكالمة هاتفية' },
};

// ---------- calendar file ----------

const icsEscape = (s: string) => s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
const icsTime = (iso: string) => iso.replace(/[-:]/g, '').replace(/\.\d{3}/, '');

/** An iCalendar (RFC 5545) event with a reminder the day before. */
export function toIcs(e: { uid: string; start: string; minutes: number; summary: string; location: string; description: string; stamp?: string }): string {
  const end = new Date(new Date(e.start).getTime() + e.minutes * 60e3).toISOString();
  const lines = [
    'BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//Silah//Counselling booking//EN', 'CALSCALE:GREGORIAN', 'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${e.uid}`,
    `DTSTAMP:${icsTime(e.stamp ?? new Date().toISOString())}`,
    `DTSTART:${icsTime(e.start)}`,
    `DTEND:${icsTime(end)}`,
    `SUMMARY:${icsEscape(e.summary)}`,
    `LOCATION:${icsEscape(e.location)}`,
    `DESCRIPTION:${icsEscape(e.description)}`,
    'BEGIN:VALARM', 'ACTION:DISPLAY', 'TRIGGER:-P1D', `DESCRIPTION:${icsEscape(e.summary)}`, 'END:VALARM',
    'END:VEVENT', 'END:VCALENDAR',
  ];
  return lines.join('\r\n') + '\r\n';
}
