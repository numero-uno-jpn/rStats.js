# Issue #249 log: distSummary("kumar") sd 0 and NaN moments for huge shapes

GitHub Issue #249. Session 11, group B (prepared in bprep_2 B2 with #240; decided by the user: the T coordinate for shapes above 100).

## Plan

- Intent: X = W^(1/a) with W = X^a ~ Beta(1, b) lies within O(1/a) of its location. The central moments were integrated in x, and the fallback raw moments b B(1 + r/a, b) cancel. The issue names a = b = 1e308 (sd 0, NaN), but the values are already wrong from about a = 1e5 (a = b = 1e5: kurtosis 459541 for 2.40; 1e10: skewness -Infinity). b B(1 + 1/a, b) also puts the mean 1e-14 off for huge a (0.9999999999999866 for a = b = 1e308).
- Method (user's decision, option (a) of the prep): for a > 100 only, use `expShape()` from #240. Write X = c (b W)^(1/a) with c = b^(-1/a), and integrate T = a expm1(log(e) / a) = a (X / c - 1) over e = b W, whose density is (1 - e/b)^(b - 1) on (0, b). Then sd = c (sd_T / a), the variance is sd², the skewness and kurtosis are those of T, and the mean is c (1 + E[T] / a). The old route is used where the integrals do not converge. a <= 100 keeps the old route and its bits.
- Changed from the prep's prototype (found while checking b < 1, which the prep tested only at b = 0.5). With e alone, the density's singularity at e = b cost accuracy. a = 150, b = 0.1 lost 3e-10 of the kurtosis, where the old route had 2e-14. b = 1e-5 lost 4e-6, where the old route had 3e-10. Both would have been worse than before. So for b < 1, (0, b/2) stays in e, and (b/2, b) is taken in r = b - e. There the integrand h is integrated as 2^-b h(r = 0) plus the integral of (h(r) - h(0)) (r/b)^(b - 1), which removes the singularity (2^-b is the piece's probability). `expShape()` takes a list of such pieces for this. One piece is used for b >= 1, and Weibull keeps its bits from the #240 commit. Two smaller changes in `expShape()`, needed for tiny b: convergence is judged on the sum of the parts' error estimates (a part 1e-20 wide near e = b stopped at its round-off, 1e-30 against a total of 1e-10), and the skewness and kurtosis are divided step by step where c2^1.5 or c2² is not a normal number (b = 1e-300 gave Infinity for -1.7e150). This is the same method as decided (T over the base variable for a > 100), with a different integration variable near the singular end. The user's decision is not changed.
- distSummary is not an R function, so docs/differences-from-r.md is not changed (as in #34).

## Check (main `ac65de1`)

References: Rmpfr (3000 to 12000 bits) from the raw moments b B(1 + r/a, b), on the exact doubles (prep bprep2_b2.R; fix15_w.R, fix15_k3.R, fix15_k4.R in this session). Relative errors of sd, skewness and kurtosis:

| a, b | before | after |
|---|---|---|
| 1e308, 1e308 (the issue) | sd 0, NaN, NaN | 3.3e-16, 2.2e-16, 6.9e-15 |
| 101, 101 | (old route) | 5.6e-16, 3.6e-15, 2.2e-16 |
| 1e5, 1e5 | 1.3e-5, 3.4 (-5.05), 1.9e5 (459541) | 0, 2.0e-15, 6.9e-15 |
| 1e6, 1e6 | 0.4, 2.6, 0.64 | 4.8e-15, 1.4e-14, 3.9e-14 |
| 1e10, 1e10 | sd 0, -Inf, Inf | 1.3e-15, 6.0e-15, 1.5e-14 |
| 1e5, 2 | 1.9e-6, 0.38, 2.1e4 | 8.9e-16, 3.4e-15, 6.1e-15 |
| 1e8, 1000 | 0.4, 2.6, 0.64 | 5.6e-16, 2.2e-16, 1.4e-15 |
| 1e5, 0.5 | 2.7e-14, 4.4e-11, 4.0e-11 | 5.6e-16, 2.4e-15, 1.1e-14 |
| 32 cases a in {150, 1e3, 1e5, 1e10}, b in {0.9, 0.7, 0.5, 0.3, 0.1, 0.03, 0.01, 0.001} | up to 4.4e-11; NaN for a = 1e10 | at most 2.1e-14 |
| 1e5, 1e-5; 101, 1e-5; 300, 1e-10; 1e6, 1e-10; 100.5, 1e-20 | 1.5e-10; 3.4e-10; 1.4e-13; 1 (wrong); 1 (wrong) | at most 1.8e-13 |

- The mean for a > 100 is c (1 + E[T] / a). It equals Rmpfr's double for a = b = 1e3, 1e4, 1e5, 1e6, 1e100 and 1e308, and for (1e5, 2) and (1e8, 1000); (1e10, 1e10) and (1e5, 0.5) are 1 ulp off. For a = b = 1e308 it is now 1 (was 0.9999999999999866).
- A sweep of 231 (a, b) pairs, a from 100.5 to 1e308 and b from 1e-300 to 1e308, took at most 12 ms per call. The only values left outside the expected range are listed under Out of scope. sd 0 for (1e200, 1e-300), (1e308, 1e-300) and (1e308, 1e-100) is the correct rounding (the true sd is below 1e-330).
- a <= 100: the fixture's Kumaraswamy cases and 30 more (a from 0.3 to 100, b from 0.5 to 1e4) give the same bits as before. Weibull: 1656 calls (828 shapes from 1e2 to 1e308, two scales) give the same bits as the #240 commit.

## Fix

- `src/distributions/summary.ts`: `expShape()` takes pieces (`ExpPiece`, with the optional `mass` for the singular end), sums the error estimates over the parts, and divides step by step where c2^1.5 or c2² is not normal. `case "kumar"`: the route for a > 100 (one piece in e for b >= 1; e on (0, b/2) and r = b - e on (0, b/2) for b < 1), the mean c (1 + E[T] / a) and the sd passed directly to `make()`. `case "weibull"` passes its one piece.

## Tests

- `test/issue249.test.ts`: the issue's call, 16 cases against Rmpfr (sd 1e-14, skewness and kurtosis 5e-14), including five with b < 1, the mean, and unchanged bits for a = 100 and 50. With `src/` stashed (back at the #240 commit), three of the four fail.
- `npx vitest run`: 344 files passed, 1 failed (signrank in distributionProperties, the known timing failure; passes alone, 33/33). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- b = 1e-300 with a <= about 300 (e.g. (101, 1e-300)): the central moments of T are themselves near 1e-306 and below, and the quadrature's error estimates do not reach 1e-8 of them, so the old route is used. It gives sd 0 and NaN, as before.
- For a > 100 with tiny b, c = b^(-1/a) is far above 1 and the mean c (1 + E[T] / a) can exceed 1 by an ulp or two: (100.5, 1e-100) gives 1.0000000000000016, (100.5, 1e-20) 1.0000000000000002, where the true mean is just below 1. The old formula was 1.1e-14 off there. Not clamped.

## close comment

Fixed in <commit of #249, see git log --grep='#249'>: for a > 100, `distSummary("kumar")` now integrates the moments in T = a (X / c - 1), c = b^(-1/a), over e = b X^a, using the same helper as #240. For b < 1, the singular end e = b is handled by subtracting its value. `distSummary("kumar", { a: 1e308, b: 1e308 })` now gives mean 1, sd 1.2825498301618644e-308, skewness -1.1395470994046484 and kurtosis 2.3999999999999835 (Rmpfr: 1.282549830161865e-308, -1.1395470994046486, 2.4), with variance 0 (true 1.6e-616). The values were already wrong from about a = 1e5 (a = b = 1e5: kurtosis 459541 for 2.40). Over the cases checked, from a = 101 to 1e308 and b from 1e-20 to 1e308, the sd, skewness and kurtosis are now within 2e-13 of Rmpfr, most within 2e-14. The mean for a > 100 is c (1 + E[T] / a) (a = b = 1e308: 1, was 0.9999999999999866). a <= 100 keeps its bits.

Test: test/issue249.test.ts. (Not pushed yet.)
