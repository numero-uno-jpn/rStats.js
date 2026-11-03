# Issue #376 log: distSummary variance of unif, arcsine and logis with the square out of range

GitHub Issue #376. Session 12, group A3 (distSummary).

## Plan

- Intent: the unif and arcsine variances square the width before dividing by 12 or 8, the logis variance squares the scale before multiplying by pi^2 / 3. The square overflows or underflows although the variance is representable, and the variance then contradicts the finite sd from sdDirect.
- Method: a receptacle. A helper `rescaled(v, f, ...[x, degree])` returns v where it is a normal number; otherwise it evaluates the same expression f on the parameters scaled by powers of 2 to [1, 2) and multiplies the result back by 2^(sum of degree times exponent). The scaling is exact, so the roundings are those of the original expression; only the intermediate power no longer leaves the range. The same helper serves #377, #378 and #383.
- Why not sd * sd: the sd is itself rounded (twice or more), so its square would add roundings; the scaled expression keeps the ordinary formula.

## Check (main `0a7d85d`)

distSummary is not an R function; references are Rmpfr (2000 bits) on the exact doubles.

| call | before | after | Rmpfr |
|---|---|---|---|
| `unif(0, 2e154)` variance | Infinity | 0x1.7bbef5d3a60d5p+1021 | 0x1.7bbef5d3a60d6p+1021 (1 ulp: w^2 / 12 rounds twice, as in the ordinary range) |
| `unif(0, 2e154)` sd | 5.773502691896258e153 (sdDirect) | 5.7735026918962576e153 (0x1.b8f12c593dc9cp+510) | 0x1.b8f12c593dc9cp+510 |
| `arcsine(0, 2e154)` variance | Infinity | 0x1.1ccf385ebc8a0p+1022 | the same |
| `logis(scale 1e-162)` variance | 0 | 5e-324 | 3.29e-324, rounds to 5e-324 |

The sd now comes from sqrt(variance) wherever the variance is normal (the rule of `make()`); for unif it became the correctly rounded value.

## Fix

- `src/distributions/summary.ts`: new helper `rescaled()`; the unif, arcsine and logis variances go through it.

## Tests

- `test/issue376.test.ts`: the three calls (fail with `src/` stashed) and unchanged values in the normal range and where the true variance overflows.
- The distSummary test files (22) and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #376, see git log --grep='#376'>. Where the variance of unif, arcsine or logis leaves the normal range, it is now formed from the width or scale scaled by a power of 2 to [1, 2), the same expression, multiplied back: unif(0, 2e154) has variance 3.33e307 (within 1 ulp of the exact value; the ordinary-range formula rounds twice too), arcsine(0, 2e154) 5e307 and logis(scale 1e-162) 5e-324. Values in the normal range are unchanged. (Not pushed yet.)
