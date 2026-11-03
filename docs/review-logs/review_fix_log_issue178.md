# Issue #178 log: glmAnova fails for a glm fitted with start

GitHub Issue #178. Session 11, group A3.

## Plan

- Intent: the one-fit `glmAnova` refits the models with the first k terms through `rowOf` -> `refit(model, cols)`. `refit` takes `model.start` unless the control overrides it, so a fit made with `start` (one value per column of the full model) passes that vector to a model with fewer columns, and `irls` stops with "length of 'start' should equal 2 ...".
- Method: `rowOf` calls `refit` with `start: undefined`, so the smaller models start as a fit without `start` (from the family's initial means).
- Why not the subset the issue suggests: R's `anova.glm` passes `start = object$start` to each refit, but `glm` does not keep `start` in its object (`is.null(f$start)` is TRUE in R 4.5.2), so R refits the smaller models without a start. Not passing it is R's behaviour and keeps the refits identical to those of the same fit made without `start`; a subset of the start could take another iteration path than R's. The full model's row is the fit itself (with its start), as in R.

## Check (main after #176; R 4.5.2)

`glm(y ~ x1 + x2, poisson, start = c(0, 0, 0))` with x1 = (0, 1, 0, 1), x2 = (0, 0, 1, 1), y = (1, 2, 3, 4):

| Row | R 4.5.2 (Deviance, Resid. Df, Resid. Dev, Pr(>Chi)) | Before | After |
|---|---|---|---|
| NULL | Resid. Dev 2.128802705724464 | RangeError | 2.128802705724463 |
| x1 | 0.4027102710137773, 2, 1.7260924347106863, 0.5256928691118514 | RangeError | 0.4027102710137769, 2, 1.7260924347106863, 0.5256928691118516 |
| x2 | 1.6456575701010379, 1, 0.08043486460964855, 0.1995509909936604 | RangeError | 1.6456575701010376, 1, 0.08043486460964866, 0.19955099099366036 |

The differences in the last digits are those of the fits themselves (the null deviance, and the full fit's deviance with this start, differ by a few ulp from R's already); the refit x1 has R's residual deviance exactly. The Rao and Cp tables (R: Rao 0.4000044280396291, 1.6000230321513993; Cp 4.128802705724464, 5.7260924347106865, 6.080434864609648) agree to the same degree. The row of x1 is bit-identical to that of the same fit without `start`.

## Fix

- `src/models/glmAnova.ts` (`rowOf`): `refit(model, cols, warnings, { start: undefined })`.
- Docs: none (R's behaviour).

## Tests

- `test/issue178.test.ts`: the issue's fit for the Chisq, Rao and Cp tables (the x1 row equal to that of the fit without start) and the Chisq table against R's values (14 digits). With src stashed it fails with the RangeError.
- Full `npx vitest run`: 304 files passed. `npx tsc --noEmit -p .`: exit 0.

## Out of scope

- None.

## close comment

Fixed in <commit of #178, see git log --grep='#178'>: the one-fit `glmAnova` now refits the smaller models without the fit's `start`, as R does (R's `anova.glm` passes `object$start`, which `glm` does not keep, so it is NULL). Rather than a subset of the start as the issue suggested, this keeps the refits on R's iteration path. The issue's example gives R's table (x1: deviance 0.40271, x2: 1.64566) instead of the RangeError. Test: test/issue178.test.ts. (Not pushed yet.)
