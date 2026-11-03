# Issue #252 log: optim's Brent method does not use control.maxit

GitHub Issue #252. Session 11, judging of the issues classified C. Verdict: not planned (the same as R). No code changed; a test added.

## Plan

- Intent: check what R's optim does with maxit for method "Brent".
- Method: the issue's example with `maxit = 1` and with the default, counting the objective's evaluations, in R 4.5.2 and rStats.js.
- Why: R's optim implements "Brent" by calling optimize, which has no iteration limit; if R ignores maxit too, rStats.js follows R.

## Check (main `800b5da`, R 4.5.2)

`optim(0, (x - 0.123456789)^2, method = "Brent", lower = -1, upper = 1, control = list(maxit = ...))`:

| maxit | R 4.5.2 | rStats.js |
|---|---|---|
| 1 | par 0x1.f9add3739635fp-4 (0.123456789), value 0, counts NA NA, convergence 0, 7 evaluations | par 0.123456789, value 0, counts [NaN, NaN], convergence 0, 7 evaluations |
| default | the same, 7 evaluations | the same, 7 evaluations |

R's optim for "Brent" calls `optimize(function(par) fn(par, ...) / con$fnscale, lower, upper, tol = con$reltol)` and does not pass maxit; R's documentation of `maxit` lists defaults for the derivative-based methods, Nelder-Mead and SANN only. rStats.js does the same (`optimize` with `tol: reltol`), with the same evaluations and the same result. The Brent search ends by its tolerance; optimize has no iteration limit in R either.

## Fix

- None (not planned): R's behaviour.

## Tests

- `test/issue252.test.ts`: maxit 1 gives R's par, value 0, convergence 0 and 7 evaluations, the same as the default.

## Out of scope

- The doc comment of `OptimControl.maxit` (src/optim/optim.ts) says "Default 500 for Nelder-Mead, 10000 for SANN, 100 otherwise", which reads as if it applied to Brent. It could add "not used by Brent (as R)". Not changed here (log and test only).

## close comment

Not planned: this is what R does. R's optim implements method "Brent" by calling optimize(fn, lower, upper, tol = reltol) and does not pass maxit (R's documentation of maxit gives defaults only for the other methods). For the issue's example R 4.5.2 gives par 0.123456789, value 0, counts NA NA and convergence 0 after 7 evaluations, with maxit = 1 and with the default; optim in rStats.js gives the same result after the same 7 evaluations. A test was added: test/issue252.test.ts. (Not pushed yet.)
