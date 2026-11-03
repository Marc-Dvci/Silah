import { DurableObject } from 'cloudflare:workers';

export interface Env {
  ROOM: DurableObjectNamespace<Room>;
  AI: Ai;
  ALLOWED_ORIGINS: string;
  EXPLAIN_MODEL: string;
}

// Limits. Keep in sync with README.md.
const ROOM_RE = /^[A-Za-z0-9_-]{22,64}$/;
const ID_RE = /^[A-Za-z0-9_-]{1,64}$/;
const B64URL_RE = /^[A-Za-z0-9_-]+$/;
const MAX_POST_BYTES = 80 * 1024;
const MAX_CT_CHARS = 65536;
const IV_CHARS = 16;
const MAX_MESSAGES = 500;
const POSTS_PER_MINUTE = 60;
const PAGE_SIZE = 200;
const RETENTION_MS = 30 * 24 * 60 * 60 * 1000;

const MAX_EXPLAIN_BYTES = 24 * 1024;
const MAX_EXPLAIN_MESSAGES = 6;
const EXPLAIN_WINDOW_MS = 10 * 60 * 1000;
const EXPLAIN_PER_WINDOW = 40;
const DEFAULT_MAX_TOKENS = 700;
const MIN_MAX_TOKENS = 64;
const MAX_MAX_TOKENS = 900;

// Minimal view of the Workers AI binding, typed loosely so any model id is accepted.
interface AiRunner {
  run(model: string, input: Record<string, unknown>): Promise<unknown>;
}

type Role = 'system' | 'user' | 'assistant';
interface ChatMessage {
  role: Role;
  content: string;
}

// Best-effort per-isolate limiter for /v1/explain, keyed by client IP.
const explainHits = new Map<string, number[]>();

function takeExplainSlot(ip: string, now: number): boolean {
  if (explainHits.size > 5000) {
    for (const [key, times] of explainHits) {
      const live = times.filter(t => now - t < EXPLAIN_WINDOW_MS);
      if (live.length === 0) explainHits.delete(key);
      else explainHits.set(key, live);
    }
  }
  const hits = (explainHits.get(ip) ?? []).filter(t => now - t < EXPLAIN_WINDOW_MS);
  if (hits.length >= EXPLAIN_PER_WINDOW) {
    explainHits.set(ip, hits);
    return false;
  }
  hits.push(now);
  explainHits.set(ip, hits);
  return true;
}

function allowedOrigins(env: Env): string[] {
  return env.ALLOWED_ORIGINS.split(',')
    .map(s => s.trim())
    .filter(s => s.length > 0);
}

function baseHeaders(cors: string | null): Headers {
  const h = new Headers({
    'cache-control': 'no-store',
    'x-content-type-options': 'nosniff',
    'referrer-policy': 'no-referrer',
    'vary': 'Origin',
  });
  if (cors !== null) h.set('access-control-allow-origin', cors);
  return h;
}

function reply(status: number, body: unknown, cors: string | null): Response {
  const h = baseHeaders(cors);
  h.set('content-type', 'application/json; charset=utf-8');
  return new Response(JSON.stringify(body), { status, headers: h });
}

function preflight(cors: string | null): Response {
  const h = baseHeaders(cors);
  if (cors !== null) {
    h.set('access-control-allow-methods', 'GET, POST, DELETE');
    h.set('access-control-allow-headers', 'content-type');
    h.set('access-control-max-age', '86400');
  }
  return new Response(null, { status: 204, headers: h });
}

// Reads the body as text, stopping as soon as it passes `max` bytes.
// Returns null when the limit is exceeded.
async function readBody(req: Request, max: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') ?? '0');
  if (declared > max) return null;
  if (req.body === null) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > max) {
      await reader.cancel();
      return null;
    }
    chunks.push(value);
  }
  const all = new Uint8Array(total);
  let off = 0;
  for (const c of chunks) {
    all.set(c, off);
    off += c.byteLength;
  }
  return new TextDecoder().decode(all);
}

interface PostBody {
  from: string;
  ct: string;
  iv: string;
}

function validatePost(body: unknown): PostBody | null {
  if (typeof body !== 'object' || body === null) return null;
  const { from, ct, iv } = body as Record<string, unknown>;
  if (typeof from !== 'string' || !ID_RE.test(from)) return null;
  if (typeof ct !== 'string' || ct.length === 0 || ct.length > MAX_CT_CHARS) return null;
  if (!B64URL_RE.test(ct)) return null;
  if (typeof iv !== 'string' || iv.length !== IV_CHARS || !B64URL_RE.test(iv)) return null;
  return { from, ct, iv };
}

function parseExplain(body: unknown): { messages: ChatMessage[]; maxTokens: number } | null {
  if (typeof body !== 'object' || body === null) return null;
  const b = body as Record<string, unknown>;
  const raw = b.messages;
  if (!Array.isArray(raw) || raw.length < 1 || raw.length > MAX_EXPLAIN_MESSAGES) return null;
  const messages: ChatMessage[] = [];
  for (const item of raw) {
    if (typeof item !== 'object' || item === null) return null;
    const m = item as Record<string, unknown>;
    const role = m.role;
    const content = m.content;
    if (role !== 'system' && role !== 'user' && role !== 'assistant') return null;
    if (typeof content !== 'string') return null;
    messages.push({ role, content });
  }
  let maxTokens = DEFAULT_MAX_TOKENS;
  if (typeof b.max_tokens === 'number' && Number.isFinite(b.max_tokens)) {
    maxTokens = Math.min(MAX_MAX_TOKENS, Math.max(MIN_MAX_TOKENS, Math.floor(b.max_tokens)));
  }
  return { messages, maxTokens };
}

function extractText(out: unknown): string | null {
  if (typeof out !== 'object' || out === null) return null;
  const response = (out as { response?: unknown }).response;
  if (typeof response === 'string') return response;
  // Newer models answer in the OpenAI chat-completions shape.
  const choice = (out as { choices?: { message?: { content?: unknown } }[] }).choices?.[0]?.message?.content;
  if (typeof choice === 'string') return choice;
  if (response === undefined || response === null) return null;
  return JSON.stringify(response);
}

async function handlePost(request: Request, stub: DurableObjectStub<Room>, cors: string | null): Promise<Response> {
  const text = await readBody(request, MAX_POST_BYTES);
  if (text === null) return reply(413, { error: 'too-large' }, cors);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: 'bad-json' }, cors);
  }
  const v = validatePost(body);
  if (v === null) return reply(400, { error: 'invalid-message' }, cors);
  const res = await stub.append(v.from, v.ct, v.iv);
  if (!res.ok) return reply(res.error === 'closed' ? 410 : 429, { error: res.error }, cors);
  return reply(200, { seq: res.seq, at: res.at }, cors);
}

async function handleList(url: URL, stub: DurableObjectStub<Room>, cors: string | null): Promise<Response> {
  const raw = url.searchParams.get('after') ?? '0';
  if (!/^(0|[1-9][0-9]{0,14})$/.test(raw)) return reply(400, { error: 'bad-after' }, cors);
  const after = Number(raw);
  const { messages, closed } = await stub.list(after);
  // Cursor: seq of the last message returned, or `after` when none.
  const last = messages.length > 0 ? (messages[messages.length - 1]?.seq ?? after) : after;
  return reply(200, { messages, last, closed }, cors);
}

async function handleExplain(request: Request, env: Env, cors: string | null): Promise<Response> {
  const ip = request.headers.get('cf-connecting-ip') ?? 'unknown';
  if (!takeExplainSlot(ip, Date.now())) return reply(429, { error: 'rate' }, cors);

  const text = await readBody(request, MAX_EXPLAIN_BYTES);
  if (text === null) return reply(413, { error: 'too-large' }, cors);
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return reply(400, { error: 'bad-json' }, cors);
  }
  const parsed = parseExplain(body);
  if (parsed === null) return reply(400, { error: 'invalid-explain' }, cors);

  let out: unknown;
  try {
    const ai = env.AI as unknown as AiRunner;
    out = await ai.run(env.EXPLAIN_MODEL, {
      messages: parsed.messages,
      max_tokens: parsed.maxTokens,
      temperature: 0.2,
      // Gemma 4 thinks by default; the explanation needs only the answer.
      chat_template_kwargs: { enable_thinking: false },
      reasoning_effort: 'low',
    });
  } catch {
    return reply(502, { error: 'model' }, cors);
  }
  const content = extractText(out);
  if (content === null) return reply(502, { error: 'model' }, cors);
  return reply(200, { content, model: env.EXPLAIN_MODEL }, cors);
}

async function route(request: Request, env: Env, cors: string | null): Promise<Response> {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;

  if (path === '/v1/health') {
    if (method !== 'GET') return reply(405, { error: 'method-not-allowed' }, cors);
    return reply(200, { ok: true, service: 'silah-relay', v: 1 }, cors);
  }

  if (path === '/v1/explain') {
    if (method !== 'POST') return reply(405, { error: 'method-not-allowed' }, cors);
    return handleExplain(request, env, cors);
  }

  const messagesRoute = /^\/v1\/rooms\/([^/]+)\/messages$/.exec(path);
  if (messagesRoute) {
    const room = messagesRoute[1] ?? '';
    if (!ROOM_RE.test(room)) return reply(400, { error: 'bad-room' }, cors);
    const stub = env.ROOM.get(env.ROOM.idFromName(room));
    if (method === 'POST') return handlePost(request, stub, cors);
    if (method === 'GET') return handleList(url, stub, cors);
    return reply(405, { error: 'method-not-allowed' }, cors);
  }

  const roomRoute = /^\/v1\/rooms\/([^/]+)$/.exec(path);
  if (roomRoute) {
    const room = roomRoute[1] ?? '';
    if (!ROOM_RE.test(room)) return reply(400, { error: 'bad-room' }, cors);
    if (method !== 'DELETE') return reply(405, { error: 'method-not-allowed' }, cors);
    const stub = env.ROOM.get(env.ROOM.idFromName(room));
    await stub.wipe();
    return reply(200, { ok: true }, cors);
  }

  return reply(404, { error: 'not-found' }, cors);
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    // Any request carrying an Origin header must come from an allowed origin.
    const origin = request.headers.get('origin');
    const allowed = origin !== null && allowedOrigins(env).includes(origin);
    if (origin !== null && !allowed) return reply(403, { error: 'forbidden' }, null);
    const cors = allowed ? origin : null;

    if (request.method === 'OPTIONS') return preflight(cors);
    try {
      return await route(request, env, cors);
    } catch {
      return reply(500, { error: 'internal' }, cors);
    }
  },
} satisfies ExportedHandler<Env>;

type PostResult = { ok: true; seq: number; at: string } | { ok: false; error: 'room-full' | 'rate' | 'closed' };

type Row = { seq: number; sender: string; ct: string; iv: string; at: string };

export interface StoredMessage {
  seq: number;
  from: string;
  ct: string;
  iv: string;
  at: string;
}

// One Durable Object per room. Holds ciphertext only.
export class Room extends DurableObject<Env> {
  private recentPosts: number[] = [];

  constructor(ctx: DurableObjectState, env: Env) {
    super(ctx, env);
    void ctx.blockConcurrencyWhile(async () => {
      this.migrate();
    });
  }

  private migrate(): void {
    this.ctx.storage.sql
      .exec(
        'CREATE TABLE IF NOT EXISTS messages (' +
          'seq INTEGER PRIMARY KEY AUTOINCREMENT, ' +
          'sender TEXT NOT NULL, ct TEXT NOT NULL, iv TEXT NOT NULL, at TEXT NOT NULL)',
      )
      .toArray();
  }

  async append(sender: string, ct: string, iv: string): Promise<PostResult> {
    const now = Date.now();
    if (await this.ctx.storage.get('closed')) return { ok: false, error: 'closed' };
    // Rate check counts every attempt, not only accepted ones.
    this.recentPosts = this.recentPosts.filter(t => now - t < 60_000);
    if (this.recentPosts.length >= POSTS_PER_MINUTE) return { ok: false, error: 'rate' };
    this.recentPosts.push(now);

    const count = this.ctx.storage.sql
      .exec<{ n: number }>('SELECT COUNT(*) AS n FROM messages')
      .one().n;
    if (count >= MAX_MESSAGES) return { ok: false, error: 'room-full' };

    const at = new Date(now).toISOString();
    this.ctx.storage.sql
      .exec('INSERT INTO messages (sender, ct, iv, at) VALUES (?, ?, ?, ?)', sender, ct, iv, at)
      .toArray();
    const seq = this.ctx.storage.sql.exec<{ seq: number }>('SELECT last_insert_rowid() AS seq').one().seq;

    await this.ctx.storage.setAlarm(now + RETENTION_MS);
    return { ok: true, seq, at };
  }

  async list(after: number): Promise<{ messages: StoredMessage[]; closed: boolean }> {
    const closed = !!(await this.ctx.storage.get('closed'));
    const rows = this.ctx.storage.sql
      .exec<Row>(
        'SELECT seq, sender, ct, iv, at FROM messages WHERE seq > ? ORDER BY seq ASC LIMIT ?',
        after,
        PAGE_SIZE,
      )
      .toArray();
    return { messages: rows.map(r => ({ seq: r.seq, from: r.sender, ct: r.ct, iv: r.iv, at: r.at })), closed };
  }

  /** A partner ended the link: delete every message, and keep only a "closed" marker so the other phone learns it. */
  async wipe(): Promise<void> {
    await this.resetStorage();
    await this.ctx.storage.put('closed', new Date().toISOString());
    await this.ctx.storage.setAlarm(Date.now() + RETENTION_MS);
  }

  override async alarm(): Promise<void> {
    await this.resetStorage();
  }

  private async resetStorage(): Promise<void> {
    await this.ctx.storage.deleteAlarm();
    await this.ctx.storage.deleteAll();
    // deleteAll drops the table, so recreate it for later requests.
    this.recentPosts = [];
    this.migrate();
  }
}
