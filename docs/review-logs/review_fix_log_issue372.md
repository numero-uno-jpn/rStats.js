# Issue #372 log: Gamma deviance NaN when y/mu overflows

GitHub Issue #372. Session 12, group A7 (glm deviance fallbacks: #371, #372, #373, #375; #349).

## Plan

- Intent: beyond 10% of the mean the Gamma deviance (and quasi `mu^2`) is -2 w (log(y/mu) - (y - mu)/mu). For y = 1e308, mu = 1e-308, w = 1e-320 both terms overflow and Inf - Inf is NaN; the true contribution is 2e296. y/mu underflowing (y = 1e-308, mu = 1e300) gives Inf, and 2 w overflowing (w = 1e308) gives Inf for an ordinary ratio.
- Method (the fallback of #371, sharing `outOfRange` and `weightedScaled`): keep the old expression; only where it leaves the doubles, form 2 w (r - 1 - log r) with r = y/mu as m 2^E (m from y and mu brought to [1, 2)), log r = log m + E log 2, in units of 2^E for E > 0, and the weight's exponent taken out. The Gamma and quasi `mu^2` branches now share `gammaFar` (R's ratio for y = 0 kept: 1 for Gamma, 1/mu for quasi). Ordinary contributions keep R's form and bits.

## Reproduction (main after #371, R 4.5.2)

| call | R | before | after | exact (Rmpfr 600 bits) |
|---|---|---|---|---|
| `devContribution(1e308, 1e-308, 1e-320)` (Gamma, quasi `mu^2`) | NaN (`Gamma()$dev.resids`) | NaN | 1.999977734365366e296 | 1.9999777343653662e296 |
| `(1e300, 1e-10, 1e-300)` | | NaN | 2e10 | 20000000000.000001 |
| `(1e-308, 1e300, 1e-300)` | | Inf | 2.7979434730807594e-297 | 2.7979434730807596e-297 |
| `(5, 2, 1e308)` | | Inf | 1.1674185362516899e308 | 1.1674185362516899e308 |
| `glm([[]], [1e308], Gamma(log), weights 1e-320, offset log(1e-308))` | deviance NaN | NaN | 1.999977734365393e296 (mean 9.999999999999866e-309) | |

## Cause

y/mu and (y - mu)/mu are formed before the weight; `-2 * w` overflows for w > 8.9e307.

## Fix

- `src/models/glmFamily.ts`: `gammaFar`, used by Gamma and quasi `mu^2` beyond 10% of the mean.

## Tests

- `test/issue372.test.ts`: the cases above for both families, the glm with a fixed mean, unchanged bits in range. With `src/` stashed, the first two blocks fail.
- glm test files and `test/issue371.test.ts`: pass, fixtures unchanged. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The AIC of the glm above is still NaN (the Gamma AIC from the dispersion and log dgamma; not this issue).

## close comment

Fixed in <commit of #372, see git log --grep='#372'>. Beyond 10% of the mean the Gamma deviance (also quasi `mu^2`) now falls back, only where the deviance or its weighted product leaves the doubles, to 2 w (r - 1 - log r) with r = y/mu held as a mantissa and a power of 2 and the weight's exponent taken out. `devContribution(1e308, 1e-308, 1e-320)` is now 1.999977734365366e296 (exact 1.9999777343653662e296; R NaN); ordinary contributions keep their bits. Test: `test/issue372.test.ts`. (Not pushed yet.)
