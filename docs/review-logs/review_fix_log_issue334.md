# Issue #334 log: weightedMean losing a residual weight in its overflow fallback

GitHub Issue #334. Session 12, group A4 (small-number fallbacks).

## Plan

- Intent: `weightedMean` falls back, where the plain quotient or the sum of the weights is not finite, to values and weights divided by powers of 2 that bring their largest absolute values into [1, 2). Signed weights that cancel can leave a residual far below the largest weight, and that residual underflows in the division: `weightedMean([1e308, 1e308, 1e308], [1e308, -1e308, 1e-308])` became 0 / 0 = NaN, while the weighted mean is 1e308.
- Method: in the fallback, form both sums exactly in BigInt (each product as an integer mantissa times a power of 2, as `rescaledDot` in `src/linalg/dot.ts` does for matMul) and round the quotient once. The rounding at the end of `rescaledDot` is moved into an exported `roundScaled` (same code). Where the exact sum of the weights is 0 (no mean), the old scaled path is kept (the same NaN or Infinity).
- Why exact sums rather than exponent-separated double sums: cancellation in the weights or the products can leave any residual, so only exact sums keep it in general. The cost is paid only in the fallback (non-finite plain result); the plain path is untouched, so values outside the fallback keep their bits.

## Check (main `c996fba`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `weightedMean([1e308, 1e308, 1e308], [1e308, -1e308, 1e-308])` (R with 2^1023 and 2^-1023) | NaN | NaN | 1e308 |
| `weightedMean([2^1000, 2^1000, 3], [2^1000, -2^1000, 2^-1000])` | | NaN | 3 |
| `weightedMean([1e308, 2, 3], [1e308, -1e308, 1e-308])` | | NaN | Infinity (the exact quotient is about 1e924) |

The earlier fallback cases (#201: sums of products or of weights that overflow) give the same bits with the exact path (`test/issue201.test.ts`, the weightedMean fixture in `test/descriptive.test.ts`).

## Fix

- `src/descriptive/basic.ts`: `exactWeightedMean`, used in the fallback before the scaled path.
- `src/linalg/dot.ts`: `roundScaled` split out of `rescaledDot` and exported.
- docs (en, ja): the weighted.mean row of differences-from-r gains the cancelling weights.

## Tests

- `test/issue334.test.ts`: the issue's call and other cancelling weights; unchanged earlier values. With `src/` stashed the first test fails.
- `test/issue201.test.ts`, `test/descriptive.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Products that underflow before the fallback is reached (#364) are a separate issue.

## close comment

Fixed in <commit of #334, see git log --grep='#334'>: where `weightedMean` falls back because the plain quotient is not finite, it now forms the sum of the products and the sum of the weights exactly (integer mantissas times powers of 2) and rounds the quotient once, so a residual of cancelling weights is kept: `weightedMean([1e308, 1e308, 1e308], [1e308, -1e308, 1e-308])` is 1e308 (was NaN; R also gives NaN, recorded in docs/differences-from-r.md). Values that do not reach the fallback are unchanged, and the earlier fallback cases (#201) give the same values. Test: test/issue334.test.ts. (Not pushed yet.)
