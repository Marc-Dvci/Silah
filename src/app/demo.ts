import type { Lang, PersonResult, Relationship } from '../core/types';

// One fictional extended family, plus a few unrelated couples for the clinic queue.
// Every person, result and date here is invented for the demonstration.

export interface Persona {
  id: string;
  name: { en: string; ar: string };
  sex: 'F' | 'M';
  lang: Lang;
  age: number;
  blurb: { en: string; ar: string };
  genome: PersonResult['findings'];
}

export const PERSONAS: Persona[] = [
  {
    id: 'mariam', name: { en: 'Mariam', ar: 'مريم' }, sex: 'F', lang: 'ar', age: 31,
    blurb: { en: 'Married to her cousin Saeed since 2019. One daughter. Hoping for a second child.', ar: 'متزوجة من ابن عمها سعيد منذ 2019، ولديهما ابنة، ويأملان أن يُرزقا بطفل ثانٍ.' },
    genome: [
      { gene: 'SMN1', variant: 'SMN1 exon 7 deletion (1 copy)', classification: 'P' },
      { gene: 'MEFV', variant: 'c.2080A>G (p.Met694Val)', classification: 'P' },
    ],
  },
  {
    id: 'saeed', name: { en: 'Saeed', ar: 'سعيد' }, sex: 'M', lang: 'ar', age: 34,
    blurb: { en: 'Mariam’s husband and first cousin.', ar: 'زوج مريم وابن عمها.' },
    genome: [
      { gene: 'SMN1', variant: 'SMN1 exon 7 deletion (1 copy)', classification: 'P' },
      { gene: 'CYP21A2', variant: 'c.293-13C>G', classification: 'P' },
    ],
  },
  {
    id: 'noura', name: { en: 'Noura', ar: 'نورة' }, sex: 'F', lang: 'en', age: 26,
    blurb: { en: 'Mariam’s younger sister. Tested before her wedding in 2026; 31 weeks pregnant.', ar: 'أخت مريم الصغرى. أجرت الفحص قبل زواجها في 2026، وهي حامل في الأسبوع 31.' },
    genome: [{ gene: 'SMN1', variant: 'SMN1 exon 7 deletion (1 copy)', classification: 'P' }],
  },
  {
    id: 'khalid', name: { en: 'Khalid', ar: 'خالد' }, sex: 'M', lang: 'en', age: 29,
    blurb: { en: 'Noura’s husband and first cousin.', ar: 'زوج نورة وابن عمها.' },
    genome: [
      { gene: 'SMN1', variant: 'SMN1 exon 7 deletion (1 copy)', classification: 'P' },
      { gene: 'HBB', variant: 'c.92+5G>C (IVS1-5)', classification: 'P', tag: 'b+' },
    ],
  },
  {
    id: 'fatima', name: { en: 'Fatima', ar: 'فاطمة' }, sex: 'F', lang: 'ar', age: 24,
    blurb: { en: 'Engaged to her cousin Ahmed. Their 2026 premarital result says “compatible”.', ar: 'مخطوبة لابن عمها أحمد، وجاءت نتيجة فحصهما قبل الزواج في 2026 «متوافق».' },
    genome: [{ gene: 'CYP21A2', variant: 'c.293-13C>G', classification: 'P' }],
  },
  {
    id: 'ahmed', name: { en: 'Ahmed', ar: 'أحمد' }, sex: 'M', lang: 'en', age: 27,
    blurb: { en: 'Fatima’s fiancé and first cousin.', ar: 'خطيب فاطمة وابن عمها.' },
    genome: [{ gene: 'GJB2', variant: 'c.35delG', classification: 'P' }],
  },
];

export const personaById = (id: string) => PERSONAS.find(p => p.id === id);

export interface DemoCouple {
  id: string;
  a: string;
  b: string;
  rel: Relationship;
  marriedYear: number;
  source: 'egp-recheck' | 'premarital';
  pregnancyDue?: string;     // ISO date
  planningPregnancy?: boolean;
  children: number;
}

const inDays = (d: number) => new Date(Date.now() + d * 864e5).toISOString().slice(0, 10);

export function demoCouples(): DemoCouple[] {
  return [
    { id: 'C-2019-0412', a: 'mariam', b: 'saeed', rel: 'first-cousins', marriedYear: 2019, source: 'egp-recheck', planningPregnancy: true, children: 1 },
    { id: 'C-2026-0388', a: 'noura', b: 'khalid', rel: 'first-cousins', marriedYear: 2026, source: 'premarital', pregnancyDue: inDays(63), children: 0 },
    { id: 'C-2026-0379', a: 'fatima', b: 'ahmed', rel: 'first-cousins', marriedYear: 2026, source: 'premarital', children: 0 },
  ];
}

/** Background cases so the counsellor's queue looks like a working day. Names are invented. */
export const BACKGROUND_CASES: { names: [string, string]; status: 'at-risk' | 'compatible'; gene?: string; state: string; waitingDays: number; flags: string[] }[] = [
  { names: ['Hessa', 'Obaid'], status: 'at-risk', gene: 'HBB', state: 'counselling-booked', waitingDays: 6, flags: ['wedding-date'] },
  { names: ['Shamma', 'Majid'], status: 'at-risk', gene: 'CYP21A2', state: 'understood', waitingDays: 3, flags: [] },
  { names: ['Alia', 'Humaid'], status: 'at-risk', gene: 'DNAH5', state: 'notified', waitingDays: 9, flags: ['vus'] },
  { names: ['Maitha', 'Sultan'], status: 'at-risk', gene: 'ABCA4', state: 'counselled', waitingDays: 21, flags: [] },
  { names: ['Reem', 'Hamad'], status: 'at-risk', gene: 'GAA', state: 'referred', waitingDays: 34, flags: ['pregnancy'] },
  { names: ['Moza', 'Rashed'], status: 'at-risk', gene: 'HBB', state: 'closed', waitingDays: 60, flags: [] },
  { names: ['Amna', 'Faisal'], status: 'at-risk', gene: 'MEFV', state: 'result-issued', waitingDays: 1, flags: [] },
  { names: ['Latifa', 'Yousef'], status: 'at-risk', gene: 'CYP21A2', state: 'counselling-booked', waitingDays: 4, flags: ['distress'] },
  { names: ['Mahra', 'Saif'], status: 'at-risk', gene: 'SMN1', state: 'referred', waitingDays: 40, flags: [] },
  { names: ['Asma', 'Nasser'], status: 'at-risk', gene: 'HBB', state: 'counselled', waitingDays: 15, flags: [] },
];

/** Married-before-the-mandate couples in the outreach register, ranked by non-genetic signals only. */
export const OUTREACH_REGISTER: { id: string; label: string; declaredRelated: boolean; affectedRelative: boolean; planning: boolean; demo?: boolean }[] = [
  { id: 'C-2019-0412', label: 'Mariam & Saeed', declaredRelated: true, affectedRelative: false, planning: true, demo: true },
  { id: 'C-2017-0233', label: 'Couple 0233', declaredRelated: true, affectedRelative: true, planning: false },
  { id: 'C-2021-0517', label: 'Couple 0517', declaredRelated: true, affectedRelative: false, planning: true },
  { id: 'C-2018-0098', label: 'Couple 0098', declaredRelated: false, affectedRelative: true, planning: true },
  { id: 'C-2020-0311', label: 'Couple 0311', declaredRelated: true, affectedRelative: false, planning: false },
  { id: 'C-2016-0144', label: 'Couple 0144', declaredRelated: false, affectedRelative: false, planning: true },
  { id: 'C-2022-0620', label: 'Couple 0620', declaredRelated: false, affectedRelative: false, planning: false },
];
