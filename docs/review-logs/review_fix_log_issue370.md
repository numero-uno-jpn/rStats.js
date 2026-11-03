# Issue #370 log: the gaussian deviance squaring the residual before the weight

GitHub Issue #370. Session 12, judging of the issues classified C. Verdict: not planned (internal; the public glm gives the correct deviance). No code changed.

## Plan

- Intent: check whether the overflow of `w (y - mu)^2` in devContribution reaches the results of the public glm.
- Why: classified C (internal helper; the public glm scales the response); the verdict needs the public path run.

## Check (main `7033ff3`, R 4.5.2)

- `makeFamily("gaussian").devContribution(1e200, 0, 1e-300)` (internal, not exported): Infinity, as the issue says.
- Public glm, no columns, offset 0, y 1e200, weight 1e-300: gaussian deviance 1e100, null deviance 1e100; `quasi` with constant variance: deviance 1e100. Correct.
- For gaussian (and constant-variance quasi) the public glm fits the response divided by a power of 2 (`scaledView`, glm.ts), so devContribution sees y of order 1 and the deviance is scaled back exactly.
- R: `glm.fit(matrix(numeric(0), 1, 0), 1e200, weights = 1e-300, offset = 0, family = gaussian())$deviance` is Inf.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: devContribution is an internal helper, and the public glm does not hand it the unscaled residual. For the gaussian and constant-variance quasi families glm fits the response divided by a power of 2 and scales the deviance back exactly, so a fit with y = 1e200, weight 1e-300 and the mean fixed at 0 by an offset gives deviance 1e100 (R's glm.fit gives Inf). (Not pushed yet.)
