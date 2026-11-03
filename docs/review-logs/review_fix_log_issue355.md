# Issue #355 log: non-finite analytic gradients in optim

GitHub Issue #355. Session 12, B4 (user decision 22). Fixed: a NaN or infinite component of an analytic gradient is an error, in the same form as the numerical gradient's check. The NaN case differs from R (docs).

## Plan

- User decision (2026-11-03): option A of the prep (`prep/nonfinite_lin.md`): if a component of `gr` is not finite, throw an error of the same form as the numerical gradient's "non-finite finite-difference value [i]"; record the NaN difference from R in the docs. Do it after #354.
- #354 (b8d7132) checks every evaluated point, as R; the prep noted that this alone stops the infinite-gradient hang. Confirmed below before adding the gradient check.

## Check (R 4.5.2 from the prep; rStats.js main `b8d7132`, fn throws after 1e5 evaluations)

f(x) = x^2, gr constant.

| gr, start | R BFGS / CG | before #354 | after #354 (b8d7132) | R L-BFGS-B |
|---|---|---|---|---|
| Inf or -Inf, 0 or 1 | error "non-finite value supplied by optim" | never returns (backtracking with step 0, 0 * -Inf = NaN) | the same error as R | the same error |
| NaN, 1 | par 1, convergence 0 (no step) | the same | the same (counts 1, 1) | par 1, convergence 0 |
| NaN, 0 | par 0, convergence 0 | the same | the same | error |

- rStats.js L-BFGS-B after #354: the error "non-finite value supplied by optim" for all six (before #354: "L-BFGS-B needs finite values of 'fn'", with a finite fn).
- `optimHess(1, f, function(x) NaN)`: R a NaN matrix.
- A non-finite gradient is an error in the user's function; the NaN "convergence 0" is a false success (R's too).

## Fix

- `src/optim/optim.ts`, `Scaled.g` (analytic branch, shared by BFGS, CG, L-BFGS-B and `optimHess`): a component that is not finite throws `Error("non-finite value of the gradient [i] supplied by 'gr'")`. The check is on the user's value (before parscale / fnscale). Finite gradients are unchanged.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: added to "Input that has no meaning is an error", after #248's fnscale.

| case | R 4.5.2 | before | after |
|---|---|---|---|
| gr NaN (BFGS, CG) | start, convergence 0 | the same | error "non-finite value of the gradient [1] supplied by 'gr'" |
| gr +-Inf (BFGS, CG, L-BFGS-B) | "non-finite value supplied by optim" | hang (BFGS, CG); misleading fn message (L-BFGS-B) | the gradient error |
| optimHess, gr NaN | NaN matrix | NaN matrix | the gradient error |

## Tests

- `test/issue355.test.ts`: NaN, Inf, -Inf for BFGS, CG, L-BFGS-B; the component index in 2 dimensions; NaN only later in the path; optimHess; a finite gradient unchanged. With `src/` stashed (after #354, nothing hangs), the three error blocks fail.
- `test/optim*`, `test/issue354.test.ts`, `test/issue248.test.ts`, factanal and omega pass; tsc no errors.

## Out of scope (recorded)

- From the prep: with a gradient that is NaN only near 0, R's CG stops at 0.36 and rStats.js's at 0 (CG's parabolic trial point, #15); both are false successes, now an error here.

## close comment

Fixed in <commit of #355, see git log --grep='#355'>. The infinite-gradient hang in BFGS's and CG's line search was fixed by #354: every evaluated point is now checked, and the infinite trial point gives R's error "non-finite value supplied by optim". In addition, a NaN or infinite component of an analytic gradient is now an error "non-finite value of the gradient [i] supplied by 'gr'" (the same form as the numerical gradient's "non-finite finite-difference value [i]") in BFGS, CG, L-BFGS-B and optimHess. R 4.5.2 does not check gr: with a NaN gradient it returns the start with convergence 0 without a step, and optimHess a NaN matrix; this difference is recorded in docs/differences-from-r.md. A test was added: test/issue355.test.ts. (Not pushed yet.)
