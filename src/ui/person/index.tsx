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

export function PersonApp({ id, page }: { id: string; page?: string }) {
  const { s, act } = usePerson(id);
  useEffect(() => { scrollTo({ top: 0 }); }, [id, page]);
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
