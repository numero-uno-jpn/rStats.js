# Nonlinear least-squares regression: reference behaviour

Issue: #540  
Branch: `work/regression`  
Reference: R 4.6.2 public documentation and public-function oracle in `oracle/nls.R` / `test/fixtures/nls.json`.

## Evidence and clean-room boundary

This specification is derived independently from:

- Bates and Watts (1988), *Nonlinear Regression Analysis and Its Applications*;
- Bates and Chambers (1992), “Nonlinear models”, in *Statistical Models in S*;
- Golub and Pereyra (1973), “The differentiation of pseudo-inverses and nonlinear least squares problems whose variables separate”;
- Pinheiro and Bates (2000), *Mixed-Effects Models in S and S-PLUS*, Appendix C;
- Dennis, Gay, and Welsch (1981), “An adaptive nonlinear least-squares algorithm”;
- Nocedal and Wright, *Numerical Optimization*, for bound-constrained optimization;
- the public R help pages for nonlinear least squares, its controls, self-starting models, profiling, prediction, and model comparison;
- public outputs recorded by the coordinator in the nls oracle and fixture.

The oracle records coefficients, summaries, covariance, residuals, fitted values, predictions, confidence intervals, convergence information, starting values, and public self-start model values and gradients. It does not inspect the fit's `m` component or any executable model object. No R or MASS source, mirror, implementation excerpt, closure, or unclassed fit was read, recalled, or used. R was not run by the implementer.

## 1. Model, objective, and formula language

For observations `i = 1,...,n`, let the response be `y_i`, the nonlinear mean function be `f(x_i; theta)`, and the residual be

```math
r_i(\theta) = y_i - f(x_i;\theta).
```

With non-negative prior weights `w_i`, the objective is weighted residual sum of squares

```math
S(\theta)=\sum_{i\in\mathcal O}w_i r_i(\theta)^2,
```

where `O` contains rows with complete finite response, predictor, parameter-independent expression values, and positive finite weights. A zero weight contributes no information. Missing rows are omitted consistently from fitting and diagnostics; prediction on new data does not silently omit invalid rows.

The formula is a string with one response and one right-hand-side expression, separated by `~`. The right-hand side supports:

- finite numeric literals and names resolving to data columns or parameters;
- parentheses, unary plus and minus, and binary `+`, `-`, `*`, `/`, and `^`;
- the mathematical functions `exp`, `log`, `log10`, `sqrt`, `abs`, `sin`, `cos`, `tan`, `sinh`, `cosh`, `tanh`, and `log1p`;
- the ten documented self-starting model calls in section 6.

The parser is a dedicated nonlinear expression parser, not the linear formula parser. Multiplication and division are left-associative; exponentiation is right-associative and binds more tightly than unary minus. Function calls require the exact supported name and arity. Unknown identifiers, unsupported operators, non-finite intermediate values, and invalid function domains produce errors that identify the expression or row where possible. No arbitrary JavaScript evaluation, property access, indexing, assignment, or user-supplied function call is permitted.

Parameter names are identifiers not resolved as data columns or supported functions. The start object supplies every free parameter exactly once. A name used both as a data column and as a parameter resolves to the data column; such collisions are rejected to avoid ambiguity. Formula response and predictor columns are numeric. The response must have more usable rows than the number of estimated parameters for residual degrees of freedom and inferential summaries.

The symbolic derivative of the expression tree is computed with respect to each free parameter. The differentiation rules are the ordinary sum, product, quotient, power, and chain rules. For a constant exponent, `d(u^v)/dtheta = v*u^(v-1)*du/dtheta`; for a variable exponent and positive base, use `u^v * (dv*log(u) + v*du/u)`. The derivative of `abs` is its sign away from zero and is undefined at zero; a non-differentiable point encountered in a required Jacobian is reported as a singular/undefined gradient rather than silently assigned a misleading derivative. Derivatives of the supported elementary functions follow their mathematical definitions. Self-start model gradients are analytic and are checked against the oracle grid.

Let `J[i,j] = d f(x_i;theta) / d theta_j`. The residual Jacobian is `-J`; the normal equations can equivalently use `J' W r = 0`.

## 2. Gauss-Newton and convergence

The default algorithm is Gauss-Newton. At each iteration, solve the weighted linearized least-squares problem

```math
(J^T W J) delta = J^T W r
```

and propose `theta_new = theta + alpha*delta`. Use a safeguarded step-halving line search, beginning at `alpha = 1` and reducing it by one half until the objective decreases or a gradient-based near-optimum acceptance test is met. The linear system is solved with a rank-revealing stable factorization; do not form an explicit inverse for the step. A rank-deficient Jacobian is an error because the parameters are not locally identifiable.

The default convergence target is the actual stationary solution, not the early stopping point produced by R's default relative-offset tolerance. Require both a scale-aware small step and a small scaled gradient `J'Wr`; also verify that the objective is finite and non-increasing. The convergence test must be invariant to a common rescaling of the response and must not mistake a tiny objective change caused by floating-point rounding for a stationary point. If the line search cannot find a valid improving step and the gradient is not small, report failure rather than claiming convergence.

Controls corresponding to the documented control object:

- `maxiter`: maximum iterations (default 50);
- `tol`: positive convergence tolerance (default 1e-5 as the documented control default; internal stationarity checks are stricter so the default fit reaches the solution);
- `minFactor`: smallest permitted step fraction in step halving (default 1/1024);
- `warnOnly`: on iteration exhaustion, return the last finite fit with `converged = false` and a warning; otherwise throw an error;
- `scaleOffset`: non-negative additive scale used in the relative objective/gradient convergence denominator, useful when the residual sum of squares is zero or very small.

A successful result records iteration count, final objective, residual degrees of freedom, convergence status, and warnings. The oracle's default fit and tight refit are both references: compare estimates and inference strictly to `fitTight`, and compare with the default R fit using a tolerance justified by the observed default-versus-tight difference for that case. The R convergence flag is not used as proof of a stationary solution.

## 3. Partially linear models (`plinear`)

The partially linear algorithm is variable projection. The mean is represented as

```math
f(x;\phi,\gamma)=g(x;\phi)+A(x;\phi)\gamma,
```

where `phi` are nonlinear parameters and `gamma` are linear coefficients. For each trial `phi`, solve the weighted linear least-squares problem for `gamma` exactly (up to the numerical linear solver), then minimize the profiled residual sum of squares over `phi`. The derivative of the profiled objective accounts for the dependence of the optimal linear coefficients on `phi`; use the variable-projection formulation of Golub and Pereyra rather than treating `gamma` as fixed.

The formula parser must identify the separable linear component without changing the mathematical expression. The coefficient name for the linear part is `.lin` (and deterministic indexed suffixes if multiple independent linear columns are present). The returned coefficient order follows the model's nonlinear parameter order followed by the linear coefficient(s), with stable names. For the Michaelis-Menten example `y ~ x/(K+x)`, the linear coefficient multiplies the nonlinear basis and is returned as `.lin`. A model that is not separable in the requested form, has a rank-deficient linear subproblem, or has no nonlinear parameter to optimize is rejected with a specific error.

The covariance and standard errors are computed from the full Jacobian with respect to all estimated parameters at the final solution, including the linear coefficients. They are not computed from the reduced nonlinear Hessian alone.

## 4. Bound-constrained algorithm (`port`)

The `port` algorithm minimizes the same weighted sum of squares subject to componentwise bounds

```math
lower_j \leq theta_j \leq upper_j.
```

Bounds default to negative and positive infinity. A scalar bound is recycled to all parameters; a named bound is matched by parameter name; a vector bound follows the start-parameter order. Missing bound entries mean the corresponding infinite bound. Require finite starting values, ordered bounds, and every starting value inside its bounds. A start outside the feasible region is an error; it is not silently clipped.

Use a bound-aware trust-region/active-set least-squares method assembled from general optimization principles (Dennis, Gay, and Welsch; Nocedal and Wright). It must respect feasibility at every accepted iterate, identify active bounds, and use projected-gradient/KKT conditions for convergence. Do not port PORT or any netlib implementation. A solution on a bound is valid when the corresponding KKT condition holds; it is not automatically a failure. Record active parameters and convergence status. Rank deficiency in the free-parameter Jacobian is an error unless the only deficient directions are fixed by active bounds and the remaining free problem is identifiable.

## 5. Inference, prediction, and model comparison

### 5.1 Residual scale and covariance

At the solution, let `p` be the number of estimated parameters (including `.lin` coefficients) and `df = n_eff - p`. The residual standard error is

```math
\hat\sigma = \sqrt{S(\hat\theta)/df}.
```

The local covariance approximation is

```math
\widehat{Var}(\hat\theta)=\hat\sigma^2(J^T W J)^{-1}.
```

This is the usual first-order covariance approximation for nonlinear least squares. It assumes a locally identifiable model and an adequate linear approximation near the optimum. If the Jacobian is rank deficient, the covariance is not finite/identified and the fit is rejected rather than returning plausible-looking standard errors. The correlation matrix is obtained by scaling the covariance by its diagonal standard errors.

The summary table contains, in parameter order, Estimate, Std. Error, t value, and two-sided Pr(>|t|), with t reference degrees of freedom `df`. The log likelihood, AIC, and BIC use the Gaussian least-squares model and the effective observation count. The deviance is the weighted residual sum of squares. The public fit also contains named coefficients, fitted values, residuals, sigma, degrees of freedom, observation count, convergence diagnostics, and warnings.

### 5.2 Prediction

For the original data, fitted values are the evaluated mean function at the fitted parameters. Residuals are observed minus fitted values. `nlsPredict(fit, { newdata })` evaluates the same parsed expression against new numeric columns and the fitted parameters. Every required predictor must be present and valid; a missing or non-finite value produces a missing prediction for that row or a clear input error, consistently documented by the API. Prediction does not refit the model and does not return standard errors in this scope.

### 5.3 Confidence intervals

`nlsConfint` supports Wald and profile intervals, with profile as the default.

For a Wald interval, use the estimate and its covariance-derived standard error with the two-sided Student-t quantile at the requested confidence level and residual degrees of freedom.

For a profile interval for parameter `theta_j`, fix `theta_j = c`, re-optimize all remaining parameters, and solve

```math
S_j(c)-S(\hat\theta) = \hat\sigma^2 F_{1,df}(level),
```

where `F_{1,df}(level)` is the corresponding upper quantile of the F distribution. Find each endpoint by bracketing outward from the estimate, then use a safeguarded root solver (bracketing plus Newton steps only when they remain inside the bracket). Warm-start nuisance parameters from the nearest successful profile point. Verify both endpoints independently by reevaluating the constrained objective. If an endpoint cannot be bracketed or a nuisance fit fails, return an unavailable endpoint with a warning; do not fabricate a finite limit. The profiling message is not part of the numerical result.

### 5.4 Nested-model F test

`nlsAnova` compares two or more nested fits to the same response observations and weights. For a reduced model with residual sum of squares `S_R`, residual degrees of freedom `df_R`, and a larger model with `S_F`, `df_F`, the test is

```math
F = \frac{(S_R-S_F)/(df_R-df_F)}{S_F/df_F},
\qquad p = P(F_{df_R-df_F,df_F}\geq F_{obs}).
```

The table reports residual degrees of freedom, residual sum of squares, the difference in degrees of freedom and sum of squares, F statistic, and p-value for each step. Reject non-nested fits, different response data, different analysis rows, or incompatible weights. Numerical round-off that makes a nested larger model's objective microscopically greater is handled only within a scale-aware floating-point tolerance; a materially worse larger model is an error.

## 6. Self-starting models

The ten built-in models are expression functions, not separately exported functions. Their values and analytic gradients are evaluated by the same expression engine. Their parameter names and argument order are fixed as documented below. The initial-value routines are deterministic heuristics based on sorted observations, response range, log transforms where appropriate, and simple linearized regressions. They need not reproduce R's initial values; the final fitted estimates are compared with the oracle. Invalid domains, insufficient distinct predictor values, or degenerate response ranges produce a clear initialization error.

Let `x` denote the first predictor (and `t` time where stated).

1. **SSasymp(x, Asym, R0, lrc)**  
   `Asym + (R0 - Asym) * exp(-exp(lrc) * x)`. `Asym` is the horizontal asymptote, `R0` the value at zero, and `exp(lrc)` the positive rate. Initialize the asymptote from the late-`x` response level, `R0` from the early-`x` level, and the rate from a log-linearized distance to the asymptote.

2. **SSasympOff(x, Asym, lrc, c0)**  
   `Asym * (1 - exp(-exp(lrc) * (x - c0)))`. `c0` is the horizontal shift and `Asym` the asymptote. Initialize `Asym` from the upper response range, `c0` from the observed onset, and the rate from the rise toward the asymptote.

3. **SSasympOrig(x, Asym, lrc)**  
   `Asym * (1 - exp(-exp(lrc) * x))`. This is the zero-origin special case of the shifted asymptotic rise. Initialize the asymptote and rate as in SSasympOff with `c0 = 0`.

4. **SSbiexp(x, A1, lrc1, A2, lrc2)**  
   `A1 * exp(-exp(lrc1) * x) + A2 * exp(-exp(lrc2) * x)`. The log-rate parameters ensure positive decay rates. Initialize two amplitudes from the early response and two ordered rates from fast/slow components of a log-linearized decay. Require enough distinct non-negative predictor values to separate the components.

5. **SSfol(Dose, Time, lKe, lKa, lCl)**  
   One-compartment oral absorption with first-order absorption and elimination:
   `Dose * exp(lKe) * exp(lKa) / (exp(lCl) * (exp(lKa) - exp(lKe))) * (exp(-exp(lKe) * Time) - exp(-exp(lKa) * Time))`. The log parameters encode positive elimination, absorption, and clearance rates. Initialization uses positive parameterization, the observed peak time and concentration, and the analytic relationship between peak time and the two rate constants. Reject coincident absorption and elimination rates as an undefined limiting case unless evaluated with a stable limit.

6. **SSfpl(x, A, B, xmid, scal)**  
   Four-parameter logistic curve `A + (B - A) / (1 + exp((xmid - x) / scal))`. `A` and `B` are lower and upper asymptotes, `xmid` is the midpoint, and `scal` is the positive scale. Initialize asymptotes from the lower and upper response ranges, midpoint from the predictor near the response midpoint, and scale from the slope around that point.

7. **SSgompertz(x, Asym, b2, b3)**  
   `Asym * exp(-b2 * exp(-b3 * x))`. Initialize `Asym` from the upper response range; estimate positive `b2` and `b3` from a double-log transform of the normalized response.

8. **SSlogis(x, Asym, xmid, scal)**  
   `Asym / (1 + exp((xmid - x) / scal))`. Initialize `Asym` from the upper response range, `xmid` from the predictor at half the asymptote, and positive `scal` from the transition width.

9. **SSmicmen(x, Vm, K)**  
   Michaelis-Menten saturation curve `Vm * x / (K + x)`. Initialize `Vm` from the upper response range and estimate positive `K` from the predictor at half that response. This model is also the basis for the plinear example, where `.lin` replaces `Vm`.

10. **SSweibull(x, Asym, Drop, lrc, pwr)**  
    `Asym - Drop * exp(-exp(lrc) * x^pwr)`. `Asym` is the asymptote, `Drop` the initial gap, and `exp(lrc)` and `pwr` control rate and shape. Initialize asymptote and drop from response range; obtain shape and rate from a log-log transform of the distance to the asymptote.

The oracle grid checks values and every gradient column for all ten models at the supplied parameter values. The initial-value outputs in the fixture are diagnostic references only, not required to match exactly.

## 7. Errors, warnings, and boundary behaviour

- Missing start values for an ordinary formula are an error. A self-starting model supplies its own deterministic initial values; an explicit start may override them.
- A singular Jacobian at the initial point or during fitting is an identifiability error. A zero/undefined gradient is not repaired by silently perturbing parameters.
- An invalid algorithm name is an error. Supported algorithms are the default Gauss-Newton, `plinear`, and `port`.
- Too few usable observations for the number of parameters and residual degrees of freedom is an error.
- A failed fit at the iteration limit is an error unless `warnOnly` is true, in which case the last finite iterate and `converged = false` are returned with a warning.
- An exact fit has zero residual variance. The point estimate is meaningful, but the usual residual-based covariance and t inference are not. Do not divide by zero or report finite inferential precision; expose the exact-fit condition and make the unavailable inference explicit. The `scaleOffset` control may stabilize convergence diagnostics but does not create residual variance.
- `port` starting values outside bounds are errors. A solution at a bound is accepted only when the bound-constrained stationarity conditions hold.
- Missing response/predictor rows are omitted from fitting as a complete-case analysis; the number of used observations and residual degrees of freedom reflect the retained rows. Missing new-data values do not trigger refitting.
- Non-positive weights are rejected except zero weights, which are excluded from the effective sample. Negative or non-finite weights are errors.
- Non-finite function values, overflow, invalid logarithm or square-root domains, division by zero, and undefined derivatives are reported with a useful diagnostic.
- Profile endpoints that cannot be found are unavailable and accompanied by a warning; the point estimate and Wald interval remain available if their covariance is valid.
- For nested comparisons, non-nested models and mismatched analysis data are errors; a materially worse larger model is not silently accepted.

## Decisions for the user

The following recommendations from `briefs/nls-1.7.ja.md` section 3 are adopted for this implementation; they are not new questions:

1. **Convergence:** iterate to a stationary solution by default; support `maxiter`, `tol`, `minFactor`, `warnOnly`, and `scaleOffset`. On failure, error unless `warnOnly` is enabled.
2. **Derivatives:** use symbolic derivatives of the parsed expression tree; do not copy the numerical-difference path of the reference implementation.
3. **Self-start initialization:** derive deterministic starts from published model equations and regression heuristics. The final estimates and model values/gradients are the comparison targets, not exact initial values.
4. **Names and exports:** export `nls`, `nlsSummary`, `nlsVcov`, `nlsPredict`, `nlsConfint`, and `nlsAnova`. Self-starting models are available only inside formulas.
5. **Errors:** fixture error cases are errors except exact-fit and missing-start cases, where a mathematically meaningful result may be returned if inference is handled honestly.
6. **Reference comparison:** use `fitTight` for strict comparisons of estimates, standard errors, and deviance. Derive tolerances against the default reference from the observed default-to-tight discrepancy for each case.

No additional user decision is currently required. The supported formula function list, initial-value heuristics, profile algorithm, and bound-constrained optimizer are implementation details that can be refined against the public oracle and independent numerical checks without changing the requested API scope.

## Stage 3 implementation notes

- The left-hand side may be a parameter-free expression. Its variables must resolve to data columns or the mathematical constant `pi`; parameter names are rejected. The response expression is evaluated once per row for fitting. Predictions remain on that transformed response scale (for example, `log(y) ~ ...` returns predictions for `log(y)`, without an automatic inverse transform).
- `pi` is the mathematical constant when no data column named `pi` exists. A data column named `pi` takes precedence over both the constant and any same-named start entry; that start entry is not treated as a free parameter.
- `atan`, `asin`, and `acos` are supported with analytic derivatives. A power with a parameter-independent exponent uses the constant-exponent derivative, avoiding an unnecessary `log(base)` term for negative bases.
- Near-zero residual convergence uses a representable-step test relative to the parameter scale and also stops when the objective cannot decrease beyond a response-scale-relative rounding floor. `scaleOffset` can relax the scaled-gradient test but cannot replace the step/objective precision checks. Exact-fit detection is relative to the response norm, so response rescaling does not turn a merely small residual into an exact fit.
- The Gauss-Newton system and final covariance inversion normalize Jacobian columns before solving/inverting, then transform covariance back to the original parameter units. This keeps singularity checks tied to column geometry rather than arbitrary units.

## rStats.js's choices

Decided by the user on 2026-11-20, as recommended in `briefs/nls-1.7.ja.md` section 3. Checked by the coordinator
against `test/fixtures/nls.json` with a temporary bundle of `src/entries/regression.ts`.

1. **Convergence: iterate to the solution** (Decision 1). R's default relative-offset test stops early, so rStats.js
   is compared with `fitTight` (R refitted from its own estimate with `tol = 1e-10`), not with R's default fit. For
   every converging fixture case the coefficients agree with `fitTight` to a relative 1e-8 and the deviance to 1e-14;
   R's default fit differs from `fitTight` by up to 7e-6. With `warnOnly` and a small `maxiter`, the iterate is that of
   the same number of Gauss-Newton steps: `maxiter-warnOnly` (two iterations) equals R's default fit to 1e-9.
2. **Derivatives: symbolic** (Decision 2). The path of iterations differs from R's numerical differences, but the
   converged values do not (item 1). The self-starting models' values and gradients equal the fixture's `models`.
3. **Self-starting models: rStats.js's own initial values** (Decision 3), built from the published model equations
   (linearisations and transformed regressions). They are not R's `getInitial` values; the final estimates agree
   with `fitTight` (item 1).
4. **Standard errors** are $\hat\sigma^2 (J^\top W J)^{-1}$ at the solution (for `plinear` including `.lin`). They
   agree with `fitTight`'s to a relative 5e-8 in every converging case.
5. **Profile intervals are the exact roots, which R's are not** (a known difference). An endpoint is the value $c$ of
   $\theta_j$ at which the deviance minimised over the other parameters exceeds the minimum by
   $\hat\sigma^2 F_{1,\mathrm{df}}(\text{level})$. R interpolates a profile traced at a few points, and its endpoints
   are off by up to a relative 4.7e-3 (`bod-exp`, $n = 6$); typically 1e-4. Checked independently of rStats.js's
   profile code (`experiments/regression-nls-profile-check.mjs` and `.out.txt`: nuisance fits by a finite-difference
   Levenberg-Marquardt, roots by bisection, for `bod-exp`, `loblolly-SSasymp`, `dnase-plinear-logistic`,
   `puromycin-plinear` and `puromycin-default` at 95% and 90%): rStats.js's endpoints equal the independent roots to
   2.6e-11, R's do not. A further sign that R's are approximate: R gives the same model's `K` different intervals
   under the default algorithm and `plinear` (0.04692 to 0.08616 and 0.04711 to 0.08586); rStats.js gives both the
   exact roots, 0.04692034 and 0.08615691. Tests check the root condition strictly and R's endpoints to a relative
   1e-2.
6. **An exact fit returns the estimates, with inference `NaN`** (Decision 5; a known difference). R stops at its
   iteration limit with an error (`error-exact-fit`), because its convergence test divides by the residual sum of
   squares. The estimates are well defined, but the residual variance is zero, so standard errors, t values, p
   values and confidence intervals are `NaN` and the fit is marked exact. `scaleOffset` changes only the gradient
   test, never the answer (amended 2026-11-20): `exact-scaleOffset` (`scaleOffset = 1`) and `error-exact-fit` are the
   same data, exactly $2 e^{0.3 x}$, and both reach $a = 2$, $b = 0.3$ to rounding (residual sum of squares 7.8e-29)
   and are marked exact. R's `fitTight` for `exact-scaleOffset` stops earlier (coefficient errors near 2e-12, residual
   sum of squares 3.9e-23, standard errors near 1e-12); that difference is rounding and is not compared. The first
   implementation stopped there too, because `scaleOffset` loosened its stopping rule (found 2026-11-20)
7. **Errors found before iterating** (Decision 5; a known difference in the message and the moment, not in the
   outcome). Without `start` and without a self-starting model, R starts every parameter at 1 with a warning and
   fails later (`error-no-start`, step factor below `minFactor`); rStats.js says that `start` must be supplied. With
   no more observations than parameters, R iterates to its limit (`error-too-few-rows`); rStats.js says so at once.
   The other `error-*` cases are errors in both, with rStats.js's own wording.
8. **`port`: rStats.js's own bound-constrained Gauss-Newton** (an active set, projected steps and the KKT conditions
   at the bounds), not the PORT library. It agrees with `fitTight` for the three `port` cases, including a solution
   at a lower bound and a start at an upper bound.
9. **`nlsAnova`** agrees with R's F test (`puromycin-anova`) to a relative 1e-9 in the F value and p value.
10. **Near-zero residuals: converge on a small step whose predicted decrease is rounding** (added 2026-11-20). The
    gradient test of item 1 is scaled by $\sqrt{\mathrm{RSS}}$, which cannot be met when the residuals are at the
    rounding level (NIST StRD Lanczos1, residual sum of squares 1.4e-25; R also fails there without `scaleOffset`).
    A small step ($\le \max(10^{-12}, 10^{-3}\sqrt{\texttt{tol}})$ relative) is then accepted as convergence when the
    Gauss-Newton model's predicted decrease $\delta^\top J^\top W r$ is within the rounding noise of the objective,
    $4\varepsilon \sum w |r||y| + 4\varepsilon^2 \sum w y^2$ (relative to the data, so independent of the units of
    $y$). The objective alone is never a stopping rule: its rounding noise allows coefficient errors of about
    $\sqrt{\varepsilon}$. On stopping, the final full step is taken when it does not raise the objective. With this,
    every NIST StRD problem that R's `nls` solves is fitted from the default control to at least 8.6 certified
    digits, including Lanczos1 (10.6) (`experiments/regression-nls-strd.mjs`; the problems R also fails from Start 1,
    BoxBOD, Eckerle4, MGH09, MGH10, MGH17 and Rat43, fail in rStats.js too)
11. **Formula language: `atan`, `asin`, `acos` and the constant `pi`; a response expression** (decided by the user on
    2026-11-20). Inverse trigonometric functions have symbolic derivatives. `pi` is the constant unless a data column
    is named `pi`. The left-hand side may be an expression of data columns (`log(y) ~ ...`), evaluated row by row;
    a parameter there is an error. Fitted values, residuals and `nlsPredict` are on the scale of that expression, as
    in R. Checked on NIST StRD Roszman1 (`atan`, `pi`) and Nelson (`log(y)`)

