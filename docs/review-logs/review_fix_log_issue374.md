# Issue #374 log: sum losing a third band of magnitudes

GitHub Issue #374. Session 12, group B (user decision).

## Plan

- User decision (2026-11-03): count an upper bound on what the double-double lost, and only where it could affect the result sum exactly in BigInt (option A of the prep notes). Reuse `splitDouble` and `roundScaled` of `src/linalg/dot.ts` (#334).
- Intent: the double-double accumulator of `sum` (`wideSumAdd`) has two components. A value in a third band far below the other two is rounded when it is added to the low component; if the two larger bands cancel later, the result is the rounding error. This is not only the overflow path of the issue: `sum([1e20, 1e3, 1e-10, -1e20, -1e3])` was 1.0004e-10.
- Method: `sum` runs the same operations as `wideSumAdd` (ddAdd of [v, 0], written out, so the value is the same bits) and adds to `lost` the rounding error of the only inexact step (u7 = e3 + lo, by TwoSum), the scaling losses of the overflow path (values rounded onto the subnormals when divided by 2^shift), and a conservative term where the following Fast2Sum might not be exact (|u7| > |s1|, s1 != 0). At the end, the exact sum is computed only if lost (times 1 + n 2^-52) reaches the distance from hi + lo to the nearest rounding boundary of the result (half the gap, the smaller gap below a power of 2), or the result is not finite, or the overflow path's result is near the subnormals. Then BigInt over the mantissas and `roundScaled` (one correct rounding).
- Why only `sum`: the decision names sum. `meanDD` and `cumsum` share `wideSumAdd` and have the same limit (Out of scope).

## Check (main `f2d56a4`, R 4.5.2)

| call | before | after | R | exact |
|---|---|---|---|---|
| `sum([1e308, 1e308, 1e100, 1, -1e308, -1e308, -1e100])` | 0 | 1 | Inf | 1 |
| `sum([1e308, 1e100, 1, -1e308, -1e100])` | 0 | 1 | -1e100 | 1 |
| `sum([1e20, 1e3, 1e-10, -1e20, -1e3])` | 1.000444171950221e-10 | 1e-10 | -1000 | 1e-10 |
| `sum([1e30, 1e3, 1e-10, -1e30, -1e3])` | 1.000444171950221e-10 | 1e-10 | | 1e-10 |

- Bits: 20000 random vectors (normal values times powers of 10, their deviations from the mean, values with 2 decimals, values of 1e307 scale that overflow on the way; n up to 200): new `sum` and the old `wideSumAdd` loop agree in all bits.
- Time (1e6 normal values, 10 runs each, twice): old 14.3 / 14.0 ms, new 10.9 / 10.9 ms (the inlined loop avoids the arrays of ddAdd).

## Fix

- `src/internal/summary.ts`: `sum` with the bound, `mayRoundOtherwise`, `exactSum` (BigInt via `splitDouble` / `roundScaled` from `src/linalg/dot.ts`). In the plain-double evaluation mode (`setDoubleDouble(false)`) the old loop is kept. The comment of `overflowShift` no longer says that the scaling losses cannot matter.

## Tests

- `test/issue374.test.ts`: the four calls above and unchanged ordinary values. With `src/` stashed, the first test fails.
- descriptive, grouping, issue176, issue287, jstat-replacement, pivot, review45, agreement, polycor, scaleInvarianceAll: pass.
- docs (en, ja): a "Sums" subsection under "Where R is inaccurate" (R's long double gives -1e100 and -1000).

## Out of scope (recorded)

- `mean` (meanDD) and `cumsum` use `wideSumAdd` and lose the third band in the same way: `mean([1e20, 1e3, 1e-10, -1e20, -1e3]) * 5` is 1.000444171950221e-10, `mean([1e308, 1e100, 1, -1e308, -1e100])` 0, the last `cumsum` value 1.000444171950221e-10. Not changed (the decision is about sum).

## close comment

Fixed in <commit of #374, see git log --grep='#374'>: the double-double accumulator of `sum` has two components, so a value in a third band far below the others was rounded away when added to the low component, and lost when the larger bands cancelled. `sum([1e308, 1e308, 1e100, 1, -1e308, -1e308, -1e100])` and `sum([1e308, 1e100, 1, -1e308, -1e100])` were 0, and also without overflow `sum([1e20, 1e3, 1e-10, -1e20, -1e3])` was 1.0004e-10 (R gives Inf, -1e100 and -1000). `sum` now keeps an upper bound on what its double-double lost, and only where that bound could change the rounded result does it form the sum exactly (BigInt over the mantissas) and round it once: 1, 1 and 1e-10. Other sums are unchanged in all bits (20000 random vectors) and not slower (1e6 values: 14 ms before, 11 ms after). `mean` and `cumsum` share the accumulator and have the same limit; they are recorded, not changed.

Test: test/issue374.test.ts. (Not pushed yet.)
