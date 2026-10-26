# Performance

English | [日本語](ja/performance.md)

rStats.js puts accuracy first: distribution functions stay within 1e-14 of the true value even in the far tails
(see [accuracy.md](accuracy.md)). That makes them slower than R's: about 4 to 30 times for the distribution
functions (most d/p functions about 10 times), 3 to 25 times for linear algebra. A single call still takes about a microsecond (a quantile function a
few to 15 µs), and a test of a typical sample well under a millisecond.

## Distributions

µs per call, one call at a time. The R column is R 4.5.2 on the same machine (one vectorised call over the same
kind of inputs, divided by their number).

| Function | rStats.js | R |
|---|---|---|
| `pbeta` | 1.6 | 0.16 |
| `dbeta` | 0.94 | 0.11 |
| `pt` | 1.2 | 0.12 |
| `pgamma` | 0.66 | 0.17 |
| `pf` | 1.5 | |
| `pchisq` | 0.52 | |
| `dt` / `dgamma` | 0.62 / 0.47 | |
| `dbinom` / `pbinom` | 0.54 / 1.4 | |
| `pnbinom` | 12.2 | |

| Quantile function | rStats.js, typical | rStats.js, tail | R, typical | R, tail |
|---|---|---|---|---|
| `qbeta` | 15.2 | 14.9 | 0.91 | 2.7 |
| `qt` | 8.8 | 9.8 | 0.33 | |
| `qgamma` | 4.8 | 4.0 | | |
| `qchisq` | 4.3 | | | |
| `qf` | 11.4 | | | |

"Typical" inputs: shape parameters log-uniform on 0.5 to 50, p uniform on 0 to 1. "Tail": shapes on 0.1 to 1e4,
p from 1e-5 to 1e-300. The results are the same as R's (see [accuracy.md](accuracy.md)); the gap is the cost of the
double-double arithmetic (see the reference section below).

**Large parameters take constant time.** `pbeta(0.5, a, a)` takes 1.0 µs for every a from 1000 to 1e6 (2.4 µs at a
= 10), `pbinom(n/2, n, 0.5)` 1.0 to 1.1 µs for n from 1e3 to 1e6, `pt` with df = 1e6 1.1 to 1.3 µs, `pf` with 1e5
denominator degrees of freedom 1.2 to 2.0 µs; `qt` with df = 1e6 takes 4.0 µs, `qf(p, 5, 1e5)` 7.5 µs,
`qbeta(p, 1e6, 2.5)` 17.1 µs, `qbinom(p, 1e6, 1e-5)` 3.0 µs.

**A test:** `tTest` (Welch, 30 and 25 observations) takes 17.3 µs; most of it is `qt` for the interval.

## Linear algebra

Matrices of standard normal values (`chol`: AᵀA + nI; symmetric `eigen`: (A + Aᵀ)/2), ms per call. R uses OpenBLAS
0.3.26 with 4 threads (blocked LAPACK, SIMD); rStats.js uses plain unblocked loops.

| Operation | n = 100: rStats.js | R | n = 300: rStats.js | R |
|---|---|---|---|---|
| `qr` | 0.76 | 0.25 | 18.4 | 4.9 |
| `solve` (one right-hand side) | 0.48 | 0.10 | 11.0 | 1.0 |
| `chol` | 0.22 | < 0.05 | 4.7 | 0.20 |
| `svd` | 6.5 | 1.3 | 162 | 15.3 |
| `eigen` (symmetric) | 4.0 | 0.95 | 96 | 7.7 |
| `eigen` (general) | 10.7 | 3.5 | 263 | 32.9 |

For the matrix sizes typical in statistics (up to a few dozen columns) a call takes well under a millisecond to a
few ms.

## Mixed models

One fit of `lmer` (REML) from the data, structure included, the median of 3 fits; lme4 2.0.6 with its default
optimiser on the same data (written out from `scripts/lmer-timing.mjs`'s seeded generator), the median of 3. Both
use a sparse Cholesky factorisation; rStats.js's criterion at its estimate was never larger than lme4's.

| Model | n | q | rStats.js | lme4 |
|---|---|---|---|---|
| `y ~ x + (1 \| s) + (1 \| i)`, 200 subjects × 100 items crossed | 20000 | 300 | 0.33 s | 0.20 s |
| the same, 500 × 200 | 100000 | 700 | 2.17 s | 1.51 s |
| `y ~ x + (x \| s)`, 1000 subjects × 10 | 10000 | 2000 | 0.20 s | 0.07 s |
| the same, 5000 subjects × 10 | 50000 | 10000 | 0.84 s | 0.35 s |

Small models (the fixtures: up to a few hundred rows) take 0.1 to 7 ms. `node scripts/lmer-timing.mjs` measures the
fits and single evaluations of the criterion.

`lmerSummary` (Satterthwaite's degrees of freedom: the analytic Hessian of the deviance and the Jacobians of the
covariance of the fixed effects) adds, after the fit: 0.04 s (crossed 200 × 100), 0.25 s (500 × 200), 0.01 s
(1000 subjects) and 0.05 s (5000 subjects), Node 24 on arm64.

## Bundle size

`npm run size` (`scripts/size.mjs`) bundles each import from the built `dist/` with esbuild, then minifies and gzips
it. Tree-shaking keeps only the imported functions and their dependencies.

| Import | Minified | gzip |
|---|---|---|
| `pnorm` | 2.3 KB | 1.2 KB |
| `setSeed`, `rnorm` | 3.4 KB | 1.7 KB |
| `solve` / `svd` / `eigen` | 3.8 / 4.5 / 11.5 KB | 1.7 / 2.0 / 4.5 KB |
| `wilcoxTest` | 29.8 KB | 12.5 KB |
| `fisherTest` | 32.4 KB | 15.7 KB |
| `tTest` | 55.4 KB | 25.3 KB |
| `qbeta` | 49.6 KB | 23.2 KB |
| `pt`, `qt` | 63.7 KB | 30.3 KB |
| `glm`, `glmSummary` / `glm` with all its methods | 63.2 / 89.4 KB | 27.4 / 39.5 KB |
| everything (except `/mixed`) | 497.2 KB | 187.9 KB |
| `@numero-uno-jpn/rstats/distributions` (all of it) | 171.5 KB | 67.9 KB |
| `@numero-uno-jpn/rstats/tests` (all of it) | 364.9 KB | 143.3 KB |
| `@numero-uno-jpn/rstats/linalg` (all of it) | 50.2 KB | 18.5 KB |
| `@numero-uno-jpn/rstats/descriptive` (all of it) | 44.8 KB | 16.7 KB |
| `@numero-uno-jpn/rstats/numerics` (all of it) | 48.7 KB | 20.9 KB |
| `@numero-uno-jpn/rstats/special` (all of it) | 57.7 KB | 26.7 KB |
| `@numero-uno-jpn/rstats/mixed`: `lmer` alone / all of it (with lmerTest's tests) | 39.7 / 134.5 KB | 15.5 / 58.0 KB |

The subpath rows are an area bundled on its own. The per-area CDN files (`dist/<area>.js`) share code between areas
through `dist/chunks/`, so one area loaded from them transfers more: 30 KB (`special`) to 159 KB (`tests`) gzipped,
chunks included. `pt` is large because the non-central t and the double-double building blocks come with it; the
tests with a formula form bring the formula and model-frame code.

## How this was measured

Apple M1 (Mac mini), Node.js 24, the `tsc` build, 2026-10-26 (version 0.11.0). Distributions and `tTest`: `npm run
bench` (`scripts/bench.mjs`), one call at a time, the minimum of 5 runs; its inputs come from the library's own
`setSeed`/`runif`, so every build sees the same ones. Linear algebra: the minimum of 5 runs of the mean of 20 calls
(3 for n = 300). R 4.5.2 (arm64) in the same machine's container, the same kind of inputs from R's own random
numbers. The bundle sizes and the mixed models were measured on 2026-10-27 (the code of 0.12.0), the mixed models
with lme4 2.0.6 in the same container.

## Reference

Background for changing the code; not needed for using the library.

**Why it is slower.** Where double precision cannot reach 1e-14, the computation is carried in double-double
arithmetic (an unevaluated sum of two doubles, about 32 digits; `src/special/dd.ts`, `src/internal/ddexp.ts`): the
exponents of tiny probabilities (Loader's saddle-point deviance `bd0`), the pair x, 1 − x and the continued fraction
of the incomplete beta function, the Poisson-mixture sums of the non-central distributions, the sums of squares of
the tests, and the Wilcoxon and studentized-range integrals. Where an error bound shows that double precision is
enough, the double-double steps are left out (the tail of Loader's series when |x v³| <= 0.12, one logarithm in the
far branch of `bd0`, `dbeta` on the linear scale). The continued fraction itself stays in double-double: in plain
double its error reaches 7e-15 for a + b below 10 and 1.5e-13 around 1000, from the rounding of its coefficients.

**What keeps it fast.**

- The incomplete beta function with both parameters large (ab/(a + b) >= 25, x within |τ| <= 1 of the mean) uses
  Temme's uniform asymptotic expansion (`src/special/incbetTemme.ts`) instead of a continued fraction of length
  √(a + b); with one parameter large and the other small (`pt`, `pf` with large degrees of freedom, `pbinom` near 0
  or n), DiDonato and Morris's expansion (TOMS 708, eq. 9; `src/special/incbetLargeA.ts`). Both were checked
  against mpmath (`scripts/mpmath/largebeta.py`, `smallb.py`) and stay within about 1e-15.
- The hot double-double code is generated as scalar code without `[hi, lo]` arrays (`python3 scripts/ddgen.py ops |
  bd0dd | ddlog | scalar | cf`), with the same operations in the same order, so the results are bit-identical.
- `ddLog` uses a 128-point table and a degree-5 polynomial (maximum relative error 4.4e-32).
- The continuous quantile functions share a solver (`src/internal/invert.ts`): Halley steps in log x with the
  closed-form derivative of the log density, one distribution-function call per step giving both scales, and
  starting values from Abramowitz and Stegun (`qbeta`, `qf`), Cornish–Fisher (`qt`) and xsf (`qgamma`); a typical
  `qbeta` takes about 3.5 iterations.

**Double-precision mode.** An internal switch (`setDoubleDouble` in `src/special/dd.ts`, not public) replaces every
double-double building block with plain double arithmetic. `npm run bench` times both modes (in separate processes;
the default mode is now 1.0 to 2.3 times slower than the double mode, and faster for some quantiles whose iterations
converge worse in double precision), and `npm run precision-report` runs the test suite in both and tabulates the
errors (`reports/precision/report.md`, not committed). In double precision about half of the fixtures still meet
1e-14; most main d/p functions stay within 1e-10, and some get far worse (`beta` 3e-5, `pt` 6e-7, the discrete
quantiles, Pearson's correlation test near ±1).

**Options not taken.**

- WebAssembly: `ddLog` compiled to Wasm was only 1.2 times faster (1.6 with a relaxed-SIMD fused multiply-add whose
  fusing depends on the engine), at the cost of asynchronous loading, no per-function tree-shaking and two code paths.
- A more accurate `stirlerr` for 1 <= n <= 15 (absolute error 8e-16 → 1.8e-16): it moves two fixture cases where R
  itself is 1e-14 off outside the tolerance, and hardly changes the speed.
- Caching the terms that depend on the parameters only (`lbeta`, `lgamma`, `stirlerr`): 1 to 6% of the time, no
  measurable gain.
