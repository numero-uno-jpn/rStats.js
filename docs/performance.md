# Performance

English | [日本語](ja/performance.md)

rStats.js puts accuracy first: distribution functions are kept within 1e-14 of the true value
even in the far tails (see [accuracy.md](accuracy.md)). That costs speed. This page explains
where the time goes, what has been done about it, and the current measurements.

## Design

### Double-double arithmetic

A double-double number is an unevaluated sum hi + lo of two doubles, giving about 32 significant
digits. The building blocks are in `src/special/dd.ts`: the error-free transformations `twoSum`,
`quickTwoSum` and `twoProd` (Dekker/Knuth, with Veltkamp splitting since JavaScript has no FMA),
and on top of them `ddAdd`, `ddSub`, `ddMul`, `ddDiv`, `ddLog` and friends; `ddExp` is in
`src/internal/ddexp.ts`.

It is used where double precision alone cannot reach 1e-14:

- the exponents of tiny probabilities: Loader's saddle-point deviance `bd0`
  (`bd0dd` in `src/special/loader.ts`) and the arguments of exp(−t) in the exponential, Weibull,
  logistic and log-normal distributions;
- the pair x, 1 − x and quantities such as n/(n + t²) passed to the incomplete beta function, and
  its continued fraction (`src/special/incbet.ts`);
- the Poisson-mixture sums of the non-central distributions (`src/internal/poissonMixture.ts`);
- sums of squares and cross products in the hypothesis tests (`src/internal/summary.ts`);
- the q-binomial product of the Wilcoxon rank-sum distribution and the studentized-range
  integrals (`src/distributions/wilcox.ts`, `tukey.ts`; these write the error-free
  transformations by hand).

Where an error bound shows that double precision is enough, the double-double steps are left out
(see "Where double precision is enough" below); elsewhere the double-double path is taken for
every input.

### Where double precision is enough

The result of a density or a tail computed as exp(−E) has a relative error equal to the absolute
error of E, so the question for each step is how large its rounding is in absolute terms, not
relative to the step. The following steps run in double precision, or with fewer double-double
operations, on that argument:

- **The tail of Loader's series** (`bd0dd` in `src/special/loader.ts`). Near x = M, bd0 is
  d·v + 2x (v³/3 + v⁵/5 + …) with v = (x − M)/(x + M). The head d·v stays in double-double; the
  tail is summed in double precision when |x v³| <= 0.12, i.e. |tail| <= 1/12. Its rounding is at
  most 3 ε |tail| (including the low part of v, which is dropped), below ε/4 in E. Before, the
  tail took up to 16 more double-double steps.
- **One logarithm in the far branch of bd0.** x log(x/M) + M − x takes log(x/M) from the
  double-double quotient with one `ddLog` instead of the difference of two (the same accuracy).
- **`dbeta` on the linear scale** is exp(−E) √(m/(2π)) / (x (1 − x)) with m = ab/(a + b): a few
  roundings after exp(−E), whatever the size of log x, and no logarithm at all. The log density
  takes one `ddLog` of the double-double product x (1 − x). The constant ½ log(m/(2π)) is one
  logarithm instead of four (its rounding was about ε (|log a| + |log b|)).
- **The continued fraction stays in double-double**, but its loop is generated (`python3
  scripts/ddgen.py cf`) as scalar code without `[hi, lo]` arrays, with the same operations in the
  same order (divisions through `sDiv`, which leaves its result in a typed array): the results
  are bit-identical (checked on 300 000 random inputs) and the loop is about twice as fast.

The continued fraction cannot be moved to double precision on a simple criterion: with exact x
and plain double arithmetic, its error against the double-double version reaches 7e-15 for
a + b below 10 and 1.5e-13 for a + b around 1000 (large a, x near 1). The error comes from the
rounding of the coefficients, not from the recurrence (double coefficients with a double-double
recurrence are just as bad), and grows with κ = r x / |a − r x| (r = a + b), the closeness of x to
the mean; even for κ below 1e-3, where few steps are needed anyway, the second fraction is off by
1e-15.

### Incomplete beta function with large parameters

For ab/(a + b) >= 25 and x within |τ| <= 1 of the mean (τ = ±√(2E/m), E the deviance of
Loader's binomial density), `src/special/incbetTemme.ts` computes I_x(a, b) by Temme's uniform
asymptotic expansion instead of the continued fraction, whose length grows like √(a + b) there.
The expansion is ½ erfc(−η √(r/2)) minus a correction e^(−E) e^(−D) Σ_k h_k(η) r^(−k) / √(2π r);
its coefficients are not tabulated but generated at run time (about 30 Taylor coefficients from
the differential equation of the change of variable, then the recursion h_k → g_(k+1) → h_(k+1)),
which costs about 2 µs whatever a and b are. In the tails (E >= 2.25) the two terms nearly cancel,
so the smaller tail is computed from a rearranged form whose terms differ only by a factor of
about 1 + 1/E; ½ erfc for arguments in [0.5, 1) uses Gauss–Legendre quadrature, since 1 − erf
loses a factor of 6 there.

The switch was measured against mpmath (`scripts/mpmath/largebeta.py`): with |τ| <= 1, the
expansion is within 9e-16 from ab/(a + b) = 20 on, as accurate as the continued fraction, but
7e-15 for 15 to 20 and 5e-14 for 10 to 15; it is faster than the continued fraction from 10 on.
The threshold 25 leaves a margin. Beyond |τ| = 1 the Taylor series in τ would need more terms,
and there the continued fraction converges in a few dozen steps.

### Expanded expressions (`scripts/ddgen.py`)

Building blocks that return a `[hi, lo]` array allocate on every operation, and the hot spots
spent most of their time in allocation and calls. The hot code is therefore written with local
variables only:

- `ddAdd`, `ddNeg`, `ddSub`, `ddMul`, `ddMulNum`, `ddDiv` and `ddDivNum` in `dd.ts` allocate only
  the result array;
- the series in `ddLog` and in `bd0dd`, and the loop of the continued fraction, use no arrays at
  all.

These expansions are generated by `scripts/ddgen.py`:

```sh
python3 scripts/ddgen.py ops     # the operations in dd.ts
python3 scripts/ddgen.py bd0dd   # the d = x − M and series part of bd0dd in loader.ts
python3 scripts/ddgen.py ddlog   # the part of ddLog after the table lookup
python3 scripts/ddgen.py scalar  # sDiv in incbet.ts (ddDiv with its result in a typed array)
python3 scripts/ddgen.py cf      # the double-double loop of the continued fraction in incbet.ts
```

The script emits the same operations in the same order as the building blocks, so the expanded
code gives bit-identical results (except for the series tail of `bd0dd`, which is summed in double
precision where that is enough; see above). To change an expression, edit the script, regenerate, and paste
the output in place.

### `ddLog`

`ddLog` reduces x = m 2^k, divides m by the nearest table point c = i/128, and computes
log m = log c + 2 atanh((m − c)/(m + c)) with a fixed degree-5 Horner polynomial. The table of
log c (in double-double) and the coefficients were computed with Rmpfr at 400 bits. The maximum
relative error is 4.4e-32 for normal numbers; subnormal inputs are first scaled by 2^600.
This is about 2.6 times faster than summing the atanh series to 1e-34 term by term. A Newton
correction from `Math.log` was not accurate enough, because `ddExp` is not.

### Quantile functions

Continuous quantile functions share a solver (`src/internal/invert.ts`):

- each step evaluates the distribution function once and gets both the linear and the log value
  from it (`cdfBoth`), instead of computing it twice;
- with the derivative of the log density (`dlogPdf`, a closed form) it takes Halley steps in
  u = log x, accepted only when the step is between 1/2 and 2 times the Newton step;
- starting values: Abramowitz and Stegun 26.5.22 for `qbeta` (a, b > 1), the same mapped through
  F = (n/m) Y/(1 − Y) for `qf`, Cornish–Fisher (A&S 26.7.5, n ≥ 3) for `qt`, and xsf's inverse
  gamma for `qgamma`;
- the solver returns the evaluated point with the smallest residual rather than evaluating once
  more after convergence, and the final polish in x is done only when |log x| > 2.

A typical `qbeta` call now needs about 4.4 distribution-function evaluations, 3.9 densities and
3.5 iterations.

Discrete quantile functions call the distribution function only about twice on average; they
are slow only when one evaluation is (for example `pbinom` with large n).

### Measuring precision against speed

`src/special/dd.ts` has an internal switch (`setDoubleDouble`, not part of the public API) that
replaces every double-double building block, including `ddExp`, with plain double arithmetic. It
shows what double-double buys and what it costs:

- `npm run bench` (`scripts/bench.mjs`) builds the package and times a fixed set of calls in both
  modes, one call at a time, minimum of 5 runs, in µs per call. Each mode runs in its own process:
  switching modes in one process leaves V8's type feedback from the first mode and makes the
  second up to 2 times slower. `node scripts/bench.mjs <dir>` measures another build (only the
  double-double mode if that build has no switch). Inputs are generated with the library's own
  `setSeed`/`runif`, so every build sees the same inputs.
- `npm run precision-report` (`scripts/precision.sh`) runs the whole test suite twice, with
  `RSTATS_PRECISION=dd` and `RSTATS_PRECISION=double`. In this mode tests do not fail; instead the
  error of every fixture is summarised in `reports/precision/<mode>/`, and
  `scripts/precision-report.mjs` writes a side-by-side table to `reports/precision/report.md`
  (not committed; takes about 7 minutes).

With everything in double precision:

- The d/p functions become 2 to 4 times faster than the current double-double code (see the
  table below; `dbeta` 2.0 → 0.51 µs). The double-precision mode keeps the array allocations and
  calls, so this speed-up is a conservative lower bound for code rewritten in double precision.
- About half of the fixtures still pass the 1e-14 tolerance: closed-form continuous
  distributions, `lgamma`, signed rank and rank sum, `ptukey`, `chisqTest`, `tTest`, `wilcoxTest`
  and all random numbers.
- Most of the main d/p functions (`dbeta`, `dbinom`, `dgamma`, `dt`, `pbeta`, `pbinom`, `pgamma`,
  `pchisq`, `pnbeta`, `pnchisq`, `pnt`, …) and `qbeta`, `qf` fail, but stay within 1e-10 (the
  largest errors are 1e-13 to 4e-12).
- Fourteen get much worse: `beta` (3.1e-5), `lbeta` (5.8e-7), `pt` (6.2e-7), `pnf` (1.0e-7),
  `pf`, `dnf`, `pnbinom_mu`, the discrete quantiles `qnbinom`, `qnbinom_mu`, `qpois`, `qbinom`
  (some return a different integer), `qt`, `qlogis`, and `corTest` (Pearson with r near ±1, up to
  0.41).
- Some become slower: iteration cut-offs assume double-double accuracy and converge poorly in
  double precision (the `qnbinom` tests take 260 s instead of 9.3 s).

These figures describe the code before the changes in "Where double precision is enough". Since
then the double-precision mode is no longer a useful bound on the speed: it keeps the array
allocations and calls of the building blocks, which the generated loop of the continued fraction
avoids, so the gap has narrowed: on the M1 of the measurements below the default mode is now only
1.0 to 1.3 times slower than the double-precision mode for `pbeta`, `pt`, `pf`, `qbeta` and `qf`
(on an x64 Linux machine `pbeta`, `pt` and `qbeta` were even faster in the default mode).

## Measurements

Apple M1 (Mac mini), Node.js 24, the `tsc` build, one call at a time, minimum of 5 runs.
All rows are from `npm run bench`. Compared with 0.7.0 (before the asymptotic expansion and the
reduced double-double steps), the default mode became faster by these factors: `pbeta` 1.6,
`dbeta` 2.0, `pt` 1.7, `pgamma` 1.2, `pnbinom` 1.2, `dbinom` 2.1, `pbinom` 5.2 (sizes up to 1e4,
mostly where the expansion applies), `dgamma` 1.4, `dt` 1.8, `pf` 1.7, `pchisq` 1.3, `qbeta` 1.8
(typical) and 1.5 (tail), `qgamma` 1.3, `qchisq` 1.4, `qt` 1.4 and 1.3, `qf` 1.7, `tTest` 1.2.
"Typical" inputs: shape parameters log-uniform in 0.5–50 and p uniform in 0–1. "Tail" inputs:
shapes in 0.1–1e4 and p in 1e-5–1e-300.

### Distributions (µs per call)

| Function | rStats.js | Double-precision mode |
|---|---|---|
| `pbeta` | 1.7 | 1.3 |
| `dbeta` | 0.93 | 0.41 |
| `pt` | 1.9 | 1.6 |
| `pgamma` | 0.66 | 0.43 |
| `pnbinom` | 12.2 | 6.6 |

| Quantile function | Typical | Tail |
|---|---|---|
| `qbeta` | 16.8 | 14.8 |
| `qgamma` | 4.9 | 3.9 |
| `qchisq` | 4.3 | |
| `qt` | 8.7 | 9.8 |
| `qf` | 12.6 | |

`tTest` (Welch, 30 and 25 observations) takes 17.0 µs (it calls `qt`).

**Compared with R and SciPy.** For `qbeta` on the same inputs, R 4.5.2 (arm64, one vectorised
call) takes about 1 µs per value for typical inputs and 2.9 µs for tail inputs; SciPy 1.13's
`betaincinv` takes 1.7 and 4.3 µs. rStats.js is therefore about 17 times slower than R on
typical inputs. R's `pbeta` and `dbeta` take about 0.2 and 0.1 µs. The answers agree (typical
inputs: median relative difference between rStats.js and R 1.5e-16, maximum 1.0e-14); the gap
is the price of the double-double arithmetic, not of a different result.

**Large parameters.** The continued fraction of the incomplete beta function needs a number of
iterations roughly proportional to the square root of the parameters near the centre, so in 0.7.0
`pbeta(0.5, a, a)` took 4.4 µs for a = 10, 21.9 µs for a = 1000, 98.9 µs for a = 1e5 and 221 µs
for a = 1e6, and `pbinom(n/2, n, 0.5)` 18.4, 39.7, 79.7 and 169 µs for n = 1e3, 1e4, 1e5 and 1e6.
With the expansion (ab/(a + b) >= 25) these calls take constant time, 0.9 to 1.1 µs from
a = 1000 and n = 1000 on (17 to 245 times faster; a = 10 is below the threshold and only gains
from the faster continued fraction, 4.4 → 2.3 µs). `pt` and `pf` with large degrees of freedom
are not covered (one parameter is 1/2 or small): `pt` with df = 1e6 takes 5.4 µs (10.5 µs in
0.7.0).

### Linear algebra

Matrices of standard normal values (`chol`: crossprod + nI; symmetric `eigen`: (A + Aᵀ)/2).
R 4.5.2 (arm64) uses OpenBLAS 0.3.26 with 4 threads; R times are the minimum of 5 runs of the mean
of 20.

| Operation | n = 100: rStats.js | R | n = 300: rStats.js | R |
|---|---|---|---|---|
| `qr` | 1.0 ms | 0.30 ms | 21.6 ms | 4.9 ms |
| `solve` (one right-hand side) | 0.6 ms | 0.10 ms | 11.3 ms | 1.0 ms |
| `chol` | 0.2 ms | < 0.05 ms | 5.6 ms | 0.20 ms |
| `svd` | 7.1 ms | 1.2 ms | 162 ms | 15.0 ms |
| `eigen` (symmetric) | 4.7 ms | 0.90 ms | 97 ms | 7.4 ms |
| `eigen` (general) | 16.5 ms | 3.5 ms | 371 ms | 32.9 ms |

rStats.js is 3 to 28 times slower than R, which uses blocked LAPACK and an optimised
multi-threaded BLAS with SIMD and FMA; rStats.js uses straightforward unblocked loops. For the
matrix sizes typical in statistics (up to a few dozen columns) a call takes 1 to a few dozen ms.

### Bundle size

`npm run size` (`scripts/size.mjs`) bundles each import from the built `dist/` with esbuild, then
minifies and gzips it. Tree-shaking keeps only the imported functions and their dependencies.

| Import | Minified | gzip |
|---|---|---|
| `pnorm` | 2.3 KB | 1.2 KB |
| `setSeed`, `rnorm` | 3.4 KB | 1.7 KB |
| `solve` / `svd` / `eigen` | 3.8 / 4.5 / 9.6 KB | 1.7 / 2.0 / 3.7 KB |
| `wilcoxTest` | 19.4 KB | 8.6 KB |
| `fisherTest` | 32.2 KB | 15.6 KB |
| `tTest` | 42.8 KB | 20.3 KB |
| `qbeta` | 47.5 KB | 22.1 KB |
| `pt`, `qt` | 62.0 KB | 29.4 KB |
| everything | 318.4 KB | 120.9 KB |
| `@numero-uno-jpn/rstats/distributions` (all of it) | 167.1 KB | 65.9 KB |
| `@numero-uno-jpn/rstats/tests` (all of it) | 169.6 KB | 69.3 KB |
| `@numero-uno-jpn/rstats/linalg` (all of it) | 39.9 KB | 14.5 KB |
| `@numero-uno-jpn/rstats/descriptive` (all of it) | 21.5 KB | 8.4 KB |
| `@numero-uno-jpn/rstats/numerics` (all of it) | 22.8 KB | 10.3 KB |
| `@numero-uno-jpn/rstats/special` (all of it) | 57.9 KB | 26.8 KB |

The subpath rows are an area bundled on its own. The per-area CDN files (`dist/<area>.js`) share
code between areas through `dist/chunks/`, so one area loaded from them transfers more: 18 KB
(`numerics`) to 91 KB (`tests`) gzipped, chunks included.

The incomplete beta function's uniform asymptotic expansion adds 1.3 KB gzipped to everything
that uses `pbeta` (`qbeta`, `pt`, `tTest`, ...), and the allocation-free loop of its continued
fraction 2.6 KB (writing all of its double-double operations out, divisions included, was 1.3
KB larger again for a loop about 1.3 times faster still).

`pt` is large because the non-central t path (`src/distributions/nt.ts`) and the double-double
building blocks come with it; splitting out a central-only function would make it smaller.

## Options not taken

- **WebAssembly.** The same `ddLog` compiled from C to Wasm was 1.2 times faster than the
  JavaScript version, and 1.6 times with a relaxed-SIMD fused multiply-add, whose fusing depends
  on the engine (without fusing, the error term silently becomes 0). Wasm also means asynchronous
  initialisation, no per-function tree-shaking and two code paths to verify, so it is kept only as
  a possible replacement for heavy matrix or iterative work, behind the same API and tested
  against the same fixtures.
- **The continued fraction in double precision**, even only for moderate parameters: its error
  reaches 7e-15 for a + b below 10 and 1.5e-13 around 1000, from the rounding of its coefficients
  (see "Where double precision is enough").
- **A more accurate `stirlerr` for 1 <= n <= 15** (a 12-term Stirling series from 7 on, and the
  steps below written as t²/3 + t⁴/5 + … with t = 1/(2m + 1), without the cancellation of
  (m + ½) log1p(1/m) − 1): its absolute error drops from 8e-16 to 1.8e-16, but it moves two R
  fixture cases where R itself is 1.0e-14 off (`choose(4.3, 31)` and `dnbinom(7, 0.01, mu = 1e-10)`)
  just outside the tolerance against R, and they have no reference values yet. It also hardly
  changes the speed. Kept for when those references can be computed.
- **Caching parameter-only terms** (`lbeta`, `lgamma`, `stirlerr`): they take 1–6% of the time,
  and memoising them made no measurable difference.
