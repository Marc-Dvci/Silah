import { useCallback, useEffect, useState } from 'preact/hooks';
import { loadPerson, syncPerson, type PersonState } from '../app/person';
import { loadClinic, seedClinic, syncClinic, type ClinicState } from '../app/clinic';
import { onNet } from '../app/net';

// Each simulated device processes its own inbox. Web Locks keep two frames from
// processing the same messages at once (the stage shows phone and clinic side by side).

const withLock = <T,>(name: string, f: () => Promise<T>): Promise<T> =>
  'locks' in navigator ? navigator.locks.request(name, f) as Promise<T> : f();

export async function ensureSeeded(): Promise<void> {
  await withLock('silah-seed', async () => {
    if (!(await loadClinic())) await seedClinic();
  });
}

export async function pumpClinic(): Promise<boolean> {
  return withLock('silah-clinic', async () => {
    const c = await loadClinic();
    return c ? syncClinic(c) : false;
  });
}

export function usePerson(id: string) {
  const [s, setS] = useState<PersonState | null>(null);
  const refresh = useCallback(async () => {
    const st = await withLock(`silah-person-${id}`, async () => {
      const st = await loadPerson(id);
      await syncPerson(st);
      return st;
    });
    setS({ ...st });
  }, [id]);
  useEffect(() => {
    setS(null);
    refresh();
    const off = onNet(() => setTimeout(refresh, 60));
    const t = setInterval(refresh, 2500);
    return () => { off(); clearInterval(t); };
  }, [id]);
  /** Run an action against fresh state, inside the person's lock, then re-render. */
  const act = useCallback(async (f: (st: PersonState) => Promise<void>) => {
    await withLock(`silah-person-${id}`, async () => {
      const st = await loadPerson(id);
      await syncPerson(st);
      await f(st);
    });
    await refresh();
  }, [id]);
  return { s, act, refresh };
}

export function useClinic() {
  const [c, setC] = useState<ClinicState | null>(null);
  const refresh = useCallback(async () => {
    await pumpClinic();
    const st = await loadClinic();
    if (st) setC({ ...st });
  }, []);
  useEffect(() => {
    refresh();
    const off = onNet(() => setTimeout(refresh, 120));
    const t = setInterval(refresh, 2500);
    return () => { off(); clearInterval(t); };
  }, []);
  const act = useCallback(async (f: (st: ClinicState) => Promise<void>) => {
    await withLock('silah-clinic', async () => {
      const st = await loadClinic();
      if (st) await f(st);
    });
    await refresh();
  }, []);
  return { c, act, refresh };
}
