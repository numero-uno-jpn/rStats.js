# Issue #200 log: pwrAnovaTest overflows k n, and the F test with huge degrees of freedom

GitHub Issue #200. Session 11, group B3 of the first preparation (bprep_1), implemented by the user's decision (P14), after #202.

## Plan

- Intent: `pwrAnovaTest` forms the noncentrality as `k * n * f ** 2`. For k = n = 1e160, f = 1e-160 the product k n overflows and the power is reported as the limit 1, although the noncentrality is 1. As in #202, the noncentrality alone is not enough: df1 = k - 1 = 1e160 and df2 = (n - 1) k = Inf, and the critical value `qf(0.95, df1, df2)` rounds to 1 in doubles (with the noncentrality corrected, `pf(1, ...)` gives about 0.5).
- User's decision (B3, first round): the noncentrality from scaled terms where it is not finite, and the normal approximation of F where both degrees of freedom exceed 1e20 (R gives NaN; docs).
- Method:
  - Where `ncp` is not finite (Inf, or NaN from Inf 0) for finite k, n and f, the product of the four factors k, n, f, f, each scaled to [1, 2) by a power of 2 with the exponents added back at the end (`scaledProduct`, local to pwr.ts; 0 if a factor is 0). The four-factor `scaledProductOver` of power.ts (#272) is a b c / d and would need 1/f, which overflows for a subnormal f.
  - Then, as before, Infinity gives the limit 1; and where both degrees of freedom exceed 1e20 (here k - 1 > 1e20, as df2 >= df1), `fPowerHugeDf` from #202.
- Why: the decided option. Only calls with a non-finite noncentrality or k - 1 > 1e20 change; ordinary values keep their bits (checked below).

## Check (after #202 `95cfdd2`, R 4.5.2, pwr 1.3.0)

| Call | R | Before | After |
|---|---|---|---|
| `pwrAnovaTest({k: 1e160, n: 1e160, f: 1e-160})` | NaN | 1 | 0.04999999999999999 (0.05 + 7e-82) |
| the same with f = 0 | | NaN | 0.04999999999999999 (noncentrality 0) |
| `pwrAnovaTest({k: 3, n: 1e308, f: 1e-154})` (ncp 3, df2 Inf) | NaN | 1 | 0.32152403656716766 (R with n = 1e300, f = 1e-150: 0x1.493d98d7bc4e9p-2 = 0.3215240365671677) |
| `pwrAnovaTest({k, n: 2, f})`, k = 1e24 / 1e40 / 1e200 with ncp = 2 sqrt(k) | 1 with "pnchisq not converged" (1e24, 1e40) | 0.25918990661239977 / 0 / 0 | 0.25951102284186195 / 0.259511022841444 / 0.259511022841444 (limit 0.25951102284144434) |
| k 4 n 20 f 0.25; solving n for power 0.8; k 3 n 1e300 f 1e-150; k 1e20 n 2 f 1e-5; f 1e200; k Inf | | 0.42039009037704295, 44.599274320396226, 0.32152403656716777, 0.25951419851352897, 1, 1 | unchanged |

## Fix

- `src/htest/pwr.ts`: `scaledProduct`, and in `pwrAnovaTest`'s `powerOf` the fallback, the limit 1 and the branch to `fPowerHugeDf`.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row after the #202 row.

## Tests

- `test/issue200.test.ts`: the issue's example and f = 0 (0.05 to 1e-14), k = 3, n = 1e308 against R's value for the same noncentrality (1e-14), the sweep k = 1e24 to 1e200 against the limit (1e-10), and unchanged values from before the fix. With `src/` stashed (the #202 commit in place) the first test fails.
- `npx vitest run`: 351 files passed (2801 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- As in #202, at k - 1 = 1e20 exactly (not above the threshold) and somewhat below, the exact path is still off (k = 1e20, n = 2, ncp = 2e10 gives 0.25951419851352897, 1.2e-5 relative from the limit). See the #202 log.
- `powerAnovaTest` (power.ts) has the same loss of the critical value (the #272 log's Out of scope). Checked here with a prototype outside the repository (`fPowerHugeDf` applied where both degrees of freedom exceed 1e20, lambda as power.ts forms it): the #272 example groups 1e200, n 1e200, between 1e8, within 1e308 (lambda 1e100) gives 0.17418726161793208 for 0.7602499389065251 now; groups 1e30, n 2, between 1, within 1e15 (lambda 2e15 = 2 sqrt(df1)) gives 0.25951102284144456 for 5.2e-175 now; groups 1e40, n 2, between 2, within 1e20 gives 0.6387600313123349 for 0 now. Calls with groups - 1 <= 1e20 (every ordinary call, and groups 3, n 1e308 of #272) keep their bits. Not applied: it is not part of the user's decision.

## Follow-up 1: the threshold lowered to 1e16 (user's decision, fifth round)

- The threshold `HUGE_DF` shared with `pwrF2Test` is now 1e16 (both functions in one commit); the check against a 256-bit reference and the table are in the #202 log ("Follow-up 1"). For `pwrAnovaTest` this means k - 1 > 1e16: `pwrAnovaTest({k: 1e20, n: 2, f: 1e-5})` (df1 = df2 = 1e20, ncp 2e10) gives 0.2595110228832371 for the reference 0.25951102280903905 (before 0.25951419851352897, off by 3.2e-6). The first Out of scope bullet above is resolved by this.
- Tests: the k = 1e20 row of `test/issue200.test.ts` ("unchanged") is replaced by k = 1e16 (not above the threshold, unchanged); k = 1e20 is checked against the reference in `test/issue202.test.ts`.

## close comment

Fixed in <commit of #200, see git log --grep='#200'>.

`pwrAnovaTest` now forms the noncentrality from k, n, f and f scaled by powers of 2 where `k n f^2` is not finite for finite inputs, so `pwrAnovaTest({k: 1e160, n: 1e160, f: 1e-160})` no longer takes the infinite-noncentrality shortcut. As the issue notes, the degrees of freedom are then out of the ordinary range too (df1 = 1e160, df2 = Inf), and the critical value `qf(0.95, df1, df2)` rounds to 1 in doubles; where both degrees of freedom exceed 1e20 the power is now taken from the normal approximation of the F statistic, as for `pwrF2Test` in #202 (error below 1e-10 there). The example gives 0.04999999999999999 (the exact value is 0.05 + 7e-82; R gives NaN), and `k: 3, n: 1e308, f: 1e-154` gives 0.32152403656716766 for the noncentrality 3 (R's value with the same noncentrality is 0.3215240365671677). Ordinary calls are unchanged. The normal approximation is used where both degrees of freedom exceed 1e16 (lowered from 1e20 together with `pwrF2Test`, #202: between the two the exact path was off by up to 3e-6; k = 1e20, n = 2, f = 1e-5 now gives 0.2595110228832371 against a 256-bit reference 0.25951102280903905). Documented in docs/differences-from-r.md; tests in test/issue200.test.ts.

(Not pushed yet.)
