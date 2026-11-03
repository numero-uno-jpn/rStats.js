# Issue #325 log: poissonTest rate ratio NaN for x1 = 0 with T2 / T1 overflowing

GitHub Issue #325. Session 12.

## Plan

- Intent: `rateRatio` falls back to (x1 / x2) (T2 / T1) when a rate is subnormal; with x1 = 0 and T2 / T1 = Inf that is 0 Inf = NaN. The interval's `toRatio(p)` has the same product at the binomial limit p = 0.
- Method: return 0 for x1 = 0 in the fallback, and map the limit p = 0 to 0. Both are the values the old expressions give wherever T2 / T1 is finite, so other inputs keep their bits.

## Check (main `61852ba`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `poissonTest([0, 1], { T: [5e-324, 1e308] })` (all three alternatives) | estimate 0, interval [0, Inf), p 1 | NaN, [NaN, Inf), 1 | 0, [0, Inf), 1 |

## Fix

- `src/htest/poissonTest.ts`: `rateRatio` and `toRatio`.

## Tests

- `test/issue325.test.ts`: the issue's call for the three alternatives. With `src/` stashed it fails.
- poissonTest tests and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #325, see git log --grep='#325'>: with x1 = 0 the rate ratio is 0, and a binomial limit of 0 is the ratio 0, also where T2 / T1 overflows, so `poissonTest([0, 1], { T: [Number.MIN_VALUE, 1e308] })` gives estimate 0 and interval [0, Inf) (was NaN and [NaN, Inf)), as R. Other inputs are unchanged. Test: test/issue325.test.ts. (Not pushed yet.)
