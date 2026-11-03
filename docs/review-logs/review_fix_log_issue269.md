# Issue #269 log: pwrRTest overflows the squared critical t for tiny significance levels

GitHub Issue #269. Session 11, group A5 of the second triage (effect sizes and powers in pwr.ts and power.ts).

## Plan

- Intent: `pwrRTest` turns the critical t into the critical correlation sqrt(t^2 / (t^2 + n - 2)). With 2 degrees of freedom and a subnormal significance level the critical t is finite (7.07e159 for `sigLevel: 1e-320`) but t^2 overflows, and Inf / Inf gave a NaN power.
- Method: only where t^2 + n - 2 overflows for a finite t, the critical correlation is 1 / sqrt(1 + ((n - 2) / t) / t). Otherwise the expression is unchanged (the same bits).
- Why this: the overflow is the only failure, and the rewritten form is the same quantity without the square. An infinite t (sigLevel 0, or 1 for a one-sided test) is left as before (NaN, as R): its limit is a separate question (pwr's one-sided formula ignores the sign of t), not part of this issue.
- R's `pwr.r.test` gives NaN (its `qt` already returns Inf for such a subnormal probability), so the case is recorded in docs.

## Check (main `7ee4cdc`, R 4.5.2, pwr)

| Call | R | Before | After |
|---|---|---|---|
| `pwrRTest({ n: 4, r: 0.5, sigLevel: 1e-320 })` | NaN (`qt(253 * 2^-1071, 2, lower.tail = FALSE)` is Inf) | NaN | 0 (the critical correlation rounds to 1; the power is about pnorm(-368)) |
| the same, `alternative: "greater"`; `r: -0.99, "less"` | not run | NaN | 0 |
| `pwrRTest({ n: 50, r: 0.3 })` | 0.571555841860208 (`0x1.24a2f7a14132ep-1`) | the same | unchanged |
| `pwrRTest({ n: 4, r: 0.5, sigLevel: 1e-300 })` (t^2 finite) | not run | 0 | unchanged |
| `pwrRTest({ n: 4, r: 0.5, sigLevel: 0 })` (t infinite) | NaN | NaN | unchanged |

rStats.js's `qt(5e-321, 2, { lowerTail: false })` is 1.0000055664551531e+160, as 1 / sqrt(p) should be. With more than 2 degrees of freedom the critical t at the smallest levels stays below 1e154, so the new branch only serves df <= 2 (and n near the largest double), where the power underflows to 0 anyway.

## Fix

- `src/htest/pwr.ts`: the critical correlation in `pwrRTest`'s `upper`.
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row after the `ES.w2` row.

## Tests

- `test/issue269.test.ts`: the issue's call and the one-sided variants give 0; ordinary calls and sigLevel 0 keep the values from before the fix. With `src/` stashed the first test fails.
- `npx vitest run`: 349 files passed (2796 tests passed, 38 skipped), with the fixes of #264, #265, #269 and #272 together. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- sigLevel 0 (and 1 for a one-sided test) still gives NaN; other pwr functions give 0 at sigLevel 0 (`pwrTTest`, `pwrNormTest`, `pwrChisqTest`).
- R's `qt` returns Inf for subnormal upper-tail probabilities with 2 df (`qt(1e-310, 2, lower.tail = FALSE)`), while `qt(1e-300, ...)` is 7.07e149.

## close comment

Fixed in <commit of #269, see git log --grep='#269'>: where t^2 + n - 2 overflows for a finite critical t, `pwrRTest` now takes the critical correlation as 1 / sqrt(1 + ((n - 2) / t) / t). `pwrRTest({ n: 4, r: 0.5, sigLevel: 1e-320 })` (t = 7.07e159 with 2 df) now gives power 0 (the critical correlation rounds to 1 and the normal tail underflows) instead of NaN. R's `pwr.r.test` gives NaN (its `qt` returns Inf there), so this is recorded in docs/differences-from-r.md. Other inputs are unchanged to the bit; sigLevel 0 still gives NaN. (Not pushed yet.)
