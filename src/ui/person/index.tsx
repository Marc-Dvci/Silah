import { useEffect } from 'preact/hooks';
import { usePerson } from '../hooks';
import { currentView } from '../../app/person';
import { personaById } from '../../app/demo';
import { PersonShell } from './shell';
import { Home } from './home';
import { Result, Check } from './result';
import { Options, BirthPlan, Family, Counsellor } from './journey';
import { Privacy } from './privacy';
import { Ask } from './ask';
import { Mark } from '../kit';

/** `focus` names a section to scroll to once the page has drawn (the demo stage uses it to point at one part). */
export function PersonApp({ id, page, focus }: { id: string; page?: string; focus?: string }) {
  const { s, act } = usePerson(id);
  const loaded = !!s;
  useEffect(() => {
    if (!focus || !loaded) { scrollTo({ top: 0 }); return; }
    const t = setTimeout(() => document.getElementById(`focus-${focus}`)?.scrollIntoView({ block: 'start', behavior: 'smooth' }), 450);
    return () => clearTimeout(t);
  }, [id, page, focus, loaded]);
  if (!personaById(id)) return <p style={{ padding: '24px' }}>Unknown person.</p>;
  if (!s) return <div class="phone" style={{ alignItems: 'center', justifyContent: 'center' }}><Mark size={64} /></div>;
  const base = `p/${id}`;
  const hasResult = !!currentView(s);
  const needResult = ['result', 'check', 'options', 'birth', 'family', 'counsellor'];
  const p = page && needResult.includes(page) && !hasResult ? undefined : page;
  const props = { s, act, base };
  return (
    <PersonShell s={s} act={act} base={base} showAsk={p !== 'ask' && hasResult}>
      {p === 'result' ? <Result {...props} />
        : p === 'check' ? <Check {...props} />
        : p === 'options' ? <Options {...props} />
        : p === 'birth' ? <BirthPlan {...props} />
        : p === 'family' ? <Family {...props} />
        : p === 'counsellor' ? <Counsellor {...props} />
        : p === 'privacy' ? <Privacy {...props} />
        : p === 'ask' ? <Ask {...props} />
        : <Home {...props} />}
    </PersonShell>
  );
}
