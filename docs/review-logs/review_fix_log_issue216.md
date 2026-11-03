# Issue #216 log: hermiteInterp with finite nodes whose separation overflows

GitHub Issue #216. Session 11, group A5 (overflowing differences in the numerical methods).

## Plan

- Intent: the divided-difference table divides by node separations `z[i + k] - z[i]`. For finite nodes such as -1e308 and 1e308 the separation overflows, the quotient becomes 0, and `hermiteInterp([-1e308, 1e308], [-1, 1], [0, 0], [0])` gives -1 instead of 0.
- Method: only where the nodes are finite and their range overflows, build and evaluate the polynomial in x / 2^k, with k from `knotScale` (the exponent of the largest |node|, as spline and splinefunH already do for #125), and the given derivatives times 2^k (dy/d(x / 2^k) = 2^k dy/dx). Multiplying by a power of 2 is exact for normal numbers, so this is the same polynomial.
- Why not x / 2 (as barylag, #215): halving makes the separations finite, but the divided differences of order j scale as 1 / x^j; in x / 2 the first ones are subnormal (2e-308) and the second ones underflow to 0, so the result stayed -1. In x / 2^k the nodes are of order 1.
- Expected effect: nodes whose range is finite go through the old code with the same bits. Not an R function (jStat's hermite), so no entry in docs/differences-from-r.md.

## Check (main `9351456`)

| call | Before | After | Exact (the nodes scaled to ±1) |
|---|---|---|---|
| `hermiteInterp([-1e308, 1e308], [-1, 1], [0, 0], [0, 0.5e308])` | -1, -1 | 0, 0.6875 | 0, 0.6875 |
| slopes (1e-308, 2e-308) at 0.5e308, -0.3e308 | 0.4999999999999998, -0.30000000000000004 | 0.21875000000000022, -0.45924999999999994 | 0.21875, -0.45925 |
| `hermiteInterp([0, 1], [0, 1], [0, 0], [0.25, 0.5])` and `([-1, 1], [-1, 1], [1, 2], [0.5, -0.3])` | | the same bits | |

## Fix

- `src/numerics/interp.ts` (`hermiteInterp`): the scaled coordinates where the range of finite nodes overflows.

## Tests

- `test/issue216.test.ts`: the issue's cubic (exact 0 and 0.6875), slopes against the nodes scaled to ±1, unchanged bits for finite ranges. With src stashed the two overflow tests fail.
- `npx vitest run` (after #211, #214, #215 and this fix): 317 files passed (2701 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## Out of scope

- Nodes that are large but whose range is finite fail the same way through underflowing divided differences: `hermiteInterp([-1e200, 1e200], [-1, 1], [0, 0], [0.5e200])` and the same at 1e300 give -1 (exact 0.6875). Scaling there too would apply the same x / 2^k under a wider condition (for example max |x| beyond 2^±500, or a coefficient that underflows), which changes the bits of results that are now correct for moderately large nodes unless the condition is chosen carefully. Left for a decision; a new issue would be the place.

## close comment

Fixed in <commit of #216, see git log --grep='#216'>: where finite nodes have a range that overflows, `hermiteInterp` now builds and evaluates the polynomial in x / 2^k, with 2^k near the largest node and the derivatives multiplied by 2^k (both exact), as spline already does. Halving alone was not enough: the separations become finite, but the higher divided differences (of order 1 / x^j) still underflow to 0. `hermiteInterp([-1e308, 1e308], [-1, 1], [0, 0], [0])` is now 0 (it was -1), and 0.6875 at 0.5e308. Nodes whose range is finite are unchanged. Large nodes with a finite range (`hermiteInterp([-1e200, 1e200], [-1, 1], [0, 0], [0.5e200])`, -1 instead of 0.6875) fail through the same underflow and are not covered by this fix.

Test: test/issue216.test.ts. (Not pushed yet.)
