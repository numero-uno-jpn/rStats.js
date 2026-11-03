# Issue #354 log: a non-finite start traps Nelder-Mead's simplex set-up

GitHub Issue #354. Session 12, group A1 (input checks to R's errors). Fixed: every point at which `fn` (and an analytic `gr`) is evaluated must be finite, as R's fminfn and fmingr check; the error is R's "non-finite value supplied by optim".

## Plan

- Intent: `optim([Infinity], () => 0)` never returns (the simplex set-up multiplies an infinite step by 10). R 4.5.2 stops with an error for every method.
- Choice: the check at each evaluation (R's form in fminfn / fmingr), not only on the start. The prep for #355 noted that this form also stops BFGS's and CG's backtracking with an infinite analytic gradient (the trial point becomes infinite and is evaluated), so #355 builds on it.
- The hanging call was not run: confirmed by reading the code; the hanging test is excluded with `-t` during the stash check.

## Check (main `3749179`, R 4.5.2)

| call | R | rStats.js before |
|---|---|---|
| `optim(Inf, function(x) 0, method = m)`, m = Nelder-Mead, BFGS, CG, L-BFGS-B, SANN | error "non-finite value supplied by optim" | Nelder-Mead: never returns (code reading); BFGS and SANN (maxit 10): a result, no error (stash run) |
| `optim(c(1, NaN), ...)`, the same methods | the same error | a result, no error (BFGS, SANN) |
| `optimHess(Inf, f, gr)` (analytic gradient) | the same error | no error |
| `optimHess(Inf, f)` (numerical gradient) | "non-finite finite-difference value [1]" | the same (R does not check the point there; kept) |
| Brent (`par` unused) | result | result (unchanged) |

## Cause

`Scaled.f` and `Scaled.g` (`src/optim/optim.ts`) passed any point to `fn` / `gr`. R's fminfn and fmingr (analytic branch) check that each scaled parameter is finite.

## Fix

- `src/optim/optim.ts`: `finitePar` throws `Error("non-finite value supplied by optim")`; called at the top of `Scaled.f` and in the analytic branch of `Scaled.g` (the scaled point, as R). Used by all methods and `optimHess`. Finite points are unchanged.
- parscale 0 (#248) now gives R's message too (the scaled start is Infinity).
- No docs: R's behaviour.

## Tests

- `test/issue354.test.ts`: Nelder-Mead with Infinity (excluded from the stash run: it hangs before the fix); BFGS and SANN with Infinity and NaN; optimHess with an analytic gradient at Infinity; the doc example's values unchanged. With `src/` stashed, the two non-hanging error blocks fail.
- `test/optim*`, `test/issue248.test.ts`, factanal and omega tests pass; tsc no errors.

## close comment

Fixed in <commit of #354, see git log --grep='#354'>. As R's fminfn and fmingr, optim now checks every point at which fn (or an analytic gr) is evaluated, and a non-finite one is the error "non-finite value supplied by optim" (R 4.5.2 gives this error for an infinite or NaN start in Nelder-Mead, BFGS, CG, L-BFGS-B and SANN). optim([Infinity], () => 0) no longer loops in the simplex set-up; BFGS and SANN no longer return a result for a non-finite start; optimHess with an analytic gradient at an infinite point throws as in R. Finite points are unchanged. A test was added: test/issue354.test.ts. (Not pushed yet.)
