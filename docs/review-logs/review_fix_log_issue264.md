# Issue #264 log: esW1 underflows the squared probability difference

GitHub Issue #264. Session 11, group A5 of the second triage (effect sizes and powers in pwr.ts and power.ts).

## Plan

- Intent: `esW1` sums (p1 - p0)^2 / p0. Where the difference d = p1 - p0 is below 2^-511, d^2 underflows (to 0 or a subnormal), although d^2 / p0 can be far larger when p0 is tiny. `esW1([1e-320, 1], [1e-200, 1])` gave 0 for w = 1e-40.
- Method: each term through the shared `squareOver(d, p0)` (`src/internal/summary.ts`, made for Pearson chi-squared terms): d^2 / p0 as before where d^2 is a normal number or d = 0, (d / sqrt(p0))^2 otherwise.
- Why this: the helper already exists for this exact form and returns the same bits wherever d^2 is normal, so ordinary inputs do not change. The cell with p0 = p1 = 0 keeps adding nothing (the intentional difference of #204), and p0 = 0 < p1 keeps giving Inf; with a tiny d it gave NaN (0 / 0) and now gives Inf as well.
- R's `ES.w1` gives 0 (and NaN for p0 = 0 < p1 = 1e-300), so the cases are recorded in docs.

## Check (main `437b55a`, R 4.5.2, pwr)

| Call | R | Before | After |
|---|---|---|---|
| `esW1([1e-320, 1], [1e-200, 1])` (p0 the subnormal 253 2^-1071) | 0 | 0 | 1.0000055664551364e-40 (Rmpfr from the double inputs 1.00000556645513627e-40, 1 ulp) |
| `esW1([0, 1], [1e-300, 1])` | NaN | NaN | Infinity |
| `esW1([0.25, 0.25, 0.25, 0.25], [0.4, 0.2, 0.2, 0.2])` | 0.34641016151377546 | the same | unchanged |
| `esW1([1e-300, 1], [1e-150, 1])` (d^2 normal) | not run | 1 | unchanged |

## Fix

- `src/htest/pwr.ts`: `esW1` adds `squareOver(p1[i] - p0[i], p0[i])`.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row after the #204 row of `ES.w1`.

## Tests

- `test/issue264.test.ts`: the issue's case against Rmpfr (relative 1e-15) and p0 = 0 with a tiny p1 giving Inf; ordinary cases keep the values from before the fix. With `src/` stashed the first test fails.
- `npx vitest run`: 349 files passed (2796 tests passed, 38 skipped), with the fixes of #264, #265, #269 and #272 together. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- The sum s itself can be subnormal (w below about 1.5e-154), where sqrt(s) loses precision; not changed.

## close comment

Fixed in <commit of #264, see git log --grep='#264'>: `esW1` now forms each term with the shared `squareOver` helper, which takes (d / sqrt(p0))^2 where d^2 = (p1 - p0)^2 is below the normal range. `esW1([1e-320, 1], [1e-200, 1])` now gives 1.0000055664551364e-40 (Rmpfr 1.00000556645513627e-40) instead of 0, and `esW1([0, 1], [1e-300, 1])` gives Infinity (p0 = 0 < p1, as for larger differences) instead of NaN. R's `ES.w1` gives 0 and NaN, so this is recorded in docs/differences-from-r.md. Ordinary inputs are unchanged to the bit. (Not pushed yet.)
