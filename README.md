# Silah · صلة

**A private companion for inherited disease risk in Abu Dhabi, from the couple check to counselling, birth and family.**

Future Health Digital Innovation Challenge · Fertility · Challenge 03, *Understanding and Reducing Inherited Disease Risk*.

**[Live demo](https://marc-dvci.github.io/Silah/demo/)** · [Product page](https://marc-dvci.github.io/Silah/) ([العربية](https://marc-dvci.github.io/Silah/ar.html)) · [Film, 2:23](https://marc-dvci.github.io/Silah/#film) · [Deck (PDF)](https://marc-dvci.github.io/Silah/assets/silah-deck.pdf) · [Assumptions and limitations](docs/ASSUMPTIONS_AND_LIMITATIONS.md)

The demo runs in the browser with a fictional family: on a desktop it shows a phone and the health-system side together, with a ten-step guided story.

Silah serves three moments where knowing a genetic risk can still change an outcome:

1. **Before the next pregnancy.** Couples who married before genetic testing joined premarital screening are invited, by non-genetic signals only, to a couple check run on genomes the Emirati Genome Programme already holds. Both partners must consent.
2. **At birth.** For conditions where days matter (SMA, Krabbe, MLD, Pompe, MPS I), an at-risk couple can choose a birth plan: the delivery hospital tests the baby in the first days. This works whatever the couple decided before, so it serves the couples who marry and conceive naturally. It complements DoH's newborn genome screening, which reports within 21 days where it is offered: when the parents' shared change is already known, a targeted test of that one change can answer in the first days, at any delivery hospital.
3. **In the family.** A carrier can invite relatives to test with blind-signed invitations. The clinic can verify each invitation but cannot tell who sent it.

Between those moments, Silah explains the result in Arabic or English, checks understanding, answers questions only from checked facts, never steers a decision, and hands the couple to a genetic counsellor who already has a brief.

## Run it

```bash
npm install
npm run dev          # http://127.0.0.1:5173  (desktop: phone + clinic side by side)
npm test             # unit tests: kernel, verifier, routes, crypto, population, panel
npm run build        # static PWA in dist/, works offline after the first visit
```

End-to-end checks drive the real UI headless (Python Playwright):

```bash
python tests/e2e/flow.py      # the whole demo story, 23 assertions
python tests/e2e/stage.py     # the guided ten-step story on the desktop stage
python tests/e2e/a11y.py      # axe-core WCAG 2.2 AA on 18 screens, both languages
python tests/e2e/webgpu.py    # Gemma 4 E2B inside the browser (WebGPU, ~3 GB download once)
python tests/e2e/offline.py   # the built app with the network off (needs `npx vite preview --port 4173`)
python tests/e2e/site.py      # the product page in both languages, as GitHub Pages serves it (after `npm run build`)
python eval/readability/score.py   # readability of the explanations vs the DoH information sheet (pip install textstat==0.7.13)
```

Everything runs on one machine at no cost: no server, no cloud, no API key. The optional language model runs either on the same computer (llama.cpp) or inside the browser (WebGPU).

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
 │ Ask: FAQ → hard routes → model → verifier│──plan─────▶│ Delivery hospital: birth plans      │
 │ Receipts: signed, hash-chained, revocable│──blinded──▶│ Invitation service (RFC 9474)       │
 └──────────────────────────────────────────┘            └────────────────────────────────────┘
```

| Part | Where | What it guarantees |
|---|---|---|
| Risk kernel | `src/core/kernel.ts`, `fraction.ts` | Every number is an exact fraction with its arithmetic and sources; tested against a hand-calculated grid |
| Gene panel | `src/core/data/panel.ts` | The 563 genes of the DoH premarital panel (Standard V3, Appendix 12), mapped to current HGNC symbols |
| Verifier | `src/core/verifier.ts` | A model sentence is shown only if it cites a fact card, uses only that card's numbers, does not steer a marriage or pregnancy decision, and states no certainty about a child |
| Hard routes | `src/core/routes.ts` | Distress, termination, religious rulings, other people's results and blame go to a person, before any model |
| Receipts | `src/core/crypto/receipts.ts` | Every consent and share is signed on the device, hash-chained, and revocable |
| Invitations | `src/core/crypto/invites.ts` | RSA blind signatures (RFC 9474): issuance and redemption logs cannot be linked |
| Population simulator | `src/core/population.ts` | Compares outreach strategies on a synthetic consanguineous population |

Privacy rule, enforced in code and checked end to end: **each partner learns only the genes they both carry**. A partner's other findings stay on that partner's phone unless they choose to share them. The clinic sees only the shared genes and what the couple chose to send.

## Honest limits

- The family, their genomes and all clinic data are fictional. No real person's data is used.
- The health-system side is simulated in the browser. In a deployment it would be DoH, M42 and SEHA services; the messages are already self-contained and signed.
- Arabic text is Modern Standard Arabic written for this prototype, using the DoH booklet's wording where possible, with masculine and feminine forms for the reader.
- Carrier frequencies are published Emirati figures for seven genes; the rest use a stated 1 in 200 assumption. Detection rates for the DoH panel are not published; Silah assumes 90% per gene and 99% for a known family variant and shows this next to every number that uses it.
- See `docs/` for sources, the threat model, evaluation results and the full list of assumptions.

## Licence

Apache License 2.0, see `LICENSE`. Third-party components keep their own licences (`docs/DATA_AND_RIGHTS.md`).
