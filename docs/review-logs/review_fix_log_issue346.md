# Issue #346 log: the Gamma AIC's sum of weights overflowing

GitHub Issue #346. Session 12, judging of the issues classified C. Verdict: not planned (internal helper; the public glm does not reach this path). No code changed.

## Plan

- Intent: check whether the reported overflow of `sum(weights)` in familyAic can be reached through the public glm.
- Why: classified C (familyAic is internal); the verdict needs the public path run.

## Check (main `7033ff3`, R 4.5.2)

- `familyAic` and `makeFamily` are not exported from the package's entry points.
- `glm([[1], [1]], [40000, 40000 (1 + 1e-5)], { intercept: false, family: "Gamma", weights: [1e308, 1e308] })`: Error "no valid set of coefficients has been found: please supply starting values"; with `start: [2.5e-5]` "inner loop 1; cannot correct step size". The fit stops before the AIC.
- With weights 1, 1: deviance 4.99995e-11, AIC 3.2380024830895495.
- R: `glm(y ~ 1, family = Gamma, weights = c(1e308, 1e308))` stops as well ("NA/NaN/Inf in 'x'").

## Fix

- None.

## Tests

- None.

## Out of scope (recorded)

- The Gamma fit with weights 1e308, 1e308 fails (the weighted deviance overflows during IRLS); R fails too. Not changed.

## close comment

Not planned: familyAic is an internal helper, and the public glm does not reach it with such weights. glm with the Gamma family and weights 1e308, 1e308 on this response stops during the fit ("no valid set of coefficients has been found", or "inner loop 1" with a starting value), before the AIC is computed; R's glm stops on the same data as well ("NA/NaN/Inf in 'x'"). (Not pushed yet.)
