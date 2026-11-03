# Issue #383 log: distSummary("weibull") variance with scale squared overflowing

GitHub Issue #383. Session 12, group A3 (distSummary).

## Plan

- Intent: for shape <= 100 the Weibull variance is scale * scale * v, v the variance for scale 1. For shape 10, scale 1e155 the square overflows and the variance is Infinity, although it is 1.31e308 and the sd (from sdDirect) is finite.
- Method: the receptacle of #376. Where the variance is not a normal number, `rescaled()` evaluates x * x * v at the scale scaled to [1, 2) and multiplies back by 2^(2e). Normal values keep their bits. (The shape > 100 path forms the variance as sd * sd from a finite sd, which overflows only where the variance does.)

## Check (main `430fdcf`)

| call | before | after | Rmpfr (2000 bits) |
|---|---|---|---|
| `weibull(10, 1e155)` variance | Infinity | 0x1.751d04363908cp+1023 | the same |
| sd | 1.14457219403008e154 (sdDirect) | 0x1.b5130c02d461cp+511 (sqrt of the variance) | the same |
| `weibull(10, 1e160)` variance | Infinity | Infinity | 1.3e318, overflows |

## Fix

- `src/distributions/summary.ts`, `case "weibull"`: the variance of the shape <= 100 path through `rescaled()`.

## Tests

- `test/issue383.test.ts`: the issue's call (fails with `src/` stashed) and unchanged values.
- The distSummary test files and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #383, see git log --grep='#383'>. Where the Weibull variance leaves the normal range, it is now scale^2 v evaluated at the scale scaled to [1, 2) by a power of 2 and scaled back, so the square no longer overflows: weibull(10, 1e155) has variance 1.310045507346831e308 (0x1.751d04363908cp+1023, correctly rounded) and sd 1.14457219403008e154. Values in the normal range are unchanged. (Not pushed yet.)
