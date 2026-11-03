# Issue #215 log: barylag with finite nodes whose differences overflow

GitHub Issue #215. Session 11, group A5 (overflowing differences in the numerical methods).

## Plan

- Intent: the barycentric weights multiply node differences `x_j - x_k`. For finite nodes such as -1e308 and 1e308 one difference already overflows, so the product is Infinity before the renormalisation of #14 can act; the weights become 0 and the result NaN. The evaluation differences `v - x_j` overflow the same way.
- Method: only where the nodes are finite and their range `max - min` overflows, build the weights and the evaluation differences in x / 2. Every difference is then at most half the range, which is finite. The barycentric interpolant is a ratio in which the scale of x cancels (weights scale by 2^(n-1), the terms w_j / (v - x_j) by a common factor), so the result is the same function. Exact node hits are still checked on the original values.
- Why x / 2 rather than x / 2^k (as `knotScale` for spline): halving is enough to make every difference finite and keeps nodes far below 1e308 from being pushed into the subnormals.
- Expected effect: nodes whose range is finite go through the old code with the same bits.

## Check (main `388d08f`; R 4.5.2 with pracma)

| call | pracma | Before | After | Exact |
|---|---|---|---|---|
| `barylag([-1e308, 1e308], [-1, 1], [0])` | NaN | NaN | -0 | 0 |
| the same at 0.5e308, -1e307 | | NaN | 0.5000000000000001, -0.1 | 0.5, -0.1 |
| `barylag([-1e308, 0, 1e308], [1, 0, 1], [0.5e308, -0.25e308])` | NaN NaN | NaN | 0.25, 0.0625 | 0.25, 0.0625 |
| nodes (1, -1, 0.3, -0.2) times 1e308, y = 1..4, at 0, 5e307 | | NaN | 3.7252747252747254, 2.4038461538461533 | 3.725274725274725, 2.4038461538461537 (the nodes divided by 1e308) |
| `barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5])`, nodes of 1e200 | | | the same bits as before | |

## Fix

- `src/numerics/interp.ts` (`barylag`): the halved coordinates where the range of finite nodes overflows.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: a row after the #14 barylag row.

## Tests

- `test/issue215.test.ts`: the line, the parabola, four nodes against the same nodes divided by 1e308, and unchanged bits for finite ranges. With src stashed the three overflow tests fail.
- The test files that mention `barylag`: 328 passed. Full run and tsc: see the log of #216.

## close comment

Fixed in <commit of #215, see git log --grep='#215'>: where finite nodes have a range that overflows, `barylag` now builds the weights and the evaluation differences in x / 2, where every difference is finite; the barycentric ratio does not depend on the scale of x. `barylag([-1e308, 1e308], [-1, 1], [0])` is now 0 (it was NaN, pracma too), and `barylag([-1e308, 0, 1e308], [1, 0, 1], [0.5e308])` is 0.25. Nodes whose range is finite are unchanged. Documented in docs/differences-from-r.md.

Test: test/issue215.test.ts. (Not pushed yet.)
