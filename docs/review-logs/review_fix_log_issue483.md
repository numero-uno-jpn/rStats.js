# Issue #483 log: ksTest exact two-sided one-sample p-value for D < 1/2 and a small p-value

GitHub Issue #483. Session 13, group B (B9).

## Plan

- User decision (2026-11-03): option A of the preparation. Only where 2 P(D+ >= d) < 1e-2 (an upper bound of p, Birnbaum-Tingey, O(n)), the upper tail P(D >= d) is built directly as a sum of positive terms (a Markov chain of the empirical counting process with binomial steps). Where that needs more work than a few seconds, back to the current 1 - P(D < d) (no new RangeError). R differs, so docs (en, ja).
- Intent: 1 - P(D < d) (Marsaglia-Tsang-Wang, in R as here) has absolute accuracy 1e-15 only, so small p-values lose their digits (p < 1e-15 has none). The switch at 2 P+ < 1e-2 keeps every bit where p may be 1e-2 or larger (R's value there is right to 1e-13 relative or better).
- The #307 RangeError check of the matrix is still made first, unchanged: the new sum only replaces values of calls that already succeed.

## Reproduction (main `9b687f8`, R 4.5.2, Rmpfr)

`x = (1:99)/99`, F(q) = 0.51 q, exact: D = 0.49.

| | p-value |
|---|---|
| before (`1 - pkolmogorovExact`) | 2.9976021664879227e-15 |
| R 4.5.2 `ks.test(exact = TRUE)` | 1.9984014443252818e-15 |
| true (Rmpfr 256 bits, 2 P(D+ >= d); the double crossing is negligible at d = 0.49) | 1.9222472248029365e-22 |
| after | 1.9222472248029486e-22 (6e-15 relative) |

Other Rmpfr references (Marsaglia's matrix in 256 bits): n 20, d 0.45: 3.2446411409554644e-4; n 40, d 0.4: 2.7416081587210552e-6; the R fixtures n 69 and 96: 2.7331790336971829e-3, 8.5305602375530878e-4. The sum is within 7e-15 relative of all of them; R and the old value are off by 8e-13 to 4e-11 relative.

## Cause

`src/htest/ksTest.ts` formed every exact two-sided one-sample p-value for D < 1/2 as `1 - pkolmogorovExact(n, D)`. The D >= 1/2 case was already 2 P(D+ >= d) (review 59, HTEST-018), where D < 1/2 had been recorded only.

## Fix

- `src/htest/core/kolmogorov.ts`: `pkolmogorovExactUpper(n, d)`. N(t) steps between the at most 2n breakpoints i/n - d and j/n + d with Binomial(n - s, (t_(k+1) - t_k) / (1 - t_k)); the mass crossing N >= i + 1 (D+) or found at N <= j at j/n + d (D-) is added up. Each binomial row starts from `dbinom1` at its mode and follows the ratio recurrence both ways until it underflows (as the faster prototype upper3.ts of the preparation; the same bits). Work limit: NaN when (breakpoints) (2 floor(n d) + 1) min(n + 1, 100) exceeds 2^28, or when the terms counted exceed 2^29 (a guard). n 1023, d 0.38: 1.4 s.
- `src/htest/ksTest.ts`: for D < 1/2, `2 pkolmogorovOneSidedUpper < 1e-2` → the sum; NaN from it or 2 P+ >= 1e-2 → `1 - pkolmogorovExact` as before. D >= 1/2 unchanged.
- docs (en, ja): a row after the D >= 1/2 row; the #307 limit paragraph notes the time of the sum.

## Tests

- `test/issue483.test.ts`: the issue's example and the four Rmpfr references (1e-13 relative); a large-p case bit for bit equal to `1 - pkolmogorovExact`; `pkolmogorovExactUpper(5000, 0.08)` is NaN (over the work limit, before any work). With `src/` stashed both tests fail.
- Fixtures: the R `ksTest.json` changes in 5 cases (n 69, 96, 90, 92, 85, p 6.7e-5 to 2.7e-3; R is the side in error, 8e-13 to 1.6e-11 relative; 69 and 96 checked with Rmpfr). The SciPy fixture changes in 9 cases, all toward SciPy's values (p 1.9e-9: off by 3.9e-7 relative before, 3.6e-15 after). Both compare these p-values with the absolute floor 1e-2, so the expected values were not changed; the comments of the floors in `test/htest-basic.test.ts` now say where the p-value is formed directly.
- ksTest tests (`htest-basic`, `extradist`, `formulaTests`, `issue307`, `issue41`, `review15`, `review59`) and `npx tsc --noEmit -p .`: pass, no errors.
- Full `npx vitest run`: 3213 passed, 1 failed (`distributionProperties` signrank, a timing test; passes when its file is run alone).

## Out of scope (recorded)

- HANDOFF.md (the common-base and "recorded only" entries for ksTest D < 1/2) still describes the old state; HANDOFF is not edited by this agent.

## close comment

Fixed in <commit of #483, see git log --grep='#483'>: for the exact two-sided one-sample p-value with D < 1/2, where 2 P(D+ >= d) < 1e-2, P(D >= d) is now formed directly as a sum of positive terms (the binomial steps of the empirical counting process between the boundaries) instead of 1 - P(D < d), which has absolute accuracy 1e-15 only. The example (x = (1:99)/99, F(q) = 0.51 q, D = 0.49) gives 1.9222472248029486e-22 (Rmpfr 1.9222472248029365e-22; was 3.0e-15, R 4.5.2 2.0e-15). Where p may be 1e-2 or larger the value is unchanged (as R), and where the sum would need more than 2^28 terms it falls back to 1 - P(D < d). Recorded in docs/differences-from-r.md. Test: test/issue483.test.ts. (Not pushed yet.)
