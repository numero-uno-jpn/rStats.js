# Issue #213 log: grad, jacobian and hessian accept relative steps d x that overflow

GitHub Issue #213. Session 11, judging of the issues classified C. Verdict: **Awaiting decision.** The issue's example (grad) already throws, as the triage found, but the same step gives a silent NaN in jacobian and hessian, which the issue also names. No code was changed.

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

## Options

- **A (recommended):** in `steps()`, throw a RangeError where a step d abs(x_i) (or the zero-coordinate step) is not finite, e.g. "the step d * abs(x) is not finite", for grad, jacobian and hessian alike (policy "meaningless input is an error": a step beyond the double range cannot be evaluated). numDeriv gives NaN for jacobian and hessian, so the docs record the difference.
  - Pros: one check in the shared helper; a clear message; grad's behaviour is unchanged in substance. Cons: R difference for jacobian and hessian.
- **B:** form the differences in scaled coordinates (x / 2^k, with f evaluated at 2^k times the shifted point) so that the step is finite.
  - Pros: returns the derivative. Cons: f must be evaluated at x +- h anyway, which is beyond the double range; there is no point to evaluate, so this cannot work in general.
- **C:** not planned: the same as numDeriv for all three.

## Out of scope

- `grad(x => x[0] / 1e308, [1e308], { d: 0.5 })` gives -3.52733686067e-312 for the true 1e-308: the derivative itself is subnormal (below 2.2e-308), and the Richardson differences of subnormal values lose their digits. Not investigated.

## close comment

Awaiting a decision; see review_fix_log_issue213.md. (Not pushed yet.)
