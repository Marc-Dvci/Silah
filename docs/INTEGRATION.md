# Integration: how a lab, a clinic and a hospital connect to Silah

Silah needs three things from the health system, all of them small and all of them already close to what the premarital programme does.

## 1. A signed result bundle per person

Schema: `schema/result-bundle.schema.json` (JSON Schema 2020-12). `tests/schema.test.ts` checks that every bundle the simulated lab issues validates, and that a bundle carrying the partner's findings is rejected.

- **One bundle per person**, not per couple. It holds that person's own findings and a `couple` section with only:
  - the genes both partners carry (`shared`),
  - this person's own carrier genes for which the partner tested negative (`partnerNegativeFor`),
  - genes with a variant of uncertain significance that matters for the couple (`vusGenes`).
- **Signature:** Ed25519 (RFC 8032) over the UTF-8 bytes of the canonical JSON of `payload`, with keys sorted recursively and no whitespace. `keyId` is the first 16 hex characters of SHA-256 of the lab's public key. Code: `src/core/crypto/sign.ts`.
- **Delivery:** alongside the existing digital premarital certificate, as a file, a QR code or a download link inside the TAMM or Sahatna apps. The phone verifies the signature against the lab keys it trusts before showing anything.
- **Gene symbols:** current HGNC symbols, restricted to the DoH panel (`src/core/data/panel.ts`, mapped from Appendix 12 of the Premarital Screening Standard V3).
- **Versioning:** `v: 1`. A new panel version changes `panelVersion`, not the format.

## 2. Messages the phone sends, each with the person's consent

| Message | To | Contains | Consent record |
|---|---|---|---|
| `consent.couple-check` | Genomics service | Couple id, person id | Signed receipt on the phone; withdrawable (`consent.withdraw`) |
| `brief.packet` | Counselling clinic | Teach-back score and missed points, questions asked, sharing choices, language | Signed receipt; `brief.revoke` deletes it at the clinic |
| `birthplan.notify` | Delivery hospital | Shared genes, condition, due date | Signed receipt; expires six weeks after the due date; `birthplan.revoke` |
| `booking` | Counselling clinic | Couple id, person id | — |
| `escalate` | Counselling clinic | The safety route that fired (for example distress); never the message text | — |
| `invite.request` | Invitation service | Blinded values and a pseudonym used only for the per-person cap | Signed receipt |

Message definitions: `src/app/net.ts`. In the prototype they travel inside the browser; in a deployment each is a single HTTPS call to a UAE-hosted service, or a QR code where there is no connection.

## 3. Anonymous family invitations

- **Scheme:** RSA blind signatures, RFC 9474, variant RSABSSA-SHA384-PSS-Randomized (`@cloudflare/blindrsa-ts`).
- **Token:** `base64url(prepared message) . base64url(signature)`. The message is 32 random bytes, prepared (64 bytes in total).
- **Redemption:** the service verifies the signature and keeps a spent set keyed on SHA-256 of the prepared message. A token can be used once.
- **Unlinkability:** the issuance log holds blinded values only. `linkable()` in `src/core/crypto/invites.ts` checks that no redemption can be matched to an issuance; a test includes a positive control.

## What the services return to the phone

`pathway.update` carries the next step (counselling booked with a time slot, referred, closed) and, from maternity, the newborn result: affected or not affected only. A child's carrier status is not tested or reported.
