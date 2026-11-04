# Issue #499 log: the Richardson methods reject a negative eps

GitHub Issue #499. Session 14, group A1. Fixed: a negative step (from a negative `eps` at coordinates near 0) is accepted by `grad`, `jacobian` and `hessian`, as in numDeriv.

## Plan

- Intent: `checkEps` accepts a negative `eps` and the comment in `steps()` says negative steps are differences taken the other way, but the step check of #213 and #246 required `h > 0`.
- Method: check `abs(h) > 0` and finite instead. The checks of #213 (an overflowing step) and #246 (a step of 0) stay, and so does the bound r <= 512 of the revision of issue 123 (`880f531`), which comes before.
- Why: the central differences and the Hessian's differences change sign with the step and its denominator, so a negative step needs nothing else; positive steps keep their bits.

## Reproduction (main `090fe94`, R 4.5.2, numDeriv)

| Call (`eps: -1e-4`) | numDeriv | rStats.js before |
|---|---|---|
| `grad(x => x[0]^2, [0])` | 0 | RangeError "the step for x[0] is -0.0001: not a positive finite number" |
| `jacobian(x => [x[0]^2], [0])` | [[0]] | the same RangeError |
| `hessian(x => x[0]^2, [0])` | [[2]] | the same RangeError |

## Fix

- `src/numerics/deriv.ts`, `steps()`: the step check is `abs(h) > 0 && abs(h) < Infinity`; the message is now "the step for x[i] is h: not a nonzero finite number" (the messages in `test/issue213.test.ts` and `test/issue246.test.ts` follow).
- Positive steps are unchanged, so every result computed before keeps its bits. No docs change: numDeriv takes the same steps.

## Tests

- `test/issue499.test.ts`: the issue's three calls give 0, [[0]], [[2]]; with two coordinates at 0, f = exp(x1) + sin(x2) x1, the values agree with numDeriv (the Hessian's off-diagonal to the bit). With `src/` stashed, both tests fail.
- `test/issue213.test.ts`, `issue246.test.ts`, `issue123_rev.test.ts`, `issue214.test.ts`, `issue356.test.ts`, `numerics.test.ts` pass.

## Out of scope (recorded)

- The last digits differ from numDeriv in the same way with a positive `eps` (grad of exp at 0: 0.9999999999974848 against 0.99999999999959037; the Hessian's diagonal 0.99999905 against 0.99999922). Already recorded in the session 14 revisions; not changed.

## close comment

Fixed in <commit of #499, see git log --grep='#499'>. The step check of the Richardson method (added for #213 and #246) required a positive step, although `eps` may be negative. It now requires a nonzero finite step: grad, jacobian and hessian of x^2 at 0 with `eps: -1e-4` give 0, [[0]] and [[2]], as numDeriv. Steps of 0 or beyond the doubles are still errors (the message is now "not a nonzero finite number"), and positive steps keep their values. A test was added: test/issue499.test.ts. (Not pushed yet.)
