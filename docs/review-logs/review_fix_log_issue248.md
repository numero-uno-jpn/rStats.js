# Issue #248 log: optim does not validate parscale, fnscale and ndeps

GitHub Issue #248. Session 11, judging of the issues classified C. Then user decision 6 (option A). Fixed: fnscale +-Infinity is an error in `optim` and `optimHess`; the other controls of the issue already throw, as in R.

## Plan

- Intent: run every invalid control the issue lists, in optim (BFGS) and optimHess, against R 4.5.2.
- Method: f(x) = x^2 from 1; parscale 0, -1, NaN, Inf; fnscale 0, NaN, Inf, -Inf; ndeps 0, NaN, Inf, -1e-3. The objective counts its evaluations and throws beyond 100000.
- Why: the triage recorded these as errors as in R; a value returned for a meaningless control would fall under the policy "meaningless input is an error", for which the user has chosen errors even where R accepts the input (#227, #229, #221's rule, session 11).

## Check (main `1d27e43`, R 4.5.2)

| control | R `optim(1, f, method = "BFGS")` | rStats.js optim | R / rStats.js optimHess |
|---|---|---|---|
| parscale 0 | error "non-finite value supplied by optim" | RangeError "initial value in 'vmmin' is not finite" | error "non-finite finite-difference value [1]" (both) |
| parscale -1 | par 4.92e-16, value 6.05e-30, convergence 0 | the same (4.920232278485271e-16, 6.052713218599093e-30, 0) | 1.99999999991873 (both) |
| parscale NaN | error "non-finite value supplied by optim" | RangeError "initial value in 'vmmin' is not finite" | error (both) |
| parscale Inf | error "initial value in 'vmmin' is not finite" | the same | error (both) |
| fnscale 0 | error "initial value in 'vmmin' is not finite" | the same | error (both) |
| fnscale NaN | the same error | the same | error (both) |
| **fnscale Inf** | **par 1, value NaN, convergence 0** | **the same** | **NaN (both)** |
| **fnscale -Inf** | **par 1, value NaN, convergence 0** | **the same** | **NaN (both)** |
| ndeps 0 | error "non-finite finite-difference value [1]" | the same | error (both) |
| ndeps NaN | the same error | the same | error (both) |
| ndeps Inf | the same error | the same | error (both) |
| ndeps -1e-3 | as ndeps 1e-3 (the issue agrees this is valid) | the same | 1.99999999991873 (both) |

- The issue's three examples (parscale 0, fnscale 0, ndeps 0) throw before any step, as in R; only the message for parscale 0 and NaN differs from R's.
- A negative parscale is valid in R (the scaled problem is the mirrored one) and gives the same optimum.
- fnscale = +-Infinity divides every value by Infinity: the objective is 0 or NaN everywhere, and both R and rStats.js report value NaN with convergence 0 (success) and the start unchanged.

## Decision (user decision 6)

Option A of the judging, which was recommended (the others were B: also validate parscale and ndeps up front, where they already throw or are valid in R; C: not planned). R accepts an infinite fnscale, so the docs record the difference in the list of meaningless input that is an error.

## Fix

- `src/optim/optim.ts`, the `Scaled` constructor (shared by `optim`, all methods, and `optimHess`): fnscale Infinity or -Infinity throws `RangeError("'fnscale' must not be infinite")`. fnscale 0 and NaN keep failing at the initial value with R's message; finite fnscale is unchanged.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: added to "Input that has no meaning is an error", after optim's SANN temperature.

| control | R 4.5.2 | before | after |
|---|---|---|---|
| fnscale Inf or -Inf, `optim(1, f, method = "BFGS")` | par 1, value NaN, convergence 0 | the same | RangeError "'fnscale' must not be infinite" (also Nelder-Mead and Brent) |
| fnscale Inf or -Inf, `optimHess` | NaN | NaN | the same RangeError |
| parscale 0, fnscale 0, ndeps 0 (the issue) | errors | errors | unchanged |

## Tests

- `test/issue248.test.ts`: fnscale +-Infinity throws for BFGS, Nelder-Mead, Brent and optimHess; the issue's three examples still throw. With `src/` stashed, the first block fails.
- `test/optim.test.ts` and the other optim tests pass; `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #248, see git log --grep='#248'>. The issue's three examples already throw before any step, as in R 4.5.2: parscale 0 ("initial value in 'vmmin' is not finite"; R: "non-finite value supplied by optim"), fnscale 0 (the same as R) and ndeps 0 ("non-finite finite-difference value [1]", as R). A negative parscale or ndeps is valid in R and gives the same optimum, so it is kept. The one case that returned a result was fnscale +-Infinity: every value divided by it is 0 or NaN, and optim returned the start with value NaN and convergence 0 (success), as R does. It now throws RangeError "'fnscale' must not be infinite" in optim (every method) and optimHess. The difference from R is recorded in docs/differences-from-r.md. A test was added: test/issue248.test.ts. (Not pushed yet.)
