# Issue #223 log: poissonTest's expected count is NaN where the fallback overflows too

GitHub Issue #223. Session 11, group A2.

## Plan

- Intent: the two-sample `poissonTest` reports R's `parameter`, the expected first count `n r T1 / (T1 + r T2)` (`expectedCount1`). Where the direct form overflows it falls back to `(n r) / (1 + r (T2 / T1))`, which overflows as well when `n r` or `r T2 / T1` is beyond the doubles: `poissonTest([1e308, 0], { r: 2, T: [1, 1e308] })` gave `Inf / Inf = NaN`, while the true value is `2D / (1 + 2D)`, which rounds to 1.
- Method: keep the direct form and the existing fallback wherever their intermediates are finite. Only where `n r` or `1 + r (T2 / T1)` is not finite, split n, r, T1 and T2 into mantissas in [1, 2) and powers of 2 and compute `T1 / (T1 + r T2)` with the power of 2 on the term it makes smaller, so the quotient is in (0, 2), and apply the powers of 2 last (`ldexp`).
- Why: a sweep of 200000 random inputs (n up to 1e6, r in [1e-3, 1e3], T in [1e-320, 1e308]) that reach the existing fallback showed it about as accurate as the new form against an exact BigInt quotient (each closer in about the same number of cases, mostly 1 ulp), so it is kept and its values keep their bits; the new branch is reached only where the result was NaN, Infinity or a wrong 0. The new values differ from R (NaN, an error, 0), so they are recorded in the docs.
- Own judgement: with `n = 0` or `r = 0` the new branch returns 0 directly (the mantissa split needs positive values). This also changes `poissonTest([1, 1], { r: 0, T: [1e-320, 1e308] }).parameter` from NaN (`0 × (T2 / T1) = 0 × Inf`) to 0, R's value.

## Check (main after #201; R 4.5.2, Rmpfr with 300 bits; doubles passed as hex)

| x, r, T | R 4.5.2 | Before | After | Rmpfr |
|---|---|---|---|---|
| (1e308, 0), 2, (1, 1e308) (the issue) | NaN (bgrat warnings) | NaN | 1 | 0x1p+0 |
| (1e308, 0), 4, (1, 1) (n r overflows) | error "result would be too long a vector" | Infinity | 8.000000000000001e307 (1 ulp above) | 0x1.c7b1f3cac7433p+1022 (8e307) |
| (1e300, 0), 2, (1e-10, 1e308) (r T2 / T1 overflows) | 0 | 0 | 1e-18 (0x1.2725dd1d243acp-60) | 0x1.2725dd1d243acp-60 |
| (1, 1), 0, (1e-320, 1e308) | 0 | NaN | 0 | 0 |
| (0, 0), 0, (1e-320, 1e308) | 0 | NaN | 0 | 0 |
| (5, 5), 1, (1e308, 1e308) | NaN | 5 | 5 (existing fallback) | |
| (11, 23), 1, (800, 3011) | 7.137234 | 7.137234321700341 | unchanged | |

## Fix

- `src/htest/poissonTest.ts` (`expectedCount1`): the third branch, with a local `frexp` (the same as in `src/distributions/cauchy.ts`) and `ldexp` from `src/internal/summary.ts`.
- Docs: a row in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue223.test.ts`: the three overflow cases against Rmpfr (the issue's exactly, the others within 2 ulps), r = 0, and unchanged values. With src stashed the first two tests fail.
- The test files that mention `poissonTest`: 71 passed.

## Out of scope

- The new branch rounds several times (up to about 1 ulp off, as in the n r overflow case above). Not refined.

## close comment

Fixed in <commit of #223, see git log --grep='#223'>: where both the direct form and the ratio fallback of `n r T1 / (T1 + r T2)` overflow, `poissonTest` now computes the expected count from the mantissas of n, r, T1 and T2 and applies their powers of 2 last. The issue's example `poissonTest([1e308, 0], { r: 2, T: [1, 1e308] }).parameter` is 1 (was NaN; R 4.5.2 also gives NaN, recorded in docs/differences-from-r.md), and `r = 0` with out-of-range time bases gives R's 0 instead of NaN. Expected counts that did not overflow are unchanged. Test: test/issue223.test.ts. (Not pushed yet.)
