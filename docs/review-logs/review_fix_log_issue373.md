# Issue #373 log: binomial near-mean deviance underflowing before the weight

GitHub Issue #373. Session 12, group A7 (glm deviance fallbacks: #371, #372, #373, #375; #349).

## Plan

- Intent: near the mean the binomial deviance is 2 w (bd0(y, mu) + bd0(1 - y, 1 - mu)) (#161). For mu = 1e-300, y one ulp above and w = 1e308 the unweighted terms underflow to 0 and 2 w overflows, so the contribution is Inf × 0 = NaN (worse than the 0 the issue predicted); the true value is 2.748e-24. Subnormal y and mu with w = 1e308 give Inf, and so does 2 w alone for an ordinary pair (0.3, 0.3003).
- Method (the fallback of #371): keep the old expression; only where the unweighted deviance or 2 w times it leaves the doubles (or the deviance is subnormal), form bd0 with y and mu in units of 2^e (e from mu; exact, bd0 is homogeneous of degree 1), the second term (bd0Shift) brought to the same units, and the weight's exponent taken out. Ordinary contributions keep their bits.

## Reproduction (main after #372, R 4.5.2)

| call | R | before | after | exact (Rmpfr 4000 bits) |
|---|---|---|---|---|
| `devContribution(y, 1e-300, 1e308)`, y = 1e-300 (1 + 2^-52) (binomial, quasibinomial, quasi `mu(1-mu)`) | Inf (`binomial()$dev.resids`) | NaN | 2.748331382369587e-24 | 2.7483313823695870e-24 |
| `(3e-320, 2.9e-320, 1e308)` | | Inf | 3.39565663329255e-15 | 3.3956566332925499e-15 |
| `(0.3, 0.3003, 1e308)` | | Inf | 4.2840832495710014e301 | 4.2840832495710015e301 |
| `glm([[]], [y], binomial, weights 1e308, offset log(1e-300))` | deviance Inf | NaN | 5.541735399409948e-20 (mean 1.0000000000000237e-300) | 5.5417353994099477e-20 |

600-bit references are not enough here: 1 - y at y = 1e-300 needs more than 1000 bits (they gave 3.3e-8).

## Cause

`2 * w` overflows for w > 8.9e307, and the unweighted bd0 terms underflow before the weight is applied.

## Fix

- `src/models/glmFamily.ts`: `binomialNearScaled`; `binomialDev` falls back to it near the mean where `outOfRange`.

## Tests

- `test/issue373.test.ts`: the cases above for the three families, a true value below the doubles (0), the glm with a fixed mean, unchanged bits. With `src/` stashed, the first two blocks fail.
- glm test files and `test/issue37*.test.ts`: pass, fixtures unchanged. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- Beyond 10% of the mean the binomial deviance still overflows in `2 * w` and in y/mu: `devContribution(0.999, 0.9991, 1e308)` is Inf (true 1.07e303), `(1, 1e-320, 1e-10)` Inf (true 1.5e-7). Not in this issue (see also #371's log).

## close comment

Fixed in <commit of #373, see git log --grep='#373'>. Near the mean the binomial deviance (also quasibinomial and quasi `mu(1-mu)`) now falls back, only where the deviance or 2 w times it leaves the doubles or the deviance is subnormal, to bd0 with y and mu in units of a power of 2 and the weight's exponent taken out. The issue's call gave NaN (2 w overflowed and the terms underflowed) and is now 2.748331382369587e-24 (exact 2.7483313823695870e-24; R Inf); ordinary contributions keep their bits. Test: `test/issue373.test.ts`. (Not pushed yet.)
