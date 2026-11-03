// Smoke test for the Silah relay Worker (global fetch, no dependencies).
// Usage: node test/smoke.mjs [baseUrl] [--ai]
//   baseUrl defaults to http://127.0.0.1:8787
//   --ai also calls /v1/explain for real (Workers AI). Off by default.
// Exit code 0 when every check passes, 1 otherwise.

import { randomBytes } from 'node:crypto';

const args = process.argv.slice(2);
const useAi = args.includes('--ai');
const baseArg = args.find((a) => !a.startsWith('--'));
const BASE = (baseArg ?? 'http://127.0.0.1:8787').replace(/\/+$/, '');

const ORIGIN_OK = 'https://marc-dvci.github.io';
const ORIGIN_LOCAL = 'http://localhost:5173';
const ORIGIN_BAD = 'https://evil.example';

const roomId = () => randomBytes(24).toString('base64url'); // 32 chars
const b64url = (bytes) => randomBytes(bytes).toString('base64url');

let passed = 0;
let failed = 0;
let firstFailure = null;

function expect(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function check(name, fn) {
  try {
    const detail = (await fn()) ?? '';
    passed++;
    console.log(`PASS  ${name}${detail ? ` (${detail})` : ''}`);
  } catch (err) {
    failed++;
    const msg = err instanceof Error ? err.message : String(err);
    if (firstFailure === null) firstFailure = { name, msg };
    console.log(`FAIL  ${name}: ${msg}`);
  }
}

async function call(method, path, { headers = {}, body } = {}) {
  const res = await fetch(BASE + path, { method, headers, body });
  const text = await res.text();
  let json = null;
  try {
    json = JSON.parse(text);
  } catch {
    // not JSON; callers check json === null
  }
  return { status: res.status, headers: res.headers, text, json };
}

function postMessage(room, payload, extraHeaders = {}) {
  return call('POST', `/v1/rooms/${room}/messages`, {
    headers: { 'content-type': 'application/json', ...extraHeaders },
    body: typeof payload === 'string' ? payload : JSON.stringify(payload),
  });
}

function expectError(r, status, code) {
  expect(r.status === status, `status ${r.status}, expected ${status}: ${r.text.slice(0, 120)}`);
  expect(r.json && r.json.error === code, `error body ${r.text.slice(0, 120)}, expected error=${code}`);
}

function expectSecurityHeaders(r) {
  expect(r.headers.get('cache-control') === 'no-store', 'cache-control is not no-store');
  expect(r.headers.get('x-content-type-options') === 'nosniff', 'x-content-type-options missing');
  expect(r.headers.get('referrer-policy') === 'no-referrer', 'referrer-policy missing');
}

const room = roomId();
const samples = [
  { from: 'pseudoA', ct: b64url(48), iv: b64url(12) },
  { from: 'pseudoB', ct: b64url(64), iv: b64url(12) },
  { from: 'pseudoA', ct: b64url(32), iv: b64url(12) },
];
const seqs = [];

console.log(`Base URL: ${BASE}`);
console.log(`Test room: ${room}`);

// Health and headers
await check('health returns ok JSON with security headers', async () => {
  const r = await call('GET', '/v1/health');
  expect(r.status === 200, `status ${r.status}`);
  expect(
    r.json && r.json.ok === true && r.json.service === 'silah-relay' && r.json.v === 1,
    `body ${r.text.slice(0, 120)}`,
  );
  expectSecurityHeaders(r);
  return 'status 200';
});

await check('no Origin header: no CORS header, request allowed', async () => {
  const r = await call('GET', '/v1/health');
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get('access-control-allow-origin') === null, 'unexpected ACAO header');
});

await check('GET from allowed origin echoes that origin', async () => {
  const r = await call('GET', '/v1/health', { headers: { origin: ORIGIN_OK } });
  expect(r.status === 200, `status ${r.status}`);
  expect(r.headers.get('access-control-allow-origin') === ORIGIN_OK, `acao ${r.headers.get('access-control-allow-origin')}`);
});

// CORS
await check('preflight from allowed origin returns 204 with CORS headers', async () => {
  const r = await call('OPTIONS', `/v1/rooms/${room}/messages`, {
    headers: {
      origin: ORIGIN_OK,
      'access-control-request-method': 'POST',
      'access-control-request-headers': 'content-type',
    },
  });
  expect(r.status === 204, `status ${r.status}`);
  expect(r.headers.get('access-control-allow-origin') === ORIGIN_OK, 'acao not echoed');
  const methods = r.headers.get('access-control-allow-methods') ?? '';
  for (const m of ['GET', 'POST', 'DELETE']) expect(methods.includes(m), `allow-methods lacks ${m}`);
  expect((r.headers.get('access-control-allow-headers') ?? '').toLowerCase().includes('content-type'), 'allow-headers');
  expect(r.headers.get('access-control-max-age') === '86400', 'max-age');
  expectSecurityHeaders(r);
  return 'acao echoed, max-age 86400';
});

await check('preflight from localhost dev origin is allowed', async () => {
  const r = await call('OPTIONS', `/v1/rooms/${room}/messages`, {
    headers: { origin: ORIGIN_LOCAL, 'access-control-request-method': 'GET' },
  });
  expect(r.status === 204, `status ${r.status}`);
  expect(r.headers.get('access-control-allow-origin') === ORIGIN_LOCAL, 'acao not echoed');
});

await check('preflight from other origin returns 403', async () => {
  const r = await call('OPTIONS', `/v1/rooms/${room}/messages`, {
    headers: { origin: ORIGIN_BAD, 'access-control-request-method': 'POST' },
  });
  expectError(r, 403, 'forbidden');
  expect(r.headers.get('access-control-allow-origin') === null, 'ACAO leaked to bad origin');
});

await check('GET from other origin returns 403', async () => {
  const r = await call('GET', '/v1/health', { headers: { origin: ORIGIN_BAD } });
  expectError(r, 403, 'forbidden');
});

// Routing and validation
await check('unknown route returns 404 JSON', async () => {
  const r = await call('GET', '/v1/nope');
  expectError(r, 404, 'not-found');
});

await check('bad room id returns 400', async () => {
  const r = await call('GET', '/v1/rooms/short/messages');
  expectError(r, 400, 'bad-room');
});

await check('post 3 messages returns seq and at', async () => {
  for (const s of samples) {
    const r = await postMessage(room, s);
    expect(r.status === 200, `status ${r.status}: ${r.text.slice(0, 120)}`);
    expect(Number.isInteger(r.json?.seq) && typeof r.json?.at === 'string', `body ${r.text.slice(0, 120)}`);
    seqs.push(r.json.seq);
  }
  expect(seqs[0] < seqs[1] && seqs[1] < seqs[2], `seqs not ascending: ${seqs.join(',')}`);
  return `seqs ${seqs.join(',')}`;
});

await check('invalid message (iv wrong length) returns 400', async () => {
  const r = await postMessage(room, { from: 'pseudoA', ct: b64url(16), iv: b64url(8) });
  expectError(r, 400, 'invalid-message');
});

await check('read with after=0 returns all 3 in order', async () => {
  const r = await call('GET', `/v1/rooms/${room}/messages?after=0`);
  expect(r.status === 200, `status ${r.status}`);
  const msgs = r.json?.messages ?? [];
  expect(msgs.length === 3, `got ${msgs.length} messages`);
  msgs.forEach((m, i) => {
    expect(m.seq === seqs[i], `seq ${m.seq} at index ${i}`);
    expect(m.from === samples[i].from && m.ct === samples[i].ct && m.iv === samples[i].iv, `payload mismatch at ${i}`);
    expect(typeof m.at === 'string', 'missing at');
  });
  expect(r.json.last === seqs[2], `last ${r.json.last}`);
  return 'contents match';
});

await check('read with after=seq1 returns the last 2', async () => {
  const r = await call('GET', `/v1/rooms/${room}/messages?after=${seqs[0]}`);
  expect(r.status === 200, `status ${r.status}`);
  const got = (r.json?.messages ?? []).map((m) => m.seq);
  expect(got.length === 2 && got[0] === seqs[1] && got[1] === seqs[2], `seqs ${got.join(',')}`);
  expect(r.json.last === seqs[2], `last ${r.json.last}`);
});

await check('read past the end returns empty list with last = after', async () => {
  const r = await call('GET', `/v1/rooms/${room}/messages?after=${seqs[2]}`);
  expect(r.status === 200 && r.json.messages.length === 0, `body ${r.text.slice(0, 120)}`);
  expect(r.json.last === seqs[2], `last ${r.json.last}`);
});

await check('bad after parameter returns 400', async () => {
  const r = await call('GET', `/v1/rooms/${room}/messages?after=-1`);
  expectError(r, 400, 'bad-after');
});

await check('oversized message body rejected with 413', async () => {
  const body = JSON.stringify({ from: 'pseudoA', ct: 'A'.repeat(65536), iv: b64url(12), pad: 'x'.repeat(20 * 1024) });
  expect(Buffer.byteLength(body) > 80 * 1024, 'test body is not over 80 KB');
  const r = await postMessage(room, body);
  expectError(r, 413, 'too-large');
});

await check('ct longer than 65536 chars returns 400', async () => {
  const r = await postMessage(room, { from: 'pseudoA', ct: 'A'.repeat(65537), iv: b64url(12) });
  expectError(r, 400, 'invalid-message');
});

// Delete
await check('DELETE empties the room', async () => {
  const r = await call('DELETE', `/v1/rooms/${room}`);
  expect(r.status === 200 && r.json?.ok === true, `body ${r.text.slice(0, 120)}`);
  const after = await call('GET', `/v1/rooms/${room}/messages?after=0`);
  expect(after.json?.messages?.length === 0, `still ${after.json?.messages?.length} messages`);
});

await check('room stays closed after DELETE, and says so', async () => {
  const r = await postMessage(room, samples[0]);
  expect(r.status === 410 && r.json?.error === 'closed', `status ${r.status}: ${r.text.slice(0, 120)}`);
  const after = await call('GET', `/v1/rooms/${room}/messages?after=0`);
  expect(after.json?.closed === true && after.json?.messages?.length === 0, `body ${after.text.slice(0, 120)}`);
});

await check('explain with oversized body rejected with 413', async () => {
  const body = JSON.stringify({ messages: [{ role: 'user', content: 'x'.repeat(25 * 1024) }] });
  expect(Buffer.byteLength(body) > 24 * 1024, 'test body is not over 24 KB');
  const r = await call('POST', '/v1/explain', {
    headers: { 'content-type': 'application/json' },
    body,
  });
  expectError(r, 413, 'too-large');
});

await check('explain with 7 messages returns 400', async () => {
  const messages = Array.from({ length: 7 }, () => ({ role: 'user', content: 'hi' }));
  const r = await call('POST', '/v1/explain', {
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ messages }),
  });
  expectError(r, 400, 'invalid-explain');
});

if (useAi) {
  await check('explain returns content and model (--ai)', async () => {
    const r = await call('POST', '/v1/explain', {
      headers: { 'content-type': 'application/json', origin: ORIGIN_OK },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: 'Explain in one short sentence.' },
          { role: 'user', content: 'Fact card: marker X is present; no names.' },
        ],
        max_tokens: 64,
      }),
    });
    expect(r.status === 200, `status ${r.status}: ${r.text.slice(0, 160)}`);
    expect(typeof r.json?.content === 'string' && r.json.content.length > 0, 'empty content');
    expect(typeof r.json?.model === 'string', 'missing model');
    return `model ${r.json.model}`;
  });
} else {
  console.log('SKIP  explain model call (pass --ai to run it)');
}

console.log('');
if (firstFailure && firstFailure.name === 'health returns ok JSON with security headers' && /fetch/i.test(firstFailure.msg)) {
  console.log(`Could not reach ${BASE}. Start the relay first: npx wrangler dev --port 8787`);
}
console.log(`Summary: ${passed} passed, ${failed} failed, ${passed + failed} total`);
process.exitCode = failed === 0 ? 0 : 1;
