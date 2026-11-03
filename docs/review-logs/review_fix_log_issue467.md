# Issue #467 log: barylag where the second form's denominator cancels

GitHub Issue #467. Session 13, group B (user decisions).

## Plan

- User decision (2026-11-03): option B of the preparation. Where the data are finite, |den| < 2^-100 sum |t_j| and |num| >= 2^-26 sum |t_j y_j|, evaluate again with the first barycentric form. pracma gives NaN, so record it in docs (en, ja).
- Why B: the denominator of the second form below 2^-100 of the sum of its absolute terms only arises when large terms cancelled exactly (a rounded sum is not below about 2^-53 / n of it otherwise; random, equispaced, integer and Chebyshev nodes with n = 60 to 200 gave at least 2^-62). The numerator test keeps the second form where the numerator cancels too (constant data), which the second form reproduces and the first form does not. Compensated summation does not help: the residual is already lost in the rounded differences x - x_j.

## Reproduction (main `29f9122`, pracma under R 4.5.2)

| call | pracma | before | after | exact |
|---|---|---|---|---|
| `barylag(xi, xi, [2^-300])`, xi = [0, 2^-250, 2^-249, 2^-600] | NaN | Infinity | 2^-300 | 2^-300 |
| same at 2^-400, 2^-260 | | Infinity | 2^-400, 2^-260 | the same |
| same at 2^-650 | | 2.1404388173910186e-196 | the same | the same |
| `barylag(xi, [1, 0, 0, 0], [2^-1074])` (#402) | NaN | 1 | 1 | |
| `barylag([0, 1, 2], [1, 3, 7], [0.5, 1.5])` | | 1.7500000000000002, 4.75 | the same | |

## Cause

With the weights scaled by a common power of 2, the terms at 2^-300 are t_0 = -2^300, t_3 = 2^300 (2^-300 - 2^-600 rounds) and t_1, t_2 of about 1e-30; summed, den is exactly 0 while the true denominator is about 1. The numerator, about 4.9e-91, does not cancel.

## Fix

- `src/numerics/interp.ts` `barylag`: the sums of |t_j| and |t_j y_j| alongside the plain sums; under the condition above, the first form l(u) sum_j w_j y_j / (u - x_j) with l(u) = prod (u - x_j) as a mantissa and an exponent, the terms 1 / (p_j (u - x_j)) as m 2^e over the power of 2 of the largest term, y_j over the power of 2 of the largest |y_j| (no overflow for y near 1e308), the result by `ldexpWide`. In the halved coordinates of #215 the same u = x / 2 (the scale cancels between l and the terms).
- docs (en, ja): a row next to the earlier barylag rows.

## Tests

- `test/issue467.test.ts`: the identity at 2^-300, 2^-400, 2^-260 (exact); 2^-650, the #402 call and the `@example` unchanged; constant data y = 1 + x keep 1. With `src/` stashed the first test fails (Infinity).
- Against the preparation's inputs (fixture cases, the existing tests' inputs, 400 random node sets with n = 2 to 80; 10057 values): the only change from main is one Infinity, now 3.274698679768776e21 (n = 65, exact 3.274698679768784e21), and every value is bit for bit the preparation's prototype. The family of the four nodes (24 orders, 260 points, y = x): 576 wrong values left (near the node 2^-600), none non-finite, the same as the prototype. y = x 2^K for K = 700 to 1000 (large data): x 2^K at the four points (main Infinity at three).
- `issue14`, `issue215`, `issue402`, `numerics`, `jstat-replacement`: pass.

## Out of scope (recorded)

- Points very near the node 2^-600 (3 2^-550 to 2^-592 in the preparation's family) remain wrong: the rounding of x - 2^-600 makes the cancellation partial, so the denominator is above 2^-64 of its terms and the test does not fire.
- Constant data y = 1 + x at points such as 2^-300 or 3 2^-500 give NaN (0 / 0) before and after; the numerator cancels as well, and the first form would not give 1 either.

## close comment

Fixed in <commit of #467, see git log --grep='#467'>: where the second barycentric form's denominator falls below 2^-100 of the sum of its absolute terms (large terms cancelled exactly) while the numerator keeps at least 2^-26 of its own, barylag now evaluates the first form l(x) sum w_j y_j / (x - x_j) with separate exponents. With `xi = [0, 2 ** -250, 2 ** -249, 2 ** -600]`, `barylag(xi, xi, [2 ** -300])` is 2^-300 (was Infinity; pracma NaN, recorded in docs/differences-from-r.md). Data whose numerator cancels too (a constant) keep the second form; ordinary inputs do not reach the test and are unchanged. Test: test/issue467.test.ts. (Not pushed yet.)
