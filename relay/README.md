# Silah relay

A Cloudflare Worker that passes end-to-end encrypted messages between two paired phones, plus an opt-in explain endpoint. Source: `src/index.ts`. Config: `wrangler.toml`.

## What it stores

Per room, in a Durable Object (SQLite storage):

- `ct` and `iv`: the ciphertext and IV the phone produced.
- `from`: a sender pseudonym chosen by the client (base64url, 1-64 characters).
- `at`: the server time the message was accepted.

Rooms are deleted after 30 days (a Durable Object alarm), or at once when either partner calls `DELETE /v1/rooms/:room`.

## What it never sees

- The room key. The AES-GCM key is in the link fragment, which browsers do not send to the server.
- Plaintext messages.
- Request bodies. The Worker does not log them, and request logs are off in `wrangler.toml`.

## Explain endpoint

`POST /v1/explain` takes de-identified fact cards as chat messages (no names) and returns the model's text from Workers AI. Nothing is stored. The phone is meant to check every sentence of the output against the fact cards itself.

## Endpoints

| Method | Path | Result |
| --- | --- | --- |
| GET | `/v1/health` | `{ ok: true, service: 'silah-relay', v: 1 }` |
| POST | `/v1/rooms/:room/messages` | body `{ from, ct, iv }` -> `{ seq, at }` |
| GET | `/v1/rooms/:room/messages?after=N` | `{ messages: [{ seq, from, ct, iv, at }], last }` |
| DELETE | `/v1/rooms/:room` | `{ ok: true }`, deletes the room |
| POST | `/v1/explain` | body `{ messages, max_tokens? }` -> `{ content, model }` |

Errors are JSON `{ "error": "<code>" }`. Requests with an `Origin` header are accepted only from `ALLOWED_ORIGINS`; others get 403.

## Limits

- Room id: 22-64 characters from `[A-Za-z0-9_-]`.
- Message: `from` 1-64 characters, `ct` 1-65536 characters, `iv` exactly 16 characters, body at most 80 KB.
- Per room: 500 messages (429 `room-full`), 60 posts per rolling minute (429 `rate`). The minute counter is in memory.
- Reads return at most 200 messages per call. `last` is the seq of the last message returned, or `after` when none. Read again while a page is full.
- Explain: body at most 24 KB, at most 6 messages, `max_tokens` clamped to 64-900 (default 700), temperature 0.2. Limit of 20 requests per 10 minutes per client IP, kept in memory per isolate, so it is best effort.

## Run locally

```
npm install
npx wrangler dev --port 8787
node test/smoke.mjs            # add --ai to also call the model
```

The Workers AI binding always runs against Cloudflare's remote service, even in `wrangler dev`, and wrangler warns that it may incur usage charges. For that reason the smoke test does not call the model unless `--ai` is passed. The room and CORS checks run fully locally.

## Deploy

```
npx wrangler login
npx wrangler deploy
```

## Free-plan limits

This design relies on three free allowances: Workers requests per day, Durable Objects with SQLite storage, and Workers AI daily neurons (used only by `/v1/explain`). The numbers change, so check the current Cloudflare pricing page before relying on them.
