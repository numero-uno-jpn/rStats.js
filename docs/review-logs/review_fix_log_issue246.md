# Issue #246 log: zeroTol 0 gives a zero Richardson step at a coordinate equal to 0

GitHub Issue #246. Session 11, judging of the issues classified C. Then user decision 6 (option A, with #213). Fixed by #213's check: a step of 0 is an error in `grad`, `jacobian` and `hessian`.

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

## Decision (user decision 6)

Option A of the judging, which was recommended and is #213's option A (the others were B: use eps for an exact 0 even with zeroTol 0, changing the meaning of zeroTol from numDeriv's; C: not planned). The code change is in #213's commit: `steps()` in `src/numerics/deriv.ts` throws where a step is not positive and finite, which covers the step 0 of x[i] = 0 with zeroTol 0. The docs entry (the list of meaningless input that is an error) was added there too, naming both issues.

| Call | before | after |
|---|---|---|
| `grad(x => x[0] * x[0], [0], { zeroTol: 0 })` | RangeError "func returned NaN at step 0 from x" | RangeError "the step for x[0] is 0: not a positive finite number" |
| `jacobian(x => [x[0] * x[0]], [0], { zeroTol: 0 })` | [[NaN]] | the same RangeError |
| `hessian(x => x[0] * x[0], [0], { zeroTol: 0 })` | [[NaN]] | the same RangeError |
| `grad(x => x[0] * x[0], [1], { zeroTol: 0 })` | 1.9999999999870133 | unchanged |

## Tests

- `test/issue246.test.ts`: the three calls throw, and the nonzero coordinate keeps its value. With `src/numerics/deriv.ts` from before #213's commit, the first block fails.

## close comment

Fixed in <commit of #213, see git log --grep='#213'> (the check added for #213), with a test in <commit of #246, see git log --grep='#246'>. grad already threw for x = 0 with zeroTol 0, but only from its check of the function's values (0 / 0 is NaN); jacobian and hessian returned [[NaN]], as numDeriv does. The steps of the Richardson method are now checked where they are formed: a step that is not positive and finite, here 0, throws RangeError "the step for x[0] is 0: not a positive finite number" in grad, jacobian and hessian alike. Nonzero coordinates with zeroTol 0 keep working (grad of x^2 at 1: 1.9999999999870133 as before). numDeriv returns NaN for jacobian and hessian; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue246.test.ts. (Not pushed yet.)
