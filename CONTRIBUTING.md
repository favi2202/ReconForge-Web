# Contributing

Thank you for improving ReconForge Web. Contributions must preserve its passive, authorized-use boundary.

## Development

1. Fork and create a focused branch.
2. Install with `npm ci` on Node.js 24 LTS.
3. Use only `example.com`, synthetic fixtures, local test servers, and mocked provider responses.
4. Add tests for behavior changes.
5. Run formatting, lint, type checking, coverage, production builds, and relevant browser tests.

Do not add live third-party targets, API keys, result dumps, credential patterns, CAPTCHA bypass, proxy rotation, active scanning, arbitrary server fetches, or code/query corpora without a compatible license review.

## Pull requests

Explain the user outcome, security impact, tests executed, and any provider-term or licensing implications. Screenshots are required for visible UI changes. A change that alters scope breadth, query safety, authentication, quotas, imports, or exports should update the threat model.

## Template contributions

Follow [template-authoring.md](docs/template-authoring.md). Sensitive or guarded templates require a clear defensive purpose and must not retrieve files, extract credentials, or imply a discovered page is vulnerable.

## Security reports

Do not open a public issue for a vulnerability. Follow [SECURITY.md](SECURITY.md).
