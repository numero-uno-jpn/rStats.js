# Issue #243 log: distSummary("triang") variance and skewness NaN or cancelled for large locations

GitHub Issue #243. Session 11, group B (prepared in bprep_2 B1; decided by the user: always the difference form).

## Plan

- Intent: the variance and skewness came from q = a² + b² + c² - ab - ac - bc on the raw parameters. Near the top of the range every product overflows and q is Inf - Inf (variance and skewness NaN for the issue's call). The cause is wider than the overflow: wherever the location is large against the width, q cancels. At (1e10, 1e10 + 1, 1e10 + 0.25) the variance was 910.2222222222222 for 0.04513888888888889, and over 10,000 random triangles near location 1e3 the variance's relative error reached 2.5e-4.
- Method (user's decision, option (a) of the prep): always form q from the differences u = b - a, v = c - a, w = b - c as q = u w + v². The terms are all non-negative, so nothing cancels. The skewness numerator (a + b - 2c)(2a - b - c)(a - 2b + c) is (w - v)(u + v)(u + w) in the same differences. The parameters are divided by 2^e (e the exponent of the largest) where b - a overflows or the largest is outside [2^-300, 2^300], as before. The variance is then ldexp(q / 18, 2e) and the sd ldexp(sqrt(q / 18), e).
- Added in implementation: the scaled coordinates are also used where the width b - a is below 2^-290. With the largest just above 2^-300 and a width of a few ulps, q is about 2^-704 and q^1.5 falls onto the subnormals (skewness 0.3054414159 for 0.305441419328485). The prep's prototype had this loss too. Only widths below 2^-290 are affected, so no value in the normal range changes because of it.
- distSummary is not an R function, so docs/differences-from-r.md is not changed (as in #34).

## Check (main `9d4ab8c`)

References: Rmpfr at 400 bits on the exact doubles (prep script bprep2_b1.R).

| a, b, c | before (variance, sd, skewness) | after | Rmpfr |
|---|---|---|---|
| 1e308, 1.0000000000000004e308, 1.0000000000000002e308 (the issue) | NaN, 4.464619196609447e299, 0 | Infinity, 8.147983944064166e291, 0 | 6.64e583 (Inf), 8.1479839440641656e291, 0 |
| 1e10, 1e10 + 1, 1e10 + 0.25 | 910.2222222222222, 30.17, 1.475e-7 | 0.04513888888888889, 0.21245914639969937, 0.4224039833745502 | 0.045138888888888889, 0.21245914639969937, 0.42240398337455022 |
| 1e300, 1.0000000000000003e300, 1e300 | NaN, 5.76e291, 1.02e-24 | Infinity, 7.009864931491307e283, 0.565685424949238 | 4.91e567 (Inf), 7.0098649314913074e283, 0.56568542494923802 |
| 2^-299 (1, 1 + 3 eps, 1 + eps) | (skewness) 0.3054414159 (prototype too) | 0.305441419328485 | 0.305441419328485 (shape of (0, 3, 1)) |

- 10,000 random triangles (locations 0, 1e3 and 1e10, widths up to 3, real end points) against the exact q in BigInt: the largest relative error of the variance is 4.4e-16.
- The fixture's triangles and 105 more (integer and dyadic end points, the default c) give the same bits as before (all 108 lines of the dump are identical). Real end points such as [-5, 5] change in the last bits, toward the true value (prep: 69% of the variances there). The user accepted this.

## Fix

- `src/distributions/summary.ts`, `case "triang"`: q, the variance, the sd and the skewness from the differences as above. The unused expanded q and its scaled copy are gone.

## Tests

- `test/issue243.test.ts`: the issue's call, two cases against Rmpfr, translation invariance of the skewness (0, 4, 1 moved to 1e10 and 1e308), the tiny width near 2^-299, and the fixture's triangles unchanged. With `src/` stashed, four of the five fail.
- `npx vitest run`: 342 files passed, 1 failed (signrank in distributionProperties, the known timing failure; passes alone, 33/33). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #243, see git log --grep='#243'>: `distSummary("triang")` now forms q = (b - a)(b - c) + (c - a)² from the differences, a form with no cancellation, and the skewness numerator in the same differences. The parameters are scaled by a power of 2 where b - a overflows or the scale leaves [2^-300, 2^300]. The issue's call now gives variance Infinity, sd 8.147983944064166e291 (Rmpfr: 8.1479839440641656e291) and skewness 0. The cause was wider than the overflow: (1e10, 1e10 + 1, 1e10 + 0.25) gave the variance 910.2 instead of 0.0451, and that is fixed too. Over random triangles the variance's error is now at most 4.4e-16. The fixture's triangles keep their bits; real end points can change in the last bits, toward the true value.

Test: test/issue243.test.ts. (Not pushed yet.)
