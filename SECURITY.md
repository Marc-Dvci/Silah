# Security

Please report a vulnerability through
[GitHub's private reporting](https://github.com/Marc-Dvci/Silah/security/advisories/new), not in a public issue. The
supported version is the `main` branch, the [live demo](https://marc-dvci.github.io/Silah/demo/) and the relay at
`https://silah-relay.pages.dev`.

The reports that matter most are anything that:

- lets the relay, or anyone on the path, read a message between paired phones;
- links a family invitation to the person who sent it;
- shows a partner or the clinic a finding the person did not choose to share;
- gets a sentence past the verifier with a number that is not on its fact card, or a certainty about a child;
- makes a phone accept a forged signed result, or show an entered result as lab-signed;
- sends a name, or anything beyond the de-identified cards, to the explanation service.

The demo uses fictional people and fictional results. Please leave real genetic results out of any report.
