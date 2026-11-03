# Issue #386 log: distSummary central() with v^1.5 and v^2 underflowing

GitHub Issue #386. Session 12, group A3 (distSummary).

## Plan

- Intent: `central()` (used by `shape()` for weibull and kumar) returns c3 / v^1.5 and c4 / v^2 - 3. For a small variance v the powers underflow to 0 and the skewness and kurtosis become Infinity: kumar(1e-220, 1) has v = 5e-221.
- Method: the guard `expShape()` already has (#249): where v^1.5 or v^2 is below the normal range, divide by v and sqrt(v), or by v twice, in turn. Where the powers are normal the bits are unchanged.

## Check (main `484c2fe`)

| call | before | after | Rmpfr (2000 bits), E[X^r] = a / (a + r) |
|---|---|---|---|
| `kumar(1e-220, 1)` skewness | Infinity | 0x1.4127cb1a937cdp+365 | 0x1.4127cb1a937ccp+365 (1 ulp) |
| kurtosis | Infinity | 0x1.c5416bb92e3e6p+730 (1e220) | the same |
| variance, sd | 5e-221, 7.071067811865476e-111 | unchanged | the same |
| `kumar(2, 3)`, `kumar(1e-5, 1)` | | unchanged | |

## Fix

- `src/distributions/summary.ts`, `central()`: the sequential divisions where v^1.5 or v^2 is below the normal range.

## Tests

- `test/issue386.test.ts`: the issue's call (fails with `src/` stashed) and unchanged values.
- The distSummary test files and `npx tsc --noEmit -p .` pass.

## Out of scope (recorded)

- The mean of kumar(1e-220, 1) is 9.999999999999984e-221 (0x1.212dd4de7090bp-731), 8 ulp from a / (a + 1) = 0x1.212dd4de70913p-731: b B(1 + 1/a, b) through exp(lbeta(...)) loses digits for a tiny a. Not part of this issue.

## close comment

Fixed in <commit of #386, see git log --grep='#386'>. The central moments in distSummary's numerical moment helper are now divided by v and sqrt(v) in turn where v^1.5 or v^2 falls below the normal range (as the large-shape path already did): kumar(1e-220, 1) has skewness 9.43e109 and kurtosis 1e220 (both were Infinity). Values where the powers are normal are unchanged. (Not pushed yet.)
