import { dbGet, dbPut } from './db';

// Each person's data is encrypted on their device with AES-GCM under a key the browser will not
// export. In a browser this is the strongest storage available without a native app; the native
// build would use the Android Keystore instead.

async function deviceKey(owner: string): Promise<CryptoKey> {
  const k = await dbGet<CryptoKey>('keys', `aes:${owner}`);
  if (k) return k;
  const nk = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  await dbPut('keys', `aes:${owner}`, nk);
  return nk;
}

export async function vaultLoad<T>(owner: string): Promise<T | undefined> {
  const rec = await dbGet<{ iv: Uint8Array; ct: ArrayBuffer }>('vault', owner);
  if (!rec) return undefined;
  const key = await deviceKey(owner);
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: rec.iv as BufferSource }, key, rec.ct);
  return JSON.parse(new TextDecoder().decode(pt)) as T;
}

export async function vaultSave<T>(owner: string, value: T): Promise<void> {
  const key = await deviceKey(owner);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ct = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(JSON.stringify(value)));
  await dbPut('vault', owner, { iv, ct });
}
