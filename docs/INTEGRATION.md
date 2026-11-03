# Integration: how a lab, a clinic and a hospital connect to Silah

Silah needs three things from the health system, all of them small and all of them already close to what the premarital programme does.

## 1. A signed result bundle per person

Schema: `schema/result-bundle.schema.json` (JSON Schema 2020-12). `tests/schema.test.ts` checks that every bundle the simulated lab issues validates, and that a bundle carrying the partner's findings is rejected.

- **One bundle per person**, not per couple. It holds that person's own findings and a `couple` section with only:
  - the genes both partners carry (`shared`),
  - this person's own carrier genes for which the partner tested negative (`partnerNegativeFor`),
  - genes with a variant of uncertain significance that matters for the couple (`vusGenes`),
  - what the lab states about its own tests (`detection`): the share of each gene's disease-causing changes the panel detects, from its validation, and, for each gene in `partnerNegativeFor`, whether the partner's sample was checked for this person's exact change, with that check's sensitivity. Without `detection`, the phone gives every remaining chance as a range (99% to 80% detection), never one figure; a gene missing from `exactChange` is treated as covered by the panel only.
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
| `booking` | Counselling clinic | Couple id, person id; for a direct booking the chosen slot (place, counsellor, start), format, language, whether a summary came with it and whether the slot was one held for urgent cases | — (the person can cancel: `booking.cancel`) |
| `summary.packet` | Counselling clinic | The physician summary (below) | Signed receipt; `summary.revoke` deletes it at the clinic |
| `escalate` | Counselling clinic | The safety route that fired (for example distress) and a reference; never the message text | — |
| `invite.request` | Invitation service | Blinded values and a pseudonym used only for the per-person cap | Signed receipt |

Message definitions: `src/app/net.ts`. In the prototype they travel inside the browser; in a deployment each is a single HTTPS call to a UAE-hosted service, or a QR code where there is no connection.

For a result the person brought (no lab case exists), each of these messages also carries `own`: the names the person entered, the couple status, the shared genes and their conditions, flags (pregnant, wedding soon, specialist first) and how the result was entered. The clinic opens a self-referred case from it and marks the result as entered by the person.

## 3. Results the person brings

The phone reads, on the device and without uploading the file:

- **PDF reports** with selectable text (pdf.js): a line counts as a finding when it has a gene symbol on the DoH panel, an HGVS c. change and a classification word, in English or Arabic. The couple section, the relationship and the detection rates are read from their own lines. `src/core/import/extract.ts`, tested on the fictional samples in `public/samples/` ([`SAMPLE_REPORTS.md`](SAMPLE_REPORTS.md)).
- **HL7 FHIR R4 genomics files**: variant Observations (LOINC 69548-6) with gene studied (48018-6), DNA change (48004-6), amino-acid change (48005-3), allelic state (53034-5) and clinical significance (53037-8). FHIR has no standard couple-carrier resource, so the couple section is a Silah-coded Observation (`couple-analysis`, system `https://marc-dvci.github.io/Silah/fhir/CodeSystem/silah`). `src/core/fhir.ts`.
- **Silah result files**, signed or not. A signed one is verified against the lab keys the phone trusts.

Nothing is computed until the person confirms every line. The bundle the phone builds has the same shape as a lab's (`bundleFromImport` in `src/app/person.ts`), unsigned (`keyId: "self"`), so the kernel and everything after it work unchanged.

## 4. The physician summary

One page, built on the phone from the result and what the person did in Silah (`buildSummary` in `src/app/summary.ts`): source and whether it was verified, couple result, shared genes with the chances per pregnancy, the person's own findings, the remaining chance with the detection used, variants of uncertain significance, flags, the understanding check, the questions asked, requests for a person, the birth plan, sharing consents, the appointment, an optional plain-language paragraph that passed the verifier, and sources. It prints to A4 (`#/s/<person>`) and exports as an HL7 FHIR R4 `document` Bundle: a Composition (LOINC 11488-4) with a narrative per section, the Patient, a DiagnosticReport (51969-4), the variant Observations and Silah-coded Observations for the couple result and the chances (`exportSummaryFhir` in `src/core/fhir.ts`). That is the form a health information exchange such as Malaffi files; the connection itself is not built.

## 5. Booking

The places and the order Silah suggests them in come from Appendix 13 of the Premarital Screening Standard: the SEHA genetic counselling clinics (Corniche Hospital FMU, Corniche Fertility Centre, Al Bateen) for incompatible results, the clinical geneticists at SKMC and Tawam for findings a specialist should see first, and genetic counselling at SKMC, Tawam and SSMC otherwise (`sitesFor` in `src/core/booking.ts`). The person filters by format (in person, video, phone), language and the counsellor's sex, and picks a time. The first slot of each counsellor on the next three working days is held for urgent cases. The clinic confirms the slot or declines it if it was taken meanwhile; the phone offers an iCalendar file. In a deployment, `slotsFor` is replaced by the hospitals' scheduling systems; the messages stay the same.

## 6. Paired phones

Two partners pair by QR code or link (`#/pair/<room>.<key>`): a 128-bit room id and a 256-bit AES-GCM key, generated on the phone. The key is in the URL fragment, which browsers never send to a server. Each message is encrypted with a fresh IV and the room id as additional data, then posted to the relay (`relay/`), which stores ciphertext, the sender's random in-room id and the time. Messages: `hello` (first name), `share.finding` and `share.revoke` (each backed by a signed receipt on the sender's phone), `booking.shared`, `bye`. Either partner can end the link: the relay deletes every message and keeps only a "closed" marker, so the other phone stops too. Rooms are deleted after 30 days. Code: `src/core/crypto/pairing.ts`, `src/app/relay.ts`, `relay/src/index.ts`.

## 7. Anonymous family invitations

- **Scheme:** RSA blind signatures, RFC 9474, variant RSABSSA-SHA384-PSS-Randomized (`@cloudflare/blindrsa-ts`).
- **Token:** `base64url(prepared message) . base64url(signature)`. The message is 32 random bytes, prepared (64 bytes in total).
- **Redemption:** the service verifies the signature and keeps a spent set keyed on SHA-256 of the prepared message. A token can be used once.
- **Unlinkability:** the issuance log holds blinded values only. `linkable()` in `src/core/crypto/invites.ts` checks that no redemption can be matched to an issuance; a test includes a positive control.

## What the services return to the phone

`escalate.received` tells the phone the request reached the clinic's list; `escalate.seen` tells it a counsellor has marked it seen. The phone says no more than these two messages confirm: it never states that a person has been contacted. In the demo the clinic acknowledges receipt automatically, and a counsellor marks a request seen from the queue.

`pathway.update` carries the next step (counselling booked with a time slot, referred, closed) and, from maternity, the newborn result: affected or not affected only. A child's carrier status is not tested or reported.
