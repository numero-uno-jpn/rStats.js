# Issue #408 log: rweibull where the power overflows

GitHub Issue #408. Session 13, group A (overflow and underflow inside the random generators; R is wrong too).

## Plan

- Intent: `rweibull` formed `scale * (-log u)^(1/shape)`; for a small shape the power overflows although a small scale brings the variate back into range. R does the same and gives Inf; the correct value is finite, so rStats.js returns it (recorded in docs).
- Method (a fallback that acts only where the power is Inf): exp(log scale + log(-log u) / shape) with the logs and the exponential in double-double (`ddLog`, `ddExp`). The issue's plain-double log form is 1.7e-14 off (the log near 763 loses its last digits); double-double gives the correctly rounded value for R's e = -log u. The same uniform; values where the power is finite keep their bits.

## Check (main `9308a51`)

R 4.5.2, `set.seed(19)` (u = 0x1.dfc4518p-4, e = -log u = 0x1.127ddb902d7a3p+1; one uniform drawn). Exact values from Rmpfr for that e:

| call | R | before | after | exact |
|---|---|---|---|---|
| `rweibull(1, 0.001, 2^-1074)` | Inf | Inf | 103020481.1280669 (0x1.88fdf048323f8p+26) | 103020481.12806690190 |
| `rweibull(1, 0.00105, 2^-1074)` | Inf | Inf | 1.7211618870375898e-8 (0x1.27b1801530376p-26) | 1.7211618870375898655e-8 |
| `rweibull(1, 0.001, 1)`, `rweibull(1, 0.0005, 2^-1074)` | Inf | Inf | Inf (true overflow) | |
| `rweibull(1, 0.002, 2^-600)` (power finite) | 1.100454e-15 | the same | the same | |

(Windows R reads the hex literal `0x1p-1074` as 0; `2^-1074` was used.)

## Fix

- `src/random/continuous.ts`, `rweibull`: the double-double log fallback where the power is Inf.
- `docs/differences-from-r.md`, `docs/ja/differences-from-r.md`: a row next to the `rnorm` row of issue 396.

## Tests

- `test/issue408.test.ts`: the rows above and the next uniform. With `src/` stashed, 1 of 2 tests fails.
- `test/random.test.ts`, `test/random-kinds.test.ts`, `test/locationScaleExtremes.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The opposite case, where the power underflows to 0 although a huge scale brings the variate back into range (a small shape with u near 1, e.g. scale 1e308), still gives 0 (R too). The issue covers the overflow only.

## close comment

Fixed in <commit of #408, see git log --grep='#408'>: where `(-log u)^(1/shape)` overflows, `rweibull` now forms `scale (-log u)^(1/shape)` from the logs in double-double, so `set.seed(19); rweibull(1, 0.001, scale = Number.MIN_VALUE)` is 103020481.1280669 (correctly rounded for the generated -log u, checked with Rmpfr) instead of Inf. One uniform is drawn as before; values where the power is finite are unchanged, and a true overflow stays Inf. R 4.5.2 also gives Inf, so this is recorded in docs/differences-from-r.md.

Test: test/issue408.test.ts. (Not pushed yet.)
