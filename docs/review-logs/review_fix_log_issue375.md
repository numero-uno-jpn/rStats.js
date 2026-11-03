# Issue #375 log: poisson near-mean deviance underflowing before the weight

GitHub Issue #375. Session 12, group A7 (glm deviance fallbacks: #371, #372, #373, #375; #349).

## Plan

- Intent: near the mean the poisson deviance is 2 w bd0(y, mu) (#161). For mu = 1e-300, y one ulp above and w = 1e308, bd0 underflows to 0 and 2 w overflows, so the contribution is Inf × 0 = NaN (worse than the 0 the issue predicted); the true value is 2.748e-24. Subnormal y and mu with w = 1e308 give Inf, and so does 2 w for an ordinary pair (5.1, 5).
- Method (the fallback of #371 and #373): keep the old expression; only where bd0 or 2 w bd0 leaves the doubles (or bd0 is subnormal), form bd0 with y and mu in units of 2^e (e from mu; exact, bd0 is homogeneous of degree 1) and take the weight's exponent out. Ordinary contributions keep their bits.

## Reproduction (main after #373, R 4.5.2)

| call | R | before | after | exact (Rmpfr 4000 bits) |
|---|---|---|---|---|
| `devContribution(y, 1e-300, 1e308)`, y = 1e-300 (1 + 2^-52) (poisson, quasipoisson, quasi `mu`) | 1.1e-8 (`poisson()$dev.resids`, its direct form cancels) | NaN | 2.748331382369587e-24 | 2.7483313823695870e-24 |
| `(3e-320, 2.9e-320, 1e308)` | | Inf | 3.39565663329255e-15 | 3.3956566332925499e-15 |
| `(5.1, 5, 1e308)` | | Inf | 1.986798421033059e305 | 1.9867984210330588e305 |
| `glm([[]], [y], poisson, weights 1e308, offset log(1e-300))` | deviance 1.1e292 | NaN | 5.541735399409948e-20 (mean 1.0000000000000237e-300) | 5.5417353994099477e-20 |

## Cause

`2 * w` overflows for w > 8.9e307, and bd0 underflows before the weight is applied.

## Fix

- `src/models/glmFamily.ts`, `poissonDev`: near the mean, the scaled bd0 where `outOfRange`.

## Tests

- `test/issue375.test.ts`: the cases above for the three families, the glm with a fixed mean, unchanged bits. With `src/` stashed, the first two blocks fail.
- glm test files and `test/issue37*.test.ts`: pass, fixtures unchanged. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The poisson row with y = 0 is still 2 * w * mu, which overflows in 2 w for w > 8.9e307 (true 2 w mu finite for mu < 1). Not in this issue.

## close comment

Fixed in <commit of #375, see git log --grep='#375'>. Near the mean the poisson deviance (also quasipoisson and quasi `mu`) now falls back, only where 2 w bd0 leaves the doubles or bd0 is subnormal, to bd0 with y and mu in units of a power of 2 and the weight's exponent taken out. The issue's call gave NaN (2 w overflowed and bd0 underflowed) and is now 2.748331382369587e-24 (exact 2.7483313823695870e-24; R 1.1e-8); ordinary contributions keep their bits. Test: `test/issue375.test.ts`. (Not pushed yet.)
