# Silah · صلة

**A private companion for inherited disease risk in Abu Dhabi, from the couple check to counselling, birth and family.**

Future Health Digital Innovation Challenge · Fertility · Challenge 03, *Understanding and Reducing Inherited Disease Risk*.

**[Live demo](https://marc-dvci.github.io/Silah/demo/)** · [Product page](https://marc-dvci.github.io/Silah/) ([العربية](https://marc-dvci.github.io/Silah/ar.html)) · [Film, 2:48](https://marc-dvci.github.io/Silah/#film) · [Deck (PDF)](https://marc-dvci.github.io/Silah/assets/silah-deck.pdf) · [Assumptions and limitations](docs/ASSUMPTIONS_AND_LIMITATIONS.md) · [Responsible AI, clause by clause](docs/RESPONSIBLE_AI.md)

The demo runs in the browser with a fictional family: on a desktop it shows a phone and the health-system side together, with a thirteen-step guided story. **Use your own result** (the green chip on the stage, or `#/p/me`) reads a premarital genetic report you bring, as a PDF, an HL7 FHIR file or typed in, on the device; fictional sample reports are one tap away.

Silah serves three moments where knowing a genetic risk can still change an outcome:

1. **Before the next pregnancy.** Couples who married before genetic testing joined premarital screening are invited, by non-genetic signals only, to a couple check run on genomes the Emirati Genome Programme already holds. Both partners must consent.
2. **At birth.** For conditions where days matter (SMA, Krabbe, MLD, Pompe, MPS I), an at-risk couple can choose a birth plan: the delivery hospital tests the baby in the first days. It is offered only where the condition has an early-treatment pathway. This works whatever the couple decided before, so it serves the couples who marry and conceive naturally. It complements DoH's newborn genome screening, which reports within 21 days where it is offered: when the parents' shared change is already known, a targeted test of that one change can answer in the first days, at any delivery hospital.
3. **In the family.** A carrier can invite relatives to test with blind-signed invitations. The clinic can verify each invitation but cannot tell who sent it.

Between those moments, Silah explains the result in Arabic or English, including what is still uncertain, checks understanding, answers questions, never steers a decision, and hands the couple to a genetic counsellor who already has a brief.

## What the 3 November review asked for, and what answers it

| Ask | What Silah does now | Where |
|---|---|---|
| Interactive report uploads, not scripted data | **Use your own result**: a PDF report (read on the phone with pdf.js: gene on the DoH panel, HGVS change, classification, couple section, detection), an HL7 FHIR genomics file, a Silah result file, or typed entry. The person confirms every line before anything is computed; the file never leaves the device; the result is labelled "entered by you" everywhere, and only a lab-signed file counts as verified. Three fictional sample reports to try | `src/core/import/`, `src/core/fhir.ts`, `src/ui/person/import.tsx`, `public/samples/` |
| AI plain-language explanations of results and uncertainties | **Explain in plain words**: Gemma 4 writes the explanation of the person's own result and of what is uncertain (detection, the range it gives, assumed frequencies, the reading of the report), and a paragraph for the clinician. Every sentence is shown only if the verifier passes it on the phone; the fixed text it was checked against is one tap away. 169 of 169 Gemma 4 E4B sentences passed on 27 explanations ([`eval/EXPLAIN.md`](eval/EXPLAIN.md)). The model runs on the device, on the computer, or (opt-in, names removed) on Silah's explanation service | `src/llm/explain.ts`, `src/core/uncertainty.ts`, `src/ui/person/explain.tsx` |
| Live partner sharing | Partners pair their phones by QR code or link; each shares chosen findings, live, end-to-end encrypted through a small relay that stores ciphertext only; either can stop at any time | `src/core/crypto/pairing.ts`, `src/ui/person/partner.tsx`, `relay/` |
| Physician summary generation | One page from the phone: result and source, couple result and chances, uncertainties, understanding check, questions, sharing, appointment, and an optional checked AI paragraph. Prints to A4, exports as an HL7 FHIR document, or goes to the clinic with a revocable receipt | `src/app/summary.ts`, `src/ui/summary.tsx`, `exportSummaryFhir` |
| Direct counselling booking | The person picks the place (the Appendix 13 sites, suggested in the order the standard gives for their result), format, language, the counsellor's sex and the time; urgent cases see held slots; the clinic confirms, the phone adds it to the calendar, and the time can be sent to the partner's phone | `src/core/booking.ts`, `src/ui/person/book.tsx`, clinic Appointments |

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5173  (desktop: phone + clinic side by side)
npm test             # unit tests: kernel, verifier, routes, crypto, population, panel
npm run build        # static PWA in dist/, works offline after the first visit
```

End-to-end checks drive the real UI headless (Python Playwright):

```bash
python tests/e2e/flow.py      # the whole demo story, 30 assertions
python tests/e2e/own.py http://localhost:5173/   # own result: PDF upload, explanation, booking, summary, pairing (30 checks; pairing needs the relay below)
python tests/e2e/stage.py     # the guided ten-step story on the desktop stage
python tests/e2e/a11y.py      # axe-core WCAG 2.2 AA on 18 screens, both languages
python tests/e2e/webgpu.py    # Gemma 4 E2B inside the browser (WebGPU, ~3 GB download once)
python tests/e2e/offline.py   # the built app with the network off (needs `npx vite preview --port 4173`)
python tests/e2e/site.py      # the product page in both languages, as GitHub Pages serves it (after `npm run build`)
python eval/readability/score.py   # readability of the explanations vs the DoH information sheet (pip install textstat==0.7.13)
node eval/binding.mjs              # claim-binding mutation test over the saved model answers -> eval/BINDING.md
node eval/sensitivity.mjs          # how the numbers move with detection and the assumed frequency -> docs/SENSITIVITY.md
node eval/explain.mjs <label> "<model>"   # plain-language explanations through the verifier -> eval/EXPLAIN.md (llama-server on :8080)
cd relay && npx wrangler dev --port 8787   # the relay for paired phones and the explanation service, locally
```

Everything except pairing runs on one machine at no cost, with no API key. The optional language model runs on the same computer (llama.cpp), inside the browser (WebGPU), or, if the person chooses it, on the explanation service. Pairing uses the relay in `relay/` (a Cloudflare Worker on the free plan; its address is set in `src/app/relay-url.json`).

## Product page

`site/` holds the bilingual product page (`index.html`, `ar.html`) published at https://marc-dvci.github.io/Silah/, with the app under `/demo/`. `python site/build/build_assets.py` rebuilds its fonts, screenshots, film and QR codes; `python site/build/capture_ar.py` recaptures the Arabic phone screens from the running app.

## How it is built

```
 Person's phone (PWA, offline)                          Health-system side (simulated in the demo)
 ┌──────────────────────────────────────────┐   signed   ┌────────────────────────────────────┐
 │ Vault: AES-GCM, key kept by the browser  │◀──bundle───│ Genomics lab / EGP couple check     │
 │ Kernel: exact fractions → fact cards     │            │  (Ed25519 signatures)               │
 │ Explain: fixed text + narration (AR, EN) │──consent──▶│ Counselling queue + pre-visit brief │
 │ Teach-back, options, birth plan          │──brief────▶│ Pathway tracker, DoH referral KPI   │
 │ Ask: routes → FAQ → model picks cards    │──plan─────▶│ Delivery hospital: birth plans      │
 │ Receipts: signed, hash-chained, revocable│──blinded──▶│ Invitation service (RFC 9474)       │
 └──────────────────────────────────────────┘            └────────────────────────────────────┘
```

| Part | Where | What it guarantees |
|---|---|---|
| Risk kernel | `src/core/kernel.ts`, `fraction.ts` | Every number is an exact fraction with its arithmetic and sources; tested against a hand-calculated grid. For related partners it counts a change inherited from a shared ancestor; across genes it gives the chance of at least one condition; it uses the detection the lab states in the signed result, and gives ranges when the result does not state it |
| Gene panel | `src/core/data/panel.ts` | The 563 genes of the DoH premarital panel (Standard V3, Appendix 12: 570 printed names, 5 repeated and 2 older names of listed genes), mapped to current HGNC symbols |
| Answers and explanations | `src/llm/answer.ts`, `src/llm/explain.ts`, `src/core/verifier.ts` | The model writes; the phone shows a sentence only if the verifier passes it, with the cited cards one tap away. If none passes, the person reads the cited cards in their own words, and an option is never shown alone. The verifier scores the model's own wording in the evaluation: a sentence passes only if it cites a fact card, uses only that card's numbers, gives each chance the value the card states for that outcome and that person, does not steer, and states no certainty about a child |
| Hard routes | `src/core/routes.ts` | Distress, termination, religious rulings, other people's results and blame go to a person, before any model. The phone says a request was received, or seen by a counsellor, only when the clinic confirms it |
| Receipts | `src/core/crypto/receipts.ts` | Every consent and share is signed on the device, hash-chained, and revocable |
| Invitations | `src/core/crypto/invites.ts` | RSA blind signatures (RFC 9474): issuance and redemption logs cannot be linked |
| Population simulator | `src/core/population.ts` | Compares outreach strategies on a synthetic consanguineous population |

Privacy rule, enforced in code and checked end to end: **each partner learns only the genes they both carry**. A partner's other findings stay on that partner's phone unless they choose to share them. The clinic sees only the shared genes and what the couple chose to send.

## Honest limits

- The family, their genomes and all clinic data are fictional. No real person's data is used.
- The health-system side is simulated in the browser. In a deployment it would be DoH, M42 and SEHA services; the messages are already self-contained and signed.
- Arabic text is Modern Standard Arabic written for this prototype, using the DoH booklet's wording where possible, with masculine and feminine forms for the reader.
- Every chance is model-derived: exact arithmetic on stated inputs. Carrier frequencies are published Emirati figures for seven genes; the rest use 1 in 1,000, the most cautious value consistent with the published added chance for first cousins. Detection rates come from the lab in the signed result; the demo's simulated lab states example values (90% per gene, 99% for a check of the exact family change), and a result without them gets ranges. Family history is not in the numbers, and every result says so.
- See `docs/` for sources, the threat model, evaluation results and the full list of assumptions.

## Licence

Apache License 2.0, see `LICENSE`. Third-party components keep their own licences (`docs/DATA_AND_RIGHTS.md`).
