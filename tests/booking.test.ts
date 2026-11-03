import { describe, it, expect } from 'vitest';
import { COUNSELLORS, SITES, parseSlotId, sitesFor, slotsFor, slotId, toIcs } from '../src/core/booking';

const NOW = new Date('2026-11-03T08:00:00Z');   // a Tuesday

describe('where to book (DoH standard, Appendix 13)', () => {
  it('suggests the counselling clinics named for incompatible results first', () => {
    const c = sitesFor({ status: 'at-risk', sharedGenes: ['SMN1'], specialistFirst: false, pregnant: false });
    expect(c.filter(x => x.recommended).map(x => x.site.id)).toEqual(['corniche-fmu', 'corniche-fertility', 'al-bateen']);
    expect(c.length).toBe(SITES.length);
  });
  it('puts clinical genetics first when a specialist should see a finding', () => {
    const c = sitesFor({ status: 'at-risk', sharedGenes: ['HBB'], specialistFirst: true, pregnant: false });
    expect(c.slice(0, 2).map(x => x.site.id)).toEqual(['skmc', 'tawam']);
  });
  it('keeps the Fetal Medicine Unit first during a pregnancy', () => {
    const c = sitesFor({ status: 'at-risk', sharedGenes: ['SMN1'], specialistFirst: false, pregnant: true });
    expect(c[0].site.id).toBe('corniche-fmu');
    expect(c[0].reason.en).toMatch(/pregnan/);
  });
  it('lists the genetic counselling hospitals for a compatible result', () => {
    const c = sitesFor({ status: 'compatible', sharedGenes: [], specialistFirst: false, pregnant: false });
    expect(c.filter(x => x.recommended).map(x => x.site.id)).toEqual(['ssmc', 'skmc', 'tawam']);
  });
});

describe('timetable', () => {
  it('offers only working days, from tomorrow, in Abu Dhabi time', () => {
    const s = slotsFor({ siteId: 'corniche-fmu', urgent: false, now: NOW, busy: 0 });
    expect(s.length).toBeGreaterThan(0);
    for (const x of s) {
      const g = new Date(new Date(x.start).getTime() + 4 * 3600e3);
      expect([0, 6]).not.toContain(g.getUTCDay());
      expect(g.getUTCHours()).toBeGreaterThanOrEqual(8);
      expect(g.getUTCHours()).toBeLessThanOrEqual(14);
      expect(new Date(x.start).getTime()).toBeGreaterThan(NOW.getTime());
    }
  });
  it('shows slots held for urgent cases only to urgent cases', () => {
    const normal = slotsFor({ siteId: 'corniche-fmu', urgent: false, now: NOW, busy: 0 });
    const urgent = slotsFor({ siteId: 'corniche-fmu', urgent: true, now: NOW, busy: 0 });
    expect(normal.some(x => x.held)).toBe(false);
    expect(urgent.filter(x => x.held).length).toBeGreaterThan(0);
    expect(urgent[0].start <= normal[0].start).toBe(true);
  });
  it('filters by format, language and the counsellor’s sex', () => {
    const s = slotsFor({ siteId: 'skmc', format: 'video', lang: 'ar', sex: 'F', urgent: false, now: NOW, busy: 0 });
    for (const x of s) {
      const c = COUNSELLORS.find(k => k.id === x.counsellorId)!;
      expect(c.formats).toContain('video');
      expect(c.langs).toContain('ar');
      expect(c.sex).toBe('F');
    }
    expect(slotsFor({ siteId: 'skmc', format: 'phone', urgent: false, now: NOW })).toEqual([]);
  });
  it('is the same for every viewer and leaves out taken slots', () => {
    const a = slotsFor({ siteId: 'al-bateen', urgent: false, now: NOW });
    const b = slotsFor({ siteId: 'al-bateen', urgent: false, now: NOW });
    expect(a).toEqual(b);
    const taken = new Set([a[0].id]);
    expect(slotsFor({ siteId: 'al-bateen', urgent: false, now: NOW, taken }).some(x => x.id === a[0].id)).toBe(false);
  });
  it('round-trips slot ids', () => {
    const start = new Date('2026-11-10T05:00:00Z');   // 09:00 in Abu Dhabi
    const id = slotId('fmu-1', start);
    expect(id).toBe('fmu-1@202611100900');
    expect(parseSlotId(id)).toMatchObject({ siteId: 'corniche-fmu', counsellorId: 'fmu-1', start: start.toISOString() });
    expect(parseSlotId('nobody@202611100900')).toBeUndefined();
    expect(parseSlotId('fmu-1;DROP')).toBeUndefined();
  });
});

describe('calendar file', () => {
  it('is RFC 5545 with escaped text and a reminder', () => {
    const ics = toIcs({ uid: 'x@silah', start: '2026-11-10T05:00:00.000Z', minutes: 45, summary: 'Genetic counselling; Corniche, FMU', location: 'A\nB', description: 'd', stamp: '2026-11-03T08:00:00.000Z' });
    expect(ics).toContain('DTSTART:20261110T050000Z');
    expect(ics).toContain('DTEND:20261110T054500Z');
    expect(ics).toContain('SUMMARY:Genetic counselling\\; Corniche\\, FMU');
    expect(ics).toContain('LOCATION:A\\nB');
    expect(ics).toContain('TRIGGER:-P1D');
    expect(ics.split('\r\n')[0]).toBe('BEGIN:VCALENDAR');
  });
});
