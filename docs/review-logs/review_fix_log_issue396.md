# Issue #396 log: rnorm where sd·Z overflows

GitHub Issue #396. Session 13, group A (overflow and underflow inside the random generators; R is wrong too).

## Plan

- Intent: `rnorm1` formed `mean + sd * Z`; sd·Z can overflow although the sum is in range (a large negative mean cancels it). R does the same and gives Inf; the correct value is finite, so rStats.js returns it (correctness over R, recorded in docs).
- Method (a fallback that acts only where the plain result is not finite): if `mean + sd * z` is not finite, return `2 * (mean / 2 + (sd / 2) * z)`. Halving is exact for such a large sd and for any mean that affects the sum, so this is the plain formula without the overflow. The same normal variate; values in range keep their bits.

## Check (main `49efab0`)

R 4.5.2 (2 uniforms drawn by one normal variate in each case):

| call | R | before | after |
|---|---|---|---|
| `set.seed(7); rnorm(1, -2^1023, 2^1023)` (Z = 2.2872471613405239) | Inf | Inf | 2^1023 (Z - 1) = 1.1570376924064318e308 |
| `set.seed(7); rnorm(1, -1e308, 1e308)` (the issue) | Inf | Inf | 1.2872471613405238e308 (the issue's correctly rounded value) |
| `set.seed(7); rnorm(1, 0, 2^1023)` | Inf | Inf | Inf (a true overflow) |
| `set.seed(1); rnorm(1, 2^1023, 2^1023)` | 0x1.7e82e469a0e12p+1021 | the same | the same |

## Fix

- `src/random/continuous.ts`, `rnorm1`: the halved fallback. `rlnorm` and the noncentral `rt` use `rnorm1`; their values in range are unchanged.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row next to `rexp(n, rate = 1e-310)`.

## Tests

- `test/issue396.test.ts`: the rows above and the next uniform. With `src/` stashed, 1 of 2 tests fails.
- `test/random.test.ts`, `test/random-kinds.test.ts`, `test/locationScaleExtremes.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #396, see git log --grep='#396'>: where `mean + sd * Z` is not finite, `rnorm` now forms the same sum with mean and sd halved (exact here) and doubles it, so `set.seed(7); rnorm(1, mean = -1e308, sd = 1e308)` is 1.2872471613405238e308 instead of Inf. The same normal variate is drawn; values in range are unchanged and a true overflow stays Inf. R 4.5.2 also gives Inf here, so this is recorded in docs/differences-from-r.md.

Test: test/issue396.test.ts. (Not pushed yet.)
