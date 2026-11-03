# Issue #265 log: esW2 returns NaN where an independence cell probability underflows

GitHub Issue #265. Session 11, group A5 of the second triage (effect sizes and powers in pwr.ts and power.ts).

## Plan

- Intent: `esW2` forms p0 = r c from the row and column sums and adds (p - p0)^2 / p0. Where r c is below 2^-1022 it is rounded to a subnormal or to 0, although the term (p - r c)^2 / (r c) = (p / sqrt(r c) - sqrt(r c))^2 can be of order 1. `esW2([[1e-200, 0], [0, 1]])` gave 0 / 0 = NaN for w = 1, and with a subnormal r c (about 1e-320) the term lost all its digits (w = 1 for 0.9999999999).
- Method: a cell with p0 = p = 0 is skipped as before (#204). Where p0 is a normal number the term goes through the shared `squareOver(p - p0, p0)`, which equals the old expression to the bit except where (p - p0)^2 underflows (then (d / sqrt(p0))^2, as #264). Where p0 is below the normal range (the row and column sums are then not 0, since p <= r and p <= c), the term is (p / sqrt(r) / sqrt(c) - sqrt(r) sqrt(c))^2.
- Why this: it changes the result only where p0 or the squared difference is out of the normal range. Dividing p by the two square roots in turn keeps the quotient (at most 1) out of the subnormal range; sqrt(r) sqrt(c) is only subnormal where it is negligible against p / sqrt(r c) unless p itself is subnormal.
- R's `ES.w2` gives NaN and 1 for the two cases, so they are recorded in docs.

## Check (main `6e91e9d`, R 4.5.2, pwr)

| Call | R | Before | After |
|---|---|---|---|
| `esW2([[1e-200, 0], [0, 1]])` (r c = 1e-400) | NaN | NaN | 1 (w^2 = (1 - 1e-200)^2 + 2e-200 exactly) |
| `esW2([[1e-160, 1e-170], [1e-170, 1]])` (r c about 1e-320, subnormal) | 1 (`0x1p+0`) | 1 | 0.9999999998999998 (Rmpfr from the double row and column sums 0.99999999989999997281) |
| `esW2([[0.3, 0.2], [0.1, 0.4]])` | 0.40824829046386296 (`0x1.a20bd700c2c3dp-2`) | the same | unchanged |
| `esW2([[0.1, 0.2, 0.05], [0.15, 0.25, 0.25]])` | not run | 0.254387626886735 | unchanged |
| `esW2([[0, 0], [0.5, 0.5]])` (an empty row, #204) | NaN | 0 | unchanged |

## Fix

- `src/htest/pwr.ts`: the cell loop of `esW2` as above (a module constant `MIN_NORMAL = 2^-1022`).
- docs/differences-from-r.md and docs/ja/differences-from-r.md: a row after the `ES.w1` rows.

## Tests

- `test/issue265.test.ts`: the issue's matrix gives 1, the subnormal r c case matches Rmpfr (relative 1e-15); ordinary matrices and the empty row keep the values from before the fix. With `src/` stashed the first test fails.
- `npx vitest run`: 349 files passed (2796 tests passed, 38 skipped), with the fixes of #264, #265, #269 and #272 together. `npx tsc --noEmit -p .`: no errors.

## Out of scope

- As in #264, the sum itself can be subnormal (w below about 1.5e-154); not changed.

## close comment

Fixed in <commit of #265, see git log --grep='#265'>: where the independence cell probability r c is below the normal range, `esW2` now forms the term as (p / sqrt(r c) - sqrt(r c))^2 from the square roots of the row and column sums, and other terms go through the shared `squareOver` helper (as `esW1` in #264). `esW2([[1e-200, 0], [0, 1]])` now gives 1 instead of NaN, and `esW2([[1e-160, 1e-170], [1e-170, 1]])`, where r c is subnormal, gives 0.9999999998999998 (Rmpfr 0.99999999989999997) instead of 1. R's `ES.w2` gives NaN and 1, so this is recorded in docs/differences-from-r.md. Cells with both probabilities 0 still add nothing (#204), and ordinary matrices are unchanged to the bit. (Not pushed yet.)
