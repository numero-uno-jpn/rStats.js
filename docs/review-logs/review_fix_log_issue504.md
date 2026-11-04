# Issue #504 log: hessian's second difference overflowed

GitHub Issue #504. Session 15, group A2. Fixed: `hessian` (`src/numerics/deriv.ts`) summed f(x + h) − 2 f(x) + f(x − h) before dividing by the step; with finite values near 1e308 the sum overflows, and #214's fallback (num / h / h) cannot recover it.

## Plan

- Intent: return the finite curvature when only the numerator of the second difference overflows.
- Method: when the numerator is not finite but f(x + h), f(x), f(x − h) are finite, divide every term by the step before the sum: diagonal (fp/h − 2 (f0/h) + fm/h)/h; off-diagonal the form of #214's else branch with num/hi/hj replaced by fu/hi/hj − 2 (f0/hi/hj) + fd/hi/hj. Otherwise the code is unchanged (K3); the function is evaluated in the same order.
- Why: a non-finite numerator with finite terms only happens by overflow of the sum. With h < 1 the true quotient overflows anyway, so dividing first gives no worse value. numDeriv gives NaN here (K2), documented.

## Reproduction (main `53ee5d7`, R 4.5.2, numDeriv)

| call | numDeriv | rStats.js before | after |
|---|---|---|---|
| 1e-92 x², x = 0, eps 1e200, r 1 | error (r = 1 is not supported by genD) | [[Inf]] | 2e-92 |
| same, r 2 | NaN | — | 2e-92 |
| 1e-92 x0 x1 + 0.5e-92 x0², r 1 | — | H[0][1] = Inf | 1e-92 |
| same, r 2 | NaN (diagonal [1,1] and off-diagonal) | — | 1e-92, 1e-92 (9.999999999999998e-93 off-diagonal) |

## Fix

- `src/numerics/deriv.ts`: the two branches above. docs (en, ja): a row after #214's.

## Tests

- `test/issue504.test.ts`: the issue's diagonal case and the off-diagonal case, relative error < 1e-15. With `src/` stashed both fail.
- Every test file that calls `hessian` (8 files, including `issue214`) passes, so ordinary bits are unchanged.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #504, see git log --grep='#504'>. hessian now divides each term of the second difference by the step before summing when the sum of finite function values overflows: the issue's example gives 2e-92 (before Infinity), and the off-diagonal case 1e-92 x0 x1 + 0.5e-92 x0² gives 1e-92 (before Infinity). numDeriv gives NaN for these (with r = 2; r = 1 is an error there); the difference is documented in differences-from-r. Other inputs keep their bits. A test was added: test/issue504.test.ts. (Not pushed yet.)
