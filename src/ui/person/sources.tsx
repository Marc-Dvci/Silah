import { useState } from 'preact/hooks';
import { sourceById } from '../../core/data/sources';
import { Sheet, useT } from '../kit';

/** Small citation chips. Tapping one shows the full reference and whether it was checked. */
export function SourceChips({ ids }: { ids: string[] }) {
  const t = useT();
  const [open, setOpen] = useState<string | null>(null);
  const uniq = [...new Set(ids)].filter(id => sourceById(id)).filter((id, i, a) => a.findIndex(x => short(x) === short(id)) === i);
  if (!uniq.length) return null;
  const src = open ? sourceById(open) : undefined;
  return (
    <>
      {uniq.map(id => (
        <button key={id} class="cite" style={{ border: 0, cursor: 'pointer' }} onClick={() => setOpen(id)}>{short(id)}</button>
      ))}
      <Sheet open={!!src} onClose={() => setOpen(null)}>
        {src && (
          <div class="stack" dir="ltr" style={{ textAlign: 'left' }}>
            <p class="eyebrow">{t({ en: 'Source', ar: 'المصدر' })}</p>
            <p>{src.cite}</p>
            {src.url && <p class="small"><a href={src.url} target="_blank" rel="noopener">{src.url}</a></p>}
            <p class={`chip ${src.verified ? 'palm' : 'saffron'}`}>
              {src.verified ? t({ en: 'Checked against the source for this project', ar: 'تم التحقق منه مقابل المصدر' }) : t({ en: 'Not yet checked against the primary source', ar: 'لم يُتحقق منه بعد مقابل المصدر الأصلي' })}
            </p>
            {src.note && <p class="small muted">{src.note}</p>}
          </div>
        )}
      </Sheet>
    </>
  );
}

function short(id: string): string {
  const fixed: Record<string, string> = {
    'assumption-carrier': 'assumed frequency', 'assumption-detection': 'assumed detection',
    'medlineplus-ar': 'MedlinePlus', 'cdc-birth-defects-1-in-33': 'CDC',
  };
  if (fixed[id]) return fixed[id];
  const src = sourceById(id);
  if (id.startsWith('doh-')) return `DoH ${src?.year ?? ''}`.trim();
  if (id.startsWith('fda-')) return `FDA ${src?.year ?? ''}`.trim();
  // Surnames can have several words ("De Vivo DC"): take the capitalised words before the initials.
  const surname = src?.cite.match(/^((?:[A-Z][a-z'’-]+\s?)+)/)?.[1].trim() ?? id;
  return `${surname} ${src?.year ?? ''}`.trim();
}
