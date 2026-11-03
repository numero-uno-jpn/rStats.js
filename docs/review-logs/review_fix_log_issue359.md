# Issue #359 log: an infinite initial Richardson step from a finite d

GitHub Issue #359. Session 12, judging of the issues classified C. Verdict: completed (already fixed by b62ddb9 for issue 213). No code changed.

## Plan

- Intent: re-check the report on the current main through the public API and compare with numDeriv in R 4.5.2.
- Why: classified C (already fixed); the verdict needs the behaviour confirmed by running it.

## Check (main `7033ff3`, R 4.5.2, numDeriv)

- `grad(x => x[0], [2], { d: 1e308 })`: RangeError "the step for x[0] is Infinity: not a positive finite number", thrown in steps() before the callback is evaluated, as the issue asks.
- numDeriv: `grad(function(x) x, 2, method.args = list(d = 1e308))` stops with "function returns NA at Inf distance from x."
- b62ddb9 (issue 213) added the check of every step d abs(x[i]) (+ eps near 0) for grad, jacobian and hessian; 0ff6df8 (issue 246) covers a step of 0.

## Fix

- None (fixed by b62ddb9).

## Tests

- None (test/issue213.test.ts).

## Out of scope

- None.

## close comment

Completed: this was fixed in b62ddb9 (#213). steps() now checks every initial Richardson step and throws before the callback is evaluated: grad(x => x[0], [2], { d: 1e308 }) gives the RangeError "the step for x[0] is Infinity: not a positive finite number", and jacobian and hessian use the same check. (Not pushed yet.)
