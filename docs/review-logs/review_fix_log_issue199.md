# Issue #199 log: lm weighted QR overflows after multiplying a finite design by a common square-root weight

GitHub Issue #199. Session 11, group A7 (lm).

## Plan

- Intent: `fitLmUnit` decomposes the model matrix with rows multiplied by sqrt(w). The weights are not scaled for the decomposition (only for the sums of squares, by 2^kw with the largest weight in [1, 4)), so sqrt(w) x can overflow where x does not: x = (0.7, 0.8, 0.9) e308 with weights 2 has the weighted column norm 1.97e308, and the coefficients were -Inf and 1e-307 (R NaN).
- Method: only where the decomposition with the given weights has an entry that is not finite (and the largest weight is finite and at least 1), decompose again with the weights divided by 2^qw, qw = kw + 2 (the largest weight then in [1/4, 1), so no entry of sqrt(w) x exceeds the entry of x); sqrt(w) 2^(-qw/2) is formed from sqrt(w) (no underflow before the square root, as in #194). The coefficients and the residuals do not depend on a common factor of the weights, so they come from this decomposition as they are. The covariance uses R as it is, and the standard errors are divided by 2^((qw - kw) / 2) (multiplying R by that factor could overflow again). The result's `qr` is this decomposition; a WeakMap keyed by the QR object (`QR_WEIGHT_EXPONENT`) records qw, and `predict` multiplies its se by 2^(-qw/2).
- Why this: the triage's "scale the weights by a power of 2 only when the QR is not finite"; fits whose decomposition is finite are not touched (the same bits, the whole suite unchanged). Keying the WeakMap by the QR object keeps it across the spreads of the result (the formula result, aov). R's own decomposition is NaN here, so `qr` has no R value to match; the scale is recorded in docs.
- The formula form also refits in double-double, which squared the columns: x near 1e308 gave NaN even without weights. The column scaling of #194 (a column outside [2^-256, 2^256] divided by its power of 2 before the double-double decomposition) already makes that finite, so with this change the formula form fits too.

## Check (main `a27f977`)

| call | R 4.5.2 | Before | After | Rmpfr |
|---|---|---|---|---|
| `lm(x, y, { weights: [2, 2, 2] })`, x = (0.7, 0.8, 0.9) e308, y = (1, 2, 3) | NaN, NaN | -Infinity, 1e-307; se Infinity, 0 | -5.999999999999992, 9.999999999999993e-308; se 1.7855847292324853e-15, 2e-323 (the same as the fit on x / 2, exactly) | -5.99999999999999933, 9.99999999999999889e-308 |
| the same in the formula form | NaN, NaN | NaN, NaN | -5.999999999999999, 1e-307; sigma 5.761494699846881e-16, se 2.316569897537906e-15 | sigma 5.76149469984688222e-16, se 2.31656989753790918e-15 |
| `lm("y ~ x")` without weights, same data | NaN, NaN | NaN before `90840cf` (#194), now -5.999999999999999, 1e-307 | (unchanged by this commit) | as above |
| matrix form without weights, or with weights 0.25 | NaN | -6.000000000000023, 1.0000000000000025e-307 | the same bits | |
| `predict(fit, [0.8e308, 0]).seFit` (weights 2) | | Infinity, Infinity | 1.8129866073473576e-16, 1.7855847292324853e-15 (= the fit on x / 2 at 0.4e308, 0) | |

The matrix form's intercept is 8 ulp from Rmpfr, the accuracy of the double-precision decomposition (the unweighted matrix fit is 26 ulp away). The R differences are recorded in docs/differences-from-r.md and docs/ja.

## Fix

- `src/models/lm.ts` (`fitLmUnit`): kw computed before the decomposition; the fallback decomposition with qw; `Rr` scaled by 2^(-kw/2) only for the usual decomposition, the standard errors divided by 2^((qw - kw)/2) otherwise. `finiteQR`, `QR_WEIGHT_EXPONENT`.
- `src/models/lm.ts` (`predict`): the se multiplied by 2^(-qw/2) for such a decomposition (through `scaledProduct`, also in the #196 fallback).

## Tests

- `test/issue199.test.ts`: the issue's matrix fit (coefficients against Rmpfr, equality with the fit on x / 2 including sigma, residuals, se and `predict`, finite `qr`), the formula form (coefficients, sigma and se against Rmpfr, equal coefficients without weights), and unchanged fits whose decomposition was finite. With `src/` stashed the first two tests fail.
- `npx vitest run`: 326 files passed (2731 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- A model matrix whose own column norm overflows (x near 1.5e308 without weights) still fails in the matrix form (`qr` itself); that is not the weighting of the issue.
- `carAnova` (`addedSS`) decomposes sqrt(w) x again with the weights given, so a type II/III table on such a fit still overflows (x with a fourth row 0.75e308, weights 2: the Sum Sq of x is NaN before and after).

## close comment

Fixed in <commit of #199, see git log --grep='#199'>: where the QR decomposition of the model matrix with rows scaled by sqrt(w) is not finite, `lm` now decomposes it again with the weights divided by a power of 2 (the largest weight then below 1, so no entry exceeds the unweighted one). The coefficients and residuals do not depend on a common factor of the weights; the standard errors are scaled back, and `predict` accounts for the scale of that decomposition (kept in `qr`). For the issue's data, `lm([0.7e308, 0.8e308, 0.9e308], [1, 2, 3], { weights: [2, 2, 2] })` now gives -5.999999999999992 and 9.999999999999993e-308 (they were -Infinity and 1e-307; R gives NaN), exactly the fit on x / 2, and the formula form -5.999999999999999 and 1e-307 (Rmpfr -5.99999999999999933, 9.99999999999999889e-308). Fits whose decomposition was finite keep their bits. Recorded in docs/differences-from-r.md.

Test: test/issue199.test.ts. (Not pushed yet.)
