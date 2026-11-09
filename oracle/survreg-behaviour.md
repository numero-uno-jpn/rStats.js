# Parametric survival regression (survreg): the behaviour to reproduce

What survival 3.8-12's `survreg` (R 4.6.2) computes, with `summary`, `predict` and `residuals`, in words and formulas,
for an implementation that must not read its source. **Clean room:** this file was written without reading the
source of R or of any package. Its sources are the help pages (`survreg`, `survreg.control`,
`survreg.distributions`, `predict.survreg`, `residuals.survreg`, `survreg.object`), the package vignette "The survival
package" (chapter "Accelerated Failure Time models": likelihood, derivatives, distributions, residuals, predictions),
Kalbfleisch and Prentice (2002, ch. 2-3) and Escobar and Meeker (1992), and the **output** of R: every statement below
was checked by experiment, mostly by an independent re-implementation in R (from this text) that reproduces R's
iterations, coefficients, log-likelihoods and variances to about 1e-15 on the cases listed in "Accuracy". Where
something could not be settled by experiment, it says so. Where this file and a fixture seem to disagree, report it.

| oracle | fixtures | cases |
|---|---|---|
| `oracle/survreg.R` (x86_64 R, as `oracle/coxph.R`) | `survreg` (fits and summaries) | 115 (19 errors) |
| `oracle/survregpredict.R` (x86_64 R) | `survregPredict`, `survregResiduals` | 274 (1 error), 102 |

`oracle/_survreg.R` holds the shared code: the argument conventions (R's names, since the API is undecided:
`time`, `time2`, `event`, `type`, `x` without the intercept column, `intercept`, `dist`, `weights`, `offset`,
`strata`, `scale`, `init`, `parms`, `maxiter`, `rel.tolerance`, `toler.chol`; for predictions `predType`, `p`,
`se.fit`, `newX`, `newStrata`, `newOffset`; for residuals `residType`, `weighted`), the fields written, and an
accurate log-domain implementation of the per-observation derivatives used for the references. Each run takes about
20 s; memory is far below 1 GB. Fixture fields keep R's names (`linear.predictors`, `df.residual`, `icoef`,
`se.fit`). Every fit case has `warnings` (R's, each once) or `{"error": message}`. Where R is wrong the case has a
`reference` with `refKind` (section 12).

Notation: n observations (rows used), p columns of the model matrix X (intercept first when present), k strata (k = 1
without strata), `w_i` case weights (1 by default), `o_i` offsets (0 by default), `η_i = x_i'β + o_i`, `σ_s = exp(τ_s)`
the scale of stratum s (τ the log scale), `y` the response on the scale of the base distribution (`log t` for the
log-transformed distributions), `z = (y − η)/σ`.

## Easy to get wrong

1. **The iteration count is one behind the evaluations, and the returned point is one ahead.** When the iterations
   run out, R returns the *next trial point* (the last accepted point plus its Newton step) with the log-likelihood of
   the last accepted point, but the variance and score computed at the returned point (section 5.4). With
   `maxiter = 0` the starting values are returned.
2. **Convergence is `|1 − ℓ_best/ℓ_new| ≤ rel.tolerance` on the log-likelihood without the Jacobian** (on the scale
   of `y`, not of the time), and it is tested *before* the improvement test: a worse point can end the iteration.
3. **A step that does not improve is shrunk to one third, not halved**, and in a shrunk step a log scale may fall by
   at most 1.1 (but rise without limit). A first step from an information matrix that is not non-negative definite
   is not a Newton step: it uses the outer product of the per-observation scores (BHHH).
4. **The starting values are not the distribution's moments.** σ₀ = 2 √v (twice the square root of the
   distribution's variance estimate); the intercept-only model is fitted first (at most 20 iterations, silently), and
   the full model starts from a weighted least-squares fit at η = y with the scales of the intercept-only fit
   (section 4).
5. **The extreme value "mean" constant is 0.572, not Euler's 0.5772**; its variance divisor is 1.64 (not π²/6); the
   logistic divisor is 3.2 (not π²/3); t: `v (df − 2)/df`.
6. `loglik` includes the Jacobian (`−Σ_exact w log t` for log-transformed distributions); the convergence test and
   `residuals(type = "matrix")` do not.
7. **R replaces an underflowing density or probability by fixed values** (log-likelihood term −200 and ad hoc
   derivatives, section 6) and computes in the linear domain. This changes the iteration path from poor starting
   values and can change the result when an observation lies far in a tail (fixture `refKind: "nullIter"`).
8. `df` counts aliased (NA) coefficients; `chi = 2 (ℓ₁ − ℓ₀)` can be negative (a model without intercept, or a run
   that did not converge), and `chiDf = df − idf` can be 0.
9. `residuals` of interval-censored observations are wrong in R for every type built from the log-scale derivatives
   (`matrix` columns `ds`, `dds`, `dsg`; `dfbeta`, `dfbetas`, `ldcase`, `ldresp`, `ldshape`), and the response and
   deviance residuals of interval-censored observations of the extreme value family forget the scale (section 10).
10. For `type = "interval2"` a lower end of 0 is left censoring (also for the log distributions, where log 0 would be
    −∞), equal ends are an exact time, and a missing or infinite end is open.

## 1. Distributions

`dist` is matched by `match.arg` against `extreme, logistic, gaussian, weibull, exponential, rayleigh, loggaussian,
lognormal, loglogistic, t` (abbreviations such as `"wei"`, `"exp"` work; otherwise the error in section 11). All are
location-scale families for y:

| dist | base | y | fixed scale | name in print |
|---|---|---|---|---|
| extreme | extreme value | t | | Extreme value |
| logistic | logistic | t | | Logistic |
| gaussian | normal | t | | Gaussian |
| t | Student t (`parms` = df, default 4, must be ≥ 3) | t | | Student-t |
| weibull | extreme value | log t | | Weibull |
| exponential | extreme value | log t | 1 | Exponential |
| rayleigh | extreme value | log t | 0.5 | Rayleigh |
| lognormal, loggaussian | normal | log t | | Log Normal |
| loglogistic | logistic | log t | | Log logistic |

Standard forms (w = e^z), with h₁ = f'/f and h₂ = f''/f:

- extreme value (minimum): F = 1 − exp(−w), f = w e^{−w}, h₁ = 1 − w, h₂ = w² − 3w + 1. Weibull: shape = 1/σ,
  R's `rweibull` scale = e^η.
- logistic: F = w/(1 + w), f = w/(1 + w)², h₁ = (1 − w)/(1 + w), h₂ = (w² − 4w + 1)/(1 + w)².
- normal: h₁ = −z, h₂ = z² − 1.
- t(ν): f ∝ (1 + z²/ν)^{−(ν+1)/2}, h₁ = −(ν + 1)z/(ν + z²), h₂ = (ν + 1)((ν + 2)z² − ν)/(ν + z²)².

Quantiles of the base (used by `predict`): extreme `log(−log(1 − p))`, logistic `log(p/(1 − p))`, normal `qnorm(p)`,
t `qt(p, ν)`.

## 2. Data

- **Surv types.** "right" (`Surv(time, event)`; no event: all exact), "left" (`event` 1 exact, 0 left censored),
  "interval" (`Surv(time, time2, event)`, event 0 right, 1 exact, 2 left, 3 interval (time, time2]), "interval2"
  (`Surv(lower, upper)`: lower NA or −Inf → left censored at upper; **lower 0 → left censored at upper**; upper NA or
  Inf → right censored at lower; equal → exact; both NA → the row is missing; lower > upper → NA with the warning
  `Invalid interval: start > stop, NA created`). For "interval" with event 3 and time > time2 the same warning.
  "counting" (start, stop] data: error `start-stop type Surv objects are not supported`. An event value outside the
  allowed set: warning `Invalid status value, converted to NA` and the row is dropped. Logical events are 0/1.
- **Missing values** in any variable (time, event, x, weights, strata, offset): the row is dropped (`n` counts the
  rows used).
- **Checks** (verbatim errors in section 11): for the log-transformed distributions every finite time used must be
  > 0 (a time of 0, negative or infinite: `Invalid survival times for this distribution`; R also warns `NaNs
  produced` first for negative times); weights must be > 0 (`Invalid weights, must be >0`; zero is an error); an
  infinite covariate: `data contains an infinite predictor`.
- **Transformation.** For the log distributions y = log t (interval ends both), and the Jacobian is `−Σ_{exact} w_i
  log t_i` (section 7).
- **Strata** (`strata(s)` term): one scale per stratum, in the order of the sorted levels; common coefficients.
- **Offset** (`offset()` term): added to η everywhere, including the starting values and predictions.

## 3. Log-likelihood and derivatives

Per observation (g, before weights), with z, z_l, z_u standardised with the observation's σ:

- exact: g = log f(z) − log σ;
- right censored at y: g = log S(z), S = 1 − F; left censored at y: g = log F(z);
- interval (y_l, y_u]: g = log(F(z_u) − F(z_l)).

ℓ = Σ w_i g_i (the convergence criterion; no Jacobian). Derivatives (vignette; checked numerically and against R's
score, variance and `residuals(type = "matrix")` for the non-interval rows). For an exact observation:

```
dg/dη        = −h₁/σ
d²g/dη²      = h₂/σ² − (h₁/σ)²
dg/dτ        = −z h₁ − 1                         (τ = log σ)
d²g/dτ²      = z h₁ + z² (h₂ − h₁²)
d²g/dη dτ    = (h₁ + z (h₂ − h₁²))/σ
```

For censored observations, with P = F(z_u) − F(z_l) (z_l = −∞ for left, z_u = +∞ for right censoring; f(±∞) = 0,
z f(z) → 0 and z² f'(z) → 0 at ±∞):

```
dg/dη        = −(f(z_u) − f(z_l))/(σ P)
d²g/dη²      = (f'(z_u) − f'(z_l))/(σ² P) − (dg/dη)²
dg/dτ        = −(z_u f(z_u) − z_l f(z_l))/P
d²g/dτ²      = (z_u² f'(z_u) − z_l² f'(z_l))/P − dg/dτ (1 + dg/dτ)
d²g/dη dτ    = (z_u f'(z_u) − z_l f'(z_l))/(σ P) − dg/dη (1 + dg/dτ)
```

Score u = (Σ w_i x_i dg_i/dη, and per stratum s Σ_{i∈s} w_i dg_i/dτ); information I = −H with H_ββ = Σ w x x'
d²g/dη², H_βτ_s = Σ_{i∈s} w x d²g/dηdτ, H_τ_sτ_s = Σ_{i∈s} w d²g/dτ² (H_τ_sτ_r = 0 for s ≠ r). With a fixed scale
the τ parameters are absent. The parameter vector is (β, τ₁, …, τ_k).

## 4. Starting values

1. **Centres.** c_i = y_i, or (y_l + y_u)/2 for an interval (on the scale of y; for log distributions the mean of the
   logs).
2. **Distribution's initial estimate** from the weighted population moments of c_i − o_i: m = Σ w(c − o)/Σ w, v =
   Σ w (c − o − m)²/Σ w (divisor Σ w, not Σ w − 1). Then (mean, variance): extreme `(m + 0.572, v/1.64)`, logistic
   `(m, v/3.2)`, normal `(m, v)`, t `(m, v (ν − 2)/ν)` (checked with ν = 4, 5, 10). Only the variance is used:
   **σ₀ = 2 √v_dist** (for a fixed scale σ₀ = the fixed value). Every stratum starts at the same σ₀.
3. **Weighted least-squares start** for coefficients b of a design matrix Z (of full rank; how R treats an aliased
   column here was not determined), given scales σ_i: evaluate the
   derivatives at η_i = c_i (z = 0 for an exact observation, the censored formulas otherwise), weights `w_i (−d²g/dη²)`,
   working response `c_i − (dg/dη)/(d²g/dη²) − o_i`, b = (Z'WZ)⁻¹ Z'W r. (For uncensored data this is the weighted
   least-squares fit of c.)
4. **Intercept-only model** ("null"): parameters (intercept, τ₁..τ_k) (no τ with a fixed scale). Start: the
   intercept from step 3 with Z = 1 and σ₀, τ_s = log σ₀. Iterated as in section 5 with the same `rel.tolerance` and
   `toler.chol` but **at most 20 iterations, whatever `maxiter` is, and without a warning** when it runs out (fixture
   case `refKind: "nullIter"`; the limit was found as 20 exactly from a case that changes at every iteration). Its
   result gives `icoef` (intercept, log scale(s)) and `loglik[1]`. With a fixed scale, `icoef` is (intercept,
   log(fixed scale)).
5. **Full model.** If `init` is given: of length p (coefficients; the log scales are those of the null fit) or p + k
   (coefficients and log scales; with a fixed scale only length p is allowed); otherwise the coefficients from step 3
   with Z = X and σ_i = the null fit's scale of the observation's stratum, and τ = the null fit's τ. A model whose
   only columns are the intercept (strata allowed) is not fitted twice: the null fit *is* the fit, run with the
   user's `maxiter` (so `loglik[1] = loglik[2]`; R gives the run-out warning twice, once per call; written once).
   A model without intercept still compares with the intercept-only model (`chi` may be negative).
   A degenerate start (v = 0: all centres equal, a single observation) gives σ₀ = 0, log σ₀ = −∞: R then returns
   NA/−Inf/garbage without an error for an intercept-only model and the error `initial iteration failed (use starting
   estimates?)` with covariates (decision 6).

## 5. Newton-Raphson

### 5.1 Factorisation

The generalised Cholesky factorisation, solve and inverse of `oracle/coxph-behaviour.md` step 4, applied to the
information I with tolerance `toler.chol` (default **1e-10**, not coxph's): e = tol × max positive diagonal; a pivot
below e is set to 0; "not non-negative definite" when a pivot is below −8e. (The step and the variances computed
this way agree with R to rounding on every case tried, including singular and indefinite I.)

### 5.2 Step

At a point with score u and information I: factorise I. If it is non-negative definite, δ = I⁻¹u by the
factorisation's solve (a zero pivot gives a zero step in that coordinate: aliased columns stay at their start).
Otherwise δ = B⁻¹u with **B = Σ_i w_i s_i s_i'**, s_i the per-observation score vector (x_i dg/dη, and dg/dτ in its
stratum's position). (Confirmed against R from starting values where I is indefinite: the first step matches B⁻¹u to
1e-13, and Σ w s s' — not Σ w² s s' — with fractional weights. How R solves B is not observable beyond rounding.)

### 5.3 Iterations

```
β ← start; evaluate ℓ, u, I at β (iteration 0); best ← ℓ; trial ← β + δ(β)
for it = 1 .. maxiter:
    evaluate ℓ_new (and u, I) at trial
    if ℓ_new is finite and |1 − best/ℓ_new| ≤ rel.tolerance:     converged: β ← trial, ℓ ← ℓ_new, iter = it; stop
    if ℓ_new is not finite or ℓ_new < best:                       reject:
        trial ← β + (trial − β)/3
        for each log scale: trial_τ ← max(trial_τ, β_τ − 1.1)
    else:                                                          accept:
        β ← trial; best ← ℓ_new; trial ← β + δ (from this evaluation)
```

Notes (each confirmed by experiment): the convergence test comes first and compares with the best value, so a point
worse than the start ends the iteration when the relative change is small (fixture: `maxiter 1, rel.tolerance 0.5`
from R's own start returns the worse first trial point); repeated rejections shrink geometrically (1/3, 1/9, 1/27 of
the original step); the floor `β_τ − 1.1` applies only after a rejection and only downwards (a log scale may rise
by any amount, and the accepted full steps are never limited: a first step of −4.05 in log σ was taken). The
starting values with `maxiter = 0` are not iterated at all.

### 5.4 Result

- Converged: the converged point, `iter` = it, `loglik[2]` = its ℓ plus the Jacobian.
- Ran out (it reached maxiter): `iter = maxiter`; if the last iteration accepted its point, **R evaluates the next
  trial point β + δ and returns it when its ℓ is ≥ best, else β**; if the last iteration rejected, it returns β.
  `loglik[2]` is best (of β, not of the returned point) plus the Jacobian. Warning `Ran out of iterations and did not
  converge` when maxiter ≥ 2 (none with maxiter 1; checked with several data sets, as in coxph).
- `maxiter = 0`: the start, its ℓ, iter 0, no warning. `maxiter < 0`: R returns `iter = −1` and a different point
  (fixture case; decision 7).
- The variance and the score are computed **at the returned point**: `var` = the generalised inverse of I there
  (section 5.1; rows and columns of zero pivots are 0), `score` = u there (`survreg(score = TRUE)`; fixture field).
- A coefficient is NA where its variance diagonal is 0 (aliased column; also every coefficient when all are
  unidentifiable, as with no events under the normal distribution). Log scales are never NA.

## 6. Arithmetic and R's substitutes for underflow

R evaluates the extreme value, logistic and normal families in compiled code **in the linear domain**: it computes
F, S, f and takes logarithms, so log-likelihood terms lose digits when f or P is subnormal (normal exact |z| > 37.5;
normal censored |z| > 37.5; extreme left-censored F = 1 − exp(−w) loses digits from z < −15 and is 0 below z ≈ −37.4;
the extreme interval difference likewise). For exact observations the derivatives use the closed forms h₁, h₂ (not
ratios of subnormal numbers). Further, observed rules (with σ = 1, 2, 3, 4 and all four statuses):

- extreme value: w = exp(max(z, −200)) (z clamped at −200 for w only: an exact observation with z < −200 has g =
  −200 − log σ while dg/dτ = −z h₁ − 1 uses the true z);
- logistic: w = exp(−|z|) (no overflow for z up to 709: g = −|z|-like values are exact; f underflows only beyond
  |z| ≈ 745);
- interval probability: F(z_u) − F(z_l), from the upper tails S(z_l) − S(z_u) when z_l > 0.
- **When the computed f (exact) or P (censored) is 0**, the observation contributes g = **−200** (no −log σ) and:
  exact dg/dη = −z/σ, d²g/dη² = −1/σ; right censored dg/dη = z/σ; left censored dg/dη = −z/σ; interval dg/dη = **1**;
  all other derivatives 0 (dg/dτ, d²g/dτ², d²g/dηdτ, and d²g/dη² for censored). The signs for exact and left
  censored observations point *away* from the data, and the interval value does not depend on z or σ.

A re-implementation following sections 3 to 6 reproduced R's results in 291 of 300 random poor starting points
(lung data, weibull/lognormal/loglogistic, log σ from −3 to 2.5, maxiter 2 to 30); of the nine others, seven are
normal-distribution starts with log σ₀ < −2 (many censored terms subnormal; differences 5e-5 to 1e-3) and two
weibull starts (one 1e-6, one where R returns an NA coefficient); they could not be resolved. The t distribution is evaluated by R-level code (as `survreg.distributions$t$density` returns F, 1 − F, f,
f'/f, f''/f); its behaviour in the underflow region was not examined.

## 7. Fit results

| field | value |
|---|---|
| `coefficients` | β (NA as in 5.4), named by the columns of X |
| `scale` | exp(τ) per stratum (names `strata=level`), or the fixed scale |
| `icoef` | null fit (intercept, log scale(s)) |
| `var` | (p + k) × (p + k) (p × p with a fixed scale), order β then τ₁..τ_k |
| `loglik` | [null, model] ℓ + Jacobian, Jacobian = −Σ_{exact} w log t for log distributions, 0 otherwise |
| `iter` | section 5.4 |
| `df` | p (aliased columns included) + number of estimated scales |
| `idf` | 1 + number of estimated scales |
| `df.residual` | n − df (can be negative: one observation) |
| `n` (summary) | rows used (not Σ w) |
| `linear.predictors` | Xβ + offset (with an aliased column: not determined how R forms the start of the aliased coordinate; the fixture has one such case) |
| `means` | unweighted column means of X (intercept 1) |

Summary table rows: the coefficient names, then `Log(scale)` (one stratum) or the strata labels (e.g. `sex=1`); no
scale rows for a fixed scale (exponential, rayleigh, `scale > 0`). Value; Std. Error = √var_jj (0 for NA); z =
value/SE (NaN for NA rows); p = 2 Φ(−|z|) (bitwise `2*pnorm(-abs(z))`, not the chi-squared tail). `chi = 2(loglik[2]
− loglik[1])`, on `df − idf` degrees of freedom, p = upper chi-squared tail (as `print.survreg`; `summary` keeps only
`chi`).

Powers of two: scaling a covariate by 2^k scales its coefficient by 2^-k and changes nothing else (bitwise, same
iterations). Scaling times by 2^k shifts the intercept by k log 2 (log distributions) or scales coefficients and σ
(untransformed), within rounding (≤ 4e-15), with the same iterations.

## 8. Options and their checks (R)

- `scale`: 0 (default) estimates; > 0 fixed; < 0 error `Invalid scale value`. With strata and a fixed scale: error
  `The scale argument is not valid with multiple strata`. With exponential/rayleigh a given scale is ignored with the
  warning `Exponential has a fixed scale, user specified value ignored` (the name is the distribution's).
- `init`: lengths in section 4; otherwise `Wrong length for initial parameters`.
- `parms`: only for t (`Degrees of freedom must be >=3` below 3); for other distributions `Extreme value
  distribution has no optional parameters` (the base family's name).
- `control`: `maxiter` (default 30; `iter.max` is a synonym), `rel.tolerance` (1e-9; 0 iterates until ℓ is exactly
  unchanged; negative never converges), `toler.chol` (1e-10; 0 and negative accepted by R), `outer.max` (10; only for
  penalised terms, no effect here), `debug`. None is checked by R.
- `robust`, `cluster` (sandwich variance), penalised terms (`pspline`, `frailty`, `ridge`), user-defined
  distributions and `survreg(..., x, y, model)` are outside this specification (decision 1).

## 9. Predictions (`predict.survreg`)

Checked to 1e-15 on every distribution, strata, fixed scale and offset (fixture `survregPredict`). With V the full
variance and η = x'β + offset (new data: their offset):

- `lp`, `linear`, `link`: η; se = √(x' V_ββ x).
- `response`: itrans(η) (e^η for log distributions; η otherwise) — **not the mean or median** of the distribution;
  se = se(η) × e^η for log distributions.
- `uquantile` with p: q = η + z_p σ (z_p the base quantile, σ of the row's stratum); se = √(c' V c), c = (x, z_p σ
  in the position of that stratum's τ) (just x with a fixed scale).
- `quantile`: itrans(q); se = se(q) × e^q for log distributions. p = 0 and 1 give 0 and Inf (log distributions).
- Default p = (0.1, 0.9). One p: a vector; several: n × length(p) rows.
- New data with a missing covariate give NA (`na.action = na.pass`). With strata in the model, new data must have
  the stratum (R's error otherwise: `object 's' not found`, with R's variable name).

## 10. Residuals (`residuals.survreg`)

Unweighted by default; `weighted = TRUE` multiplies every type by w_i (fixture). With the per-observation derivatives
of section 3 at the fit (no Jacobian), s_i = (x_i dg/dη, dg/dτ in the stratum's position) and V the variance:

- `matrix`: n × 6, columns `g, dg, ddg, ds, dds, dsg` = g, dg/dη, d²g/dη², dg/dτ, d²g/dτ², d²g/dηdτ.
- `dfbeta`: s_i' V (rows; parameters including the log scales); `dfbetas`: divided column-wise by √diag(V).
- `ldcase`: s_i' V s_i. `ldresp`: d_i' V d_i with d_i = σ (−x_i d²g/dη², −d²g/dηdτ). `ldshape`: e_i' V e_i with e_i =
  (x_i d²g/dηdτ, d²g/dτ²).
- `working`: −(dg/dη)/(d²g/dη²).
- `response`: ŷ₀ − itrans(η) on the original time scale, ŷ₀ = the time for exact, right and left censored rows; for
  an interval, itrans of its "centre": the midpoint of (y_l, y_u) for the symmetric families, and for the extreme
  value family y_l − σ log(b/(e^b − 1)), b = (y_u − y_l)/σ (vignette).
- `deviance`: sign × √(2 (g_max − g)), g_max: exact `log f(0) − log σ` (extreme −1, logistic −log 4, normal
  −½ log 2π, each − log σ), censored 0, interval `log(exp(−e^a) − exp(−e^{a+b}))` with a = log(b/(e^b − 1))
  (extreme), `log((e^{b/2} − 1)/(e^{b/2} + 1))` (logistic), `log(2Φ(b/2) − 1)` (normal). Sign: + for right censored,
  − for left censored, sign(y − η) for exact, sign(centre − η) for intervals.

**R is wrong for interval-censored rows** (fixture `refKind: "intervalDerivs"`): its `ds`, `dds`, `dsg` columns are
not the derivatives of g (wrong sign of ds; R's `ds` column does not sum to 0 at the maximum, e.g. 4.96 where the
correct column sums to 3e-11), and dfbeta, dfbetas, ldcase, ldresp, ldshape built from them are wrong in those rows;
`working` and the other columns are right. For the extreme value family R's interval centre is y_l − log(b/(e^b − 1))
**without the factor σ** (outside the interval when σ < 1), so its interval response and deviance residuals are wrong
unless σ = 1 (`refKind: "extremeCentre"`; R's deviance formula for these rows could not be identified). Types
`ldresp`/`ldshape` follow Escobar and Meeker; "terms" predictions and `collapse` are not covered.

## 11. Errors and warnings (verbatim, from R)

Errors: `Invalid survival times for this distribution`, `Invalid weights, must be >0`, `Invalid scale value`,
`Wrong length for initial parameters`, `The scale argument is not valid with multiple strata`, `Degrees of freedom
must be >=3`, `Extreme value distribution has no optional parameters`, `initial iteration failed (use starting
estimates?)` (zero-width intervals, an infinite time under the normal distribution, identical times with
covariates), `start-stop type Surv objects are not supported`, `data contains an infinite predictor`, `'arg' should be
one of “extreme”, “logistic”, “gaussian”, “weibull”, “exponential”, “rayleigh”, “loggaussian”, “lognormal”,
“loglogistic”, “t”` (curly quotes).
Warnings: `Ran out of iterations and did not converge`, `Exponential has a fixed scale, user specified value ignored`,
`Invalid status value, converted to NA`, `Invalid interval: start > stop, NA created`, `NaNs produced` (before the
error for negative times).

## 12. Boundaries (fixture `survreg`) and where R is wrong or inaccurate

- One event: finite fit (monotone in a 0/1 covariate: coefficients grow until the tolerance stops them, 23
  iterations). Separation likewise (21 iterations, SE ~1e4).
- No events: no maximum. Intercept-only: R "converges" (ℓ → 0, iter 14); with covariates R runs out after 30
  iterations with **loglik −1058 far below the null's −4e-10** (the −200 substitutes); normal: every coefficient NA,
  ℓ = 0.
- All left censored: as no events. Identical exact times, one observation: degenerate start (section 4). Two
  observations: fine.
- Aliased column: NA, var row/column 0, still in `df`. No intercept: compared with the intercept-only model.
- `maxiter = −1`: iter −1.
- Fixed scale 0.7 with the extreme value distribution on raw times: many exact terms underflow; the intercept-only
  model stops after 20 iterations at ℓ = −405.71 where its maximum is −257.11 (`refKind: "nullIter"`, reference
  `loglik1`). Fixed scale 1.3 with the normal distribution on raw lung times: R runs out at ℓ ≈ −36109 (substitutes
  throughout; no reference written).

| where | R | fixture |
|---|---|---|
| intercept-only model inside a fit | stopped silently after 20 iterations | `nullIter` |
| interval rows of residuals built from ds, dds, dsg | wrong derivatives | `intervalDerivs` |
| extreme value interval response/deviance residuals | centre not scaled by σ | `extremeCentre` |
| underflowing terms | −200 and ad hoc derivatives (section 6) | cases without reference |
| degenerate starts (σ₀ = 0) | NA/−Inf without error | decision 6 |

## Accuracy

The re-implementation from this text agreed with R to ≤ 1.2e-15 (coefficients, relative) and ≤ 8e-16 (log-likelihood)
with identical `iter` on 62 fits: every distribution, right/left/interval censoring, integer and fractional weights,
offsets, strata, fixed scales, `init` of both lengths, and far starting values with BHHH steps, rejections and the
log-scale floor; and in 291/300 poor starts (section 6). R's converged coefficients are the iterate at the convergence
test (with the default tolerance within ~1e-10 of the maximum on lung: rel.tolerance 0 moves them by 6e-11).
Proposed test tolerance: 1e-12 relative value by value for fits from R's start (as coxph), with the same `iter`; the
fixtures come from x86_64 R.

## Decisions for the user

1. **Scope and API.** Proposal: `survreg(time, event, x, { type, time2, dist, weights, offset, strata, scale, init,
   parms, control: { maxiter, relTolerance, tolerChol }, confLevel })` in the matrix style of `coxph` (x without the
   intercept, `intercept` option default true), returning `{ coefficients, scale, icoef, var, loglik, iter, df, idf,
   dfResidual, n, linearPredictors, means, score?, table: { value, se, z, p }, rowNames, chi, chiDf, chiP, dist,
   warnings }` (names camelCase; R's where they exist). Leave out robust/cluster, penalised terms, user distributions
   (recommended; robust could follow coxph's later). Alternative (b): an object with methods `predict`/`residuals`.
2. **Strata (separate scales):** (a) support (recommended; small extra cost, R's vignette example); (b) leave out.
3. **Residuals:** (a) none in 1.4.0; (b) response, deviance, working, dfbeta(s) only; (c) all types including
   ld* and matrix (recommended: (b) or (c)); and for interval-censored rows (d) R's values or (e) the correct ones
   (recommended (e), recorded in differences-from-r, as the "right value only where R is wrong" rule).
4. **Predictions:** `predict(fit, { type: "lp" | "response" | "quantile" | "uquantile", p, newX, newStrata,
   newOffset, seFit })`; "terms" left out (recommended). Alias names `linear`/`link`: keep only `lp`? (recommended:
   accept R's names).
5. **Underflow substitutes (section 6).** (a) Reproduce R (linear-domain arithmetic, −200 terms, the odd derivatives)
   so iteration paths match R from any start; (b) compute in the log domain (accurate) — differs from R only when a
   term underflows at some iterate, mostly from poor `init`; (c) (a) for the iterations but report an accurate
   `loglik`. Recommendation: (b) with fixture tolerance on the affected cases (`refKind`), because R's substitutes can
   change the maximum itself; if bit agreement from R's default start is preferred, (a).
6. **Degenerate data** (all times equal, n = 1 with σ estimated, no events, all left censored): R returns NA/−Inf or
   a non-converged fit without an error. Proposal: throw (`no events`, `scale cannot be estimated`), per Design rule 1;
   keep R's behaviour for one event and separation (finite but huge, with the warning when it runs out).
7. **Control checks:** throw for maxiter < 0, non-finite or negative tolerances (R accepts them; maxiter −1 gives
   iter −1).
8. **Null model limit:** keep R's silent 20-iteration limit for `loglik[1]` (bit agreement) or iterate the
   intercept-only model with `maxiter` and warn (correct; recommended only together with 5(b)).
9. **t distribution:** include (`parms` → option `df`, default 4) — recommended; it is built in.
10. **The intercept-only run-out warning** that R gives twice: once (Design rule 10, recommended).
11. **Weights:** non-integer weights are case weights here (no switch to a robust variance, unlike coxph): keep
    (recommended), as R.

## rStats.js's choices

Decided by the user on 2026-11-09. Binding. Every numbered decision above is taken as recommended in this document, and where R is wrong rStats.js returns
the correct values: densities and probabilities computed in the log domain (no -200 substitutes or clamping), the
intercept-only model iterated to convergence (not silently capped at 20), correct residuals for interval-censored
rows (and the extreme-value interval centre with its factor sigma). On ordinary data the iteration and values are
R's. All such differences are documented in docs/differences-from-r.md and tested against references.
