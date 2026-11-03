# External review report, 2026-10-30

## Overview

- Date: 2026-10-30 (first external review)
- Reviewer: ChatGPT (external reviewer)
- Target: `src.zip` (192 TypeScript files under `src/`; no `package.json`, `tsconfig` or tests)
- Method: independent checks of numerical properties (scale invariance, symmetry, exact answers that can be derived by hand, comparison with SciPy / NumPy / statsmodels), and running the compiled source on boundary inputs. The test suite was not used.

This file is a cleaned-up English version of the review conversation (originally `ChatGPT_notices_20261030.txt`, Japanese). Greetings, descriptions of how the review would proceed, interim status reports and repeated explanations are left out. Supplements to a finding (wider scope, extra reproductions) are merged into that finding. Each finding ends with an **Outcome:** line, translated from the "rStats.js status 2026-10-31" line that was written under each finding in the original file.

For the details of the fixes, see `review_fix_log_20261031.md`. For results that intentionally differ from R, see `docs/differences-from-r.md`.

## Numbering

The report numbers findings in more than one way, and some findings have two or more numbers. The numbers are kept exactly as in the report, and all numbers for the same finding are shown together (this matches the notation "No.1/2", "No.28/32/43/56" and so on in `review_fix_log_20261031.md`).

- No.1 to No.6: the reviewer's summary table. The first list in the report numbered them differently (1 `sample()`, 2 the simulation `B`, 3 `rmultinom()`); the summary table and the fix log use 1 `sample()`, 2 `rmultinom()`, 3 the simulation `B`. Both are shown.
- No.7 to No.16: stage 3 (linear algebra and numerics).
- No.17 to No.34 appear twice. The reviewer's first output for stages 5 to 10 was cut off, and the reviewer then produced the stages again with different contents under the same numbers. Here they are marked **(first output)** and **(re-output)**. For example, `fivenum()` is No.17 (first output) and No.18 (re-output).
- No.35 to No.39: continuation of the re-output.
- No.40 to No.123: running numbers of later findings. Many of them re-confirm earlier findings, and the report itself says so (for example "No.78 is the run confirmation of No.26").
- One finding has no number: the Fligner–Killeen test, reported next to No.50.
- No.59 does not appear in the report. No.108 and No.109 are referred to, but their own text is not in the received report (see [No.108 and No.109](#no108-and-no109-text-not-in-the-received-report)).

Commits referred to in the outcomes: `440b953` and `3f0515b` (both 2026-10-31).

## Part 1: Stages 1 to 4 (No.1 to No.16)

### Stage 1: random sampling, simulation tests, matrix, root finding, optimisation

#### No.1: `sample()` with weights: large finite weights break the selection probabilities

- File: `src/random/sample.ts`, lines 126–138
- The weights are summed directly and then normalised. If each weight is finite but the sum is `Infinity`, every normalised weight becomes zero.

```ts
setSeed(2026);
sample(["A", "B"], { size: 20, replace: true, prob: [1e308, 1e308] });
```

- Observed: all 20 draws are `"A"`. Expected: both equally likely, since the weights are equal.
- Suggested fix: normalise without overflow (for example divide by the maximum weight before summing).

**Outcome:** Fixed in 440b953. The weights are scaled by their maximum only when their sum overflows.

#### No.2: `rmultinom()`: the same weight overflow (item 3 in the reviewer's first list)

- File: `src/random/binomial.ts`, lines 196–204

```ts
setSeed(2026);
rmultinom(5, 10, [1e308, 1e308]);
```

- Observed: all 5 draws are `[0, 10]`. Expected: each category with probability 1/2.
- The reviewer notes this is a design weakness common to the weight normalisation, not only in `sample()`.

**Outcome:** Fixed in 440b953, in the same way as `sample()`.

#### No.3: `fisherTest()` / `chisqTest()`: a fractional `B` makes the p-value denominator inconsistent (item 2 in the reviewer's first list)

- Files: `src/htest/fisherTest.ts` lines 151–158; `src/htest/chisqTest.ts` lines 200–211 and 300
- The number of simulations is `Math.trunc(B)`, but the p-value denominator uses the untruncated `B + 1`. With `B = 2.5`, only 2 simulations run but the denominator is 3.5; the p-value was `0.285714...`, which does not match the `1/3` correction for 2 simulations.
- See also No.58 for more values.

**Outcome:** Fixed in 440b953. The denominator is now the number of simulations actually run (the integer part of `B`) + 1 (R uses the untruncated `B + 1`).

#### No.4: `matrix()`: a fractional dimension returns a matrix containing `undefined`

- File: `src/linalg/ops.ts`, lines 374–386

```ts
matrix([1, 2, 3, 4], { nrow: 2.5 })
// [[1, undefined], [2, undefined]]
```

- The dimensions are not checked for being non-negative integers; the array length conversion is left to JavaScript. The function is typed as returning `number[][]`. (Reported again as No.49.)

**Outcome:** Fixed in 440b953. `nrow`/`ncol` are truncated like R's `as.integer`; negative or non-finite values are an error.

#### No.5: `uniroot()`: a negative `maxiter` returns a value that is not a root

- File: `src/numerics/integrate.ts`, lines 192–200 and 301–367

```ts
uniroot(x => x * x - 2, 0, 2, { maxiter: -1 })
// { root: 2, fRoot: 2, iter: -1, ... }
```

- The loop never runs and the endpoint is returned. More cases are in No.13 and No.46.

**Outcome:** Fixed in 440b953. `tol` must be non-negative and finite, and `maxiter` at least 1.

#### No.6: `optimize()` / `optim()` Brent method: a negative tolerance never terminates

- Files: `src/numerics/integrate.ts` lines 224–236; `src/optim/localmin.ts` lines 31–38; `src/optim/optim.ts` around line 642

```ts
optimize(x => (x - 0.3) ** 2, 0, 1, { tol: -1 });
optim([0.2], ([x]) => (x - 0.3) ** 2,
  { method: "Brent", lower: 0, upper: 1, control: { reltol: -1 } });
```

- Both timed out after 2 seconds in a separate process. `optim()` passes `reltol` to `optimize()` without checking it. The reviewer suggests checking at the public entry point as well. (Reported again as No.45.)

**Outcome:** Fixed in 440b953. `tol` must be non-negative and finite (also when reached through `optim`'s Brent method).

### Stage 2: survival analysis and regression

#### Candidate withdrawn: weighted Efron method in `coxph()`

- File: `src/models/coxph.ts`, `evaluate()`
- The reviewer first suspected that the Efron method uses the number of tied death rows instead of the sum of their case weights, so that a weight of 2 would not be equivalent to duplicating the row.

**Outcome:** Retracted by the reviewer. R's `survival::coxph` documentation states that with the Efron method, weighted data and data with duplicated rows do not give the same coefficients, so the difference is R-compatible behaviour.

### Stage 3: matrix exponential, linear algebra and numerical stability

#### No.7: `expm()` Taylor / Padé methods: the scaling overflows

- File: `src/linalg/expm.ts`, `scalingExponent()`
- Input: `A = [[0, 1e308], [0, 0]]`. Since `A^2 = 0`, exactly `e^A = I + A = [[1, 1e308], [0, 1]]`.
- Observed: `Higham08.b` and `Higham08` are correct; `Pade`, `Taylor`, `PadeO` and `TaylorO` return the identity matrix.
- Cause: `const nu = Math.sqrt(oneNorm(A) * infNorm(A));` overflows although each norm is finite, the scaling factor becomes infinite, and `A` is scaled to almost zero. Suggested: `Math.sqrt(oneNorm(A)) * Math.sqrt(infNorm(A))`, with further checks for larger and smaller values.

**Outcome:** Fixed in 440b953. The overflow of the norm product is avoided, and when `2^p` overflows, part of the scale is moved to the `A` side. Not yet compared with the R `expm` package.

#### No.8: `eigen()`: the automatic symmetry check fails for large finite values

- File: `src/linalg/eigen.ts`
- The check sums absolute values of the elements to form a relative error; the sum overflows.

```ts
const A = [[8e307, 4e307], [4.0000000000000004e307, 8e307]];
eigen(A, { onlyValues: true });                  // { values: [Infinity, NaN] }
eigen(A, { symmetric: true, onlyValues: true }); // { values: [1.2e308, 4e307] }
```

- The relative difference of the off-diagonal elements is about 6.24e-17, well below the tolerance `100 * eps`, so the matrix should be treated as symmetric. The general algorithm was chosen and broke finite eigenvalues. (Reported again as No.70.)

**Outcome:** Fixed in 440b953. The sum in `isSymmetric` is divided by the maximum only when it overflows.

#### No.9: `chol()` with pivoting does not detect `tol: NaN`

- File: `src/linalg/chol.ts`

```ts
chol([[1, 2], [2, 1]], { pivot: true, tol: NaN });
// { r: [[1, 2], [0, NaN]], pivot: [0, 1], rank: 2 }
```

- The matrix is not positive definite; normal pivoted decomposition gives `rank: 1`. With `NaN` every comparison is false, a negative remainder goes into the square root, and rank 2 is reported. The reviewer suggests keeping the "negative means automatic tolerance" behaviour but rejecting `NaN` and `+Infinity`. (Reported again as No.86.)

**Outcome:** Fixed in 440b953. `NaN` for `tol` is rejected.

#### No.10: `prcomp()`: `tol: NaN` returns an empty result

- File: `src/linalg/lu.ts`, `prcomp()`

```ts
prcomp([[1, 2], [2, 4], [3, 1]], { tol: NaN });
// { sdev: [1.5811..., 0.9128...], rotation: [[], []], x: [[], [], []] }
```

- Cause: the comparison `d > sdev[0] * tol` is always false, so all components are dropped.

**Outcome:** Fixed in 440b953. `NaN` for `tol` is rejected.

#### No.11: `svd()` does not converge for a finite matrix

- File: `src/linalg/svd.ts`

```ts
svd([[1e300, 2e300], [3e300, 4e300]]);
// throws "the singular value decomposition did not converge" after 75 iterations
```

- Expected: the singular values of `[[1, 2], [3, 4]]` times 1e300. The same matrix times 1e-300 also fails. Suggested cause: products of very large or very small values in the Golub–Reinsch diagonalisation; normalise first and scale back. (Reported again as No.69.)

**Outcome:** Fixed in 440b953. Matrices of extreme magnitude are scaled by a power of 2 for the computation and the values are scaled back.

#### No.12: `eigen()` for a general matrix returns wrong values depending on the scale

- File: `src/linalg/eigen.ts`
- Input: `[[1, 2], [3, 4]]` times a constant. Its eigenvalues are 5.372281323269014 and -0.372281323269014, and they should scale with the matrix.
- Observed:
  - times 1 and times 1e150: correct (about 5.3723 and -0.3723, times the factor)
  - times 1e160: `-Infinity`, `NaN`
  - times 1e-150 and times 1e-160: about 5.8541 and -0.8541 times the factor (wrong finite values)

**Outcome:** Fixed in 440b953. The automatic symmetry check was made relative (independent of the scale), and matrices of extreme magnitude are scaled.

#### No.13: `uniroot()`: invalid control parameters return a wrong result as if successful

- File: `src/numerics/integrate.ts`
- Observed with `uniroot(x => x * x - 2, 0, 2, opts)`:
  - `tol: NaN`: a result with `root: NaN` (later run: `root: NaN`, `fRoot: NaN`, `iter: 1000`)
  - `tol: Infinity`: `root: 2` (the root is sqrt(2))
  - `maxiter: NaN`: `root: 2`, `iter: NaN`
  - `maxiter: 1.5`: stops at `root: 1.3333...` without converging (later run: `fRoot: -0.2222`)
- The reviewer groups this with No.5 as one problem: missing validation of `uniroot`'s control parameters. (Also No.46.)

**Outcome:** Fixed in 440b953. `tol` must be non-negative and finite, and `maxiter` at least 1.

#### No.14: sampling with replacement from an empty population returns non-existent elements

- Files: `src/random/sample.ts`, `src/random/rng.ts`

```ts
sampleInt(0, { size: 1, replace: true }); // [0]
```

- `sample([], { size: 1, replace: true })` would return `undefined`. Cause: `unifIndex(0)` returns `0` and the empty population is not detected. Expected: an error when `size > 0 && n === 0`. (Reported again as No.63.)

**Outcome:** Fixed in 440b953. An empty population with `size > 0` is an error.

#### No.15: `setSeed()` rejects the lower limit of a 32-bit signed integer

- File: `src/random/rng.ts`
- `setSeed(-2147483648)` throws, while `-2147483647` and `2147483647` are accepted. Cause: `if (Math.abs(s) > 2147483647)`. Suggested: `if (s < -2147483648 || s > 2147483647)`. (Reported again as No.60.)

**Outcome:** Unchanged. In R, -2147483648 is `NA_integer_`, and `set.seed` gives an error.

#### No.16: `integrate()` accepts an invalid `subdivisions` and reports `NaN` as success

- Files: `src/numerics/integrate.ts`, `src/integrate/quadpack.ts`

```ts
integrate(x => Math.sin(1000 * x), 0, 1, { subdivisions: NaN, stopOnError: false });
// { value: NaN, absError: 0.5922713623, subdivisions: 1, ier: 0, message: "OK" }
```

- The correct value is about `0.0004376209237`, which `subdivisions: 100` gives. `subdivisions: 1.5` also returns `NaN` with `ier: 0`; `Infinity` throws while creating the internal typed array. In QUADPACK the value is used both for array sizes and for the loop condition.

**Outcome:** Fixed in 440b953. `subdivisions` is truncated; non-finite values, and `NaN` tolerances, are an error.

### Stage 4: special functions (no findings)

The reviewer compared the incomplete gamma function (121 cases), the incomplete beta function (648 cases) and Bessel I/K/J/Y (308 cases) with SciPy and found no mismatch above a relative error of 1e-8 (1e-7 for Bessel). See also [Checks without findings](#checks-without-findings).

## Part 2: Stages 5 to 10, first output (No.17 to No.34, first output)

The reviewer's first output for these stages was cut off. Its numbers 17 to 34 differ from the re-output in Part 3.

### Stage 5: descriptive statistics

#### No.17 (first output) / No.18 (re-output): `fivenum()` returns `Infinity` for finite data

- File: `src/descriptive/quantile.ts`, around lines 140–145
- Cause: the median and hinges use `0.5 * (a + b)` (`0.5 * (s[Math.floor(v) - 1] + s[Math.ceil(v) - 1])`); the sum overflows although `a` and `b` are finite.

```ts
fivenum([1e308, 1e308]);   // [Infinity, Infinity, Infinity, Infinity, Infinity]; expected all 1e308
fivenum([1e308, 1.7e308]); // the median overflows; expected 1.35e308
fivenum([1e308]);          // all five values Infinity (the same value is added to itself)
```

- The reviewer notes that `median()` in the same file uses `meanDD()` and avoids the overflow, so the median computation is not consistent within the library. Suggested: `a / 2 + b / 2` or the same safe mean as `median()`.

**Outcome:** Fixed in 440b953. `a / 2 + b / 2` is used only when the sum overflows (R returns `Inf`; recorded in `docs/differences-from-r.md`).

#### No.18 (first output) / No.17 (re-output): `skewness()` and `kurtosis()` are not invariant to a change of units

- File: `src/descriptive/moments.ts`, lines 31–38 and 57–96
- Skewness and kurtosis do not change when the data are multiplied by a positive constant. The squares, cubes and fourth powers of the deviations are accumulated directly (`s2 += d2; s3 += d2 * d; s4 += d2 * d2;`).
- Observed:
  - `[1, 2, 3, 4]`: skewness 0, kurtosis -2.0775
  - `[1e100, 2e100, 3e100, 4e100]`: skewness about 0, kurtosis `NaN`
  - `[1e150, 2e150, 3e150, 4e150]`: both `NaN`
  - `[1e200, -1e200]`: both `NaN`; expected skewness 0 and excess kurtosis (type 1) -2
- Suggested: scale by the largest deviation before computing the central moments.

**Outcome:** Fixed in 440b953. When the deviations are extreme, they are scaled by a power of 2 (the ratios do not change).

#### No.19 (first output) / No.51: `scale()` turns large values into zero

- File: `src/descriptive/moments.ts`, lines 254–264
- Cause: the standard deviation is computed from the sum of squares, and `t * t` overflows (or underflows).

```ts
scale([1e200, 2e200, 3e200]);    // scaled [[-0], [0], [0]], center [2e200], scale [Infinity]
scale([1e-200, 2e-200, 3e-200]); // scaled [[-Infinity], [NaN], [Infinity]], scale [0]
```

- Expected: about `[[-1], [0], [1]]` in both cases. Suggested: divide by the maximum absolute value before summing squares.

**Outcome:** Fixed in 440b953. Only when the sum of squares overflows or underflows, the values are divided by the maximum before the computation.

### Stage 6: convergence control of GLM

#### No.20 (first output and re-output): `glm()` accepts `epsilon: Infinity` and reports an unconverged model as converged

- File: `src/models/glm.ts`, from line 435 (validation around lines 474–479)
- The check is only `if (!(model.epsilon > 0))`, which lets `Infinity` through. The convergence test `abs(dev - devPrevious) / (abs(dev) + 0.1) < epsilon` then passes at the first iteration.

```ts
glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial", epsilon: Infinity });
```

- Default: coefficients `[-4.24909655, 1.21402759]`, `iter: 5`, `converged: true`
- `epsilon: Infinity`: coefficients `[-3.40472387, 0.97277825]`, `iter: 1`, `converged: true`

**Outcome:** Fixed in 440b953. `epsilon` must be positive and finite.

#### No.21 (first output): `glm()` accepts a fractional `maxit`, and the reported iteration count does not match

- File: `src/models/glm.ts`
- With `maxit: 1.5`, the loop ran once but `iter` was 1.5. The upper limit is copied into `iter` at the end. The re-output (No.20) adds that the loop may run twice while `iter` is rewritten to 1.5, and that `Infinity` should also be rejected.

**Outcome:** Fixed in 440b953. The integer part is used, like R's `1:maxit`, and `iter` is an integer.

#### No.22 (first output) / No.107: `tabulate()` and `cut()` fail on large data

- Files: `src/descriptive/table.ts` line 31 and lines 145–146
- `Math.max(...array)` / `Math.min(...array)` hit the engine's limit on the number of arguments.
- Observed: 50,000 and 100,000 elements succeed; 150,000 throws for both functions, and 250,000 throws for `tabulate()` (`cut()` not tried). The error is `RangeError: Maximum call stack size exceeded`.
- No.107 reproduces it with `tabulate(new Array(200_000).fill(1))` and `cut(new Array(200_000).fill(1), 3)`, and asks for a review of every `Math.min(...array)` / `Math.max(...array)` in the source.

**Outcome:** Fixed in 440b953. `Math.max(...array)` was replaced throughout by loop versions (`maxOf` / `minOf`).

#### No.23 (first output): `wilcoxTest()` confidence interval also stops on large data

- File: `src/htest/wilcoxTest.ts`, lines 365–366
- With `confInt: true`, the interval computation calls `Math.min(...x)` / `Math.max(...x)`.

```ts
const x = Array.from({ length: 150000 }, (_, i) => i + 1);
wilcoxTest(x, undefined, { confInt: true, exact: false }); // RangeError: Maximum call stack size exceeded
```

- 50,000 and 100,000 succeed. No.107 also reproduces it with 200,000 observations.

**Outcome:** Fixed in 440b953, as No.22.

#### No.24 (first output): `wilcoxTest()` Hodges–Lehmann estimate overflows

- File: `src/htest/wilcoxTest.ts`, lines 367–368
- Cause: the midpoint of the range is `(lo + hi) / 2`.

```ts
wilcoxTest([1e308, 1e308, 1e308, 1e308], undefined, { confInt: true, exact: false });
// estimate: Infinity; expected 1e308
```

- See also No.66 (Walsh averages).

**Outcome:** Fixed in 440b953. The midpoint is computed without overflow.

#### No.25 (first output) / No.48: `mean()` does not reject a trim outside 0 to 0.5

- File: `src/descriptive/basic.ts`, lines 141–150
- `mean([1, 2, 3, 100], { trim: -0.1 })` returns 26.5 (the plain mean). A later run: `trim: 0.6` and `trim: 1` return the median.

**Outcome:** Unchanged. Retracted by the reviewer: R's `mean` also clamps `trim` to 0 to 0.5.

#### No.26 (first output) / No.22 (re-output): `weightedMean()` turns a finite answer into `Infinity`

- File: `src/descriptive/basic.ts`, from line 154 (lines 164–180)
- Cause: the numerator `sumOf(xs[i] * ws[i])` is summed before dividing by `sumOf(ws)`.

```ts
weightedMean([1e308, 1e308], [1, 1]); // Infinity; expected 1e308
```

- Suggested: normalise the weights first. The re-output notes that if negative weights are allowed, simple normalisation as probability weights is not enough and that case needs its own design.

**Outcome:** Fixed in 440b953. Only when the result is non-finite and the inputs are finite, the computation is repeated with scaling.

### Stage 7: double-double arithmetic

#### No.27 (first output) / No.87 / No.88: `ddMulNum()` and other double-double operations produce `NaN` for large finite values

- File: `src/special/dd.ts`, lines 37–47, 96–125 and from line 128
- Cause: in Dekker's split, `SPLITTER` (2^27 + 1) times an input above about 1e300 overflows.

```ts
ddMulNum([1e302, 0], 1); // [NaN, NaN]; expected [1e302, 0]
// also NaN: twoProd(1e302, 1), ddMul([1e302, 0], [1, 0]), ddDiv([1e302, 0], [1, 0])
```

- Effect on `lm()`:

```ts
const x = [1, 2, 3, 4, 5, 6];
const y = [2, 4, 5, 7, 8, 11].map(v => v * 1e150);
lm(x, y);                 // R^2 about 0.978267 (correct)
lm("y ~ x", { x, y });    // coefficients and SEs finite, but rSquared, F and p-value NaN
```

- No.87 and No.88 report the same cause for `ddMul()` and `ddDiv()`; see those entries.

**Outcome:** Fixed in 440b953. When the error term overflows, it is recomputed with scaling; when a sum, product or quotient is out of range, `[±Inf, 0]` is returned.

### Stage 8: joining data frames

#### No.28 (first output) / No.23 (re-output): multi-column `merge()` matches different keys

- File: `src/descriptive/dataFrames.ts`, around line 242
- Cause: the key values are converted to text and joined with `\r` (`cols.map((c) => valueText(valueAt(c, i))).join("\r")`); missing values become the text `"NA"`. Single-column keys use a dedicated Symbol for missing values and do not have this problem.

```ts
merge({ a: ["x\ry"], b: ["z"], v: [1] }, { a: ["x"], b: ["y\rz"], w: [2] }, { by: ["a", "b"] });
merge({ a: [null], b: ["x"], v: [1] }, { a: ["NA"], b: ["x"], w: [2] }, { by: ["a", "b"] });
```

- Observed: both pairs are joined although the keys differ. `NaN` in a number column and the text `"NA"` also collide. Suggested: an encoding that keeps type, missingness and content apart (for example `JSON.stringify()` of the key array, or nested Maps).

**Outcome:** Fixed in 440b953. The matching key uses an unambiguous encoding.

### Stage 9: factors and model frames

#### No.29 (first output): `modelFrame()` does not reject duplicated factor levels

- File: `src/models/modelFrame.ts`, around lines 80–90

```ts
modelFrame({ g: ["a", "b"] }, ["g"], { levels: { g: ["a", "a", "b"] } });
// variables: [{ kind: "factor", levels: ["a", "a", "b"], codes: [1, 2] }]
```

- `"a"` is registered twice and the code points to the later position. See also No.105.

**Outcome:** Fixed in 440b953. Duplicated levels are an error (as R's `factor(levels=)`).

#### No.30 (first output): `split()` with several factors overwrites a group and loses data

- File: `src/data/grouping.ts`, lines 240–243
- The levels are joined with `sep` to make the Map key; with the default `"."`, `("a.b", "c")` and `("a", "b.c")` both become `"a.b.c"`.

```ts
split([10, 20], [["a.b", "a"], ["c", "b.c"]]); // the group holding 20 is lost
```

**Outcome:** Fixed in 440b953. A collision of the joined group names is an error.

### Stage 10: mixed-effects models, Cox regression, aggregation

#### No.31 (first output): `lmer()` fails to converge after only a change of units of the response

- Files: `src/models/lmer.ts`, `src/models/mixedDeviance.ts`

```ts
const data = {
  y: [9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4],
  g: ["a", "a", "a", "b", "b", "b", "c", "c", "c"],
};
lmer("y ~ 1 + (1 | g)", data);
```

- Response times 1, 1e100 and 1e150: success. Times 1e200: the optimisation does not converge and throws. The inputs and the expected standard deviations are all finite.

**Outcome:** Not fixed. The plan is to standardise the response internally; this needs the comparison with lme4 to be redone, so it is a large change.

#### No.32 (first output) / No.28 (re-output) / No.43 / No.56: `coxph()` accepts invalid convergence and pivot tolerances

- File: `src/models/coxph.ts`, lines 380–385 (validation), 260–288, around 276, and 470–490 (convergence test)
- `eps` is only checked by `if (!(eps > 0))`, so `Infinity` passes and `abs(1 - best / ev.loglik) <= eps` is met at the first iteration. `tolerChol` and `tolerInf` are not checked enough.
- With two collinear columns, `const x = [1, 2, 3, 4, 2, 1, 3, 5].map(v => [v, v]);`, the default sets one coefficient to `NaN` (not identifiable); `control: { tolerChol: Infinity }` gives `coefficients: [NaN, NaN]`.
- `eps: Infinity`: a model that takes 4 iterations by default stops after 1 and the coefficients change. No.43: on 8 observations it returned `iter: 1`.
- No.56 gives the `tolerChol: Infinity` result on ordinary data.

**Outcome:** Fixed in 440b953. `eps`, `tolerChol` and `tolerInf` must be positive and finite.

#### No.33 (first output): `coxph()` standard errors underflow after a change of units of the covariate

- File: `src/models/coxph.ts`, around line 573
- Observed (covariate multiplied by the factor):
  - times 1: coefficient 0.2935, SE 0.4127, z 0.7112, p 0.4770
  - times 1e150: coefficient 2.935e-151, SE 4.127e-151, z 0.7112, p 0.4770
  - times 1e200: coefficient 2.935e-201, SE 0, z `Infinity`, p 0
- The variance underflows to zero before the square root is taken, so a test with p about 0.477 is reported as p = 0.

**Outcome:** Not fixed. The plan is to standardise the covariates internally (as R's `coxph` does); a medium-size change.

#### No.34 (first output): `aggregate()` silently drops a column when a group column and a value column share a name

- File: `src/data/grouping.ts`, lines 322–347

```ts
aggregate({ g: [10, 20, 30], y: [1, 2, 3] }, { g: ["a", "a", "b"] },
  values => values.reduce((a, b) => a + b, 0));
// { g: [30, 30], y: [3, 3] }
```

- Expected both the group column `g: ["a", "b"]` and the value column `g: [30, 30]`; the value column overwrote the group column. The same can happen with suffixes such as `y.1` when the function returns several values.

**Outcome:** Fixed in 440b953. A duplicated column name in the result is an error.

## Part 3: Stages 5 to 14, re-output (No.17 to No.39)

The reviewer produced stages 5 onward again. Numbers 17 to 34 here are the re-output numbers. Findings already described in Part 2 are given as short pointers.

### Stage 5: descriptive statistics

#### No.17 (re-output): `skewness()` and `kurtosis()` give `NaN` for large finite values

Same finding as No.18 (first output); the example `[1e200, -1e200]` is included there.

**Outcome:** Fixed in 440b953. When the deviations are extreme, they are scaled by a power of 2.

#### No.18 (re-output): `fivenum()` median overflows

Same finding as No.17 (first output); the example `fivenum([1e308, 1.7e308])` is included there.

**Outcome:** Fixed in 440b953.

#### No.19 (re-output) / No.47: `hist()` class midpoints `mids` overflow

- File: `src/descriptive/hist.ts`, line 288
- Cause: `const mids = counts.map((_, i) => 0.5 * (br[i + 1]! + br[i]!));`

```ts
hist([1.05e308], { breaks: [1e308, 1.1e308] }); // mids: [Infinity]
```

- With breaks `1e308` and `1.7e308`, the midpoint should be `1.35e308`. Suggested: `br[i] + (br[i + 1] - br[i]) / 2`, also considering the case where the difference itself overflows, or a shared safe midpoint function.

**Outcome:** Fixed in 440b953.

### Stage 6: generalised linear models

#### No.20 (re-output): `glm()` accepts `epsilon: Infinity`

Same finding as No.20 (first output); the re-output's remark on a fractional `maxit` is included in No.21 (first output).

**Outcome:** Fixed in 440b953.

#### No.21 (re-output) / No.74: binomial GLM in two-column form does not reject negative counts

- File: `src/models/glmFamily.ts`, lines 373–398, `prepareResponse()`
- `size = r[0] + r[1]` and `yy = r[0] / size` are computed without checking that the successes and failures are non-negative. The one-column form checks `0 <= y <= 1`.

```ts
glm(X, [[10, 20], [15, 15], [-1, 21]], { family: "binomial" });
glm([[1], [1], [1], [1], [1], [1]],
  [[-1, -3], [1, 3], [2, 2], [3, 1], [4, 1], [5, 0]], { family: "binomial" });
```

- No.74: the second call returns a result with no error and no warning.

**Outcome:** Fixed in 440b953. Negative counts are an error.

#### No.22 (re-output): `weightedMean()` overflows in the intermediate sum

Same finding as No.26 (first output).

**Outcome:** Fixed in 440b953.

### Stage 7: data frame operations

#### No.23 (re-output): multi-column `merge()` matches different keys

Same finding as No.28 (first output), including the later check that a missing value and the text `"NA"` collide (reproduced with `a: [null]` against `a: ["NA"]`). The reviewer notes that changing only the separator is not enough; the key must distinguish value type, missingness and text.

**Outcome:** Fixed in 440b953 (both the separator collision and the `"NA"` collision).

#### No.24 (re-output): a column named `__proto__` disappears in `fromRows()`

- File: `src/descriptive/dataFrames.ts`, lines 60–62 and from line 413
- `addColumn()` does `out[name] = col`; for a plain object, assigning `__proto__` changes the prototype instead of adding a column.

```ts
const rows = JSON.parse('[{"__proto__": 123, "value": 456}]');
const df = fromRows(rows);
// expected { "__proto__": [123], "value": [456] }; the __proto__ column is missing
```

- Also affects `merge()`, `subset()`, `pivotLonger()`, `pivotWider()` and others that use `addColumn()`. Suggested: `Object.create(null)` or `Object.defineProperty()`.

**Outcome:** Fixed in 440b953. `addColumn` uses `defineProperty`.

### Stage 8: nonparametric tests

#### No.25 (re-output) / No.40 / No.98: `cochranQTest()` accepts non-binary data

- File: `src/htest/rankTests.ts`, around line 170
- The function passes the data to `friedmanTest()` and does not check for 0/1 values.

```ts
cochranQTest([[1, 2, 3], [2, 3, 4], [3, 4, 5]]);
cochranQTest([[0, 2], [1, 0], [0, 1]]);          // No.40: Q statistic and p-value returned
cochranQTest([[0, 1, 2], [1, 2, 0], [2, 0, 1]]); // No.98: Q = 0, pValue = 1
```

- The reviewer later removed No.98 from the count of rStats.js-specific bugs, because DescTools also only calls the Friedman test without checking binarity.

**Outcome:** Fixed in 440b953. Values other than 0/1 (and `NaN`) are an error.

#### No.26 (re-output) / No.44 / No.78: `moodTest()` continues when one sample is empty

- File: `src/htest/rankTests.ts`, lines 354–397
- Only the combined size is checked (`if (N < 3)`).

```ts
moodTest([1, 2, 3], []);
moodTest([], [1, 2, 3]);
```

- Both return a statistic and p-value of `NaN` without an error. The same happens when removing missing values leaves one sample empty.

**Outcome:** Fixed in 440b953. An empty group is an error.

### Stage 9: test options and confidence intervals

#### No.27 (re-output) / No.61: `wilcoxTest()` accepts `tolRoot: Infinity`

- File: `src/htest/wilcoxTest.ts`, line 144 (`checkTolRoot()`), lines 331, 388–399 and 529–530
- `checkTolRoot()` only checks `!(tol > 0)`.

```ts
wilcoxTest([1, 2, 3, 4, 5], [2, 3, 4, 5, 6], { confInt: true, tolRoot: Infinity });
```

- No.61, same two samples: `tolRoot: 1e-4` gives estimate -1 and 95% CI [-3.99997, 1.99997]; `tolRoot: Infinity` gives estimate 3 and CI [-5, 3]. The p-value is the same; the root search effectively returns an endpoint.

**Outcome:** Fixed in 440b953. `tolRoot` must be positive and finite.

### Stage 10: survival analysis and Cox regression

#### No.28 (re-output): `coxph()` accepts `eps: Infinity`

Same finding as No.32 (first output).

**Outcome:** Fixed in 440b953.

#### No.29 (re-output) / No.89: `survdiff()` returns a test result for a single group

- File: `src/models/survival.ts`, from line 152
- The number of groups (`const k = labels.length;`) is not checked to be at least 2.

```ts
survdiff([1, 2, 3, 4], [1, 1, 0, 1], ["A", "A", "A", "A"]);
// { n: [4], obs: [3], exp: [3], chisq: 0, pvalue: 1 }
```

**Outcome:** Fixed in 440b953. A single group is an error (R gives the same error).

### Stage 11: normality tests

#### No.30 (re-output) / No.41: five normality tests do not handle constant data

- File: `src/htest/normalityTests.ts` (lines 38–41 and 200–215)
- Functions: `adTest()`, `cvmTest()`, `lillieTest()`, `sfTest()`, `pearsonTest()`. The shared standardisation divides by a standard deviation of 0, giving `NaN`.
- Observed:
  - `adTest([5, 5, 5, 5, 5, 5, 5, 5])`: the statistics cannot be computed
  - 10 identical values: Anderson–Darling and Cramér–von Mises give a statistic of `NaN` but p-values `3.7e-24` and `7.37e-10`
  - `pearsonTest([1, 1, 1, 1, 1, 1])`: statistic 6, p-value about 0.0498

**Outcome:** Fixed in 440b953. Constant data are an error. Not yet compared with nortest's `pearson.test`/`sf.test` in R.

#### No.31 (re-output) / No.52: `pearsonTest()` does not validate `nClasses`

- File: `src/htest/normalityTests.ts`, from about line 180 (lines 200–217)
- `k = options.nClasses ?? Math.ceil(2 * n ** (2 / 5))` is used as an array length, and `df = k - 1 - (adjust ? 2 : 0)` can be zero or negative.
- No.52, observed by `nClasses`:
  - 0, 1 and 2: statistic 0, p-value `NaN`
  - 1.5 and -1: `Invalid array length`

**Outcome:** Fixed in 440b953. `nClasses` must be an integer that leaves positive degrees of freedom.

### Stage 12: proportion and binomial tests

#### No.32 (re-output): `propTest()` accepts fractional counts

- File: `src/htest/propTest.ts`, lines 74–91
- Only `n > 0`, `x >= 0` and `x <= n` are checked; `propTest(1.5, 10)` is computed. `binomTest()` checks integers with `isCount()`.
- The reviewer did not count this as a confirmed bug, because R's `prop.test()` may also accept fractions.

**Outcome:** Unchanged for fractions, because R's `prop.test` also accepts them. `Infinity` for `n` is now rejected (No.77).

#### No.33 (re-output) / No.42: `zTest()` accepts a negative, zero or non-finite known standard deviation

- File: `src/htest/aov.ts`, lines 253–278
- `zTest([1, 2, 3, 4], { sigmaX: -1, mu: 0 })`: the standard error is negative, so the sign of Z flips and a one-sided p-value goes the wrong way; No.42: the confidence limits are swapped.
- `zTest([1, 2, 3, 4], { sigmaX: 0, mu: 0 })`: division by zero.

**Outcome:** Fixed in 440b953. The known standard deviation must be positive and finite.

#### No.34 (re-output): power functions do not validate probabilities, variances and standard deviations

- File: `src/htest/power.ts`
- Inputs that need checks: `powerTTest()` `sd` (0, negative, `Infinity`); `powerPropTest()` `p1`, `p2` (outside 0 to 1); `powerAnovaTest()` `betweenVar`, `withinVar` (negative, zero variance); all three `power` and `tol` (out of range, non-finite).
- Run examples are No.37 to No.39.

**Outcome:** Fixed in 440b953. `power`, `p1` and `p2` must be probabilities; `sd` and `withinVar` positive and finite; `betweenVar` non-negative; `n >= 2`.

### Stage 13: repeated-measures ANOVA and model options

#### No.35: `aovEz()` silently accepts an invalid sphericity correction

- File: `src/models/aovEz.ts`, line 177 and lines 388–394

```ts
aovEz(data, { id: "id", dv: "dv", within: "w", correction: "bogus" as any });
```

- Returns the uncorrected ANOVA, the same as `"none"`, without an error.

**Outcome:** Fixed in 440b953. An invalid `correction` is an error.

#### No.36: `aovEz()` `observed` does not recognise a valid column name starting with a dot

- Files: `src/models/aovEz.ts` lines 128–130; `src/htest/effectSize.ts` around line 253
- The check uses ``new RegExp(`\\b${escapeRegExp(o)}\\b`)``; `\b` is an ASCII word boundary, so `.grp` is not found.

```ts
const data = { id: ["a", "b", "c", "d", "e", "f"], dv: [1, 2, 3, 5, 6, 8],
  ".grp": ["A", "A", "A", "B", "B", "B"] };
aovEz(data, { id: "id", dv: "dv", between: ".grp", observed: ".grp" });
// Error: Observed variable not in data: .grp

const fit = lm("dv ~ .grp", { dv: [1, 2, 3, 5, 6, 8], ".grp": ["A", "A", "A", "B", "B", "B"] });
etaSquared(fit, { generalized: [".grp"] }); // the same error
```

- The same regular expression is used by `omegaSquared()` and `epsilonSquared()`.

**Outcome:** Fixed in 440b953. The regular expression was replaced by splitting the term name at `:` and comparing the parts (also in `etaSquared` and the others).

### Stage 14: running the power functions

#### No.37: `powerTTest()` accepts a negative standard deviation

- File: `src/htest/power.ts`, from line 112

```ts
powerTTest({ n: 20, delta: 1, sd: -1 }); // { sd: -1, power: 2.2603186271656928e-7 }
```

**Outcome:** Fixed in 440b953.

#### No.38: `powerPropTest()` accepts a probability outside 0 to 1

- File: `src/htest/power.ts`, from line 224

```ts
powerPropTest({ n: 50, p1: 1.2, p2: 0.5 }); // { p1: 1.2, p2: 0.5, power: 1 }
powerPropTest({ n: 50, p1: 0, p2: 0 });     // power: NaN
```

**Outcome:** Fixed in 440b953. The `NaN` for `p1 = p2 = 0` is unchanged.

#### No.39: `powerAnovaTest()` accepts a negative variance

- File: `src/htest/power.ts`, from line 335

```ts
powerAnovaTest({ groups: 3, n: 5, betweenVar: -1, withinVar: 3 }); // power: NaN
powerAnovaTest({ groups: 3, n: 5, betweenVar: 1, withinVar: 0 });  // power: NaN
```

**Outcome:** Fixed in 440b953.

## Part 4: No.40 to No.52

### No.40 to No.49: re-runs collected in one table

The reviewer collected the following as No.40 to No.49, mostly reproductions of earlier findings by running the compiled source. The original status line covers all ten: No.40 to No.47 and No.49 fixed in 440b953, No.48 retracted by the reviewer.

#### No.40: `cochranQTest()` accepts data other than 0/1

`src/htest/rankTests.ts:170`. See No.25 (re-output).

**Outcome:** Fixed in 440b953.

#### No.41: normality tests return an extremely small p-value for constant data although the statistic is `NaN`

`src/htest/normalityTests.ts:38–41, 200–215`. See No.30 (re-output).

**Outcome:** Fixed in 440b953.

#### No.42: `zTest()` accepts a negative standard deviation and the confidence limits are swapped

`src/htest/aov.ts:258–275`. See No.33 (re-output).

**Outcome:** Fixed in 440b953.

#### No.43: `coxph()` accepts `eps: Infinity`

`src/models/coxph.ts:380–384`. See No.32 (first output).

**Outcome:** Fixed in 440b953.

#### No.44: `moodTest()` accepts an empty group and returns a `NaN` result

`src/htest/rankTests.ts:354–366`. See No.26 (re-output).

**Outcome:** Fixed in 440b953.

#### No.45: `optimize()` does not terminate with a negative `tol`

`src/numerics/integrate.ts:133–140`. `optimize(x => (x - 0.3) ** 2, 0, 1, { tol: -1 })` did not finish within an external 2-second timeout. See No.6.

**Outcome:** Fixed in 440b953.

#### No.46: `uniroot()` returns an endpoint that is not a root with a negative `maxiter` or an infinite `tol`

`src/numerics/integrate.ts:192–200`. See No.5 and No.13 (the values for `tol: NaN` and `maxiter: 1.5` are there).

**Outcome:** Fixed in 440b953.

#### No.47: `hist()` class midpoints become `Infinity` for large finite values

`src/descriptive/hist.ts:288`. See No.19 (re-output).

**Outcome:** Fixed in 440b953.

#### No.48: `mean()` does not reject `trim` outside 0 to 0.5

`src/descriptive/basic.ts`. See No.25 (first output).

**Outcome:** Retracted by the reviewer: R's `mean()` also clamps `trim` to 0 to 0.5 (a negative value is treated as 0, and 0.5 or more gives the median), so the current behaviour is R-compatible.

#### No.49: `matrix()` creates a matrix containing `undefined` for a fractional `nrow`

`src/linalg/ops.ts:374–386`. See No.4.

**Outcome:** Fixed in 440b953.

### Fligner–Killeen test (no number; reported next to No.50): not scale invariant

- File: `src/htest/groups.ts:78`, the internal `median()`
- For an even number of values the median is `(sum of the two middle values) / 2`, which overflows; the test uses absolute deviations from the group medians, so the ranks are broken too.
- Observed:
  - `[[8, 9, 10, 10], [7, 8, 9, 10]]`: statistic 0.4667, p-value 0.4945
  - the same times about 1e307, `[[8e307, 9e307, 1e308, 1e308], [7e307, 8e307, 9e307, 1e308]]`: statistic 6.3244, p-value 0.0119
- The test should not change under multiplication by a positive constant. No.104 (Levene test) has the same cause.

**Outcome:** Fixed in 440b953. The internal `median` in htest uses a midpoint that does not overflow (the Levene test as well).

### No.50: `seq()` accepts an infinite step

- File: `src/linalg/ops.ts`, `seq()`

```ts
seq(1, 2, { by: Infinity });  // [NaN]
seq(1, 2, { by: -Infinity }); // [NaN]
```

**Outcome:** Fixed in 440b953. With `by = ±Infinity`, only `from` is returned.

### No.51: `scale()` fails to standardise extreme values

See No.19 (first output), which includes the `1e-200` example from No.51.

**Outcome:** Fixed in 440b953.

### No.52: `pearsonTest()` does not validate `nClasses`

See No.31 (re-output), which includes the values from No.52. The reviewer treats No.52 as the run confirmation of No.31.

**Outcome:** Fixed in 440b953.

## Part 5: No.53 to No.88

### Cox regression and survival

#### No.53: `coxph()` accepts an infinite initial coefficient

- File: `src/models/coxph.ts:393, 459`
- The length of `init` is checked, but not whether the elements are finite. On 6 observations, `coxph(time, status, x, { init: [Infinity] })` returns a result whose coefficients, log-likelihood, linear predictor, p-values and so on are `NaN`.

**Outcome:** Fixed in 440b953. `init` must be finite.

#### No.54: Kaplan–Meier median interpolation overflows

- File: `src/models/survival.ts:241`, `(time[i] + time[j]) / 2`

```ts
survfit([8e307, 1e308, 1.1e308, 1.2e308], [1, 1, 1, 0]).median; // Infinity
```

- With times `[1, 2, 3, 4]` and the same event pattern, the median is 2.5.

**Outcome:** Fixed in 440b953.

#### No.55: `poissonTest()` accepts an observation time of 0

- File: `src/htest/poissonTest.ts`

```ts
poissonTest(0, { T: 0 });           // estimate NaN, CI [NaN, Infinity]
poissonTest([1, 2], { T: [0, 1] }); // rate ratio Infinity, CI [Infinity, Infinity]
```

**Outcome:** Unchanged (decision pending). An estimate of `NaN` at `T = 0` is judged to represent that the rate is undefined.

#### No.56: `coxph()` accepts `tolerChol: Infinity`

- File: `src/models/coxph.ts:380–384`, around line 276
- `coxph(time, status, x, { control: { tolerChol: Infinity } })` on ordinary data: coefficient `NaN`, SE 0, Wald p-value `NaN`, likelihood ratio p-value 1, degrees of freedom 0. Every covariate is treated as rank deficient. See No.32 (first output).

**Outcome:** Fixed in 440b953.

#### No.57: `coxph()` neither drops nor rejects an infinite covariate

- File: `src/models/coxph.ts:398–405`, around line 433

```ts
coxph([1, 2, 3, 4, 5, 6], [1, 1, 0, 1, 0, 1], [[0], [1], [2], [3], [4], [Infinity]]);
```

- `n` stays 6, the mean is `Infinity`, and the coefficient, log-likelihood and test statistics are `NaN`. (`NaN` covariates are removed.)

**Outcome:** Fixed in 440b953. `±Infinity` in a covariate is an error.

### Simulation, random numbers, sampling

#### No.58: `fisherTest()` accepts a fractional simulation count `B` (also `chisqTest()`)

- Files: `src/htest/fisherTest.ts` (`fisherSimulated()`); `src/htest/chisqTest.ts:201–208, 274–310`
- Fisher test, by `B`:
  - 0.5: 0 runs, p-value 0.6667 (2/3 instead of 1)
  - 1: 1 run, p-value 0.5
  - 1.5: 1 run, p-value 0.4
  - 2.7: 2 runs, p-value 0.2703
- Chi-squared test: `chisqTest([20, 15, 25], { simulatePValue: true, B: 0.5 })` returns `pValue: 1.3333333333333333`, above 1. See No.3.

**Outcome:** Fixed in 440b953. The p-value denominator is the number of runs actually made + 1.

#### No.60: `setSeed()` range is one value short of a 32-bit integer

- File: `src/random/rng.ts:98–101`
- `if (Math.abs(s) > 2147483647)` rejects only -2147483648, while the Mersenne Twister and L'Ecuyer implementations convert the seed with `seed >>> 0` and could handle it. See No.15.

**Outcome:** Unchanged, for the same reason as No.15.

#### No.61: `wilcoxTest()` accepts `tolRoot: Infinity`, breaking the CI and the estimate

See No.27 (re-output), which includes the values from No.61. The reviewer treats No.61 as the run confirmation of No.27.

**Outcome:** Fixed in 440b953.

#### No.63: `sample()` draws non-existent elements from an empty population

- File: `src/random/sample.ts:34–65`

```ts
sample([], { size: 2, replace: true });       // [undefined, undefined]
sampleInt(0, { size: 2, replace: true });     // [0, 0]
```

- See No.14.

**Outcome:** Fixed in 440b953.

#### No.64: `rlogis()` accepts a negative scale

- File: `src/random/continuous.ts:129–136`
- `rlogis(5, { scale: -1 })` returns 5 finite values, while `dlogis()` returns `NaN` for `scale: -1`.
- The reviewer later retracted this: R's random generator also has code that does not explicitly reject a negative scale, so it cannot be called a bug from the compatibility point of view.

**Outcome:** Unchanged (decision pending). Returning `NaN` would stop consuming random numbers, and the sequence after `setSeed` would no longer match R. Also retracted by the reviewer.

#### No.65: `rtriang()` returns all `NaN` for a large finite interval

- Files: `src/random/extra.ts` (`rtriang()`); `src/distributions/triangular.ts`; `distSummary`
- When the mode `c` is omitted, it defaults to `(a + b) / 2`, which overflows.

```ts
rtriang(4, { a: 8e307, b: 1e308 }); // [NaN, NaN, NaN, NaN]; with c: 9e307 the values are finite
```

- `dtriang()`, `ptriang()` and `qtriang()` also return `NaN` with `a: 8e307, b: 1e308` and no `c`.
- `distSummary("triang", ...)` with `c: 9e307` gives a mean of `Infinity` instead of `9e307`, because `(a + b + c) / 3` overflows.

**Outcome:** Fixed in 440b953. The default mode of the triangular distribution uses a midpoint that does not overflow (also in `dtriang` and the others, and in `distSummary`).

#### No.73: `runif()` returns `Infinity` outside a finite interval

- File: `src/random/continuous.ts:29–33`, `min + (max - min) * u`

```ts
runif(5, { min: -1e308, max: 1e308 }); // all five Infinity
```

- The reviewer later stopped counting this as an rStats.js bug: R itself uses the same `min + (max - min) * u`, so it is a numerical limit inherited from R.

**Outcome:** Fixed in 440b953. When the width overflows, `min * (1 - u) + max * u` is used.

### Nonparametric estimates and interpolation

#### No.66: Wilcoxon signed-rank Hodges–Lehmann estimate overflows

- File: `src/htest/wilcoxTest.ts:342`, the Walsh average `(x[i] + x[j]) / 2`

```ts
wilcoxTest([8e307, 9e307, 1e308], { confInt: true, exact: true });
// estimate Infinity, upper CI limit Infinity; the estimate should be 9e307
```

- See also No.24 (first output).

**Outcome:** Fixed in 440b953.

#### No.67: monotone spline produces `Infinity` and `NaN` on finite straight-line data

- File: `src/numerics/interp.ts:515`, `fritschCarlsonSlopes()`, `(S[k - 1] + S[k]) / 2`

```ts
const f = splinefun([0, 1, 2], [-1e308, 0, 1e308], { method: "monoH.FC" });
f([0, 0.5, 1, 1.5, 2]); // a mix of NaN and ±Infinity; the data lie on a straight line
```

**Outcome:** Fixed in 440b953.

### Numerical integration, linear algebra, optimisation

#### No.68: `integrate()` accepts an infinite tolerance and reports insufficient accuracy as success

- File: `src/numerics/integrate.ts:66–69`, `relTol` and `absTol` are not checked for finiteness

```ts
const f = x => 1 / (1 + 1e6 * (x - 0.5) ** 2);
integrate(f, 0, 1, { relTol: Infinity });
// value 0.0032210835, absError 0.0059751846, ier 0; with the default tolerance the value is about 0.0031376
```

**Outcome:** Partly fixed in 440b953. `NaN` tolerances and an invalid `subdivisions` are rejected. `tol = Infinity` is unchanged, as behaviour that follows the request.

#### No.69: `svd()` stops converging after scaling a simple finite matrix

- File: `src/linalg/svd.ts`
- `svd([[1, 2], [3, 4]])` succeeds; times 1e200, 1e300, 1e-200 and 1e-300 it does not converge. See No.11.

**Outcome:** Fixed in 440b953.

#### No.70: `eigen()` breaks the eigenvalues for an asymmetry of about 1 ULP

- File: `src/linalg/eigen.ts`
- `[[8e307, 4e307], [4e307, 8e307]]` works; changing the lower off-diagonal to `4.0000000000000004e307` gives `{ values: [Infinity, NaN] }`. See No.8.

**Outcome:** Fixed in 440b953.

#### No.71: `optim()` returns an unconverged solution as success for an invalid `reltol`

- File: `src/optim/optim.ts` (control parameters and the BFGS convergence test)
- Minimising `(x - 3)^2 + (y + 2)^2`:
  - default: `[3, -2]`, value about 0, convergence 0
  - `reltol: Infinity`: `[1.2, -0.8]`, value 4.68, convergence 0
  - `reltol: NaN`: `[1.2, -0.8]`, value 4.68, convergence 0

**Outcome:** Fixed in 440b953. `reltol` must be non-negative and finite; `abstol` must not be `NaN`.

#### No.72: `optim()` reports the unoptimised start as success with zero iterations

- File: `src/optim/optim.ts:611, 624–631`

```ts
optim([0, 0], p => (p[0] - 3) ** 2 + (p[1] + 2) ** 2, { method: "BFGS", control: { maxit: 0 } });
// { par: [0, 0], value: 13, convergence: 0 }; the minimum is 0
```

- Nelder–Mead behaves the same way.

**Outcome:** Unchanged (decision pending). R's `optim` also returns `convergence` 0 with `maxit = 0`.

#### No.62: `solve()` with `tol: NaN` disables the singularity check

- File: `src/linalg/solve.ts:335–339`
- `tol <= 0` disables the check by design, and `NaN` also passes the comparison.

```ts
const A = [[1, 1], [1, 1 + 5e-16]];
solve(A, [2, 2 + 1e-15]);             // singularity error
solve(A, [2, 2 + 1e-15], { tol: NaN }); // [0, 2]
```

**Outcome:** Fixed in 440b953. `NaN` for `tol` is rejected.

#### No.85: `qr()` rank decision changes with an invalid `tol`

- File: `src/linalg/qr.ts:85–94, 112–130`
- `A = [[1, 1], [2, 2], [3, 3]]` has rank 1. Rank found: default 1; `tol: NaN` 2; `tol: Infinity` 0.
- The reviewer adds that `ginv()` has the same kind of problem: `ginv([[1, 1], [2, 2], [3, 3]])` gives rows of `[0.035714..., 0.071428..., 0.107142...]`, and with `{ tol: NaN }` it gives a zero matrix.

**Outcome:** Fixed in 440b953. `NaN` for `tol` is rejected. `Infinity` is unchanged, as behaviour that follows the request.

#### No.86: `chol()` with pivoting misjudges the rank with `tol: NaN`

- File: `src/linalg/chol.ts`
- `chol([[1, 1], [1, 1]], { pivot: true })` gives `rank: 1`; with `tol: NaN` it gives `rank: 2`. See No.9.

**Outcome:** Fixed in 440b953.

### Models and tests: non-finite input

#### No.74: binomial GLM in two-column form accepts negative counts

See No.21 (re-output), which includes the example from No.74.

**Outcome:** Fixed in 440b953.

#### No.75: `lm()` accepts an infinite response and makes every statistic `NaN`

- File: `src/models/lm.ts`

```ts
lm([1, 2, 3, 4, 5, 6], [1, 2, 3, 4, 5, Infinity]);
// coefficients [NaN, NaN], residuals, SEs, R^2 and the F-test p-value all NaN, no warning
```

**Outcome:** Fixed in 440b953. Non-finite values in `y` or `x` are an error (as in R).

#### No.76: chi-squared goodness-of-fit test accepts an infinite probability

- File: `src/htest/chisqTest.ts:231–244`, with `rescaleP: true`

```ts
chisqTest([20, 30], { p: [Infinity, 1], rescaleP: true });
// expected [NaN, 0], residuals [NaN, Infinity], statistic NaN, p-value NaN
```

**Outcome:** Fixed in 440b953. `Infinity` in the probabilities is an error.

#### No.77: `propTest()` accepts an infinite number of trials

- File: `src/htest/propTest.ts:85–111`

```ts
propTest(10, Infinity); // estimate 0, statistic NaN, p-value NaN, 95% CI [0, 0]
```

**Outcome:** Fixed in 440b953.

#### No.78: `moodTest()` returns a result when one group is empty

See No.26 (re-output). The reviewer treats No.78 as the run confirmation of No.26.

**Outcome:** Fixed in 440b953.

#### No.79: `hist()` accepts duplicated breaks and the density becomes `NaN`

- File: `src/descriptive/hist.ts:252–255, 310–311`

```ts
hist([0.5, 1, 1.5, 2, 3], { breaks: [0, 1, 1, 3] });
// breaks [0, 1, 1, 3], counts [2, 0, 3], density [0.4, NaN, 0.3]
```

**Outcome:** Fixed in 440b953. Breaks that are not strictly increasing are an error (as in R).

### Distributions

#### No.80: uniform distribution summary is `Infinity` for a symmetric finite interval

- File: `src/distributions/summary.ts` (`unif`)
- `distSummary("unif", { min: -1e308, max: 1e308 })` gives a mean and median of `Infinity`; both should be 0. Cause: `min + (max - min) / 2`.

**Outcome:** Fixed in 440b953.

#### No.81: beta distribution variance is 0 or `NaN` although it is finite and positive

- File: `src/distributions/summary.ts` (`beta`), variance `ab / ((a + b)^2 (a + b + 1))`
- `distSummary("beta", { shape1: 1e150, shape2: 1e150 })`: mean and median 0.5, variance 0; the variance should be about `1.25e-151`.
- `shape1: 1e160, shape2: 1e160`: variance `NaN`.

**Outcome:** Fixed in 440b953. When the products overflow or underflow, the variance is computed from ratios.

#### No.82: F distribution with extremely large degrees of freedom loses its symmetry

- File: `src/distributions/f.ts` (`pfRaw()`, `qf1()`)
- With equal degrees of freedom, P(F <= 1) = 0.5. Observed: `pf(1, 1e308, 1e308)` = 0 and `qf(0.5, 1e308, 1e308)` = 2.

**Outcome:** Not addressed; waiting for comparison with R's values.

#### No.83: symmetric beta distribution loses its symmetry

- File: `src/distributions/beta.ts`
- Expected `pbeta(0.5, a, a) = 0.5`, `qbeta(0.5, a, a) = 0.5`, and `dbeta(0.5, a, a)` positive and finite. With `a = 9e307`: `pbeta` `NaN`, `qbeta` 0.75, `dbeta` 0.

**Outcome:** Not addressed; waiting for comparison with R's values.

#### No.84: gamma distribution gives probability 0 near the mean for a finite shape and scale

- File: `src/distributions/gamma.ts`

```ts
const shape = 8e307;
const scale = 1.25e-308;
pgamma(1, shape, { scale });   // 0
dgamma(1, shape, { scale });   // 0
qgamma(0.5, shape, { scale }); // 1
```

- The mean is 1 and the median almost 1, so the CDF should be about 0.5 and the density positive.

**Outcome:** Not addressed; waiting for comparison with R's values.

### Double-double arithmetic

#### No.87: `ddMul()` turns a finite product into `NaN`

- File: `src/special/dd.ts:96–109`, `SPLITTER * a` overflows

```ts
ddMul([1e308, 0], [0.5, 0]);                     // [NaN, NaN]; expected 5e307
distSummary("binom", { size: 1e308, prob: 0.5 }).mode; // NaN; expected 5e307
```

**Outcome:** Fixed in 440b953, as No.27.

#### No.88: `ddDiv()` turns a finite quotient into `NaN`

- File: `src/special/dd.ts` (`ddDiv()`)

```ts
ddDiv([1e308, 0], [1e308, 0]); // [NaN, NaN]; expected 1
ddDiv([5e307, 0], [1e308, 0]); // [NaN, NaN]; expected 0.5
```

**Outcome:** Fixed in 440b953, as No.27.

## Part 6: No.89 to No.101

From No.94 on, the reviewer compared with the R implementations and removed No.94 to No.100 from the count of rStats.js-specific bugs because R or the upstream package behaves the same way. No.93 and No.101 were kept.

### Survival analysis and agreement

#### No.89: `survdiff()` returns a test result for a single group

See No.29 (re-output), which includes the example from No.89. The reviewer treats No.89 as the run confirmation of No.29.

**Outcome:** Fixed in 440b953.

#### No.90: `icc()` returns a result for one subject or one rater

- File: `src/htest/agreement.ts:243–285`

```ts
icc([[1, 2, 3]]);     // df1: 0, ICC: NaN, p-value: NaN
icc([[1], [2], [3]]); // df2: 0, ICC: NaN, p-value: NaN
```

**Outcome:** Fixed in 440b953. Fewer than 2 subjects or raters is an error.

#### No.91: Fleiss' kappa returns a finite test result for one subject

- File: `src/htest/agreement.ts:148–193`

```ts
kappamFleiss([[1, 2, 3]]);
// { value: -0.5, statistic: -1.224744871391589, pValue: 0.22067136191984693 }
```

- One rater is not rejected either and gives `NaN`.

**Outcome:** Fixed in 440b953. Fewer than 2 subjects or raters is an error.

#### No.92: `icc()` accepts an impossible correlation for `r0`

- File: `src/htest/agreement.ts`, `icc()`
- `icc([[1, 2], [2, 3], [3, 4]], { r0: 1.2 })` returns `Fvalue: -0.3636`, `pValue: 1` without an error.
- The reviewer found that ICC, Cronbach's alpha and partial correlation match the examples in the source for normal data.

**Outcome:** Fixed in 440b953. `r0` must be in [-1, 1).

### Tests

#### No.93: `ansariTest()` confidence interval throws when no interval can be formed

- File: `src/htest/ansariTest.ts`, `normalInterval()`

```ts
ansariTest([1, 2, 3], [-3, -2, -1], { exact: false, confInt: true });
// RangeError: lower < upper is not fulfilled
```

- The function's description says `NaN` is returned when no interval can be formed, but an invalid search interval is passed to `uniroot()`. The reviewer kept this finding: R 4.6.0 added a warning and `NA` when the candidate set is empty.

**Outcome:** Unchanged (decision pending). Same as R 4.5; R 4.6.0's behaviour (`NA` and a warning) needs checking.

#### No.94: `binomTest()` rounds a non-integer number of successes

- File: `src/htest/binomTest.ts`, `isCount()`
- `binomTest(1.00000001, 10)` rounds the count to 1 and returns a result; values within a relative error of 1e-7 are accepted as integers.
- Removed from the count by the reviewer: R's `binom.test()` uses the same 1e-7 tolerance.

**Outcome:** Unchanged. Same 1e-7 integer check as R's `binom.test`.

#### No.95: Jonckheere–Terpstra test returns a p-value above 1 for valid data

- File: `src/htest/trendTests.ts`, `jonckheereTest()`

```ts
jonckheereTest([1, 4, 2, 3], ["A", "A", "B", "B"], { alternative: "two.sided" });
// JT = 2, pValue = 1.3333
```

- Removed from the count by the reviewer: DescTools computes the exact two-sided p-value as `2 * min(lower, upper, 1)` and can give the same result.

**Outcome:** Fixed in 440b953. The two-sided p-value is at most 1.

#### No.96: `propTrendTest()` accepts impossible counts

- File: `src/htest/trendTests.ts`, `propTrendTest()` (from line 46)

```ts
propTrendTest([-1, 3], [10, 10]); // pValue about 0.00287
propTrendTest([11, 3], [10, 10]);
```

- Removed from the count by the reviewer: R's `prop.trend.test()` does not explicitly check these either.

**Outcome:** Fixed in 440b953. `0 <= x <= n`, and `n` must be positive and finite.

#### No.97: `polychor()` accepts a table with negative counts

- File: `src/htest/polycor.ts`, `polychor()`

```ts
polychor([[20, -8, 1], [5, 30, 9], [2, 6, 25]]); // rho about 0.9380, no warning
```

- Removed from the count by the reviewer: CRAN `polycor::polychor()` does not explicitly check for negative counts.

**Outcome:** Fixed in 440b953. Counts must be non-negative and finite.

#### No.98: `cochranQTest()` accepts non-binary data

See No.25 (re-output), which includes the example from No.98.

**Outcome:** Fixed in 440b953, as No.25.

#### No.99: `pwrTTest()` / `pwrT2nTest()` accept invalid sample sizes

- File: `src/htest/pwr.ts`

```ts
pwrTTest({ n: 1, d: 0.5 });                      // power: NaN
pwrT2nTest({ n1: Infinity, n2: 10, d: 0.5 });    // power about 0.3526
```

- Removed from the count by the reviewer: CRAN `pwr` checks `n < 2` but not finiteness, and `pwr.t.test()` has no minimum sample size check.

**Outcome:** Partly. `n < 2` is an error as before. `n = Infinity` is unchanged (decision pending).

#### No.100: `pwrChisqTest()` accepts zero degrees of freedom

- File: `src/htest/pwr.ts`, `pwrChisqTest()`
- `pwrChisqTest({ w: 0.3, N: 100, df: 0 })` returns power about 0.9889.
- Removed from the count by the reviewer: CRAN `pwr.chisq.test()` does not check that `df` is positive.

**Outcome:** Fixed in 440b953. `df` must be positive and finite.

#### No.101: `factanal()` runs an invalid rotation as Promax

- File: `src/descriptive/factanal.ts`, `factanal()`
- `factanal(x, 2, { rotation: "bogus" })` with a normal 5-variable, 80-observation matrix returns the same result as `rotation: "promax"`. The `else if` that rejects an invalid value is not reached when `q >= 2`.

**Outcome:** Fixed in 440b953.

## Part 7: No.102 to No.107

The report repeats No.102 to No.107 word for word; each finding is given once here.

#### No.102: `rank()` ties are wrong for infinite values

- File: `src/descriptive/rank.ts`, `rankValues()`

```ts
rank([Infinity, Infinity, Infinity], { tiesMethod: "last" });   // [1, 2, 3]; expected [3, 2, 1]
rank([Infinity, Infinity, Infinity], { tiesMethod: "random" }); // [1, 2, 3]; expected a random order
```

- Cause: the comparison is `x[a] - x[b]`, which is `NaN` for two equal infinities, so the tie handling is not reached.

**Outcome:** Fixed in 440b953. The comparison uses `<` and `>`.

#### No.103: `rank()` with an invalid `naLast` gives a missing value the same rank as data

- File: `src/descriptive/rank.ts`, `rank()`
- `rank([1, NaN, 2], { naLast: "bogus" as any })` returns `[1, 1, 2]`.

**Outcome:** Fixed in 440b953.

#### No.104: `leveneTest()` cannot be computed after a change of units

- File: `src/htest/groups.ts`, `median()`, used by `src/htest/leveneTest.ts` and `src/htest/rankTests.ts`

```ts
const x = [1, 2, 4, 8, 2, 3, 5, 7];
const g = ["A", "A", "A", "A", "B", "B", "B", "B"];
leveneTest(x, g);                      // F 0.2222, p-value 0.6540
leveneTest(x.map(v => v * 1e307), g);  // F and p-value NaN
```

- Same cause as the Fligner–Killeen finding; the reviewer adds the Levene test to its scope rather than counting it separately.

**Outcome:** Fixed in 440b953, with the same change as the Fligner test reported next to No.50.

#### No.105: `modelMatrix()` accepts duplicated factor levels and builds a wrong model matrix

- Files: `src/models/modelFrame.ts` `convert()`; `src/models/modelMatrix.ts` `design()`

```ts
modelMatrix("y ~ g", { y: [1, 2, 3], g: ["a", "b", "a"] }, { levels: { g: ["a", "a", "b"] } });
```

- The duplicated levels are kept; one `"a"` cannot be the reference level, and an indicator column that duplicates the intercept is created. A `Map` overwrites the same level with the later index.
- Correction by the reviewer: R's `factor()` does not always reject duplicated levels; R's `levels<-` makes the levels unique with `unique()` and reassigns the codes. The reviewer's revised suggestion is to make the levels unique and reassign the codes as R does.

**Outcome:** Fixed in 440b953. Duplicated levels are an error.

#### No.106: `rbindFrames()` creates a mixed-type column

- File: `src/descriptive/dataFrames.ts`, `rbindFrames()` / `gather()`

```ts
rbindFrames([{ x: [1, 2] }, { x: ["3", "4"] }]); // { x: [1, 2, "3", "4"] }
```

- A later `modelMatrix("~ x", result)` fails with `column 'x' mixes number and string values`. The same happens with logical and number values.

**Outcome:** Fixed in 440b953. Converted to a common type as in R (string, or number).

#### No.107: `tabulate()` overflows the stack with about 200,000 inputs

See No.22 (first output), which includes the examples from No.107 (`tabulate()`, `cut()` and the `wilcoxTest()` normal-approximation interval with 200,000 values).

**Outcome:** Fixed in 440b953, as No.22.

## Part 8: No.108 to No.123 (linear, generalised linear and mixed models; ANOVA)

### No.108 and No.109: text not in the received report

The received report has no entry of its own for No.108 or No.109. It refers to No.108 as a linear-regression finding about non-finite values (in No.110), and to No.109 as a missing check of `newdata` in `lm`'s `predict()` (in the extension below).

#### No.109, extended to GLM: `glmPredict()` does not detect `newdata` with the wrong number of columns

- File: `src/models/glm.ts`, `glmPredict()`

```ts
const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
glmPredict(fit, { newdata: [[7, 99]] }); // { fit: [NaN], seFit: [3.3878477095521484] }
```

- With `newoffset: [Infinity]`, the prediction is returned as `Infinity`. The reviewer adds this to the scope of No.109 rather than counting it separately.

**Outcome:** Fixed in 440b953. `newdata` with the wrong number of columns is an error (also in `lm`'s `predict`).

#### No.110: `glm()` neither drops nor rejects an infinite response

- File: `src/models/glm.ts`, `glm()`

```ts
glm([1, 2, 3, 4], [1, 2, Infinity, 4], { family: "gaussian" });
// coefficients [0, 0], deviance NaN or similar, a non-convergence warning
```

- Cause: rows are dropped only by `Number.isNaN()`.

**Outcome:** Fixed in 440b953. Non-finite values in `y` or `x` are an error.

#### No.111: `lmer()` reports a "perfect fit" only because the mean of the response is large

- File: `src/models/lmer.ts`, `lmerWithCriterion()`

```ts
const g = ["a", "a", "b", "b", "c", "c"];
const y = [1e12, 1e12 + 0.1, 1e12 - 0.1, 1e12 + 0.2, 1e12 - 0.2, 1e12 + 0.3];
lmer("y ~ 1 + (1 | g)", { y, g }); // error: response is fitted exactly by the fixed effects
```

- Subtracting `1e12` from the same data gives a normal fit with a residual SD of about 0.1871. Cause: the residuals are compared with `1e-12 * max(abs(y))`, which here is about 1.

**Outcome:** Fixed in 440b953. The threshold for a perfect fit is now 64 eps.

#### No.112: `predict()` accepts an invalid `interval`

- File: `src/models/lm.ts`, `predict()`

```ts
const fit = lm([1, 2, 3, 4, 5], [2, 4, 5, 8, 9]);
predict(fit, [6], { interval: "bogus" as any }); // returns lwr and upr of a confidence interval
```

**Outcome:** Fixed in 440b953. An invalid `interval` is an error.

#### No.113: `glmAnova()` compares GLMs with different responses

- File: `src/models/glmAnova.ts`, `glmAnova()`; only the number of observations is checked

```ts
const x = [1, 2, 3, 4, 5, 6];
const fit1 = glm(x, [0, 0, 0, 1, 1, 1], { family: "binomial" });
const fit2 = glm(x, [1, 0, 1, 0, 1, 0], { family: "binomial" });
glmAnova([fit1, fit2], { test: "LRT" }); // an LRT table, no warning

const small = glm([[], [], [], [], [], []], [0, 0, 0, 1, 1, 1], { family: "binomial" });
const large = glm(x, [1, 0, 1, 0, 1, 0], { family: "binomial" });
glmAnova([small, large], { test: "LRT" }); // p = 0.46756
```

- The reviewer adds that models with different families can also be compared.

**Outcome:** Not fixed (overlooked). A check that the compared models have the same response is needed.

#### No.114: `glmAnova()` silently accepts an invalid test

- File: `src/models/glmAnova.ts`
- `glmAnova(fit, { test: "bogus" as any })` returns an ANOVA table without the statistic and p-value columns.

**Outcome:** Fixed in 440b953. An invalid `test` is an error.

#### No.115: `glmConfint()` runs an invalid test as the Rao test

- File: `src/models/glmConfint.ts`
- `glmConfint(fit, { test: "bogus" as any })` returns exactly the same intervals as `test: "Rao"`; only `"LRT"` is checked.

**Outcome:** Fixed in 440b953. An invalid `test` is an error.

#### No.116: `glmPredict()` treats an invalid `type` as the response scale

- File: `src/models/glm.ts`, lines 828–832, `glmPredict()`

```ts
const fit = glm([1, 2, 3, 4, 5, 6], [0, 0, 1, 0, 1, 1], { family: "binomial" });
glmPredict(fit, { newdata: [7], type: "bogus" as any }); // 0.9859, same as type "response"
```

**Outcome:** Fixed in 440b953. An invalid `type` is an error.

#### No.117: `lmerContest()` treats a single zero contrast as a 1-df test

- File: `src/models/lmerTest.ts`, `fTestOf()`

```ts
const fit = lmer("y ~ x + (1 | g)", data);
lmerContest(fit, [0, 0]); // numDF: 1, F: NaN, pValue: NaN
```

- A zero contrast has rank 0, and a multi-row zero contrast gives an empty result; the `r === 1` branch runs first for a single row. The file's own description says a rank-0 hypothesis has no test result.

**Outcome:** Fixed in 3f0515b. A contrast of rank 0 gives no test (`undefined`).

#### No.118: prediction from a rank-deficient linear model processes non-estimable data without a warning

- File: `src/models/lm.ts`, `predict()`

```ts
const fit = lm([[1, 1], [2, 2], [3, 3], [4, 4], [5, 5]], [2, 4, 5, 8, 9]);
predict(fit, [[6, 7]]); // prediction 11, SE 0.5416, no warning
```

- In the training data `x1 === x2`, so `x1 = 6, x2 = 7` is outside the estimable space. R's `predict.lm()` warns by default for rank-deficient fits, and `rankdeficient = "NA"` sets such rows to `NA`. `glmPredict()` in `src/models/glm.ts` has the same structure.

**Outcome:** Fixed in 3f0515b. As R 4.5's `predict.lm`, non-estimable rows are returned in `nonEstimable` with a warning (also in `glmPredict`).

#### No.119: `lmerAnova()` compares models fitted on different rows

- File: `src/models/lmerAnova.ts`, `compareFits()`; `nObs` is compared, `fit.rows` is not

```ts
const data = {
  y:  [1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 8, 9],
  x1: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, NaN, NaN],
  x2: [NaN, NaN, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12],
  z:  [NaN, NaN, 2, 1, 4, 3, 6, 5, 8, 7, 10, 9],
  g:  ["a", "a", "a", "b", "b", "b", "c", "c", "c", "d", "d", "d"],
};
lmerAnova([lmer("y ~ x1 + (1 | g)", data), lmer("y ~ x2 + z + (1 | g)", data)]);
// rows [0..9] and [2..11], both nObs = 10; LR statistic 2.2516, p-value 0.1335
```

- Extra reproduction with different responses on the same rows: `y1 ~ 1 + (1 | g)` against `y2 ~ x + (1 | g)` (`y1 = [1, 2, 2, 3, 4, 5, 5, 6, 7, 8, 8, 9]`, `y2 = [9, 8, 8, 7, 6, 5, 5, 4, 3, 2, 2, 1]`, `x = 1..12`) gives an LR statistic of 39.4099 and a p-value of 3.44e-10.

**Outcome:** Fixed in 3f0515b. If the rows used or the responses differ, it is an error.

#### No.120: Satterthwaite degrees of freedom change from finite to infinite after only a change of units of the response

- File: `src/models/lmerTest.ts`, line 26 and around line 105; `const HESSIAN_TOLERANCE = 1e-8;` drops Hessian eigenvalues below this absolute value

```ts
const fit1 = lmer("y ~ x + (1 | g)", { y, x, g });
const fit2 = lmer("y ~ x + (1 | g)", { y: y.map(v => v * 1e6), x, g });
lmerSummary(fit1); // fixed-effect df [38, 38]
lmerSummary(fit2); // df [Infinity, Infinity], with a warning that a Hessian eigenvalue is near 0
```

**Outcome:** Not fixed. The plan is to standardise the response internally; a large change.

#### No.121: a random-slope model stops converging after only a change of units of the covariate

- File: `src/models/lmer.ts`, `minimiseCriterion()` and `localMinimum()`
- `lmer("y ~ x + (x | g)", { y, x, g })` with `x` multiplied by 1, 10,000 and 100,000 converges; by 300,000 and 1,000,000 it fails with `minimisation of the criterion over theta did not converge`. The random-intercept model `y ~ x + (1 | g)` converges with the same scaling.

**Outcome:** Not fixed. The plan is to standardise the columns of X and Z internally; a large change.

#### No.122: in repeated-measures ANOVA, a change of units of a covariate removes its effect

- File: `src/models/aovStrata.ts`, `stratumTable()` (around line 45): `const kept = zcols.flatMap((c, j) => ddSumSquares(c)[0] > 1e-5 ? [j] : []);`

```ts
const data = {
  id: ["a", "a", "b", "b", "c", "c", "d", "d", "e", "e", "f", "f"],
  w:  ["pre", "post", "pre", "post", "pre", "post", "pre", "post", "pre", "post", "pre", "post"],
  x:  [1, 1, 2, 2, 3, 3, 4, 4, 5, 5, 6, 6],
  y:  [2, 3, 3, 5, 4, 6, 5, 8, 7, 9, 8, 11],
};
aov("y ~ x + w + Error(id/w)", data);
aov("y ~ x + w + Error(id/w)", { ...data, x: data.x.map(v => v * 1e-4) });
```

- Original `x`: the between-subject `x` effect has df 1 and sum of squares 67.207. `x` times 1e-4: the `x` row disappears and the residual df changes from 4 to 5. Suggested: a relative rank decision by QR instead of the absolute threshold.

**Outcome:** Fixed in 3f0515b. The threshold is now 1e-5 times the mean square of the column.

#### No.123: `aovEz()` silently ignores an invalid effect size

- File: `src/models/aovEz.ts`, around line 178

```ts
aovEz(data, { id: "id", dv: "y", within: "W", es: "bogus" as any }); // table without effect-size columns
```

- `es: ["ges", "bogus"]` computes only `"ges"`.

**Outcome:** Fixed in 440b953. An invalid `es` is an error.

## Checks without findings

The reviewer also reported these checks, in which no problem was found:

- Quantiles (9 definitions) against NumPy; binomial test (250 cases), Fisher's exact test (250 2x2 tables) and Wilcoxon rank-sum test against SciPy; Shapiro–Wilk (150 cases, no large difference); linear regression (150 cases) against NumPy; logistic regression (100 cases) and Cox regression (80 cases) against statsmodels; linear systems and SVD by residuals against NumPy.
- Relationship between CDF and quantile for 13 main distributions in the usual probability range; normal, logistic, t, gamma, beta, F and chi-squared against SciPy.
- Incomplete gamma (121 cases), incomplete beta (648 cases) and Bessel I/K/J/Y (308 cases) against SciPy.
- Noncentral chi-squared (7 parameter sets: CDF, density, median) and noncentral beta (5 sets: CDF, density) against SciPy, including noncentrality of 1e6 and above.
- ICC, Cronbach's alpha and partial correlation against the examples in the source.
- `lmer()` coefficients, variance components and REML criterion, and `lmerAnova()` F, df and p-values, against the expected values in the source.
- Multiple comparisons: Dunn test with Holm correction, Tukey–Kramer, Games–Howell, Dunnett, and pairwise t, Wilcoxon and proportion tests.
- GLM residuals, hat values and Cook's distance on ordinary data and data with zero weights.
- Weighted `lm()` against Gaussian `glm()`: coefficients `[0.2788339670, 1.4588086185]`, residual variance 0.1077313054 and residual df 4 match; scaling all weights leaves the coefficients unchanged; a constant offset shifts the intercept; zero weights and `NaN` weights or offsets drop the row. With extremely small weights (about 1e-320) the SE can be `Infinity`; not counted as a bug because it was not compared with R.
- Singular fit detection (zero random-intercept or random-slope variance, correlation at the boundary), equal fixed effects under REML and ML, and refitting REML models with ML for comparison.
