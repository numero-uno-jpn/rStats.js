# Penalized generalized linear models: reference behaviour

Issue: #545  
Base: `d41e20295c6fed3031bc7eb59c0cc76be2f7160b` (`work/regression-1.8`)  
Reference: R 4.6.2, glmnet 5.1  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification uses Friedman, Hastie and Tibshirani (2010), Simon et al. (2011) for the pathwise coordinate-descent framework, the glmnet public help/vignette, and the public-function outputs in `experiments/regression18-glmnet.R` and `.json`. The available CRAN reference manual inspected during this audit is for glmnet 5.2, not the pinned 5.1; it is used only for documentation unchanged across the requested options and is not treated as evidence of 5.1-specific behaviour. Version-specific conclusions below come from the pinned 5.1 public outputs and the task's recorded observations. No glmnet or R source, implementation excerpt, function body, or fit closure was read or used.

## 1. Objective and penalty

For a design matrix $X\in\mathbb R^{n\times p}$ and response $y$, the fit minimizes a family-specific negative log-likelihood (or Gaussian squared-error criterion) plus an elastic-net penalty. In the common normalized form,

$$
\frac{1}{n}\,\mathcal L(\beta_0,\beta;X,y,w,o)
+\lambda\sum_{j=1}^p v_j
\left[\alpha|\beta_j|+\frac{1-\alpha}{2}\beta_j^2\right],
$$

where $\alpha\in[0,1]$ mixes lasso and ridge penalties, $v_j$ is the penalty factor, and the intercept $\beta_0$ is not penalized. Observation weights and offsets enter the family-specific criterion. The penalty factors are rescaled internally to sum to the number of predictors; the resulting effective penalty weights therefore affect the lambda path.

At $\alpha=1$ the penalty is lasso; at $\alpha=0$ it is ridge; intermediate values give elastic net. For multinomial models, `type.multinomial = "ungrouped"` applies coordinatewise sparsity, whereas `"grouped"` applies a group penalty across class coefficients for each predictor, selecting or excluding the predictor jointly across classes.

The input is a numeric matrix `x` with observations in rows and predictors in columns, plus response `y`. The formula interface is intentionally out of scope. The requested families are Gaussian, binomial, Poisson, and multinomial; Cox and multi-response Gaussian are excluded. Binomial outcomes may be a two-level factor or the documented numeric/count representation. Multinomial outcomes are a factor with at least two classes or a class-count matrix.

## 2. Standardization and constraints

By default, predictors are standardized before fitting and coefficients are returned on their original scale. `standardize = FALSE` disables predictor standardization. `intercept = FALSE` removes the intercept. A supplied offset is added to the linear predictor and must also be supplied for prediction. Observation weights are supported.

`penalty.factor` supplies a separate nonnegative shrinkage multiplier for each coefficient; zero means the coefficient is unpenalized. `lower.limits` and `upper.limits` impose coefficient-wise box constraints. The reference documentation requires lower limits to be non-positive; scalar bounds are replicated across coefficients. `dfmax` and `pmax` limit the number of active and ever-active coefficients, respectively. The implementation must validate dimensions and contradictory bounds before optimization.

## 3. Lambda path and convergence

When no lambda sequence is supplied, the reference constructs a decreasing sequence of `nlambda` values from a data-dependent $\lambda_{max}$ to $\lambda_{min}=\lambda_{max}\times$ `lambda.min.ratio`. The default ratio depends on dimensions: approximately $10^{-4}$ when $n>p$ and $10^{-2}$ when $n<p$. A user-supplied decreasing `lambda` sequence overrides automatic path generation. The actual lambda sequence is returned and is the authoritative x-coordinate for coefficients, degrees of freedom, and predictions.

For $\alpha=0$, the limiting lambda that makes all coefficients exactly zero is infinite; the reference uses a finite construction based on a small positive mixing value. This is a documented exception to the simple path interpretation and should be recorded explicitly.

The coordinate-descent path uses warm starts. The public default convergence threshold is $10^{-7}$ and the iteration/pass limit is $10^5$ (in 5.1 these are supplied through the control list rather than the deprecated top-level arguments). The fit reports per-lambda degrees of freedom, fraction of null deviance explained, null deviance, number of passes, and a convergence/error code. A nonzero error code or a warning about a failed lambda means the returned path may stop before the requested end. rStats.js is intended to solve each convex problem to its own strict convergence criterion; matching an early-stopped reference path is not a correctness target. The oracle therefore records ordinary and tight fits, with the tight fit using `control = list(thresh = 1e-14)`.

## 4. Coefficients and prediction

The coefficient path includes the intercept and predictor coefficients for each lambda. For multinomial fits, there is one coefficient matrix per class, with the reference class parameterization documented by the package. The `coef` interface evaluates coefficients at requested $s$ values. When $s$ is outside the stored path, the default interpolation is linear in the coefficient path over log-lambda; exact refitting is a separate option requiring the original `x` and `y`.

Prediction supports:

- `link`: linear predictor (including offset where applicable);
- `response`: mean, probability, or class-probability matrix on the response scale;
- `class`: predicted class for classification families;
- `nonzero`: indices of nonzero coefficients at the requested lambda.

The requested $s$ values may be numeric lambdas or the CV-selected labels `lambda.min` and `lambda.1se` through the CV prediction interface. Out-of-path predictions use interpolation unless exact refitting is explicitly requested. Offset values must be supplied consistently for prediction.

## 5. Cross-validation

`cv.glmnet` evaluates a supplied or generated fold assignment over a lambda sequence. This project compares CV only when `foldid` is fixed, because automatically sampled folds introduce a random partition unrelated to the numerical implementation. The supported measures in scope are deviance, MSE, MAE, classification error, and AUC, subject to family compatibility. For binomial AUC, each fold must contain enough observations from both classes; otherwise the reference warns and falls back to deviance for the affected measurement.

The CV summary includes the lambda sequence, mean cross-validated measure (`cvm`), its estimated standard error (`cvsd`), upper/lower one-standard-error bounds, number of nonzero coefficients, and `lambda.min` and `lambda.1se`. `grouped` selects whether fold-level results are aggregated before or after summary calculation according to the documented CV procedure. With `keep = TRUE`, fold-held-out predictions are returned in `fit.preval`. The oracle records fixed-fold results and a small portion of this matrix; the full matrix is not required as a fixture.

## 6. Observed warnings, errors, and boundaries

The pinned public output and task notes establish:

- The standard Gaussian, binomial, and Poisson paths are recorded for multiple alpha values, with default and tight convergence settings.
- Multinomial grouped and ungrouped paths are recorded, including class and response prediction.
- Standardization, intercept removal, weights, offset, penalty factors, coefficient limits, explicit lambda values, automatic path length/ratio, and active-set limits are exercised.
- A one-column design is rejected; the documented input requires at least two predictor columns.
- A constant Gaussian response is rejected in the recorded case.
- Missing values in the predictor matrix are rejected.
- A constant column and $p>n$ are included as boundary cases.
- Near-complete binomial separation can cause a later lambda to hit the iteration limit; the reference warns and returns only the converged prefix.
- For AUC, folds with fewer than ten observations trigger a warning and a deviance fallback in the pinned 5.1 experiment.
- The task's pinned 5.1 observation is that passing `thresh` and related controls at top level is deprecated; use the `control` list.

The exact text of warnings and the length of a truncated path are reference-version observations, not statistical guarantees.

## 7. Oracle coverage and unresolved behaviour

`oracle/glmnet.R` records Gaussian, binomial, Poisson, and multinomial fits; alpha values 0, 0.5, and 1; default and tight paths; standardization and intercept switches; weights, offsets, penalty factors, coefficient limits, explicit and automatic lambda sequences, active-set limits; coefficient and prediction interpolation; fixed-fold CV for supported measures; grouped multinomial fitting; `grouped` and `keep`; and the principal boundary cases. The pinned 5.1 output is in `experiments/regression18-glmnet.json`.

Unresolved items:

1. The precise 5.1 lambda-max calculation and path endpoint in degenerate, weighted, offset, and unpenalized-predictor cases should be checked from public outputs, not inferred from newer documentation.
2. The exact stopping rule and KKT/optimality residual needed to declare convergence independently of glmnet's tolerance remain to be specified.
3. Interpolation for every family and multinomial class parameterization needs broader off-path tests.
4. CV standard-error aggregation, the meaning of `grouped = FALSE`, and the exact fallback rules for small or single-class folds need more targeted outputs.
5. Behaviour at $\alpha=0$, zero penalty factors, pmax/dfmax truncation, and boundary coefficient limits requires additional validation.
6. The reference's one-column rejection, constant response handling, and NA policy should be translated into deliberate API validation rather than copied error strings.

## Decisions for the user

1. **Convergence target.** (A) reproduce glmnet's default early-stopping path; (B) solve each lambda to a strict, independently checked optimum and treat the reference's default path as a comparison band. **Recommendation: B**, consistent with the rStats.js policy for earlier regressions. Keep the default reference and tight reference outputs separate.
2. **Lambda path.** (A) reproduce the exact 5.1 data-derived path, including its alpha-zero convention; (B) use a mathematically equivalent deterministic path with explicit documented differences. **Recommendation: A where the public outputs identify the path; otherwise B with the exact actual lambda sequence exposed and tested.**
3. **Off-path coefficient requests.** (A) implement log-lambda interpolation only; (B) also refit exactly when original data are supplied. **Recommendation: A initially**, because exact refitting expands the API and is not needed for the core path.
4. **Cross-validation folds.** (A) generate random folds internally; (B) require `foldid` for the R-compatibility mode. **Recommendation: B**, matching the project's fixed-fold test contract; optional internal fold generation can be a later convenience.
5. **CV grouped semantics.** (A) implement both `grouped = TRUE/FALSE` exactly; (B) initially support only the default grouped calculation. **Recommendation: A** because both are explicit public options and materially change the estimate of CV error.
6. **Multinomial grouped penalty.** (A) support both grouped and ungrouped penalties; (B) defer grouped. **Recommendation: A**, as explicitly requested in scope.

## rStats.js's choices

