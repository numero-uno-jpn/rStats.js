# rStats.js

English | [日本語](README.ja.md)

R-compatible statistical functions for JavaScript and the browser, written in TypeScript.
[Try it in the browser](https://numero-uno-jpn.github.io/rStats.js/demo/) (every function, with the values R gives).

- **Same numbers as R.** Function names, defaults and results follow R. Every function is
  tested against R 4.5.2 (relative error 1e-14 for distributions), and where R itself is
  inaccurate, against high-precision reference values.
- **JavaScript-style calls.** Required arguments are positional, optional ones go in an object
  with camelCase keys: `pt(q, df, { lowerTail: false })` is R's `pt(q, df, lower.tail = FALSE)`.
  Results are plain objects that `JSON.stringify` cleanly.
- **Runs anywhere.** ESM only, no dependencies, no Node-specific APIs, tree-shakable
  (`pnorm` alone is 1.2 KB gzipped).

Status: **0.5.0.** The goal is to cover the numerical core of R's
`stats` package (distributions, hypothesis tests, special functions and the basics of linear
algebra) with R-compatible results; see [ROADMAP.md](ROADMAP.md) for what remains. See [CHANGELOG.md](CHANGELOG.md).

## Install

```sh
npm install @numero-uno-jpn/rstats
```

Requires an ES2022 environment (current browsers, Node.js 22 or later, Deno, Bun).

## Examples

### Distributions

```ts
import { pnorm, qnorm, pt, qbeta, dbinom } from "@numero-uno-jpn/rstats";

pnorm(1.96);                                  // 0.9750021048517795
qnorm([0.025, 0.975]);                        // [-1.9599639845400545, 1.959963984540054]
pt(-40, 3);                                   // 1.7190340394579263e-5
pt(2, 10, { lowerTail: false, logP: true });  // -3.3051415512324533 (log of the upper tail)
qbeta(1e-10, 2, 3);                           // 4.082494015808333e-6
dbinom(3, 10, 0.2);                           // 0.20132659200000003
```

The first argument may be a number, an array or a `Float64Array`; the result has the same shape.
Distribution parameters are scalars.

### Random numbers that match `set.seed()`

```ts
import { setSeed, rnorm, sample } from "@numero-uno-jpn/rstats";

setSeed(42);
rnorm(3);  // [1.3709584471466685, -0.5646981713960887, 0.3631284113373392]
           // R: set.seed(42); rnorm(3) gives the same numbers (up to the last bit)
```

### Hypothesis tests

```ts
import { tTest, fisherTest, pAdjust } from "@numero-uno-jpn/rstats";

const r = tTest([5.1, 4.9, 6.2, 5.8, 6.0, 5.5], [4.1, 4.5, 5.0, 4.8, 4.3]);
r.pValue;    // 0.0035365308877675647 (Welch, the default in R)
r.confInt;   // [0.4423253334608047, 1.6443413332058612]
r.method;    // "Welch Two Sample t-test"

fisherTest([[3, 1], [1, 3]]).pValue;                     // 0.4857142857142857
pAdjust([0.01, 0.02, 0.03, 0.04], { method: "BH" });    // ≈ [0.04, 0.04, 0.04, 0.04]
```

### Linear algebra

Matrices are arrays of rows.

```ts
import { solve, qr, qrCoef, svd, eigen } from "@numero-uno-jpn/rstats";

solve([[2, 1], [1, 3]]);            // [[0.6, -0.2], [-0.2, 0.4]]
const q = qr([[1, 1], [1, 2], [1, 3]]);
qrCoef(q, [1, 3, 4]);               // ≈ [-0.333, 1.5] (least squares)
svd([[1, 4], [2, 5], [3, 6]]).d;    // [9.50803200069572, 0.7728696356734838]
eigen([[2, 1], [1, 3]]).values;     // [3.618033988749895, 1.381966011250105]
```

## What is included

| Area | Functions (R names in parentheses where they differ) |
|---|---|
| Special functions | `gamma`, `lgamma`, `beta`, `lbeta`, `choose`, `lchoose`, `factorial`, `lfactorial`, `digamma`, `trigamma`, `psigamma`, `besselI`, `besselK`, `besselJ`, `besselY` |
| Distributions (d/p/q) | normal, t, chi-squared, F, beta, gamma, binomial, Poisson, uniform, exponential, log-normal, logistic, Cauchy, Weibull, geometric, negative binomial, hypergeometric, Wilcoxon signed rank and rank sum, studentized range (`ptukey`, `qtukey`), non-central chi-squared, t, F and beta (`ncp`); the multinomial probability (`dmultinom`) |
| Random numbers | `setSeed` (`set.seed`), `getRandomSeed`/`setRandomSeed` (`.Random.seed`), 20 `r*` functions, `sample`, `sampleInt` (`sample.int`) |
| Hypothesis tests | `tTest`, `chisqTest`, `fisherTest`, `wilcoxTest`, `cor`, `corTest`, `pAdjust` (`p.adjust`) |
| Linear algebra | `crossprod`, `tcrossprod`, `norm`, `backsolve`, `forwardsolve`, `chol`, `chol2inv`, `qr` with `qrQ`, `qrR`, `qrX`, `qrCoef`, `qrQy`, `qrQty`, `qrResid`, `qrFitted`, `qrSolve` (`qr.Q` …), `solve`, `det`, `determinant`, `rcond`, `kappa`, `svd`, `eigen`, `ginv` (MASS) |

An API reference can be generated with `npm run docs` (TypeDoc).

## Accuracy

Expected values are produced by R scripts in [`oracle/`](oracle) and stored in
[`test/fixtures/`](test/fixtures), so the test suite runs without R. A case passes if it matches
R, or if R is wrong there and rStats.js matches a high-precision value computed with Rmpfr or
gmp. In the far tails and for large parameters rStats.js is often more accurate than R, because
it computes exponents in double-double arithmetic. Details: [docs/accuracy.md](docs/accuracy.md).

## Differences from R

Most differences are cases where R loses accuracy or fails. The deliberate ones that affect
everyday use:

- Indices are 0-based: `sampleInt(n)` returns `0..n-1` (R's `sample.int()` minus 1, from the
  same random stream), and pivots of `qr` and `chol` are 0-based.
- Signs of eigenvectors and singular vectors may differ from R (both are correct).
- Hypothesis tests do not emit R's warnings; all numeric fields and method names match.
- Distribution parameters are not recycled as vectors.

Full list: [docs/differences-from-r.md](docs/differences-from-r.md).

## Using it in the browser

With a bundler (Vite, esbuild, webpack, Rollup), import named functions; unused functions are
removed. Approximate sizes after minification and gzip:

| Import | gzip |
|---|---|
| `pnorm` | 1.2 KB |
| `setSeed`, `rnorm` | 1.7 KB |
| `solve` / `svd` / `eigen` | 1.7 / 2.0 / 3.7 KB |
| `wilcoxTest` / `fisherTest` / `tTest` | 7.9 / 13.2 / 16.3 KB |
| `qbeta` / `pt` and `qt` | 17.3 / 25.0 KB |
| everything | 72.2 KB |

(`npm run size` measures these.)

Without a bundler, load the single-file build `dist/rstats.js` (one minified ES module with every
function, 72 KB gzipped) from jsDelivr, which serves each release tag of this repository:

```html
<script type="module">
  import { pnorm } from "https://cdn.jsdelivr.net/gh/numero-uno-jpn/rStats.js@v0.5.0/dist/rstats.js";
  console.log(pnorm(1.96)); // 0.9750021048517795
</script>
```

Release tags contain the build output (`dist/`), which is not on the main branch. npm-based CDNs
work as well, for example
`https://cdn.jsdelivr.net/npm/@numero-uno-jpn/rstats@0.5.0/dist/rstats.js` or
`https://esm.sh/@numero-uno-jpn/rstats`.

The browser build is tested in headless Chromium, both bundled and as `dist/rstats.js` loaded as
an ES module (`npm run test:browser`).

**Demo:** <https://numero-uno-jpn.github.io/rStats.js/demo/>. [`demo/`](demo) is a static page that loads `dist/rstats.js` from jsDelivr and exercises
every function: distributions with plots, special functions, random numbers, hypothesis tests and
linear algebra. Each form shows the equivalent R and JavaScript code for its inputs, and a "Compare
with R" tab checks curated examples against values printed by R (`source("examples.R")` runs them
all in R). To use your own build instead of the CDN, run `npm run build`, serve the repository root
with a static server (for example `npx serve .`) and open `/demo/?src=local`.

## Versioning

While the version is 0.x, a minor release may contain breaking changes; they are listed in the
changelog. From 1.0.0 the project follows Semantic Versioning.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for how the comparison with R works and the licensing
rules (no code from R or GPL packages). Notes on speed and the double-double arithmetic are in
[docs/performance.md](docs/performance.md).

## License

MIT. Numerical kernels are ported from SciPy's xsf and scipy.stats (BSD-3), Boost.Math
(BSL-1.0), statsmodels (BSD-3) and the LAPACK reference implementation (modified BSD), plus
public-domain LINPACK, EISPACK and Cephes code. See [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
