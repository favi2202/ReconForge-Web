# Security policy

ReconForge Web is a defensive passive-reconnaissance planner and analyst workspace. We welcome careful, good-faith reports that help keep its users, provider credentials, and connected services safe.

## Supported versions

Until the project publishes a stable release line, security fixes are applied to the latest code on the default branch. After releases begin, this table must be updated for every release-policy change:

| Version        | Supported                       |
| -------------- | ------------------------------- |
| Latest release | Yes                             |
| Default branch | Best effort; may be unstable    |
| Older releases | No, unless explicitly announced |

## Reporting a vulnerability

Do not open a public issue for a suspected vulnerability. Use GitHub's private vulnerability-reporting feature on this repository (**Security → Advisories → Report a vulnerability**). If that feature is unavailable, contact the repository owner, `favi2202`, through a private GitHub channel and ask for a secure reporting address without including exploit details in the initial public message.

Include, when possible:

- the affected version, commit, deployment mode, and component;
- a concise impact statement and prerequisites;
- reproducible steps using `example.com`, synthetic data, mocked providers, or a local test service;
- relevant request/response shapes with every credential and real target removed;
- a minimal proof of concept, suggested mitigation, and whether disclosure has occurred elsewhere.

Never include live API keys, access tokens, private findings, personal data, or third-party target data. Encrypt sensitive follow-up material using a key agreed through the private report channel.

## Our response

Maintainers aim to acknowledge a report within 5 business days, provide an initial assessment within 10 business days, and coordinate remediation and disclosure based on severity and exploitability. These are goals, not a guarantee. We will keep the reporter informed when practical, credit them if requested, and publish an advisory for material vulnerabilities after users have a reasonable opportunity to update.

Please allow time for a fix before public disclosure. If a report affects an upstream provider or dependency, we may coordinate with that maintainer and will avoid sharing more data than necessary.

## Safe-harbor expectations

Good-faith research should:

- test only your own local deployment, accounts, credentials, synthetic fixtures, and mocked providers;
- minimize access and stop as soon as a vulnerability is demonstrated;
- avoid privacy violations, persistence, lateral movement, social engineering, denial of service, quota exhaustion, automated high-volume traffic, and degradation of third-party services;
- never retrieve credentials, sensitive databases, or unrelated user data;
- avoid testing the public planner or any connected deployment without the operator's explicit permission;
- report promptly, keep details confidential during remediation, and securely delete accidentally obtained data.

When these expectations are followed, the maintainers will treat the research as authorized for this project and will not pursue action merely for bypassing a project control to demonstrate a vulnerability. This statement cannot authorize activity against search providers, hosting platforms, third parties, or systems the maintainers do not own, and it does not waive their terms or applicable law.

## Out of scope

The following usually do not qualify unless they create a concrete security impact:

- provider data that is stale, inaccurate, or publicly indexed;
- reports that a discovered page might be vulnerable without validation against the application itself;
- missing security headers on a non-production local development server;
- self-XSS requiring the same user to paste code into developer tools;
- denial-of-service demonstrations, high-volume quota consumption, brute force, CAPTCHA bypass, or real-target scanning;
- vulnerabilities solely in unsupported dependencies or versions without a demonstrated reachable impact;
- exposure of a reporter's own deliberately published test token;
- social engineering, physical attacks, and attacks on GitHub or an upstream provider rather than ReconForge Web.

## Operational security guidance

- Public planner mode must contain no provider credential or owner access token. Browser JavaScript cannot keep a secret.
- Leave connected mode disabled unless an operator deliberately configures it. Use a unique high-entropy access token, HTTPS, an exact CORS allowlist, strict quotas, and provider keys limited at the provider whenever possible.
- Never place secrets in `.env.example`, version control, build arguments, client-prefixed environment variables, URLs, screenshots, reports, issue attachments, or CI logs. Rotate any value that may have been exposed; redaction after exposure is not sufficient.
- Treat project files and reports as sensitive. Review exports before sharing and use an isolated browser profile for sensitive investigations.
- Keep dependencies and the Public Suffix List current. Use the lockfile, review update diffs, and run the project's security verification gates before releases.

The detailed architecture risks and required controls are documented in [`docs/threat-model.md`](docs/threat-model.md). The permitted-use policy is in [`ETHICAL_USE.md`](ETHICAL_USE.md).
