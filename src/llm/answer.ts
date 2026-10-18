import type { FactCard, Lang } from '../core/types';
import { Q } from '../core/fraction';
import { parseModelAnswer, verifyAnswer, type ModelAnswer, type VerifiedAnswer } from '../core/verifier';

// The language model only rephrases fact cards in answer to a question. Its output is JSON,
// every sentence cites cards, and the verifier decides what the person sees.

export interface ChatMessage { role: 'system' | 'user' | 'assistant'; content: string }
export interface Backend { name: string; generate(messages: ChatMessage[]): Promise<string> }

export const COUNSELLOR_CARD: FactCard = {
  id: 'counsellor',
  kind: 'option',
  numbers: {},
  text: {
    en: 'Your genetic counsellor can answer questions that Silah cannot, and can talk through any decision with you.',
    ar: 'يستطيع مستشارك الوراثي الإجابة عن الأسئلة التي لا يجيب عنها تطبيق صلة، ومناقشة أي قرار معك.',
  },
  sources: [],
};

const SCHEMA = {
  type: 'object',
  properties: {
    sentences: {
      type: 'array',
      minItems: 1,
      maxItems: 4,
      items: {
        type: 'object',
        properties: { text: { type: 'string' }, cards: { type: 'array', items: { type: 'string' }, minItems: 1 } },
        required: ['text', 'cards'],
      },
    },
  },
  required: ['sentences'],
};

export function composeMessages(question: string, cards: FactCard[], lang: Lang): ChatMessage[] {
  const all = [...cards, COUNSELLOR_CARD];
  const list = all.map(c => {
    const nums = Object.entries(c.numbers).map(([k, v]) => `${k}=${Q.from(v).toString()}`).join(', ');
    return `- id: ${c.id}\n  text: ${c.text[lang]}${nums ? `\n  numbers: ${nums}` : ''}`;
  }).join('\n');
  const language = lang === 'ar' ? 'Modern Standard Arabic' : 'English';
  const system = [
    'You are Silah, a careful assistant that helps a person understand their own premarital or preconception genetic result.',
    'You may only use the FACT CARDS below. They were computed for this person and checked by people.',
    'Rules:',
    `1. Reply in ${language}, in plain words a person without medical training understands.`,
    '2. Output JSON only, in the form {"sentences":[{"text":"...","cards":["card-id"]}]}. No other text.',
    '3. Every sentence must list the id of at least one card it is based on.',
    '4. Use only numbers that appear on the cards you cite. Do not compute new numbers.',
    '5. Never tell the person what to decide about marriage, pregnancy, IVF, embryo testing or ending a pregnancy. You may say that their genetic counsellor can help them think it through.',
    '6. Never say a particular child will or will not be affected. Speak about chances.',
    '7. At most 4 short sentences.',
    '8. If the cards do not answer the question, reply with one sentence based on the "counsellor" card.',
    '9. If the question asks for a number that is on no card (for example the chance for two children, or a figure about other people), say that the genetic counsellor can work it out. Never answer with a different number instead.',
    '10. Put card ids only in the "cards" field, never inside the text, and never mention "cards" or "fact cards" to the person.',
    '',
    'FACT CARDS:',
    list,
  ].join('\n');
  return [{ role: 'system', content: system }, { role: 'user', content: question }];
}

export interface ModelResult { raw: string; parsed: ModelAnswer | null; verified: VerifiedAnswer | null; ms: number; backend: string }

export async function askModel(backend: Backend, question: string, cards: FactCard[], lang: Lang): Promise<ModelResult> {
  const t0 = performance.now();
  const raw = await backend.generate(composeMessages(question, cards, lang));
  const parsed = parseModelAnswer(raw);
  const verified = parsed ? verifyAnswer(parsed, [...cards, COUNSELLOR_CARD]) : null;
  return { raw, parsed, verified, ms: Math.round(performance.now() - t0), backend: backend.name };
}

// ---------- backends ----------

/** An OpenAI-compatible server on this machine (llama.cpp's llama-server). */
export function localServer(base = 'http://127.0.0.1:8080', model = 'local'): Backend {
  return {
    name: `llama-server (${base})`,
    async generate(messages) {
      const r = await fetch(`${base}/v1/chat/completions`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          model, messages, temperature: 0.2, max_tokens: 420,
          response_format: { type: 'json_schema', json_schema: { name: 'answer', schema: SCHEMA } },
        }),
      });
      if (!r.ok) throw new Error(`server ${r.status}`);
      const j = await r.json();
      const msg = j.choices?.[0]?.message ?? {};
      // Reasoning models put their thinking in a separate field; only the content is the answer.
      return String(msg.content ?? '');
    },
  };
}

export async function detectLocalServer(base = 'http://127.0.0.1:8080'): Promise<boolean> {
  try {
    const r = await fetch(`${base}/health`, { signal: AbortSignal.timeout(1200) });
    return r.ok;
  } catch {
    return false;
  }
}

export const WEB_MODEL = 'onnx-community/gemma-4-E2B-it-ONNX';

/** Gemma in the browser through Transformers.js and WebGPU. Downloaded once, then cached offline. */
export async function webgpuBackend(onProgress?: (p: number) => void): Promise<Backend> {
  if (!('gpu' in navigator)) throw new Error('WebGPU is not available on this device');
  const tf: any = await import('@huggingface/transformers');
  const files = new Map<string, number>();
  const gen = await tf.pipeline('text-generation', WEB_MODEL, {
    device: 'webgpu',
    dtype: 'q4f16',
    progress_callback: (e: any) => {
      if (e.status === 'progress' && e.total) {
        files.set(e.file, e.loaded / e.total);
        const v = [...files.values()];
        onProgress?.(v.reduce((a, b) => a + b, 0) / v.length);
      }
    },
  });
  return {
    name: `${WEB_MODEL} (WebGPU)`,
    async generate(messages) {
      const out = await gen(messages, { max_new_tokens: 380, do_sample: false });
      const last = out?.[0]?.generated_text;
      return Array.isArray(last) ? String(last.at(-1)?.content ?? '') : String(last ?? '');
    },
  };
}
