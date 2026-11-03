# Issue #213 log: grad, jacobian and hessian accept relative steps d x that overflow

GitHub Issue #213. Session 11, judging of the issues classified C. Then user decision 6 (option A, with #246). Fixed: a step that is not positive and finite is an error in `grad`, `jacobian` and `hessian`.

## Plan

- Intent: check all three functions that share `steps()` (src/numerics/deriv.ts) with the issue's step, d = 2 at x = 1e308 (h = 2e308 overflows).
- Method: run grad, jacobian and hessian on f(x) = x / 1e308 at 1e308 with `{ d: 2 }`, and numDeriv's grad, jacobian and hessian with `method.args = list(d = 2)` in R 4.5.2.
- Why: a C verdict needs every named function to behave acceptably; a silent NaN for a finite derivative is not, so the choice (error or value) is written up.

## Check (main `a265a0d`, R 4.5.2, numDeriv)

| Call | numDeriv | rStats.js | true value |
|---|---|---|---|
| `grad(x => x[0] / 1e308, [1e308], { d: 2 })` (the issue) | error "function returns NA at Inf distance from x." | RangeError "func returned NaN at step Infinity from x" | 1e-308 |
| `jacobian(x => [x[0] / 1e308], [1e308], { d: 2 })` | NaN | **[[NaN]]** | [[1e-308]] |
| `hessian(x => x[0] / 1e308, [1e308], { d: 2 })` | NaN | **[[NaN]]** | [[0]] |

grad's error comes from the check of the function's values (f(+-Infinity) is NaN), not from a check of the step; jacobian and hessian have no such check and return NaN, as numDeriv does.

## Decision (user decision 6)

Option A of the judging, which was recommended (the others were B: scaled coordinates, which cannot work as f must be evaluated beyond the doubles; C: not planned). One check covers #246 (a step of 0). numDeriv gives NaN for jacobian and hessian, so the docs record the difference in the list of meaningless input that is an error.

## Fix

- `src/numerics/deriv.ts`, `steps()` (shared by the Richardson method of grad, jacobian and hessian): after the steps h0 = d abs(x[i]) (+ eps where abs(x[i]) < zeroTol) are formed, a step that is not positive and finite throws `RangeError("the step for x[i] is h: not a positive finite number")`. Finite positive steps are unchanged, so every result that was computed keeps its bits. A NaN coordinate now throws here as well (its step is NaN). The "simple" method does not use these steps and is unchanged.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: added to "Input that has no meaning is an error" next to the other numDeriv entries.

| Call | before | after |
|---|---|---|
| `grad(x => x[0] / 1e308, [1e308], { d: 2 })` | RangeError "func returned NaN at step Infinity from x" | RangeError "the step for x[0] is Infinity: not a positive finite number" |
| `jacobian(x => [x[0] / 1e308], [1e308], { d: 2 })` | [[NaN]] | the same RangeError |
| `hessian(x => x[0] / 1e308, [1e308], { d: 2 })` | [[NaN]] | the same RangeError |

## Tests

- `test/issue213.test.ts`: the three calls throw the message above. With `src/` stashed, it fails (jacobian and hessian return NaN, grad's message differs).
- `test/issue214.test.ts`, `test/numerics.test.ts`, `test/review49.test.ts` pass; `npx tsc --noEmit -p .`: no errors.

## Out of scope

- `grad(x => x[0] / 1e308, [1e308], { d: 0.5 })` gives -3.52733686067e-312 for the true 1e-308: the derivative itself is subnormal (below 2.2e-308), and the Richardson differences of subnormal values lose their digits. Not investigated.

## close comment

Fixed in <commit of #213, see git log --grep='#213'>. grad already threw for the issue's call, but only from its check of the function's values (f at x +- Infinity is NaN); jacobian and hessian returned [[NaN]], as numDeriv does. The steps of the Richardson method are now checked where they are formed, for grad, jacobian and hessian alike: a step d abs(x[i]) that is not positive and finite throws RangeError "the step for x[0] is Infinity: not a positive finite number". The same check covers a step of 0 (x[i] = 0 with zeroTol 0, #246). Finite steps are unchanged. numDeriv returns NaN for jacobian and hessian here; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue213.test.ts. (Not pushed yet.)
