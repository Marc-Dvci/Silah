import { render } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import '@fontsource/ibm-plex-sans/400.css';
import '@fontsource/ibm-plex-sans/500.css';
import '@fontsource/ibm-plex-sans/600.css';
import '@fontsource/ibm-plex-sans-arabic/400.css';
import '@fontsource/ibm-plex-sans-arabic/500.css';
import '@fontsource/ibm-plex-sans-arabic/600.css';
import '@fontsource/ibm-plex-mono/400.css';
import '@fontsource/ibm-plex-mono/500.css';
import '@fontsource/reem-kufi/600.css';
import '@fontsource/reem-kufi/700.css';
import './ui/styles.css';
import { Bloom, useRoute } from './ui/kit';
import { ensureSeeded, pumpClinic } from './ui/hooks';
import { onNet } from './app/net';
import { PersonApp } from './ui/person';
import { ClinicApp } from './ui/clinic';
import { RelativePage } from './ui/relative';
import { Stage } from './ui/stage';

function App() {
  const r = useRoute();
  const [ready, setReady] = useState(false);
  useEffect(() => {
    ensureSeeded().then(() => setReady(true));
    // The simulated health-system service runs wherever Silah is open, so a phone-only visit still works.
    const off = onNet(() => setTimeout(pumpClinic, 40));
    const t = setInterval(pumpClinic, 2000);
    return () => { off(); clearInterval(t); };
  }, []);
  if (!ready) return null;
  const [a, b, c, d] = r;
  if (a === 'p' && b) return <PersonApp id={b} page={c} focus={d} />;
  if (a === 'c') return <ClinicApp page={b} sub={c} />;
  if (a === 'r' && b) return <RelativePage token={b} />;
  return <Stage />;
}

render(<><Bloom /><App /></>, document.getElementById('app')!);
