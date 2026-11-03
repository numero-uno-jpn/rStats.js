# Issue #228 log: hist density is 0 where the width of a cell with finite ends overflows

GitHub Issue #228. Session 11, group A4 (hist: #228, #230, #231, #258, #259).

## Plan

- Intent: `hist` computes the density as `count / (n * (b - a))` (R's order). For finite ends whose difference exceeds `Number.MAX_VALUE`, such as `hist([-1e308, 1e308], { breaks: [-1e308, 1e308] })`, `b - a` is Infinity and the density is 0, while the true density 1 / 2e308 = 5e-309 is a representable subnormal.
- Method: a helper `cellDensity`. Where the width of finite ends is Infinity, it takes ws = b / 2 - a / 2 (finite; the halving is exact for ends this large), divides it by its power of 2, 2^e, and returns `ldexp(count, -(e + 1)) / (n * ldexp(ws, -e))`. Both products by powers of 2 are exact (also the subnormal numerator count 2^-(e+1), since count is an integer below 2^53), so the density is rounded once even where it is subnormal.
- Why: R's expression is kept wherever the width is finite, so those densities keep their bits. The case where only n times a finite width overflows is #259 and is handled there (separate commit). Chosen over dividing by 2 after the quotient, which would round twice in the subnormal range.

## Check (main after #189; R 4.5.2, Rmpfr 300 bits with the same doubles passed as hex)

| call | R 4.5.2 | Before | After | Rmpfr |
|---|---|---|---|---|
| `hist([-1e308, 1e308], breaks [-1e308, 1e308])` density | 0 | [0] | [0x1.cc359e067a348p-1025] (5e-309) | 0x1.cc359e067a348p-1025 |
| `hist([-1.5e308, 1.5e308, 1.68e308], breaks [-1.7e308, 1.6e308, 1.65e308, 1.7e308])` density | | [0, 0, 6.666666666666683e-308] | [0x1.73e2ec4da366p-1026, 0, 6.666666666666683e-308] | 0x1.73e2ec4da366p-1026 for the first |
| `hist([1, 2, 2, 3, 3, 3, 4])` density | | [0.428..., 0.428..., 0.142...] | same bits | |
| `hist([-1e300, 0.5e300, 1e300], breaks [-1e300, 0, 1e300])` density | | [3.333333333333333e-301, 6.666666666666666e-301] | same bits | |

## Fix

- `src/descriptive/hist.ts`: `cellDensity` (above) used for the densities.
- Docs: a row for `hist(...)$density` in "Where R fails and rStats.js returns a value" (English and Japanese).

## Tests

- `test/issue228.test.ts`: the two overflowing widths against the Rmpfr values, and the unchanged densities (values before the fix). With src stashed the first test fails.

## Out of scope

- `hist([0, 1e308], { breaks: [0, 1e308] })`: the width is finite but n times it overflows (density 0). That is #259.

## close comment

Fixed in <commit of #228, see git log --grep='#228'>: where the width of a cell with finite ends overflows, `hist` now computes the density from half the width divided by its power of 2, rounded once. `hist([-1e308, 1e308], { breaks: [-1e308, 1e308] }).density` is 5e-309 (0x1.cc359e067a348p-1025, the Rmpfr value; was 0, and R 4.5.2 also gives 0, recorded in docs/differences-from-r.md). Densities of finite widths are unchanged. Test: test/issue228.test.ts. (Not pushed yet.)
