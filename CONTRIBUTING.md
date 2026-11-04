# Contributing

English | [日本語](CONTRIBUTING.ja.md)

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
2. The implementation in `src/`, exported from its area's `src/entries/<area>.ts` (the subpath
   export; `src/index.ts` re-exports every area).
3. `test/<name>.test.ts` — runs the implementation on the fixture and checks the relative error.

Regenerating fixtures requires R in Docker:

```sh
npm run oracle -- <oracle name>     # e.g. npm run oracle -- gamma
```

`scripts/oracle.sh` runs `Rscript` in a throw-away container (`docker run --rm --network none`).
The image is `rstats-oracle` by default (override with `RSTATS_ORACLE_IMAGE`), built from
`oracle/Dockerfile`: R 4.5.2 with the packages the oracles load (`jsonlite`, `Rmpfr`, `gmp`, `MASS`,
`Matrix`, and for functions that R lacks `extraDistr`, `lme4`, `car`, `afex` and the others listed in
`oracle/Dockerfile`), pinned to a dated package snapshot so that a rebuild gives the same versions.
Building needs network access; running the oracles does not.

```sh
docker build -t rstats-oracle oracle
docker build --platform linux/amd64 -t rstats-oracle-amd64 oracle
```

R's messages are forced to English with `LANGUAGE=en`, so error messages recorded in fixtures do
not depend on the locale. A new oracle must not reuse the name of an existing fixture
(`write_fixture` overwrites it silently); check `git status` after running one.

Fixtures for random numbers are generated with the x86_64 build of the image (`rstats-oracle-amd64`
under `--platform linux/amd64`, oracles marked `# oracle-platform: amd64`), because the arm64 build
differs in the last bit of some functions. Linear-algebra fixtures
record the LAPACK and BLAS versions R used in an `info` block (the current fixtures were made with
OpenBLAS 0.3.26 and LAPACK 3.12.0), since a different BLAS can change the last bits.

Functions can also be checked against high-precision values from mpmath: `scripts/mpmath/<name>.py`
writes `test/fixtures/<name>.mpmath.json` (`python3 -I scripts/mpmath/<name>.py`, needs `pip
install mpmath`). Work done without R starts with these; the tests switch on the R comparison as
soon as `oracle/<name>.R` has been run. Read the numbers of a fixture as doubles first
(`mp.mpf(float(s))`): `mp.mpf(s)` takes the decimal string exactly, which is not the input the
functions saw. For special functions whose R fixtures have no Rmpfr reference functions,
`scripts/mpmath/mismatch_ref.py` computes mpmath references for the cases that disagree with R
(written by `RSTATS_WRITE_MISMATCH=1`) and merges them into `<name>.ref.json`.

R is not always right. When a case does not match, the test compares it with a high-precision
reference value (Rmpfr or gmp) and accepts it if rStats.js is closer to the truth than R. Cases
where rStats.js deliberately differs from R are excluded with a written reason
(`knownDifference`) and recorded in the documentation. See
[docs/accuracy.md](docs/accuracy.md) and [docs/differences-from-r.md](docs/differences-from-r.md).
[docs/performance.md](docs/performance.md) describes the double-double arithmetic, the generated
code from `scripts/ddgen.py`, and how to measure speed (`npm run bench`) and what double-double
buys in accuracy (`npm run precision-report`).

The distribution functions are also checked for properties that need no reference value
(`test/distributionProperties.test.ts`, with the checks in `test/helpers/properties.ts`): probabilities
in [0, 1], lower + upper tail = 1, the log scale against the linear one, monotonicity, quantile round
trips, the density against differences of the distribution function, time and independence of call
order, over parameters from 1e-300 to 1e300. Violations known today are listed with their reasons in
`test/helpers/distributionKnown.ts`; an entry that is no longer needed fails the test. For a longer
search, build and run `node scripts/fuzz-distributions.mjs <seed> <iterations> [family regex]
[output.json]` (options in its header): it runs each family in a worker thread, reports calls that do
not return within 5 s, and writes the violations as JSON (`--known` leaves out the listed ones).

## Design rules

These rules settle what a function returns where R and the mathematics disagree or where an input has no answer.
Follow them in new code and in fixes.

1. **Input without a defined result is an error.** NaN or out-of-range arguments, a non-finite tolerance or step, and
   degrees of freedom or a standard error that leave a test undefined throw an `Error` or `RangeError`, also where R
   returns NaN or ±Inf (the test replaces R's expected value with the error and gives the reason). The distribution
   functions (d/p/q/r) are the exception: they return NaN for invalid parameters, as R. A NaN in new data for a
   prediction gives NaN in that row. An options object with a key the function does not know is a RangeError (in the
   distribution functions too), not ignored: a misspelt option would otherwise give a wrong result without a sign.
2. **R's bits where R is right, the right value only where R is wrong.** A correct value comes before agreement with
   R, but a fix is limited to the range where R (or the package) is wrong. Every value that differs from R is
   recorded with its reason in [docs/differences-from-r.md](docs/differences-from-r.md) and its Japanese translation.
3. **Fallbacks leave the ordinary range alone.** A different path is taken only where the original result is not
   finite, out of range or has lost its digits, so results in the ordinary range keep their bits.
4. **Limits on memory and time.** One array holds at most 2^24 values, and a call should finish within about 10
   seconds. Beyond that, throw a RangeError before allocating (an exact test suggests `exact: false`) and list the
   limit in the docs ([performance](docs/performance.md#limits)). Where an allocation can be avoided without changing
   the values or the random stream, avoid it.
5. **Random numbers follow R's stream.** Draw the same uniforms, as many as R (or extraDistr) draws, also where the
   value is changed; where a parameter is infinite, `r` returns the limit that `q` gives.
6. **Infinite scales are limits.** Where `d` and `p` return the limit for an infinite scale, `q` and `r` do too. A
   scale of 0 behaves as in R.
7. **Integers beyond 2^53.** An argument that must be an integer but is beyond 2^53, where doubles are no longer
   exact integers, gives NaN (the documented exceptions are in differences-from-r).
8. **Empty input as R.** A vector of length 0 gives what R gives.
9. **Integer conversion as R.** An argument that must be an integer is truncated as R's `as.integer` does before it is
   checked; the discrete distribution functions count the values at most q.
10. **Other conventions.** At confidence levels so close to 1 that α/2 < 1e-8, the quantile is taken from the upper
    tail. Nothing is printed: tests do not emit R's warnings, and fits return theirs in the result's `warnings`.
    Computations scale their input by a power of 2 first where the values could overflow or underflow.

## Licensing rules

rStats.js is MIT licensed. To keep it that way:

- **Do not copy or translate code from R or from GPL packages.** R is the oracle: its outputs are
  what rStats.js is checked against. Reading R's source to find out exactly how R behaves (which
  inputs it rejects, which formula or convention it uses, where it rounds) is fine, and often the
  quickest way to settle a mismatch; writing the implementation from it is not. This includes R's
  `src/nmath`, `src/appl`, recommended packages and TOMS 708.
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
  with camelCase keys; names and numerical results follow R. Where R's usage passes an optional argument by position
  (`glmResiduals(fit, "pearson")`), it is taken both by position and in the options (an overload), and giving it both
  ways is a RangeError. The exception is `optimHess(par, fn, gr, control)`, which takes `gr` and `control` by
  position only, as R: `control` is itself a plain object, so an options object after `gr` could not be told from it.
- A key of an options object that the function does not know is a RangeError (`checkOptions` in
  `src/internal/checkOptions.ts`). The checks and their key lists are generated from the option types: after adding
  an exported function or changing an options type, run `node scripts/option-keys.mjs --write` and commit what it
  changes (`test/unknownOptions.test.ts` fails while the sources differ from its output). Do not edit the marked
  generated lines by hand; positions where the options and a data frame can both come, and functions with a check of
  their own, are set in the script.
- Public API documentation (TSDoc on exported symbols), internal comments and the documents
  (`*.md` and `docs/`) are written in English. `docs/ja/` and the `*.ja.md` files are Japanese
  translations; the English documents are authoritative, and a change to one should be made in
  its translation too.
- Every exported function's TSDoc has an `@example` whose `// value` comments are checked by
  `test/docExamples.test.ts`, and exactly one sentence naming its R counterpart in a fixed form
  (``Equivalent to R's `t.test()`.``, ``Equivalent to `car::Anova()` in R.`` or `Not an R function.`;
  `test/rNames.test.ts`). After changing the exports or these comments, regenerate the index pages with `node
  scripts/r-index.mjs > docs/r-functions.md` and `node scripts/r-index.mjs --ja > docs/ja/r-functions.md`
  (the Japanese descriptions are in `docs/ja/r-functions.json`, one per function; the test checks both pages).
  `npx typedoc@0.28.20` must report no warnings.
- Errors: `TypeError` for wrong types or shapes (a formula of the wrong form for the function included),
  `RangeError` for values out of range (a column that does not exist, an empty selection, an unknown choice), `Error`
  for numerical failures and for input whose result is not defined (such as too few observations), and `SyntaxError`
  for a formula that cannot be parsed. Messages are in English. When to throw instead of returning NaN, and the limits
  on memory and time, are in [Design rules](#design-rules).

## Releasing

1. Add demo examples for the exports listed in `NOT_IN_DEMO_YET` (`test/demo.test.ts`) and empty
   the list (this needs `npm run demo:r`). Update `version` in `package.json`, the date in
   `CHANGELOG.md` and `VERSION` in `demo/app.js`
   (the tag the demo loads from jsDelivr), commit, then tag and push:
   `git tag vX.Y.Z && git push origin vX.Y.Z`.
2. `.github/workflows/release.yml` runs the tests, builds, and moves the tag to a commit that also
   contains `dist/`, so that jsDelivr serves
   `https://cdn.jsdelivr.net/gh/numero-uno-jpn/rStats.js@vX.Y.Z/dist/rstats.js`. (After the
   workflow has run, `git fetch --tags --force` updates your local tag.) The main branch never
   contains `dist/`.
3. It then stages the version on npm with provenance (`npm stage publish`). No token is involved:
   the package's settings on npmjs.com name this repository and `release.yml` as its trusted
   publisher, which may only stage, not publish directly.
4. A maintainer reviews the staged version and approves it, which publishes it: on npmjs.com (the
   package's Staged Packages tab, Approve) or with `npm stage approve <id>`. Both require the npm
   account's two-factor authentication.

Version 0.5.0 was published by hand (`npm publish --provenance=false`, since provenance needs CI);
later versions go through the workflow and the approval above. Publishing from a local machine also
requires the npm account's two-factor authentication. The repository must stay public for jsDelivr to serve it.
