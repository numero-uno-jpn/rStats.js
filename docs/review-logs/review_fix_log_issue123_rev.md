# Revision of issue 123: r of grad, jacobian and hessian at most 512

## Plan
- Intent: from r = 513 on, the Richardson extrapolation's factor 4^m overflows (m = 512) and every result is NaN
  (numDeriv too), and the O(r^2) extrapolation and r evaluations per coordinate do not end for a huge r (2^31).
  Criterion K4 (a RangeError before the computation), applied only where the result is NaN anyway.
- Decision: D8 (session 14, `prep/limits.md` question 2, recommended option: limits on expm and grad only).
- Form: in the shared `steps` (Richardson only), after the positive-integer check of r, RangeError "'r' must be at most
  512". The "simple" method does not use r and is unchanged, as numDeriv. r = 20 to 512 (the range issue 123 recorded
  as numDeriv's loss of accuracy, a user decision "record only") keeps its values: the option (b) of the prep (a check
  that the smallest step still moves x) was not taken.

## Original decision
- Issue 123 (user's decision: record only, not planned): the loss of accuracy for r of about 20 and more is a property
  of the method, with numDeriv's values. No bound on r.

## Gap with the current criteria
- K4: no bound on the time; r > 512 always NaN.

## Reproduction (main, R 4.5.2 with numDeriv; f(x) = sin x + x^2, x = 1)
| r | rStats.js grad (jacobian the same), hessian | numDeriv grad, hessian |
|---|---|---|
| 4 | 2.5403023058516023, 1.1585290151924952 (0.2 to 1 ms) | 0x1.4528a03ec3f4dp+1 (2.5403023058387704), 0x1.28955b87b806dp+0 (= rStats.js) |
| 20 | 2.5403011122263432, 1.1610966185222744 | 0x1.4528963b8095cp+1 (= rStats.js), 0x1.293da195e2928p+0 (1.1610966673784535) |
| 41 | 0.07754986974849315, -108295126.13857378 | 0.0873992732481785, 3140779847.9812856 |
| 512 | 0, 0 (2 ms) | 0, 0 |
| 513 | NaN, NaN | NaN, NaN |
| 2000 | NaN, NaN (8 ms) | |

The time grows as r^2 (prep: about 5 s at r = 1e5); 2^31 does not return (not run).

## Fix
- `src/numerics/deriv.ts`: the check above; the option's documentation says "at most 512".
- Docs (en, ja): a bullet after the expm limit (with the exact-distribution limits of session 12).

## Tests
- `test/issue123_rev.test.ts`: r = 513, 2000, 2^31 and 1e16 throw at once (under 100 ms) in the three functions,
  `grad` and `hessian` without calling the function, `jacobian` after its one evaluation at x; "simple" ignores r;
  r = 20, 41 and 512 keep the values before the revision. The 513 and 2000 case fails with src stashed (the huge r is
  not run on the old code).
- numerics (fixture), issue213, issue246, review49 pass.

## Out of scope (recorded)
- With this sin-based f the values differ from numDeriv in the last digits at r = 4 (1.3e-11 relative in grad) and r =
  20 (4e-8 in hessian), and completely at r = 41: the difference quotients amplify 1-ulp differences of sin between V8
  and R's libm by up to 1 / h, and the extrapolation amplifies them further. Not investigated; issue 123's comparison
  used f(x) = x and x^2, where the values agree.
