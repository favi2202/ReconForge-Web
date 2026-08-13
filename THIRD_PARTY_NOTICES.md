# Third-party notices

ReconForge Web is MIT licensed. Its JavaScript distribution includes or depends on open-source packages whose licenses remain with their respective copyright holders.

The production planner bundle includes React, React DOM, React Router, Lucide React, `idb-keyval`, Zod, and `tldts`. The connected API additionally uses Fastify and official Fastify plugins. Development and verification use TypeScript, Vite, Vitest, Playwright, ESLint, Prettier, and related tooling.

The exact dependency versions and integrity hashes are recorded in `package-lock.json`. Corresponding license texts are distributed by npm inside each installed package and can be reviewed with:

```sh
npm ci --ignore-scripts
npm query ".license"
```

At the time of the v0.1.0 release review, dependency license metadata was limited to permissive or notice-style licenses including MIT, ISC, Apache-2.0, BSD variants, BlueOak-1.0.0, MPL-2.0, Python-2.0, and CC-BY-4.0. No source or query corpus from the reconnaissance tools discussed in `docs/research.md` is incorporated into this project.

This notice is informational and does not replace the license files shipped with individual packages.
