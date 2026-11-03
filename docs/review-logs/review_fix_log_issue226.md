# Issue #226 log: mantelhaenTest (2 x 2 x K) gives NaN where the stratum totals overflow

GitHub Issue #226. Session 11, group A8.

## Plan

- Intent: the 2 x 2 x K asymptotic test sums each stratum's cells with plain addition. Finite counts near 1e308 give an infinite total, and the expected count, variance and odds ratio terms become Inf / Inf = NaN; the sums over the strata (sum a, sum E(a)) can also overflow with finite totals.
- Method, only where a stratum total or one of the sums over the strata (sum a, sum E(a), sum Var(a), and the four Robins-Breslow-Greenland sums) is not finite: divide all counts by an even power of 2, 2^s (the shared `countExponent` of #224: largest count below 2^1020 / (8 I J K)), form the sums again with the count 1 of `t - 1` as 2^-s, then
  - statistic = 2^s times `squareOver(abs(delta') - yates', sv')`, with the continuity correction 1/2 as 2^-s / 2 and its condition abs(delta) >= 1/2 as abs(delta') >= 2^-s / 2;
  - the estimate sR / sS unchanged (degree 0);
  - the sd of log(estimate) 2^(-s/2) times (its square is of degree -1; s even keeps this exact).
- Why this: every term is homogeneous in the counts, so the power of 2 is exact and the result is the test on the given counts; where nothing overflows the code path and bits are unchanged (s = 0, `ldexp(x, 0)` is x). The same scaling as #224 for the general branch.
- R fails (error "missing value where TRUE/FALSE needed"; the issue says NaN), so the new value is recorded in docs/differences-from-r.md and docs/ja.

## Check (main `25b355d`)

| call | R 4.5.2 | Before | After | Reference |
|---|---|---|---|---|
| `[[1e308, 1e308], [1e308, 1e308]]` twice (the issue) | error | statistic, estimate, interval NaN | statistic 0, p 1, estimate 1, interval [1, 1] | 0 and 1; the sd of log(estimate) is about 1e-154, so the limits round to 1 |
| `[[1e308, 5e307], [3e307, 1e308]]`, `[[4e307, 1e308], [2e307, 6e307]]` | error | statistic NaN, estimate NaN | 3.7755956165032934e307, estimate 3.226966292134831 | Rmpfr (300 bits): `0x1.ae2150376cad2p+1021` (6 ulps), `0x1.9d0d3b4101b9dp+1` (1 ulp) |
| counts 1e150 (the fallback of review 58), the documented example | | 0; 8.972595458903124 | the same bits | |

## Fix

- `src/htest/mantelhaenTest.ts`: the per-stratum sums of `asymptotic2x2xK` moved to `sums2x2xK` (with `one` for the count 1 in `t - 1`); `asymptotic2x2xK` repeats them on the scaled counts where a total or a sum is not finite and scales the statistic, the correction and the sd.

## Tests

- `test/issue226.test.ts`: the issue's balanced strata (statistic, p, estimate, interval), the unbalanced pair with and without the correction and one-sided against the Rmpfr values, and unchanged values at 1e150 and for the documented example. With `src/` stashed the first two tests fail.
- `npx vitest run`: 331 files passed (2745 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- A difference sum a - sum E(a) that is far below the counts is lost to rounding at any scale: `[[1e308, 1], [1, 1]]` twice now gives statistic 0 (true about 2.8e307: the difference is about 2 against counts of 2e308). The same holds without overflow (counts 1e300 with cells 1) and in R; it needs extended precision, not scaling.
- The interval where sR^2 or sS^2 overflows or underflows (review 58, recorded only): in the case above the limits are NaN, and the estimate 1.0000000000001038e308 has lost bits because b c / t is subnormal.

## close comment

Fixed in <commit of #226, see git log --grep='#226'>: where a stratum total or a sum over the strata overflows in the 2 x 2 x K asymptotic branch of `mantelhaenTest`, all counts are now divided by an even power of 2, the sums are formed again (the count 1 in t - 1 scaled likewise), and the statistic is multiplied back by that power, the continuity correction scaled with it, and the sd of the log odds ratio multiplied back by its square root. Every term is homogeneous in the counts, so this is exact. The issue's balanced strata now give statistic 0, p-value 1, common odds ratio 1 (they gave NaN; R fails with "missing value where TRUE/FALSE needed"), and an unbalanced pair of strata near 1e308 is within a few ulps of a 300-bit Rmpfr computation. Values where nothing overflows are unchanged. Recorded in docs/differences-from-r.md.

Test: test/issue226.test.ts. (Not pushed yet.)
