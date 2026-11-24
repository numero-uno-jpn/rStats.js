# Stepwise model selection: step, stepAIC, drop1, add1, extractAIC (draft, 1.15.0)

Reference basis: the documentation of stats (`step`, `add1`, `drop1`, `extractAIC`) and of MASS 7.3-66 (`stepAIC`,
`addterm`, `dropterm`); Venables and Ripley (2002), "Modern Applied Statistics with S", 4th ed., section 6.8. R 4.6.2
public-call results (x86_64) in `experiments/step115.R`, `experiments/step115-detail.R` and
`experiments/step115-threshold.R`, recorded on Issue #565. No R or package source was consulted.

The call followed is ReactiveStat's (`scripts/多変量/multivar/multipleRegression.js`): `step(start, scope =
list(lower = y ~ 1, upper = <full>), direction, trace)` with `start` the empty model for "forward" and the full model
otherwise.

## Scope (decided 2026-11-25)

- Models: `lm` and `glm` with a formula. `glm` gets a formula interface for this (`glm(formula, data, options)`, the
  user's decision): the selected model is the `lm` / `glm` result itself
- Both `step` and `stepAIC`; `k` a number (2 = AIC, `log(n)` = BIC); `direction` "both", "backward", "forward";
  `scope` a lower and an upper formula (or the upper alone)
- The result: the selected fit, the path table (`$anova`) and the tables of every step (the trace); `drop1`, `add1`
  and `extractAIC` as functions of their own
- Missing values and weight-0 rows behave as in R, oddities included (the user's decisions, see below)

## Settled

- **The criterion (`extractAIC`).** lm: `n log(RSS / n) + k edf`, RSS the weighted residual sum of squares, n the
  number of residuals (rows used, weight-0 rows included) and edf = n − df.residual (the coefficients plus the
  weight-0 rows). With `scale > 0`: Cp = RSS / scale − n + k edf. glm: `AIC + (k − 2) edf`, AIC the family's (the
  likelihood one for gaussian: a gaussian glm and the lm of the same model have different values but the same path),
  edf the rank. The quasi families: error "AIC is not defined for this model, so 'step' cannot proceed"; a criterion
  of −Inf (a perfect lm fit): "AIC is -infinity for this model, so 'step' cannot proceed".
- **The candidates.** Whole terms move. Drops: the terms of the model that are not in the lower scope and not
  contained in a higher-order term of the model (marginality: `y ~ x1 * f + x2 + g` offers x2, g, x1:f). Adds: the
  terms of the upper scope that are not in the model and whose lower-order terms all are (x1:f only once x1 and f are
  in). The intercept is never added or dropped (`lower = ~ 0` changes nothing). "backward" uses the drops, "forward"
  the adds, "both" the two together. Default scope: none for forward (the search stops at the start), the model's
  own terms for backward and both (so only drops).
- **A move** is taken when the best candidate's criterion is strictly below the current one (an improvement of
  1e-12 is taken, exactly 0 is not; `experiments/step115-threshold`). The best is the minimum; among equal values the
  first in the table order, which is the drops in the model's term order, then the adds in the upper scope's order.
  An added term goes at the end of the formula. `steps` (default 1000) bounds the number of moves; `steps = 0`
  returns the start model.
- **Aliased terms.** Before the first table, every term of the model whose columns are all aliased (Df 0) is removed,
  one move each, as a path row with Df 0 and Deviance 0 and no table; a term that would add no column is not offered
  for adding (it is left out of the table).
- **The tables (the trace, and drop1 / add1).** One row `<none>` (the current model) and one per candidate: lm `Df`,
  `Sum of Sq` (the change of RSS, positive), `RSS`, `AIC` (or `Cp`); glm `Df`, `Deviance` (of the candidate model),
  `AIC`. In the trace the rows are sorted by the criterion, ties keeping the table order. drop1 / add1 return them
  unsorted (`<none>` first), and their criterion uses edf = the number of coefficients (so with weight-0 rows it is
  below the path's `extractAIC` by 2 × their number; the selection is the same). `test = "F"` (lm) adds `F value`
  and `Pr(>F)`; `test = "Chisq"`/`"LRT"` (glm) adds `LRT` and `Pr(>Chi)`. MASS's dropterm / addterm give the same
  tables.
- **The path table (`$anova`).** One row for the start (Step "", Df and Deviance NA) and one per move: `Step`
  ("- x5", "+ x1"), `Df`, `Deviance` (the change of the residual deviance, positive), `Resid. Df`, `Resid. Dev`,
  `AIC` (or `Cp` with scale > 0). **step's Df is the change of the residual df (−1 for an added term, +2 for a
  dropped 3-level factor); stepAIC's is positive.** This is the only difference found between the two.
- **How drop1 fits a candidate:** the columns of the term are taken out of the current model matrix, on the current
  model's rows (not a refit of a formula): with `scope = ~ x1 + ...` on `y ~ x1 * f + ...`, dropping x1 keeps the
  columns of x1:f as coded and removes one degree of freedom (a refit of `y ~ f + x1:f` would recode x1:f and lose
  none). The deviances equal fresh `glm` fits of the reduced matrices to 17 digits. add1 refits each larger model.
- **The glm tables' AIC** is not the candidate's own AIC: it is the current model's AIC + the scaled change of
  deviance + k × the change of rank, the scaled change being n log(dev / dev₀) for gaussian (exact), the change of
  deviance for binomial and poisson (exact), and the change over the current model's Pearson dispersion for Gamma and
  inverse.gaussian (an approximation: 139.417 against the refit's 137.831; `experiments/step115-gamma`). The search
  chooses by these values, and the path then shows the refitted model's own AIC (118.64 after a table value of
  118.54). The warnings of the refits (separation) are collected; the search goes on.
- **Tests:** `test = "F"`: (change of deviance / Df) / (deviance / residual df of the larger model: the current one
  for drop1, the candidate for add1), against F(Df, that residual df), for lm and glm alike. `"Chisq"` / `"LRT"` for
  glm: the scaled change above against chi-squared(Df); R names the column "LRT" for binomial and poisson and
  "scaled dev." for the other families.
- **A perfect fit:** lm's drop1 and add1 warn "attempting model selection on an essentially perfect fit is nonsense"
  when RSS < 1e-10 Σ w y² of the current model (`experiments/step115-perfect*`); the search goes on.
- **Moves are decided in the table:** the best row against `<none>` of the same table (with weight-0 rows the path's
  value is higher than the table's, and no move is made when `<none>` is best). Aliased terms are removed from the
  last in the model order. `Resid. Df` of the path is nobs − edf (edf of extractAIC).
- **Missing values (as R, the user's decision).** The rows of each fit are those complete in its own variables.
  When a move changes the number of rows used: error "number of rows in use has changed: remove missing values?".
  add1 with candidates that have missing values computes its whole table (`<none>` included) on the rows complete in
  the model's and all candidates' variables, with the warning "using the 47/50 rows from a combined fit"; the path
  keeps the values of the model's own rows. (So a forward search may compare on 47 rows and report on 50.)
- **Weights:** lm weights enter the weighted RSS; glm prior weights as in `glm`. Offsets stay in every model.

## Choices of rStats.js

- `step(fit, data, options)` and `stepAIC(fit, data, options)` take a formula fit of `lm` or `glm` and the data it was
  fitted on (rStats.js's fits do not keep the data frame); the refits use the fit's own options (weights, offset,
  family, contrasts, levels).
- The result holds `fit` (the selected model), `anova` (the path), `visits` (each model visited: its formula, its
  criterion, and the table examined from it, sorted), and `keep` is not offered (the visits hold what a keep function
  would). drop1 and add1 return their tables unsorted with the test columns asked for.
- `'.'` in a scope is refused (R expands it from the model's formula; list the terms instead).
- The fits remember their options (weights, offset, family, contrasts, levels) beside the result, so a copied result
  with weights or an offset, or any copied glm, is refused (its options are not known).
- The trace is returned, not printed.

## To check

- The glm formula interface against R's `glm(formula, data, family, weights, offset)` (fixture), and that every
  existing method (`glmSummary`, `glmAnova`, `glmConfint`, `glmPredict`, residuals) works on it.
- Extreme scales, common values, weight scales, collinearity, large n and many terms (the edge-case pass).
