# Issue #371 log: poisson deviance overflowing y/mu before the weight

GitHub Issue #371. Session 12, group A7 (glm deviance fallbacks: #371, #372, #373, #375; #349).

## Plan

- Intent: beyond 10% of the mean, `poissonDev` forms 2 w (y log(y/mu) - (y - mu)). For y = 1e308, mu = 1e-308, w = 1e-320 the ratio overflows and the contribution is Infinity, although the true value is 2.83e-9. The same happens when y log(y/mu) overflows (y = 1e308, mu = 1e-10) or 2 w does.
- Method (a fallback, HANDOFF "glm deviance" and the common rule "normalize by a power of 2 only when needed"): keep the old expression; only where the unweighted deviance D or 2 w D is not finite, or D is below the normal range (subnormal y and mu, where a large weight would bring back lost bits), recompute with y and mu in units of 2^e (e from the larger, exact), log(y/mu) from the two logarithms where the ratio is out of range (then abs(log) > 708, so their rounding is below 1e-15 of it), and the weight's exponent taken out (`weightedScaled`). Ordinary contributions keep R's form and bits.
- Why not a log-domain form throughout: it would change the bits of ordinary values (HANDOFF: the ordinary range must not move).

## Reproduction (main `76e0cde`, R 4.5.2)

| call | R | before | after | exact (Rmpfr 600 bits) |
|---|---|---|---|---|
| `devContribution(1e308, 1e-308, 1e-320)` (poisson, quasipoisson, quasi `mu`) | Inf (`poisson()$dev.resids`) | Inf | 2.834753275426968e-9 | 2.8347532754269681e-9 |
| `(1e308, 1e-10, 1e-10)` | | Inf | 1.4624441191442133e301 | 1.4624441191442131e301 |
| `(3e-320, 1e-320, 1e308)` | | Inf | 2.5916448793784532e-12 | 2.5916448793784545e-12 (5e-16) |
| `(1e-308, 1e308, 1e-300)` | | -Inf | 2e8 | 200000000.00000001 |
| `glm([[]], [1e308], poisson, weights 1e-320, offset log(1e-308))` | deviance Inf | Inf | 2.834753275426968e-9 | |

## Cause

`y / mu` and `y * log(y / mu)` are formed before the weight; `2 * w` overflows for w > 8.9e307.

## Fix

- `src/models/glmFamily.ts`: `exponentOf`, `weightedScaled`, `outOfRange`, `poissonFarScaled`; `poissonDev` falls back to the scaled form where `outOfRange`.

## Tests

- `test/issue371.test.ts`: the issue's call and the cases above for the three families, the glm with a fixed mean, and unchanged bits in range. With `src/` stashed, the first two blocks fail.
- glm test files (`test/glm*`, `issue159`-`issue17x`, `binomialDevZero`): pass, fixtures unchanged.

## Out of scope (recorded)

- The AIC of the same glm is still Inf: `familyAic` takes w log dpois(y, mu) with log dpois(1e308, 1e-308) = -7e310 (true AIC about 1.4e-9; R Inf too).
- The binomial deviance beyond 10% of the mean has the same overflow of y/mu: `binomial` `devContribution(1, 1e-320, 1e-10)` is Inf (true 1.5e-7). Not in this issue.

## close comment

Fixed in <commit of #371, see git log --grep='#371'>. Beyond 10% of the mean the poisson deviance (also quasipoisson and quasi `mu`) now falls back, only where the unweighted deviance or its product with the weight leaves the doubles or the deviance is subnormal, to y and mu in units of a power of 2 with log(y/mu) from the logarithms and the weight's exponent taken out. `devContribution(1e308, 1e-308, 1e-320)` is now 2.834753275426968e-9 (exact 2.8347532754269681e-9; R Inf); ordinary contributions keep their bits. Test: `test/issue371.test.ts`. (Not pushed yet.)
