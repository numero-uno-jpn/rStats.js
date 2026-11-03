# Issue #197 log: powerTTest's noncentrality overflows before the division by sd

GitHub Issue #197. Session 11, group A2.

## Plan

- Intent: `powerTTest` forms the noncentrality as `(sqrt(n / ts) * delta) / sd`, R's order. With `delta = sd = 1e308` the product overflows before the division and the noncentrality is Infinity, so the power is 1, while the true noncentrality is `sqrt(n / ts)` (finite).
- Method: keep R's order; only where the result is not finite take `sqrt(n / ts) * (delta / sd)`. Since `n >= 2`, `sqrt(n / ts) >= 1`, so the reordered value is Infinity only where the noncentrality itself is beyond the doubles.
- Why: reordering always would change the bits of ordinary powers (a different rounding order); the fallback is reached only where the value was Infinity, so every other power keeps its bits. R gives 1 here (its noncentrality is Inf too), so the new value differs from R and is recorded in the docs.

## Check (main `d4c0ca9`; R 4.5.2)

| Call | R 4.5.2 | Before | After |
|---|---|---|---|
| `n = 10, delta = 1e308, sd = 1e308` | 1 | 1 | 0.5619846150342211 (= delta = sd = 1) |
| same, `type = "one.sample"` | 1 | 1 | 0.8030962086904039 |
| same, `strict = TRUE` | 1 | 1 | 0.5620066465861491 |
| same, `alternative = "one.sided"` | (not run) | 1 | 0.6935574919366613 |
| `delta = -1e308`, one sided | (not run) | 0 | 7.198408814300099e-5 |
| `n = 10, delta = 1, sd = 1` | 0.56198461503427142 | 0.5619846150342211 | unchanged |
| `n = 10, delta = 1e308, sd = 2e-308` | | 1 | 1 (the noncentrality is truly Inf) |

The reference is the power at `delta = sd = 1`: `1e308 / 1e308` is exactly 1, so the reordered noncentrality is bit for bit that of `delta = sd = 1`. (rStats.js and R differ in the last digits at `delta = sd = 1`; that is the existing accuracy difference of the noncentral t recorded in the docs, not this issue.)

## Fix

- `src/htest/power.ts` (`powerTTest`, `powerOf`): the fallback with the ratio first. The solving branches (for n, delta, sd or sig.level) go through the same `powerOf`.
- Docs: a row in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue197.test.ts`: the five cases above equal the power at `delta = sd = 1` with the same options; an ordinary power and a truly infinite noncentrality unchanged. With src stashed the first test fails.
- The test files that mention `powerTTest`: 8 passed.

## Out of scope

- Where the product `sqrt(n / ts) * delta` falls below the normal range (delta and sd around 1e-310) the noncentrality loses bits to the subnormal rounding (relative error about 1e-14 at 2e-310). Not reported; not changed.
- The solving intervals `ad * 1e7`, `sd * 1e7` (for sd and delta) can overflow for inputs near the largest double. Not checked further.

## close comment

Fixed in <commit of #197, see git log --grep='#197'>: where `sqrt(n / ts) * delta` overflows, `powerTTest` now forms the noncentrality as `sqrt(n / ts) * (delta / sd)`. The issue's example `powerTTest({ n: 10, delta: 1e308, sd: 1e308 }).power` is 0.5619846150342211 (was 1), the same bits as `delta = sd = 1`; R 4.5.2 gives 1 here (its noncentrality is Inf too), so the difference is recorded in docs/differences-from-r.md. Powers whose product does not overflow are unchanged. Test: test/issue197.test.ts. (Not pushed yet.)
