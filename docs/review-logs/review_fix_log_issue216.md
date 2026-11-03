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

## Follow-up (session 11, user decision 5)

### Plan

- Intent: the out-of-scope case above. With nodes ±1e200 the separations are finite, but the divided differences of order j scale as 1 / x^j and the third one underflows, so `hermiteInterp([-1e200, 1e200], [-1, 1], [0, 0], [0.5e200])` gave -1 (exact 0.6875). Tiny nodes fail the other way: at ±1e-200 the differences overflow and the result was NaN.
- Method: a fallback condition rather than a magnitude threshold. The table is built as before; only where a quotient of finite, nonzero numbers (finite table entries, nonzero difference and separation) is not finite or falls below the normal range 2^-1022, it is rebuilt in x / 2^k with k = floor(log2(max abs(node))), the same coordinates as the overflow case of #216 (derivatives times 2^k, exact). The overflowing range keeps its trigger (knotScale). Where nothing is lost the coefficients and the evaluation are the old ones, so the bits cannot change; a threshold such as max abs(x) > 2^500 would have changed results that are correct now.
- Not an R function, so no entry in docs/differences-from-r.md.

### Check

Bits of ordinary inputs: 20000 random cases (1 to 7 nodes, node scale 1e-6 to 1e10, value and slope scales 1e-6 to 1e10, zeros and grid nodes mixed in, 240328 evaluations at and around the nodes) against a copy of the code before the fix: 0 differences (`Object.is`).

| call | Before | After | Reference |
|---|---|---|---|
| `hermiteInterp([-1e200, 1e200], [-1, 1], [0, 0], [0, 0.5e200])` | -1, -1 | -2.220446049250313e-16, 0.6874999999999996 | exact 0, 0.6875; the nodes divided by 2^664 give the same bits |
| `([-1e300, 1e300], ...)` at 0.5e300 | -1 | 0.6875 | 0.6875 |
| `([-1e150, 1e150], ...)` at 0.5e150 | 0.12499999999999978 | 0.6875 | 0.6875 |
| `([-1e-200, 1e-200], ...)` at 0.5e-200 | NaN | 0.6874999999999998 | 0.6875 |
| nodes 0, 1e200, 3e200, values 1, -2, 0.5, slopes 1e-200, 0, -3e-200 at 0.5e200, 2e200 | 1.5, 3 | -0.6624710648148147, 1.407407407407408 | nodes 0, 1, 3: -0.6624710648148149, 1.4074074074074066 |
| the same at 1e-200 (slopes times 1e200) | NaN, NaN | -0.6624710648148144, 1.4074074074074092 | as above |
| `([-1e100, 1e100], ...)` at 0.5e100 (differences normal) | 0.6875000000000002 | the same bits | |
| `([-1e308, 1e308], ...)` (#216) | 0, 0.6875 | the same bits | |

The last digits at 1e200 come from 1e200 / 2^664 not being 1 (the nodes are about 1.03 in the scaled coordinates), not from the scaling.

### Fix

- `src/numerics/interp.ts`: the table moved to `hermiteTable`, which also reports `lost`; `hermiteInterp` rebuilds it in x / 2^k when it is lost and all inputs are finite.

### Tests

- `test/issue216.test.ts` (new describe block): the ±1e200, ±1e300 and ±1e150 cubic, the ±1e-200 cubic, three nodes at both scales against the nodes of order 1, and the 1e100 case unchanged. With src stashed the first three fail.
- `npx vitest run`: 355 files passed (2819 tests passed, 38 skipped). `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commits of #216, see git log --grep='#216'>: where finite nodes have a range that overflows, `hermiteInterp` now builds and evaluates the polynomial in x / 2^k, with 2^k near the largest node and the derivatives multiplied by 2^k (both exact), as spline already does. Halving alone was not enough: the separations become finite, but the higher divided differences (of order 1 / x^j) still underflow to 0. `hermiteInterp([-1e308, 1e308], [-1, 1], [0, 0], [0])` is now 0 (it was -1), and 0.6875 at 0.5e308. Nodes whose range is finite are unchanged. Large nodes with a finite range fail through the same underflow, and tiny nodes through overflowing differences; a follow-up rebuilds the table in the same scaled coordinates only where a divided difference of finite, nonzero numbers falls outside the normal range: `hermiteInterp([-1e200, 1e200], [-1, 1], [0, 0], [0.5e200])` is now 0.6874999999999996 (it was -1, exact 0.6875), and at ±1e-200 0.6874999999999998 (it was NaN). Where no difference is lost the bits are unchanged (0 differences in 240328 evaluations of ordinary inputs).

Test: test/issue216.test.ts. (Not pushed yet.)
