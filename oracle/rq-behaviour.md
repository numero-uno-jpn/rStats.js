# Quantile regression: reference behaviour

Issue: #545  
Base: `d41e20295c6fed3031bc7eb59c0cc76be2f7160b` (`work/regression-1.8`)  
Reference: R 4.6.2, quantreg 6.1  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification uses the public quantreg 6.1 reference manual, Koenker and Bassett (1978), Koenker and d'Orey (1987, 1994), Koenker (1994, 2005), Gutenbrunner and Jurečková (1991), Portnoy and Koenker (1997), Hall and Sheather (1988), Bofinger (1975), Powell (1991), and the public-function output in `experiments/regression18-rq.R` and `.json`. No quantreg or R source, implementation excerpt, function body, or fit closure was read or used.

## 1. Model and objective

For observations $(y_i,x_i)$, quantile level $0<\tau<1$, and nonnegative case weights $w_i$, the linear conditional-quantile model estimates $\beta_\tau$ by

$$
\widehat\beta_\tau=\arg\min_\beta
\sum_{i=1}^n w_i\rho_\tau(y_i-x_i^\mathsf T\beta),
\qquad
\rho_\tau(u)=u\{\tau-\mathbf 1(u<0)\}.
$$

The design matrix follows the formula model matrix, including its intercept and factor contrasts. The objective is a convex, piecewise-linear function. The estimate need not be unique: a set of coefficient vectors can attain the same minimum, especially with tied responses or more observations exactly on the fitted hyperplane than the design rank requires. Residuals are $y-X\widehat\beta_\tau$ and the reported objective (often named $\rho$) is the weighted sum above.

For several quantiles, the fit returns one coefficient column per requested $\tau$; each quantile is a separate minimization. This is not a joint non-crossing fit: fitted quantile curves may cross.

## 2. Algorithms and convergence

The requested methods are:

- `br`: a Barrodale–Roberts linear-programming method, based on the modified L1 algorithm of Koenker and d'Orey (1987, 1994). It returns a basic feasible optimum (a vertex when the optimum is not unique).
- `fn`: a Frisch–Newton interior-point method, based on the primal/dual interior-point approach described by Portnoy and Koenker (1997). Its convergence tolerance controls the numerical stopping accuracy.

Both target the same convex objective. The reference manual explicitly notes that in a non-unique problem `fn` may return a point near the centroid of the solution set, whereas `br` stops at a vertex. Therefore exact coefficient equality between methods is not a valid general correctness criterion. A valid independent check is: objective value is minimal to numerical tolerance and primal feasibility / subgradient optimality conditions hold. For unique optima, coefficients should agree tightly.

The reference defaults to `method = "br"`; `tau = 0.5`; unit weights; and formula-based model construction. `na.action` is applied to the model frame and the documented default is `na.fail`. Weights must be nonnegative, and the manual recommends strictly positive weights because zero weights are ambiguous. `tau` outside (0,1) requests the full quantile process in the reference, rather than an ordinary single-quantile fit.

## 3. Inference and summary

The reference summary supports the following standard-error procedures:

- `rank`: confidence limits obtained by inversion of a regression-rank test (Koenker, 1994). The default assumes iid errors; the optional non-iid score construction is documented separately. The procedure can be expensive and is used by default only below the documented sample-size cutoff (the observed default is rank for n < 1001).
- `iid`: asymptotic covariance under iid errors, based on the regression-quantile asymptotics of Koenker and Bassett (1978).
- `nid`: a Huber sandwich covariance using a local estimate of sparsity, relying on local linearity of the conditional quantile function in $\tau$ and $x$. The bandwidth can use Hall–Sheather (1988) or Bofinger (1975); the reference option `hs = FALSE` selects the latter.
- `ker`: a Powell (1991) kernel estimate of the sandwich covariance. When `covariance = TRUE`, the summary also returns the coefficient covariance matrix.
- `boot`: bootstrap standard errors, with `bsmethod` choices `xy`, `pwy`, `mcmb`, and `wxy`, and replication count `R`.

The coefficient table contains estimates, standard errors, test statistics and p-values for the asymptotic methods; rank inference reports estimate and confidence bounds. The exact column names differ by method. The reference output records the full table and warning/message channels. A multi-quantile summary contains a separate coefficient table for each requested quantile.

For the bootstrap methods, the reference's R random-number generator is part of the observable procedure. The existing output records the four methods at `set.seed(1)`, `R = 200`, and another xy run at `set.seed(42)`, `R = 50`. These outputs alone do not yet establish the exact sequence of random draws and resampling transformations needed to reproduce R's stream bit-for-bit.

## 4. Prediction

Prediction evaluates $x_{new}^\mathsf T\widehat\beta_\tau$ for each requested quantile. Confidence intervals are requested with `interval = "confidence"`. The documented interval types include `none`, `percentile`, and `direct`. The percentile method requires bootstrap standard errors; the recorded non-bootstrap call fails with that explicit requirement. Interval bounds are pointwise, not simultaneous bands, and do not enforce non-crossing across quantiles.

## 5. Model comparison

For nested models at a common quantile, `anova` provides a Wald comparison and a rank-based alternative. The rank test is based on regression-rank scores (Gutenbrunner and Jurečková, 1991); its score choice and trimming options apply to this test. The Wald version uses a covariance estimate such as `nid` or `ker`.

For a multi-quantile fit, `anova` can test equality of slopes across quantiles, jointly or one slope at a time (`joint`). Intercepts are not part of the slope-homogeneity hypothesis. These are distinct hypotheses from comparing nested predictor sets at a single quantile. The oracle records both the joint and separate forms and the nested-model Wald and rank tables.

## 6. Observed warnings, errors, and boundaries

The pinned public output establishes:

- A non-unique solution may be returned without a fitting warning; a subsequent summary can warn `Solution may be nonunique`.
- On the constructed non-unique problem, `br` and `fn` return different coefficient vectors with the same optimal objective, consistent with the documented vertex-versus-interior-point distinction.
- An exact fit can have zero objective and degenerate rank confidence bounds; `nid` may fail because its covariance calculation is singular.
- A rank-deficient design produces `Singular design matrix` in the recorded example.
- `tau = 1.5` is interpreted as a request for a quantile-process object by the reference. A negative tau likewise returns a process over (0,1), with its solution path available through the documented process result.
- A weighted fit is accepted; the observed weighted example's `nid` summary warns about non-positive sparsity estimates.
- Missing rows are omitted in the recorded example.
- The default summary for n below 1001 uses `rank`; the recorded `rank` output includes confidence bounds.
- `predict(type = "percentile")` without bootstrap inference errors as described above.

These are reference observations, not all recommended API policies. In particular, reference error strings are not normative API design.

## 7. Oracle coverage and unresolved behaviour

`oracle/rq.R` records the Engel data over five quantiles and both algorithms; weighted and factor-predictor fits; multi-quantile coefficients and summaries; slope-homogeneity and nested-model tests; confidence prediction; non-unique, exact, collinear, missing-row, and out-of-range-tau cases; and the four bootstrap methods with fixed seeds. The pre-existing `experiments/regression18-rq.json` supplies the pinned R 4.6.2 / quantreg 6.1 observations.

Unresolved items:

1. The exact bootstrap random-number consumption and resampling transforms have not been identified from the recorded public outputs. More targeted seeded experiments are required before claiming R-stream equivalence.
2. A full characterization of `rank` versus `iid = FALSE`, all bandwidth boundary cases, and covariance output for each method remains open.
3. Multi-quantile crossing behaviour and all `anova` score/trim combinations are not exhaustively mapped.
4. The precise handling of zero weights, infinite inputs, and very large/small scales needs targeted experiments.
5. The exact method-specific stopping diagnostics are not fully characterized by the currently recorded output.

## Decisions for the user

1. **Non-unique optima.** (A) Reproduce the `br` vertex whenever possible; (B) accept any solution with the minimum objective and valid optimality conditions. **Recommendation: B.** The manual explicitly describes different valid representatives from `br` and `fn`; the objective and optimality conditions are invariant and can be checked independently.
2. **Bootstrap random stream.** (A) Require exact R `set.seed` stream compatibility for all four bootstrap methods; (B) provide reproducible rStats.js bootstrap streams but document that they differ from R; (C) defer `boot`. **Recommendation: B unless experiments identify the exact R draw sequence without implementation inspection.** This is the honest, testable boundary; do not claim parity without evidence.
3. **Out-of-range tau.** (A) Reproduce the reference quantile-process result; (B) reject tau outside (0,1) for the initial API. **Recommendation: B.** The process object is a distinct API and not needed for ordinary quantile regression.
4. **Rank inference default.** (A) Follow the reference sample-size-dependent default; (B) use a single predictable default such as `nid`. **Recommendation: A** for compatibility, with the documented computational cost and cutoff.
5. **Zero weights.** (A) allow zero weights and remove their rows from the effective problem; (B) require strictly positive weights. **Recommendation: A**, while rejecting negative weights and documenting that zero-weight rows do not contribute.

## rStats.js's choices

