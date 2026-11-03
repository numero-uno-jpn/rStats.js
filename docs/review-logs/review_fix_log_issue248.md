# Issue #248 log: optim does not validate parscale, fnscale and ndeps

GitHub Issue #248. Session 11, judging of the issues classified C. Verdict: **Awaiting decision** (one case). The issue's three examples already throw, as R does, and so do most other invalid values; but `fnscale` = +-Infinity returns value NaN with convergence 0, as R, which the issue also names. No code was changed.

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

## Options

- **A (recommended):** throw a RangeError for a non-finite fnscale (Infinity, -Infinity; NaN and 0 already throw through the initial value), e.g. "'fnscale' must be a finite nonzero number", in optim and optimHess. All other cases stay as they are (they already throw, as R, or are valid). R returns NaN with convergence 0, so the docs record the difference with the other rejected inputs.
  - Pros: no silent "converged" result for a meaningless control; matches the session 11 decisions on #227 and #229. Cons: an R difference.
- **B:** also validate parscale (positive or nonzero finite) and ndeps (nonzero finite) up front with own messages.
  - Pros: clearer messages. Cons: parscale 0 and NaN already throw (with R's messages for other cases); a negative parscale is valid in R and would have to stay allowed; more change for little gain.
- **C:** not planned: the same as R in every case.

## close comment

Awaiting a decision; see review_fix_log_issue248.md. (Not pushed yet.)
