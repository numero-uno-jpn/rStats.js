# Issue #409 log: rgamma (shape < 1) and rinvgamma underflow

GitHub Issue #409. Session 13, group A (overflow and underflow inside the random generators; R is wrong too).

## Plan

- Intent: for shape a < 1, `rgamma1` (algorithm GS) forms the unit variate x = exp(log p / a) and returns scale x. x can underflow to 0 (or lose digits on the subnormal grid) although a large scale brings the variate back into range; `rinvgamma` (1 / rgamma1(alpha, 1 / beta)) then gives Inf. R does the same (0 and Inf); the correct values are finite, so rStats.js returns them (recorded in docs).
- Method (a fallback that acts only where x < 2^-1022 and scale > 1): scale p^(1/a) = exp(log scale + log p / a) with the logs and the exponential in double-double. The GS acceptance test uses x as before, so the draws and the accepted candidate are R's. With scale <= 1 the result is below the normal range anyway and is left as it was; normal x keeps its bits. The p >= 1 branch gives x >= 1 and is not affected.

## Check (main `bd4f4d5`)

R 4.5.2 (extraDistr 1.10), `set.seed(1)`, 2 uniforms drawn in each case (u = 0x1.0fe180c4p-2, p = 0x1.0ffb1ba2ca906p-2). Exact values from Rmpfr for that p:

| call | R | before | after | exact |
|---|---|---|---|---|
| `rgamma(1, 0.001, scale = 2^1023)` | 0 | 0 | 0x1.48e4ef4a2813ap-890 (1.5563963702389774e-268) | 1.5563963702389774598e-268 |
| `rgamma(1, 0.001, scale = 2^900)` | 0 | 0 | 0x1.48e4ef4a2813ap-1013 | the same |
| `rinvgamma(1, 0.001, 2^-1023)` | Inf | Inf | 0x1.8e85f08bec418p+889 (6.4250985103907345e267) | 6.4250985103907343855e267 |
| `rgamma(1, 0.001, scale = 2^500)`, `rgamma(1, 0.001)` | 0 | 0 | 0 (true underflow) | 5.7e-426 |
| `rinvgamma(1, 0.001)` | Inf | Inf | Inf | |
| `rgamma(3, 0.01)` | 3.692704e-58, ...; 8 drawn | the same | the same | |

The issue's `rinvgamma(1, 0.001, beta = 1e-308)` now gives 5.775177741471758e267 (the issue's plain-double log estimate 5.775177741472546e267 is 1.4e-13 off). Powers of 2 were used for R, as Windows R misrounds the literal 1e308.

## Fix

- `src/random/gamma.ts`, `rgamma1` (GS branch): the double-double log fallback. It also covers the other users of `rgamma1` with a scale above 1 (the central and noncentral `rchisq` with df < 2, scale 2, where x is subnormal: the result is now correctly rounded instead of twice a subnormal; only results below about 2^-1021 can change).
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row next to the rows of issues 396 and 408.

## Tests

- `test/issue409.test.ts`: the rows above. With `src/` stashed, 1 of 2 tests fails.
- `test/random.test.ts`, `test/random-kinds.test.ts`, `test/locationScaleExtremes.test.ts`, `test/issue420.test.ts`, `test/issue424.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `rinvgamma` with beta below about 5.6e-309 (1 / beta overflows) still goes through rgamma1 with an infinite scale (Inf, then 0). Not part of this issue.

## close comment

Fixed in <commit of #409, see git log --grep='#409'>: for shape below 1, where the unit variate p^(1/shape) falls below the normal range and the scale is above 1, `rgamma` now forms scale p^(1/shape) from the logs in double-double. `set.seed(1); rgamma(1, 0.001, scale = 2^1023)` is 1.5563963702389774e-268 (was 0) and `rinvgamma(1, 0.001, beta = 2^-1023)` 6.4250985103907345e267 (was Inf), both correctly rounded per Rmpfr; the issue's `beta = 1e-308` gives 5.775177741471758e267. The draws and the acceptance test are unchanged, as are values in the normal range; a true underflow stays 0. R 4.5.2 also gives 0 and Inf, so this is recorded in docs/differences-from-r.md.

Test: test/issue409.test.ts. (Not pushed yet.)
