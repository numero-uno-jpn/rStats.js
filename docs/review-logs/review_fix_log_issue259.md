# Issue #259 log: hist density is 0 where n times a finite cell width overflows

GitHub Issue #259. Session 11, group A4 (hist: #228, #230, #231, #258, #259).

## Plan

- Intent: `hist` computes the density as `count / (n * (b - a))`. #228 handled a width b - a that overflows. Where the width is finite but n times it overflows, as in `hist([0, 1e308], { breaks: [0, 1e308] })` (2 times 1e308), the density is still 0, while the true density 1e-308 is representable.
- Method: extend the fallback of `cellDensity` from #228 to every case where `n * (b - a)` is Infinity for finite ends. The width ws is b - a where finite (s = 0) or b / 2 - a / 2 where it overflows (s = 1); with 2^e its power of 2 the density is `ldexp(count, -(e + s)) / (n * ldexp(ws, -e))`. The products by powers of 2 are exact (count is an integer below 2^53), so the density is rounded once, also where it is subnormal, and n ws 2^-e is rounded as n (b - a) would be.
- Why: R's expression is kept wherever `n * (b - a)` is finite, so those densities keep their bits. The values of #228 are unchanged (s = 1 gives the same expression as before).

## Check (main after #258; R 4.5.2, Rmpfr 300 bits with the same doubles passed as hex)

| call (density) | R 4.5.2 | Before | After | Rmpfr |
|---|---|---|---|---|
| `hist([0, 1e308], breaks [0, 1e308])` | 0 | [0] | [0x1.cc359e067a348p-1024] (1e-308) | 0x1.cc359e067a348p-1024 |
| `hist([1, 2, 3, 4, 1e308], breaks [0, 1e308])` | | [0] | same as above | 5 / (5 1e308), the same |
| `hist(i 3e306 for i = 0..9, breaks [0, 3e307])` | | [0] | [0x1.7f8203b010812p-1022] (normal) | 0x1.7f8203b010812p-1022 |
| `hist([0, 0.5e308, 0.8e308], breaks [0, 0.5e308, 0.9e308])` | | [0, 0] | [0x1.32ce6959a6cdcp-1023, 0x1.7f8203b01081p-1024] | the same |
| `hist([-1e308, 1e308], breaks [-1e308, 0, 1e308])` (#228's width overflow, counts of #258) | | [0x1.cc359e067a348p-1025] x 2 | same | 1 / (2 1e308) |
| `hist([0, 1e300], breaks [0, 1e300])`, `hist([1, 2, 2, 3, 3, 3, 4])` | | 1e-300; (0.428..., 0.428..., 0.142...) | same bits | |

## Fix

- `src/descriptive/hist.ts` (`cellDensity`): the condition and the width as above.
- Docs: the row for `hist(...)$density` added in #228 now also names `hist(c(0, 1e308), breaks = c(0, 1e308))` (English and Japanese).

## Tests

- `test/issue259.test.ts`: the cases above against the Rmpfr values, and the unchanged densities (values before the fix). With src stashed the first test fails. `test/issue228.test.ts` still passes.

## Out of scope

- None found.

## close comment

Fixed in <commit of #259, see git log --grep='#259'>: where n times a finite cell width overflows, `hist` now computes the density from the width divided by its power of 2, rounded once (the same path as the overflowing width of #228). `hist([0, 1e308], { breaks: [0, 1e308] }).density` is 1e-308 (0x1.cc359e067a348p-1024, the Rmpfr value; was 0, and R 4.5.2 also gives 0, recorded in docs/differences-from-r.md). Densities where n times the width is finite are unchanged. Test: test/issue259.test.ts. (Not pushed yet.)
