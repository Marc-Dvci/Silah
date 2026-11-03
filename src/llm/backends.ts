import { detectLocalServer, localServer, webgpuBackend, type Backend } from './answer';
import { cloudBackend } from './explain';
import { RELAY_URL } from '../app/relay';

// The language model the phone uses, chosen once per session by the person:
// - on this device (Gemma 4 E2B in the browser, WebGPU, downloaded once),
// - on this computer (llama.cpp, when it is running),
// - the Silah explanation service (opt-in; receives the result's cards with names removed, keeps nothing).

let current: Backend | null = null;
let kind: 'device' | 'computer' | 'service' | null = null;
const listeners = new Set<() => void>();

export const getBackend = () => current;
export const backendKind = () => kind;
export function onBackend(f: () => void): () => void { listeners.add(f); return () => listeners.delete(f); }
const set = (b: Backend, k: typeof kind) => { current = b; kind = k; listeners.forEach(f => f()); };

export const hasComputerModel = () => detectLocalServer();
export const useComputer = () => set(localServer(), 'computer');
export const useService = () => set(cloudBackend(RELAY_URL), 'service');
export async function useDevice(onProgress?: (p: number) => void): Promise<void> {
  set(await webgpuBackend(onProgress), 'device');
}
