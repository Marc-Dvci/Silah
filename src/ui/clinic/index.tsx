import { useMemo, useState } from 'preact/hooks';
import { useClinic } from '../hooks';
import { PATH, PATH_OWNER, counsellorAdvance, recordNewborn, referralKpi, sendOutreach, urgency, OUTREACH_REGISTER, type Case, type ClinicState, type Referral } from '../../app/clinic';
import type { PathState } from '../../app/person';
import { conditionFor } from '../../core/conditions';
import { linkable } from '../../core/crypto/invites';
import { personaById } from '../../app/demo';
import { LangCtx, Mark, Step, go, Enter } from '../kit';
import { Population } from './population';

const NAV = [
  { k: 'queue', label: 'Counselling queue', sub: 'Sorted by urgency' },
  { k: 'outreach', label: 'Outreach', sub: 'Married before the mandate' },
  { k: 'births', label: 'Birth plans', sub: 'Delivery hospital' },
  { k: 'invites', label: 'Family invitations', sub: 'Blind-signed' },
  { k: 'pathway', label: 'Pathway & KPI', sub: 'DoH referral target' },
];

export function ClinicApp({ page, sub }: { page?: string; sub?: string }) {
  const { c, act } = useClinic();
  const p = page ?? 'queue';
  return (
    <LangCtx.Provider value={{ lang: 'en', digits: 'latn' }}>
      <div class="desk" dir="ltr">
        <nav>
          <div class="row" style={{ marginBottom: '22px' }}>
            <Mark size={30} /><span class="wordmark">صلة</span>
          </div>
          <p class="eyebrow" style={{ marginBottom: '6px' }}>Health-system side</p>
          <p class="tiny muted" style={{ marginBottom: '18px' }}>Simulated lab, counselling clinic, hospital and invitation service.</p>
          <div class="thread">
            {NAV.map(n => (
              <Step key={n.k} state={n.k === p ? 'now' : 'next'} title={n.label} sub={n.sub} onClick={() => go(`c/${n.k}`)} />
            ))}
          </div>
        </nav>
        <main>
          {!c ? <p class="muted">Loading…</p>
            : p === 'outreach' ? <Outreach c={c} act={act} />
            : p === 'births' ? <Births c={c} act={act} />
            : p === 'invites' ? <Invites c={c} />
            : p === 'pathway' ? <Pathway c={c} />
            : <Queue c={c} act={act} sel={sub} />}
        </main>
      </div>
    </LangCtx.Provider>
  );
}

type Act = (f: (st: ClinicState) => Promise<void>) => Promise<void>;

const STATE_LABEL: Record<PathState, string> = {
  'result-issued': 'Result issued', 'notified': 'Opened', 'understood': 'Understood', 'counselling-booked': 'Booked',
  'counselled': 'Counselled', 'confirmatory': 'Confirmatory', 'referred': 'Referred', 'closed': 'Closed',
};
const FLAG_LABEL: Record<string, string> = {
  'distress': 'Distress', 'asked-for-human': 'Asked for a call', 'pregnancy': 'Pregnant', 'planning': 'Planning a pregnancy',
  'wedding-date': 'Wedding date set', 'vus': 'Uncertain variant', 'birth-plan': 'Birth plan',
  'newborn-treatment': 'Newborn in treatment', 'consent-withdrawn': 'Consent withdrawn',
};
const flagTone = (f: string) => f === 'distress' ? 'madder' : f === 'birth-plan' ? 'palm' : f === 'pregnancy' || f === 'asked-for-human' ? 'saffron' : 'indigo';
const days = (iso: string) => Math.round((Date.now() - new Date(iso).getTime()) / 864e5);

function Queue({ c, act, sel }: { c: ClinicState; act: Act; sel?: string }) {
  const list = useMemo(() => [...c.cases].filter(k => k.status === 'at-risk').sort((a, b) => urgency(b, c.births) - urgency(a, c.births)), [c]);
  const selected = list.find(k => k.id === sel) ?? list[0];
  return (
    <Enter k="queue">
      <div class="row" style={{ alignItems: 'flex-end' }}>
        <div class="grow">
          <p class="eyebrow">Genetic Counselling Clinic · Corniche Hospital</p>
          <h1>Today’s couples</h1>
        </div>
        <Kpi c={c} />
      </div>
      <div class="split">
        <div class="stack" style={{ '--gap': '2px' } as any}>
          {list.map(k => (
            <button key={k.id} class={`queue-row ${selected?.id === k.id ? 'sel' : ''}`} onClick={() => go(`c/queue/${k.id}`)}>
              <div class="stack" style={{ '--gap': '6px' } as any}>
                <div class="row" style={{ gap: '8px' }}><b>{k.names.join(' & ')}</b><span class="tiny muted num">{k.id}{k.demo ? ' · demo' : ''}</span></div>
                <div class="row wrap" style={{ gap: '5px' }}>
                  {k.genes.map(g => <span key={g} class="chip saffron num">{g}</span>)}
                  {k.flags.slice(0, 3).map(f => <span key={f} class={`chip ${flagTone(f)}`}>{FLAG_LABEL[f] ?? f}</span>)}
                </div>
              </div>
              <span class="small muted" style={{ whiteSpace: 'nowrap' }}>{STATE_LABEL[k.state]}</span>
            </button>
          ))}
        </div>
        {selected && <Brief k={selected} c={c} act={act} />}
      </div>
    </Enter>
  );
}

function Timeline({ k }: { k: Case }) {
  const idx = PATH.indexOf(k.state);
  return (
    <div>
      <div class="timeline">
        {PATH.map((s, i) => (
          <>{i > 0 && <span class={`tl ${i <= idx ? 'done' : ''}`} />}<span class={`tk ${i < idx ? 'done' : i === idx ? 'now' : ''}`} title={STATE_LABEL[s]} /></>
        ))}
      </div>
      <div class="row tiny muted" style={{ justifyContent: 'space-between' }}><span>Result issued</span><span>{STATE_LABEL[k.state]} · {PATH_OWNER[k.state]}</span><span>Closed</span></div>
    </div>
  );
}

const MISSED: Record<string, string> = {
  chance: '1 in 4 per pregnancy (picked the wrong picture)',
  next: 'that the chance is the same in every pregnancy',
  ill: 'that carriers are healthy',
  ours: 'that the decision is theirs',
  zero: 'that “compatible” is not zero chance',
  all: 'what the panel does not test',
  cousins: 'the added background chance for cousins',
};

/** The pre-visit brief. Built deterministically from the lab section and what the couple chose to share. */
function Brief({ k, c, act }: { k: Case; c: ClinicState; act: Act }) {
  const conds = k.genes.map(g => conditionFor(g));
  const birth = c.births.find(b => b.coupleId === k.id && b.active);
  const weeks = k.due ? Math.round((new Date(k.due).getTime() - Date.now()) / (7 * 864e5)) : null;
  const agenda: string[] = [];
  if (k.flags.includes('distress')) agenda.push('Call today: distress language was detected in Silah. Start with how they are, not with the result.');
  if (k.flags.includes('asked-for-human')) agenda.push('The couple asked for a call back.');
  if (birth?.outcome) agenda.push(birth.outcome.affected ? 'Baby born and confirmed affected; referred to the treating team. Offer the family support and invitations for relatives.' : 'Baby born and not affected; pathway complete.');
  else if (weeks !== null) agenda.push(`Pregnancy due in about ${weeks} weeks${birth ? '; the birth plan is shared with the maternity team' : '; offer a birth plan'}.`);
  for (const b of k.briefs) {
    const who = personaById(b.personId)?.name.en ?? b.personId;
    for (const m of b.teachback?.missed ?? []) agenda.push(`Revisit with ${who}: ${MISSED[m] ?? m}.`);
    if (b.questions.some(q => q.route === 'religion')) agenda.push(`${who} asked a religious question; offer to involve a scholar of their choice.`);
  }
  if (k.flags.includes('vus')) agenda.push('A variant of uncertain significance is involved; confirm before discussing reproductive options.');
  if (!k.briefs.length) agenda.push('The couple has not shared a summary from Silah. Start from understanding.');

  const next: { label: string; to: PathState; extra?: { referral?: Referral; note?: string; closeReason?: string } }[] = [];
  const at = PATH.indexOf(k.state);
  if (at < PATH.indexOf('counselled')) next.push({ label: 'Mark counselled', to: 'counselled', extra: { note: 'Counselling session held' } });
  if (at >= PATH.indexOf('counselled') && at < PATH.indexOf('referred')) {
    next.push({ label: 'Refer: IVF + PGT', to: 'referred', extra: { referral: 'pgt', note: 'Referred to reproductive genomics' } });
    next.push({ label: 'Refer: prenatal testing', to: 'referred', extra: { referral: 'prenatal', note: 'Referred for prenatal testing' } });
    next.push({ label: 'Birth plan only', to: 'referred', extra: { referral: 'birth-plan', note: 'Birth plan with maternity team' } });
    next.push({ label: 'No action chosen', to: 'referred', extra: { referral: 'no-action-chosen', note: 'Couple chose no reproductive intervention; informed choice recorded' } });
  }
  if (at === PATH.indexOf('referred')) next.push({ label: 'Close case', to: 'closed', extra: { closeReason: 'Pathway completed' } });

  return (
    <div class="pool stack" style={{ '--gap': '16px', position: 'sticky', top: '20px' } as any}>
      <div>
        <p class="eyebrow">Pre-visit brief · {k.source === 'egp-recheck' ? 'EGP couple re-check' : 'Premarital 2026'}</p>
        <h2>{k.names.join(' & ')}</h2>
        <p class="small muted num">{k.id} · waiting {days(k.createdAt)} days</p>
      </div>
      <Timeline k={k} />
      <div class="row wrap" style={{ gap: '6px' }}>{k.flags.map(f => <span key={f} class={`chip ${flagTone(f)}`}><span class="dot" />{FLAG_LABEL[f] ?? f}</span>)}</div>
      <div class="stack" style={{ '--gap': '6px' } as any}>
        <p class="eyebrow">Shared genes</p>
        {k.genes.map((g, i) => (
          <p key={g}><span class="chip saffron num">{g}</span> {conds[i].name.en} · <span class="num">1 in 4</span> per pregnancy{conds[i].birthPlan ? ' · early treatment changes outcome' : ''}</p>
        ))}
        <p class="tiny muted">The clinic sees only genes both partners carry. Each partner’s other findings stay on their own phone.</p>
      </div>
      <div class="stack" style={{ '--gap': '6px' } as any}>
        <p class="eyebrow">Suggested agenda</p>
        {agenda.map((a, i) => <p key={i} class="row small" style={{ alignItems: 'flex-start' }}><span class="dot" style={{ color: 'var(--saffron)', marginTop: '9px' }} />{a}</p>)}
      </div>
      {k.briefs.map(b => (
        <div key={b.personId} class="stack" style={{ '--gap': '4px' } as any}>
          <p class="eyebrow">Shared by {personaById(b.personId)?.name.en} · {new Date(b.at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}</p>
          {b.teachback && <p class="small">Teach-back: <b class="num">{b.teachback.correct}/{b.teachback.total}</b> {b.teachback.missed.length ? `· missed ${b.teachback.missed.map(m => MISSED[m] ?? m).join('; ')}` : '· all points explained back'}</p>}
          {b.questions.length > 0 && <div class="small">Questions: {b.questions.map((q, i) => <p key={i} dir="auto" style={{ marginInlineStart: '12px' }}>“{q.q}”</p>)}</div>}
          <p class="small muted">Language: {b.lang === 'ar' ? 'Arabic' : 'English'} · sharing: {b.sharing.map(s => s.kind + (s.gene ? ` ${s.gene}` : '')).join(', ') || 'none'}</p>
        </div>
      ))}
      {k.referral && <p class="small">Referral: <b>{k.referral}</b>{k.closeReason ? ` · ${k.closeReason}` : ''}</p>}
      <div class="row wrap">
        {next.map(n => <button key={n.label} class={`btn ${n.to === 'closed' || n.label.startsWith('Mark') ? 'primary' : 'calm'}`} style={{ padding: '10px 16px', fontSize: '14px' }} onClick={() => act(st => counsellorAdvance(st, k.id, n.to, n.extra))}>{n.label}</button>)}
      </div>
    </div>
  );
}

function Kpi({ c }: { c: ClinicState }) {
  const k = referralKpi(c);
  const pct = k.total ? Math.round((k.referred / k.total) * 100) : 0;
  return (
    <div style={{ minWidth: '260px' }}>
      <p class="tiny muted">Non-compatible couples referred to counselling · DoH target 90%</p>
      <div class="row"><div class="meter grow"><i style={{ width: `${pct}%` }} /><b style={{ left: '90%' }} /></div><b class="num">{pct}%</b></div>
    </div>
  );
}

function Outreach({ c, act }: { c: ClinicState; act: Act }) {
  const ranked = [...OUTREACH_REGISTER].sort((a, b) => score(b) - score(a));
  const [n, setN] = useState(3);
  return (
    <Enter k="outreach">
      <p class="eyebrow">Moment A · couples married before the mandate</p>
      <h1>Invite couples to a check on genomes the programme already holds.</h1>
      <p class="muted" style={{ maxWidth: '760px' }}>No new sample is taken. The list is ranked by signals people have declared or that are already in their record: being related, a relative with an inherited condition, planning a pregnancy. No genetic data is used to choose who is invited, so the invitation itself reveals nothing about anyone’s genes.</p>
      <div class="split">
        <div class="stack" style={{ '--gap': '2px' } as any}>
          {ranked.map((r, i) => {
            const sent = c.outreach.sent.includes(r.id);
            const consents = c.outreach.consents[r.id]?.length ?? 0;
            return (
              <div key={r.id} class="queue-row" style={{ gridTemplateColumns: '24px 1fr auto', cursor: 'default' }}>
                <span class="num muted">{i + 1}</span>
                <div class="stack" style={{ '--gap': '6px' } as any}>
                  <div class="row" style={{ gap: '8px' }}><b>{r.label}</b><span class="tiny muted num">{r.id}</span></div>
                  <div class="row wrap" style={{ gap: '4px' }}>
                    {r.declaredRelated && <span class="chip indigo">Declared related</span>}
                    {r.affectedRelative && <span class="chip indigo">Affected relative</span>}
                    {r.planning && <span class="chip indigo">Planning pregnancy</span>}
                  </div>
                </div>
                <span class="small muted">{consents ? `${consents}/2 consented` : sent ? 'Invited' : ''}</span>
              </div>
            );
          })}
          <div class="row" style={{ marginTop: '16px' }}>
            <button class="btn primary" onClick={() => act(st => sendOutreach(st, ranked.slice(0, n).map(r => r.id)))}>Send invitations to the top {n}</button>
            <button class="chip" onClick={() => setN(Math.max(1, n - 1))}>−</button><button class="chip" onClick={() => setN(Math.min(ranked.length, n + 1))}>+</button>
          </div>
          <p class="tiny muted">In this demo only Mariam & Saeed have phones; the other rows stand in for the register.</p>
        </div>
        <Population />
      </div>
    </Enter>
  );
}
const score = (r: (typeof OUTREACH_REGISTER)[number]) => (r.declaredRelated ? 4 : 0) + (r.affectedRelative ? 3 : 0) + (r.planning ? 2 : 0);

function Births({ c, act }: { c: ClinicState; act: Act }) {
  const list = c.births.filter(b => b.active);
  return (
    <Enter k="births">
      <p class="eyebrow">Corniche Hospital · maternity</p>
      <h1>Expected births with a plan</h1>
      <p class="muted" style={{ maxWidth: '760px' }}>Each line was shared by the parent from Silah, for these genes and this pregnancy only, and disappears six weeks after birth or when the parent withdraws it.</p>
      {list.length === 0 && <p class="muted">No birth plans shared yet.</p>}
      {list.map(b => {
        const weeks = b.due ? Math.round((new Date(b.due).getTime() - Date.now()) / (7 * 864e5)) : null;
        return (
          <div key={b.coupleId + b.personId} class="pool stack" style={{ maxWidth: '760px', '--gap': '8px' } as any}>
            <div class="row"><h2 class="grow">{b.name}</h2>{b.outcome?.born
              ? <span class="chip palm num">born {new Date(b.outcome.born).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })} · simulated</span>
              : weeks !== null && <span class="chip indigo num">due in {weeks} weeks</span>}</div>
            <p>{b.genes.map(g => <span key={g} class="chip saffron num" style={{ marginInlineEnd: '6px' }}>{g}</span>)} {b.conditionIds.map(id => conditionFor(b.genes[0]).id === id ? conditionFor(b.genes[0]).name.en : id).join(', ')}</p>
            <p class="row small" style={{ alignItems: 'flex-start' }}><span class="dot" style={{ color: 'var(--saffron)', marginTop: '9px' }} />Day 1–3: targeted confirmatory test for {b.genes.join(', ')} (in addition to routine and genome newborn screening).</p>
            <p class="row small" style={{ alignItems: 'flex-start' }}><span class="dot" style={{ color: 'var(--saffron)', marginTop: '9px' }} />If positive: same-week referral to the treating team, before symptoms.</p>
            {b.outcome ? (
              <p class={`chip ${b.outcome.affected ? 'indigo' : 'palm'}`} style={{ whiteSpace: 'normal' }}>{b.outcome.note}</p>
            ) : (
              <div class="row wrap">
                <span class="small muted">Record the targeted newborn test:</span>
                <button class="btn calm" style={{ padding: '8px 14px', fontSize: '14px' }} onClick={() => act(st => recordNewborn(st, b.coupleId, false))}>Not affected</button>
                <button class="btn primary" style={{ padding: '8px 14px', fontSize: '14px' }} onClick={() => act(st => recordNewborn(st, b.coupleId, true))}>Affected · refer this week</button>
              </div>
            )}
            <p class="tiny muted">Shared {new Date(b.at).toLocaleDateString('en-GB')} · couple {b.coupleId} · only affected or not affected is reported; a child’s carrier status is not tested.</p>
          </div>
        );
      })}
    </Enter>
  );
}

function Invites({ c }: { c: ClinicState }) {
  const link = linkable(c.issuerLog, c.redeemLog);
  return (
    <Enter k="invites">
      <p class="eyebrow">Invitation service · RSA blind signatures (RFC 9474)</p>
      <h1>The clinic can verify an invitation, but not who sent it.</h1>
      <p class={`chip ${link ? 'madder' : 'palm'}`}>{link ? 'A redemption can be linked to an issuance' : 'No redemption can be linked to any issuance'}</p>
      <div class="split">
        <div class="stack">
          <h3>Issued (what the clinic saw)</h3>
          {c.issuerLog.length === 0 && <p class="muted small">Nothing issued yet.</p>}
          {c.issuerLog.map((e, i) => (
            <div key={i} class="pool soft">
              <p class="small"><b>{e.count} invitations</b> · {new Date(e.at).toLocaleTimeString('en-GB')} · requester pseudonym <span class="num">{e.requester.slice(0, 8)}</span></p>
              <p class="mono-log">{e.blinded.map(b => b.slice(0, 40) + '…').join('\n')}</p>
            </div>
          ))}
        </div>
        <div class="stack">
          <h3>Redeemed (what the clinic saw)</h3>
          {c.redeemLog.length === 0 && <p class="muted small">Nothing redeemed yet.</p>}
          {c.redeemLog.map((e, i) => (
            <div key={i} class="pool soft">
              <p class="small"><b>{e.outcome}</b> · {new Date(e.at).toLocaleTimeString('en-GB')}</p>
              <p class="mono-log">{e.tokenHash}</p>
            </div>
          ))}
        </div>
      </div>
    </Enter>
  );
}

function Pathway({ c }: { c: ClinicState }) {
  const atRisk = c.cases.filter(k => k.status === 'at-risk');
  const reached = (s: PathState) => atRisk.filter(k => PATH.indexOf(k.state) >= PATH.indexOf(s)).length;
  const max = atRisk.length || 1;
  const kpi = referralKpi(c);
  const suppress = (x: number) => (x > 0 && x < 5 ? '<5' : String(x));
  const byRef = (r: Referral) => atRisk.filter(k => k.referral === r).length;
  return (
    <Enter k="pathway">
      <p class="eyebrow">From result to documented closure</p>
      <h1>Pathway</h1>
      <div class="split">
        <div class="stack" style={{ '--gap': '10px' } as any}>
          {PATH.map(s => (
            <div key={s} class="row">
              <span class="small" style={{ width: '120px' }}>{STATE_LABEL[s]}</span>
              <div class="grow"><div class="bar" style={{ width: `${(reached(s) / max) * 100}%`, background: s === 'closed' ? 'var(--palm)' : undefined }} /></div>
              <span class="num small" style={{ width: '40px', textAlign: 'end' }}>{reached(s)}</span>
            </div>
          ))}
          <p class="tiny muted">Cases that reached each step (internal view, identifiable to the clinic).</p>
          <div style={{ marginTop: '14px' }}><Kpi c={c} /></div>
          <p class="small">{kpi.referred} of {kpi.total} non-compatible couples have reached counselling.</p>
        </div>
        <div class="pool stack" style={{ '--gap': '8px' } as any}>
          <p class="eyebrow">Report for DoH · aggregated</p>
          <p class="small muted">Counts under 5 are suppressed. Choices are reported, never ranked: no outcome counts as success over another.</p>
          {([['IVF + PGT', 'pgt'], ['Prenatal testing', 'prenatal'], ['Birth plan', 'birth-plan'], ['No intervention chosen', 'no-action-chosen'], ['High-risk marriage committee', 'committee']] as [string, Referral][]).map(([l, r]) => (
            <p key={r} class="row small"><span class="grow">{l}</span><span class="num">{suppress(byRef(r))}</span></p>
          ))}
          <p class="row small"><span class="grow">Teach-back completed (shared)</span><span class="num">{suppress(atRisk.filter(k => k.briefs.some(b => b.teachback)).length)}</span></p>
          <p class="row small"><span class="grow">Birth plans active</span><span class="num">{suppress(c.births.filter(b => b.active).length)}</span></p>
        </div>
      </div>
    </Enter>
  );
}
