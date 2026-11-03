# Issue #368 log: qgamma and pgamma where x / scale is beyond the largest double

GitHub Issue #368. Session 12, group B (user decision).

## Plan

- User decision (2026-11-03): where x / scale exceeds Number.MAX_VALUE with a shape of about 1e307 and above, return NaN instead of a wrong value (option B of the prep notes). Computing the true values in the coordinate lambda = q / (shape scale) (option A) was not taken.
- Intent: `qgammaStd` solves for the standardized quantile and multiplies by scale; the search stops at MAX_VALUE, so a standardized quantile beyond it came out as MAX_VALUE times scale. `pgamma1` forms x = q / scale, which overflows to Inf, and gammaInc returns the limit.
- Which outputs are wrong: with x / scale beyond MAX_VALUE, P = 1, Q = 0 and log P = 0 are right to double precision (x exceeds even the largest shape by far more than sqrt(shape)). Only log Q can be finite: its leading term is shape (r - 1 - log r) with r = q / (shape scale), finite for shapes of about 1e307 and above (and about 1e290 and above when q / scale is just beyond MAX_VALUE). So pgamma returns NaN exactly where that term is finite; elsewhere -Inf stays (it is the rounded value).
- qgamma: after the search, if x >= 2^1000 and the distribution function at MAX_VALUE has not reached the target, the standardized quantile is beyond the doubles: Inf for scale >= 1 (the quantile overflows; R gives Inf), NaN for scale < 1.

## Check (main `27a4776`, R 4.5.2; 1e308 and 1e-308 passed as hex floats)

| call | before | after | R | true |
|---|---|---|---|---|
| `qgamma(-1e308, 1e308, scale 1e-308, upper, log)` | 1.7976931348622731 | NaN | Inf | about 3.146 |
| `qgamma(-1e308, 1e308, scale 0.9, upper, log)` | 1.6179e308 | NaN | Inf | Inf (about 2.8e308) |
| `qgamma(-1e308, 1e308, scale 1, upper, log)` | 1.7976931348623157e308 | Inf | Inf | Inf |
| `pgamma(3.146, 1e308, scale 1e-308, upper, log)` | -Inf | NaN | -Inf | about -1e308 |
| `pgamma(1.8, 1e308, scale 1e-308, upper, log)` | -Inf | NaN | -Inf | about -2.1e307 |
| `pgamma(1.7, ...)` (x finite), `qgamma(-1e300, ...)`, `qgamma(-1e308, 1e307, scale 1e-307, ...)`, `qgamma(0.5, ...)` | | unchanged | | |
| `pgamma(MAX, 1e290, scale 1 - 2^-53, upper, log)` | -Inf | -Inf (the leading term overflows) | | |
| `pgamma(MAX, 1e295, scale 1 - 2^-53, upper, log)` | -Inf | NaN (true about -(MAX - 3e296)) | | |

## Fix

- `src/distributions/gamma.ts`: `overflowLogUpperFinite` and its use in `pgamma1` (only for x = Inf with q and scale finite, upper tail, log); the check after the search in `qgammaStd` (only for x >= 2^1000).

## Tests

- `test/issue368.test.ts`: the NaN and Inf cases above, and unchanged values (copied from the code before the fix). With `src/` stashed, the two tests of the changed values fail.
- gamma, chisq, extremeAccuracy, distributionProperties, extradist: pass.
- docs (en, ja): a row in "Deliberate differences / Distributions" (R gives Inf and -Inf).

## Out of scope

- None.

## close comment

Fixed in <commit of #368, see git log --grep='#368'>: where x / scale is beyond the largest double the standardized gamma cannot be evaluated, and the values were wrong: `qgamma(-1e308, 1e308, scale = 1e-308, lowerTail: false, logP: true)` was 1.797 (true value about 3.146), and `pgamma(3.146, 1e308, scale = 1e-308, upper, log)` was -Inf (true about -1e308). These are now NaN rather than computed (R gives Inf and -Inf): qgamma returns NaN where the standardized quantile is beyond the doubles and scale < 1 (Inf for scale >= 1, as in R; it was MAX_VALUE), and pgamma's log upper tail is NaN where its leading term shape (r - 1 - log r), r = q / (shape scale), is finite (shapes of about 1e307 and above). The other tails there (1, 0, 0) and the log upper tail where it overflows are right and unchanged, as is everything with x / scale in range.

Test: test/issue368.test.ts. (Not pushed yet.)
