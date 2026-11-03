# Issue #377 log: distSummary("exp") variance with rate squared overflowing

GitHub Issue #377. Session 12, group A3 (distSummary).

## Plan

- Intent: the exp variance is 1 / (rate * rate). For rate 1e155 the square overflows and the variance is 0, although 1 / rate^2 = 1e-310 is a representable subnormal and the sd (1 / rate) is finite.
- Method: the receptacle of #376. Where the variance is not a normal number, `rescaled()` evaluates 1 / (x * x) at the rate scaled to [1, 2) and multiplies back by 2^(-2e). Normal values keep their bits.
- Why not (1 / rate)^2: two roundings before the subnormal one; the scaled expression is the ordinary one.

## Check (main `4ba8456`)

| call | before | after | Rmpfr (2000 bits) |
|---|---|---|---|
| `exp(rate 1e155)` variance | 0 | 0x0.012688b70e62bp-1022 (1e-310) | 0x1.2688b70e62bp-1030, the same |
| `exp(rate 1e-160)` variance | Infinity | Infinity | 1e320, overflows |

## Fix

- `src/distributions/summary.ts`, `case "exp"`: the variance through `rescaled()`.

## Tests

- `test/issue377.test.ts`: the issue's call (fails with `src/` stashed) and unchanged values.
- The distSummary test files and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #377, see git log --grep='#377'>. Where the exp variance leaves the normal range, it is now 1 / rate^2 evaluated at the rate scaled to [1, 2) by a power of 2 and scaled back, so the square no longer overflows: exp(rate 1e155) has variance 1e-310 (0x0.012688b70e62bp-1022, the correctly rounded value). Values in the normal range are unchanged. (Not pushed yet.)
