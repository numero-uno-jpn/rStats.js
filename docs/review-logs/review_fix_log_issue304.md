# Issue #304 log: normality tests with an infinite observation

GitHub Issue #304. Session 12.

## Plan

- Intent: the shared `standardized()` of the nortest tests returned all-NaN values for a sample with an infinite value. `adTest` and `cvmTest` then fell through their piecewise p-values to the fixed tail values 3.7e-24 and 7.37e-10, and `pearsonTest` counted no value in any class (P = 8, a finite p-value). `sfTest` gave NaN.
- Method: reject an infinite value with "'x' must be finite" (the message of `shapiroTest`), after NaN is dropped. The sorted values are checked at the ends only. `sfTest` does not use `standardized()`, so it gets the same check. Finite samples take the old code (the same bits). R's `pearson.test` and `sf.test` return values, so the case is added to "Input that has no meaning is an error" in `docs/differences-from-r.md` (policy, as #309 and #314).

## Check (main `7f2be98`, R 4.5.2, nortest)

`x = c(1:7, Inf)`:

| test | R | before |
|---|---|---|
| `ad.test` | error "missing value where TRUE/FALSE needed" | A NaN, p 3.7e-24 |
| `cvm.test` | the same error | W NaN, p 7.37e-10 |
| `lillie.test` | the same error | NaN |
| `sf.test` | W NaN, p NaN | NaN |
| `pearson.test` | P 8, p 0.01831564 | P 8.000000000000002, p 0.01831563888873417 |

No fixture has an infinite value (no expected value changes).

## Fix

- `src/htest/normalityTests.ts`: `requireFinite`, called by `standardized()` and `sfTest`.

## Tests

- `test/issue304.test.ts`: the error for Infinity and -Infinity in the five tests; NaN still dropped. With `src/` stashed, the 5 error tests fail.
- `test/moreTests.test.ts`, `test/issue46.test.ts`, `test/scaleInvarianceAll.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #304, see git log --grep='#304'>. `adTest`, `cvmTest`, `lillieTest`, `sfTest` and `pearsonTest` now throw "'x' must be finite" for an infinite observation (NaN values are still dropped). The standardised values were all NaN, so `adTest` and `cvmTest` returned their fixed tail p-values (3.7e-24, 7.37e-10) and `pearsonTest` an empty classification (P = 8). nortest's `ad.test`, `cvm.test` and `lillie.test` stop there; `pearson.test` returns P = 8 and `sf.test` NaN, which is recorded in docs/differences-from-r.md. Finite samples give the same values as before. (Not pushed yet.)
