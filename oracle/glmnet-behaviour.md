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

## 7. Formula-level specification and numerical verification

The successful R 4.6.2 / glmnet 5.1 public-output run in experiments/regression18-oracle-glmnet.R on commit 9c698624 is complete and parses successfully. The emitted design, responses, weights, fold ids, and public fit components are the numerical evidence.

### 7.1 Objective, weights, and standardization

For family loss L,
\[
\frac1nL(\beta_0,\beta;X,y,w,o)+
\lambda\sum_{j=1}^pv_j^*
\{\alpha|\beta_j|+(1-\alpha)\beta_j^2/2\},
\quad \beta_0\ {\rm unpenalized},
\]
where \(w_i^*=nw_i/\sum_iw_i\) and \(v_j^*=pv_j/\sum_jv_j\). Gaussian loss is one half the weighted squared residual sum, divided by n; offsets enter the linear predictor and are not penalized. Binomial, Poisson, and multinomial use their family negative log-likelihoods. Predictors are centered and scaled by weighted means and weighted standard deviations with divisor n after weight normalization. Gaussian response is also scaled for path construction and transformed back for returned coefficients. standardize=FALSE disables predictor scaling; intercept=FALSE removes the intercept.

The penalty-factor-only output for v=(0,1,4) starts at lambda=1.01352271569708, versus 0.647290715250188 without the altered factors, consistent with rescaling penalty factors to sum to p. The weighted case starts at 0.607659750969885.

### 7.2 Lambda maximum and geometric path

For alpha>0, after standardization and null-model adjustment, the all-zero penalized-slope KKT boundary is
\[
\lambda_{\max}=
\max_{j:v_j^*>0}
\frac{|n^{-1}\sum_iw_i^*\widetilde x_{ij}\widetilde r_i|}
{\alpha v_j^*}.
\]
Zero-penalty predictors are fitted in the null model rather than divided by zero. At alpha=0 the lasso threshold is infinite; the pinned reference uses the finite ridge convention equivalent to effective alpha=0.001.

The automatic path is geometric:
\[
\lambda_k=\lambda_{\max}
(\lambda_{\min}/\lambda_{\max})^{(k-1)/(L-1)},\quad
\lambda_{\min}=\lambda_{\max}\,\texttt{lambda.min.ratio}.
\]
The default ratio is 1e-4 when n>p and 1e-2 when n<p. A supplied decreasing lambda vector replaces the automatic path. The path may stop early on deviance-fraction or convergence/active-set limits.

For the fixed Gaussian data, the independently calculated population-scale column standard deviations are (2.05986785,1.97905701,1.97905701), and the centered cross-products divided by n are (1.33333333333333,0.666666666666667,0.25). Thus max_j |x_j^T(y-ybar)|/(n s_j)=0.647290715250188, matching the R lambda_max to 15 significant digits. With the supplied weights normalized to sum n, the weighted means are (0.65,0.05,0.85), weighted population standard deviations are (2.24220873,1.82961745,1.87816400), and the maximum weighted standardized covariance is 0.607659750969884, matching the R start 0.607659750969885 to 14 significant digits. The Gaussian fixed-design starts are 0.647290715250188 for alpha=1, 1.29458143050038 for alpha=.5, and 647.290715250188 for alpha=0; the latter is 1000 times the lasso start and verifies the effective alpha=.001 convention. For n=20,p=50, the default path ratio is exactly .01. For n=60,p=3, the path ends at ratio .000372759372031494, above the nominal 1e-4, showing early stopping rather than a different default. The eight-point path with lambda.min.ratio=.01 has constant successive ratios to at least 14 significant digits. Ordinary and thresh=1e-14 fits return identical lambda vectors to all 15 displayed digits.

### 7.3 Degrees of freedom and deviance

df is the number of nonzero predictor coefficients at each lambda (intercept excluded; nonzero unpenalized predictors are included). For Gaussian,
\[
nulldev=\sum_iw_i^*(y_i-\bar y_w)^2,\qquad
dev.ratio=1-\frac{deviance(\widehat\beta_\lambda)}{nulldev}.
\]
For binomial, Poisson, and multinomial, nulldev is the null-model deviance under the same response/weight/offset convention, and dev.ratio is the fraction removed by the fitted model. The Gaussian output has nulldev=98; at the second lambda dev.ratio=.0588477262271477, so residual deviance is 98(1-.0588477262271477). Binomial and Poisson nulldev are 16.3006383837966 and 6.18196332758927. Gaussian df begins [0,2,2,3,...], excluding the intercept.

### 7.4 Multinomial grouped penalty

For class coefficients beta_jk, ungrouped penalty is
\[
\lambda\sum_jv_j^*\sum_k\{\alpha|\beta_{jk}|+(1-\alpha)\beta_{jk}^2/2\}.
\]
Grouped penalty is
\[
\lambda\sum_jv_j^*\{\alpha\|\beta_{j\cdot}\|_2+
(1-\alpha)\|\beta_{j\cdot}\|_2^2/2\}.
\]
The ungrouped and grouped starts are 0.434995773978776 and 0.560170128638723; their deviance-ratio sequences differ as expected. The grouped path fails at its sixth lambda and returns the converged prefix.

### 7.5 Off-path interpolation

For s between adjacent stored lambdas,
\[
t=\frac{\log s-\log\lambda_k}{\log\lambda_{k+1}-\log\lambda_k},
\quad
\widehat\beta(s)=(1-t)\widehat\beta(\lambda_k)+t\widehat\beta(\lambda_{k+1}).
\]
The offPath output requests s=.75 and .30 from (2,1,.5,.25,.125) and records coefficient and prediction matrices. The public help states log-lambda interpolation. The compact output does not contain the full neighboring coefficient columns for this custom path, so an independent reconstruction is not claimed.

### 7.6 Cross-validation

For fixed folds F_k, let E_k(lambda) be the held-out loss. For grouped=TRUE,
\[
cvm(\lambda)=K^{-1}\sum_kE_k(\lambda),\qquad
cvsd(\lambda)=sd(E_1,\ldots,E_K)/\sqrt K.
\]
For grouped=FALSE, predictions are pooled at the observation level before computing the CV loss and its uncertainty; cvm can agree while cvsd differs. lambda.min minimizes cvm; lambda.1se is the largest lambda satisfying
\[
cvm(\lambda)\leq \min_{\lambda'}cvm(\lambda')+cvsd(\lambda_{\min}).
\]
MSE and MAE are mean squared and absolute errors; class is misclassification proportion; binomial AUC is the loss 1-AUC; deviance is family deviance per held-out observation.

The fixed-fold Gaussian MSE output begins cvm=9.44621930369904 and cvsd=1.81870626086261. grouped=FALSE has the same first cvm and cvsd=2.82299348396042. For MAE, the minimum is 0.131398384219135 at lambda=.00305154195233708; lambda.1se is .0113749086188093, whose error .131503101496899 is below the one-SE cutoff. The binomial class and AUC sequences are recorded in full; AUC errors around .43 confirm the reported measure is a loss.

### 7.7 Convergence and controls

The public control output records fdev=1e-5, eps=1e-6, mnlam=5, devmax=.999, thresh=1e-7, maxit=100000, plus the remaining control fields. A nonconverged lambda returns the converged prefix and warning; the grouped multinomial case fails at lambda six. The project target remains a strict independently checked optimum, not reproduction of a default early stop.

## 8. Unresolved behaviour

1. The log-lambda interpolation rule is documented and the requested public values are recorded, but the custom-path output omits the neighboring coefficient columns. Independent reconstruction of the two off-path coefficient vectors is therefore not claimed.
2. The exact stopping boundary for fdev, devmax, and active-set limits has not been isolated numerically. The n<p example reaches .01 exactly; the n>p example stops at .000372759372031494. The control defaults and both outcomes are recorded.
3. Full class-centering/identifiability behaviour for every multinomial class-count and grouped-penalty corner case is not established by the compact output. Both grouped and ungrouped public paths and class probabilities were recorded; no unsupported parameterization detail is asserted.

## Decisions for the user

1. **Convergence target.** (A) reproduce default early stopping; (B) solve each lambda to a strict independently checked optimum. **Recommendation: B**, consistent with numerical-correctness policy.
2. **Lambda path.** (A) reproduce pinned data-derived paths where public KKT outputs identify them; (B) use an equivalent deterministic path with explicit differences otherwise. **Recommendation: A where verified, otherwise B with actual lambda exposed.**
3. **Off-path requests.** (A) log-lambda interpolation only; (B) also refit exactly with original data. **Recommendation: A initially.**
4. **CV folds.** (A) generate folds internally; (B) require foldid for comparison mode. **Recommendation: B**, for deterministic comparisons.
5. **CV grouped semantics.** (A) implement both grouped modes; (B) grouped only. **Recommendation: A**, because both affect uncertainty.
6. **Multinomial grouped penalty.** (A) support grouped and ungrouped; (B) defer grouped. **Recommendation: A**, as both are in scope.

## rStats.js's choices

