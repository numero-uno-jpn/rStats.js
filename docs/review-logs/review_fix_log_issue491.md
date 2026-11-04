# Issue #491 log: pbeta where a + b overflows, away from the mean

GitHub Issue #491. Session 14, group A2. Fixed: tails away from the mean of shapes whose sum overflows were NaN; they are now 0 and 1 (as R), with the correct log.

## Plan

- Intent: the triage found that the issue's example is right (0), but that the same cause, `cfOk`'s lower-frame mean `a / (a + b)` rounding to 0 where `a + b` overflows, goes with NaN for pbeta(0.1, 1e308, 1e308) and pbeta(0.9, 1e308, 1e308).
- Planned method: `1 / (1 + b / a)` where `a + b` overflows, as the upper frame already does.
- Changed during the work: that alone does not remove the NaN. The continued fraction in the right frame is NaN too (its coefficients `a + b` and the choice `x (a + b - 2) - (a - 1)` overflow, and so do the prefactor's `a b / (a + b)` and `dbinomRawDD`). So a fallback was added, which acts only where the result is NaN and `a + b` overflows (K3): there the smaller tail is e^-E times factors whose log is a few thousand at most, so where E >= 1e22 its log is -E to double precision and its linear value 0. E is formed as in the uniform expansion (`betaIncTemme`), in the halved shapes and doubled. The `cfOk` change is kept (the test is right in both frames now); it changed none of the values checked.
- Why: making the continued fraction and the prefactor work with an overflowing `a + b` would touch the inner loops of every call. The fallback leaves every finite result to the bit.

## Reproduction (main `92ab878`, R 4.5.2; shapes passed to R as hex floats)

| Call | R (lower, upper, log lower, log upper) | rStats.js before |
|---|---|---|
| `pbeta(0.1, 1e308, 5e307)` (the issue; a + b = 1.5e308 is finite) | 0, 1, -Inf, -0 | 0, 1, -1.4005e308, 0 |
| `pbeta(0.1, 1e308, 1e308)`, also x = 0.0025, and (0.1, 9e307, 9e307) | 0, 1, -Inf, -0 | NaN |
| `pbeta(0.9, 1e308, 1e308)` | 1, 0, -0, -Inf | NaN |
| `pbeta(x, 1.7e308, 1e307)` at x = 1e-300, 0.1, 0.5; `pbeta(x, 1.7e308, 1e308)` at x = 1e-300, 0.1, 0.9 | 0 (1 at 0.9), log -Inf | NaN |

The issue's statement that `1e308 + 5e307` overflows is wrong (the largest double is 1.797e308). With one shape small (`pbeta(x, 1.7e308, b)` for b up to 1e200) the values were already right.

## Fix

- `src/special/incbet.ts`, `cfOk`: the lower-frame mean as `1 / (1 + b / a)` where `a + b` overflows.
- `src/special/incbetTemme.ts`, `betaIncOverflowSum`: where `a + b` overflows and E >= 1e22, the smaller tail is [-E, 0] and the larger [0, 1] (the larger's log 0, as `betaIncTemme`). `betaIncCore` calls it only where the result (or its log, when asked) is NaN; otherwise it returns undefined and the NaN stays.
- Values: pbeta(0.1, 1e308, 1e308) = 0, upper 1, log -0x1.22f9d6cd6a1e6p+1023 (Rmpfr's log of x^a (1 - x)^b / (a B(a, b)) to the bit; the other factors move it by less than an ulp); pbeta(0.0025, 1e308, 1e308, log) is -Inf (the true log is about -4.6e308). The linear values agree with R; R's logs are -Inf, so the docs (en, ja) record the difference.

## Tests

- `test/issue491.test.ts`: the issue's example; lower and upper tails 0 and 1 (and the larger's log 0) at four points and at x = 0.9; the logs of the small tails at four points against Rmpfr, and -Inf beyond the doubles. With `src/` stashed, the two new-value tests fail.
- The 18 test files that call `pbeta` or `qbeta` pass (916 tests).

## Out of scope (recorded)

- Each of these calls still runs the continued fraction to its limit of 100000 steps (about 50 ms) before the fallback catches the NaN. Not changed: the fallback form keeps the paths that give finite values.
- The issue's example `pbeta(0.1, 1e308, 5e307, log.p = TRUE)` was already -1.4005e308 (finite) against R's -Inf, by the continued fraction (a + b is finite there). Not changed and not added to the docs here.

## close comment

Fixed in <commit of #491, see git log --grep='#491'>. The issue's example is right as it was: pbeta(0.1, 1e308, 5e307) is 0 (1e308 + 5e307 = 1.5e308 does not overflow). But where a + b does overflow, the same mean test rounded to 0 and the continued fraction, which forms a + b, was NaN: pbeta(0.1, 1e308, 1e308) and pbeta(0.9, 1e308, 1e308) were NaN (R: 0 and 1). The mean test now uses 1/(1 + b/a) there, and where the result is NaN and a + b overflows, the tails come from the deviance E in the halved shapes: 0 and 1 as R, and the log of the smaller tail -E (-1.0216512475319813e308 for pbeta(0.1, 1e308, 1e308, log.p = TRUE), to the bit against Rmpfr; R gives -Inf, recorded in docs/differences-from-r.md). Finite results are unchanged. A test was added: test/issue491.test.ts. (Not pushed yet.)
