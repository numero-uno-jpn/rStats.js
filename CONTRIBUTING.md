# Contributing

Thank you for your interest in rStats.js. This document explains how the project is
checked against R and what is needed to add or change a function.

## Setup

- Node.js 22 or later
- `npm ci`
- `npm run typecheck`, `npm test`, `npm run build`

The test suite needs neither R nor network access: the expected values from R are stored in
`test/fixtures/*.json`.

## How results are checked against R

Every function is compared with R output. Adding a function means adding three files:

1. `oracle/<name>.R` — builds a grid of inputs (typical values, tails such as p = 1e-300,
   boundaries, NaN/Inf, huge parameters) and writes R's results to `test/fixtures/<name>.json`,
   one case per line, with numbers printed as `%.17g` strings.
2. The implementation in `src/`, exported from `src/index.ts`.
3. `test/<name>.test.ts` — runs the implementation on the fixture and checks the relative error.

Regenerating fixtures requires R in Docker:

```sh
npm run oracle -- <oracle name>     # e.g. npm run oracle -- gamma
```

`scripts/oracle.sh` runs `Rscript` in a throw-away container (`docker run --rm --network none`).
The image is `rstats-oracle` by default (override with `RSTATS_ORACLE_IMAGE`); it needs R 4.5.2
with the packages `jsonlite`, `Rmpfr`, `gmp` and `MASS`. R's messages are forced to English with
`LANGUAGE=en`, so error messages recorded in fixtures do not depend on the locale.

Fixtures for random numbers are generated with the x86_64 build of R (`rocker/r-ver:4.5.2` under
`--platform linux/amd64`, oracles marked `# oracle-platform: amd64`), because the arm64 build
differs in the last bit of some functions. Linear-algebra fixtures
record the LAPACK and BLAS versions R used in an `info` block (the current fixtures were made with
OpenBLAS 0.3.26 and LAPACK 3.12.0), since a different BLAS can change the last bits.

R is not always right. When a case does not match, the test compares it with a high-precision
reference value (Rmpfr or gmp) and accepts it if rStats.js is closer to the truth than R. Cases
where rStats.js deliberately differs from R are excluded with a written reason
(`knownDifference`) and recorded in the documentation. See
[docs/accuracy.md](docs/accuracy.md) and [docs/differences-from-r.md](docs/differences-from-r.md).
[docs/performance.md](docs/performance.md) describes the double-double arithmetic, the generated
code from `scripts/ddgen.py`, and how to measure speed (`npm run bench`) and what double-double
buys in accuracy (`npm run precision-report`).

## Licensing rules

rStats.js is MIT licensed. To keep it that way:

- **Do not copy or translate code from R or from GPL packages.** R is used only as an oracle
  (to observe outputs). This includes R's `src/nmath`, recommended packages and TOMS 708.
- Port only from permissively licensed sources: SciPy and xsf (BSD-3), Boost.Math (BSL-1.0),
  statsmodels (BSD-3), lifelines (MIT), the LAPACK reference implementation (modified BSD),
  public-domain code (LINPACK, EISPACK, Cephes as distributed with xsf), or published papers.
- Name the source at the top of each ported file and add it to `THIRD_PARTY_NOTICES.md`.

## Demo

`demo/` is a static page that loads `dist/rstats.js` from jsDelivr (or the local build with
`?src=local`). Its examples are defined in `demo/examples.json`; after changing them, run
`npm run demo:r` to regenerate `demo/examples.R` and the R values in `demo/r-results.json`.
`test/demo.test.ts` checks every example against R, and `test/browser/demo.mjs` drives the page.

## Style

- TypeScript, ESM, one function family per file. Optional arguments go in an options object
  with camelCase keys; names and numerical results follow R.
- Public API documentation (TSDoc on exported symbols), internal comments and the documents in
  `docs/` are written in English.
- Errors: `TypeError` for wrong types or shapes, `RangeError` for values out of range, `Error`
  for numerical failures. Messages are in English.

## Releasing

1. Update `version` in `package.json`, the date in `CHANGELOG.md` and `VERSION` in `demo/app.js`
   (the tag the demo loads from jsDelivr), commit, then tag and push:
   `git tag v0.5.0 && git push origin v0.5.0`.
2. `.github/workflows/release.yml` runs the tests, builds, and moves the tag to a commit that also
   contains `dist/`, so that jsDelivr serves
   `https://cdn.jsdelivr.net/gh/numero-uno-jpn/rStats.js@v0.5.0/dist/rstats.js`. (After the
   workflow has run, `git fetch --tags --force` updates your local tag.) The main branch never
   contains `dist/`.
3. It then publishes to npm with provenance. No token is involved: the package's settings on
   npmjs.com name this repository and `release.yml` as its trusted publisher.

Version 0.5.0 was published by hand (`npm publish --provenance=false`, since provenance needs CI);
later versions are published by the workflow. Publishing from a local machine requires the npm
account's two-factor authentication. The repository must stay public for jsDelivr to serve it.
