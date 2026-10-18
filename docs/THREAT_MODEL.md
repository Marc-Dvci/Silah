# Threat model

## What is protected

1. **A person's own carrier findings.** Genes they carry that their partner does not.
2. **Who in a family is a carrier**, and who sent an invitation to test.
3. **Consent**: what was shared, with whom, for how long, and that it can be withdrawn.
4. **What a person said in Silah**: their teach-back answers and their questions.

## Who it is protected from

| Party | What Silah prevents | How |
|---|---|---|
| **The partner** | Learning the other partner's findings beyond the genes they both carry | The lab issues each partner a couple section with the shared genes only, plus "your partner tested negative" for that person's own carrier genes. Anything else moves only if its owner shares it, with a signed receipt. |
| **Relatives** | Learning who in the family carries a variant | Invitations name no sender. Adding the gene name is off by default, and the toggle says that it makes the sender easier to guess. |
| **The invitation service** | Linking a redeemed invitation to the person who requested it | RSA blind signatures (RFC 9474). The service signs blinded values; redemption shows a different, unblinded value. A per-requester cap uses a pseudonym that never appears on a token. |
| **The counselling clinic** | Seeing more than the couple chose to send | The clinic receives the shared genes from the lab and a summary only if the person shares it. Revoking the share is one tap. |
| **The delivery hospital** | Learning about other genes or later pregnancies | A birth plan names the shared genes for this pregnancy only and expires six weeks after the due date. |
| **Someone else holding the phone** | Reading results at a glance | Data is encrypted at rest; "hide screen" shows a blank page with one tap. |
| **A forged or altered result** | Being shown as genuine | Results are Ed25519-signed by the lab and verified on the phone before anything is displayed. |
| **A tampered consent history** | Going unnoticed | Receipts are signed and hash-chained; any edit breaks the chain and the app says so. |

## What is not protected, stated plainly

- **The lab and the signing physician see everything.** That is how the premarital programme works under the DoH standard. Silah protects people from each other and from services that do not need their full result, not from the lab.
- **Browser storage is not a hardware keystore.** The vault key is a non-extractable WebCrypto key. A native build would use the Android Keystore.
- **Timing and small families.** If a family is small and an invitation arrives right after a known event, people can guess the sender. The cryptography hides the sender from the clinic, not from family logic.
- **The demo runs every party in one browser**, so messages pass through shared browser storage. In a deployment each party is a separate device or service; every message is already self-contained and signed, or blinded.
- **Truncation.** A hash chain shows edits, not a deleted tail of entries. A deployment would anchor the latest receipt hash with the clinic.

## Data rules

- No genetic data is used to choose who is invited to a couple check. Ranking uses declared relationship, a known affected relative and pregnancy plans only.
- Health data stays in the UAE: on the person's phone, or with UAE-hosted health services (Federal Law No. 2 of 2019, Article 13, as summarised by Latham & Watkins; the official text was not reachable for this project).
- Aggregates reported to DoH suppress counts under 5.
