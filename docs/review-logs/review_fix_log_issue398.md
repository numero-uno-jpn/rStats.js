# Issue #398 log: the hyman limiter where the product of the secants underflows

GitHub Issue #398. Session 13, group 5a (interpolation fallbacks).

## Plan

- Intent: `hymanCoef` decides whether the neighbouring secants have the same sign by `sm * sp > 0`. For secants near 1e-200 the product underflows to 0, and the sign then comes from the unconstrained fmm slope, which can be negative for increasing data.
- Method: compare the signs, `(sm > 0 && sp > 0) || (sm < 0 && sp < 0)`. Where the product is finite and nonzero (or overflows to +Infinity) this is the same test, so values in the ordinary range keep their bits; it differs only where the product underflows.

## Check (main `a32a8a8`, R 4.5.2)

| call | R | before | after |
|---|---|---|---|
| `splinefun([0, 1, 5], [0, 2e-199, 4e-199], hyman)(5, 1)` | -0x1.56ebfd2a518b4p-662 (-7e-200) | -6.999999999999999e-200 | 0 |
| the same at 3, 4, 5 | 4.1e-199, 4.3625e-199, 4e-199 (not monotone) | the same | 3.75e-199, 3.96875e-199, 4e-199 |

The new values are those of the spline through y = (0, 2, 4) (3.75, 3.96875, 4; derivative 0 at 5) times 1e-199.

## Fix

- `src/numerics/interp.ts` `hymanCoef`: the sign comparison.
- docs (en, ja): a row in the overflow table of differences-from-r (R gives the same wrong value).

## Tests

- `test/issue398.test.ts`: the call above against the scaled spline, and the ordinary-range values. With `src/` stashed the first test fails.
- `issue125`, `issue380`, `numerics`, `jstat-replacement`: pass. `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #398, see git log --grep='#398'>: the Hyman limiter now compares the signs of the neighbouring secants instead of testing `sm * sp > 0`, which underflowed to 0 for secants near 1e-200 and let the fmm slope pick a negative sign. `splinefun([0, 1, 5], [0, 2e-199, 4e-199], { method: "hyman" })([5], 1)` is 0 (was -7e-200, R gives the same -7e-200; recorded in docs/differences-from-r.md), and the spline is that through (0, 2, 4) scaled by 1e-199. Where the product is in range the test is the same, so ordinary values are unchanged. Test: test/issue398.test.ts. (Not pushed yet.)
