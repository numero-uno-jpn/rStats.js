# Issue #246 log: zeroTol 0 gives a zero Richardson step at a coordinate equal to 0

GitHub Issue #246. Session 11, judging of the issues classified C. Verdict: **Awaiting decision**, with #213. The issue's example (grad) already throws, as the triage found, but jacobian and hessian, which the issue also names, return NaN silently. No code was changed.

## Plan

- Intent: check grad, jacobian and hessian at x = 0 with `zeroTol: 0`, where `steps()` (src/numerics/deriv.ts) gives h0 = abs(d * 0) + (abs(0) < 0 ? eps : 0) = 0.
- Method: run the three on f(x) = x^2 at 0, and numDeriv's grad, jacobian and hessian with `method.args = list(zero.tol = 0)` in R 4.5.2.
- Why: the same pattern as #213 (a step that cannot be used: there infinite, here zero), where the triage looked at grad only.

## Check (main `7a9fd3b`, R 4.5.2, numDeriv)

| Call | numDeriv | rStats.js | true value |
|---|---|---|---|
| `grad(x => x[0] * x[0], [0], { zeroTol: 0 })` (the issue) | error "function returns NA at 0 distance from x." | RangeError "func returned NaN at step 0 from x" | [0] |
| `jacobian(x => [x[0] * x[0]], [0], { zeroTol: 0 })` | NaN | **[[NaN]]** | [[0]] |
| `hessian(x => x[0] * x[0], [0], { zeroTol: 0 })` | NaN | **[[NaN]]** | [[2]] |
| `grad(x => x[0] * x[0], [1], { zeroTol: 0 })` | | 1.9999999999870133 | 2 |

`zeroTol` is checked to be finite and non-negative; 0 is accepted and works for nonzero coordinates. grad's error comes from the check of the function's values (0 / 0 is NaN); jacobian and hessian have no such check, as numDeriv.

## Options

- **A (recommended, the same as #213's A):** in `steps()`, throw a RangeError where a step is not positive and finite, e.g. "the step for x[i] is 0 (x[i] = 0 and zeroTol = 0)". grad, jacobian and hessian then agree; nonzero coordinates with zeroTol 0 keep working. numDeriv gives NaN for jacobian and hessian, so the docs record it.
  - Pros: one check covering #213 and #246; a clear message. Cons: R difference for jacobian and hessian.
- **B:** use eps for an exact 0 coordinate even when zeroTol is 0 (`abs(v) <= zeroTol`).
  - Pros: returns the derivative ([0], [[0]], [[2]]). Cons: changes the meaning of zeroTol = 0 from numDeriv's (`abs(x) < zero.tol`), and grad's result from numDeriv's error to a value.
- **C:** not planned: the same as numDeriv for all three.

## close comment

Awaiting a decision; see review_fix_log_issue246.md. (Not pushed yet.)
