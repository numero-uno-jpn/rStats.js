# survfit continued and the restricted mean survival time (rStats.js 1.4.0): the behaviour to reproduce

This file describes, in words and formulas, what the R functions below compute, for an implementation that must not
read their source. It was written **without reading the source code** of R or of the packages (clean room): from the
help pages, the vignettes (survival's `methods`, `validate`, `survival`; survRM2's vignette), the papers they cite,
and experiments with R's output. Every formula below was re-implemented independently in R and agrees with the
packages on the fixtures: survfit's cumulative hazards, survival curves, rmean and se(rmean) to 4e-16 relative on all
131 unweighted and integer-weighted cases of `survfit2`; the infinitesimal-jackknife (robust) standard errors to the
accuracy of a numerical derivative (1e-10); rmst2's unadjusted RMST and se to 3e-16; rmst2's adjusted coefficients and
standard errors to 2e-13 relative (7e-12 for a coefficient near 0). Where this file and a fixture seem to disagree,
report it instead of working around it. Where a behaviour could not be determined without the source, this file says
so.

| package | version | functions |
|---|---|---|
| R | 4.6.2 | |
| survival | 3.8-12 | `survfit` (formula method; `survfitKM` underneath), `summary.survfit` (`$table`, `rmean`, `scale`), `print.survfit` |
| survRM2 | 1.0-4 | `rmst2` |

Oracles and fixtures (`npm run oracle -- <name>`):

| oracle | fixture | cases | platform | time |
|---|---|---|---|---|
| `oracle/survfit2.R` | `survfit2` | 196 (13 errors) | arm64 (as `oracle/survival.R`) | 1 s |
| `oracle/rmst.R` | `rmst2` | 58 (10 errors) | x86_64 (`# oracle-platform: amd64`, as `oracle/coxph.R`: it uses `solve()` and IRLS) | 15 s |

Fixture conventions. The arguments keep R's names (`time`, `status`, `group`, `weights`, `ctype`, `stype`,
`conf.type`, `conf.int`, `robust`, `rmean`, `scale`; `arm`, `tau`, `alpha`, `covariates`, `covariateNames`) because
the API is not decided. All numbers are strings (`"NA"`, `"NaN"`, `"Inf"`); `rmean` is either one of `"none"`,
`"common"`, `"individual"` or a number written as a string. A matrix (`covariates`) is an array of rows. A table
(`summary(fit)$table`, rmst2's result matrices) is `{colNames, rowNames, table}` with one array per row. Every case
has `warnings` (R's, each once) or `{"error": message}`. Where R is wrong or inaccurate the case has a `reference`
(and, in `survfit2`, an argument `refKind`; in `rmst2`, `refKind` inside the reference); see "Where R is wrong or
inaccurate". The headers of the two oracles list the fields.

Notation (one curve; the curves of `group` are computed separately). The observations are `(x_i, δ_i, w_i)`: time,
status (1 event, 0 censored), case weight (1 without weights). At each distinct time `t` (events and censorings):
`n(t) = Σ_i w_i [x_i ≥ t]` (weighted number at risk), `d(t) = Σ_i w_i [x_i = t, δ_i = 1]` (weighted events),
`e(t) = #{i : x_i = t, δ_i = 1}` (unweighted events, **including rows of weight 0**), `c(t)` the weighted censorings.
`z = qnorm(1 − (1 − conf.int)/2)` (rStats.js already takes the upper tail for α/2 < 1e-8). eps = 2^-52.

## Easy to get wrong

1. **`std.err` of a survfit object is not one quantity.** Without the robust variance it is the standard error of
   log S for stype 1 (Greenwood) and of the cumulative hazard H for stype 2, and `logse` is TRUE; with the robust
   variance (non-integer weights by default) it is the standard error **of S itself** and `logse` is FALSE.
   `summary(fit)$std.err` (the existing `stdErr` of rStats.js) is always meant as the standard error of S: `S ×
   std.err` when `logse`, `std.err` otherwise (section 4). The confidence limits always use se(log S) =
   `std.err` when `logse`, `std.err/S` otherwise.
2. **Non-integer case weights switch R to the robust (infinitesimal jackknife) variance** for every standard error of
   the curve (std.err and std.chaz), not only for S. Integer weights keep the model-based formulas with weighted
   counts (identical to replicating rows). `robust = TRUE/FALSE` overrides the default (section 5).
3. **R's robust variance is wrong for `stype = 2`:** `std.err` holds the standard error of H (= of log S), but
   `logse` is FALSE, so `summary()$std.err` and the confidence limits treat it as the standard error of S (upper
   limit 1 almost everywhere). Fixture `refKind: "robustStype2"`.
4. **The Fleming-Harrington increment uses the unweighted count e of tied events**, splitting the weighted d into e
   equal parts: `Σ_{k=0}^{e−1} (d/e)/(n − k d/e)`. Rows of weight 0 count in e, so a zero-weight event changes the
   FH estimate (R: 0.2469 instead of 0.2448 in the fixture). The Nelson-Aalen variance is `Σ d/n²` (not
   `d(n − d)/n³`), FH's `Σ_k (d/e)/(n − k d/e)²`.
5. **rmean integrates from t0 = min(0, smallest time over all curves)** (not from the first time of the curve); a
   numeric rmean below the **smallest time of the whole fit** is an error (`Truncation point for the mean time in
   state is < smallest survival`), even when it is above t0 (rmean = 0.5 with times from 1 on; with strata, the
   smallest time of any curve, not of each curve). Beyond the end of a curve, its last value of S is extended.
6. **summary's table includes rmean by default ("common")**, print's does not. "common" uses the largest time of all
   curves (censored times included), "individual" the largest time of each curve.
7. **se(rmean) is always the Greenwood-type formula with the weighted counts**, also when the curve itself has the
   robust variance; terms with `n = d` (the last event when everyone left dies) are dropped (their A is 0; 0 × Inf is
   not formed). stype 2 uses the curve exp(−H) in the areas A but the same Greenwood terms `d/(n(n − d))`.
8. **Rows of weight 0 still make rows of the fit** (their times are distinct times, with `n.risk` possibly 0 at the
   end) and count in `records` and `fit$n`, but not in `n.max`, `n.start`, `events` (weighted).
9. **rmst2's default τ is not simply min(max time of each arm).** The last observation of an arm counts as an event
   only if every observation at its largest time is an event (a tie of event and censoring counts as censored). Both
   last observations events: τ = max of the two largest times; otherwise τ = the smallest largest time among the
   arms whose last observation is censored. A given τ above this default is an error.
10. **rmst2's adjusted analysis estimates the censoring distribution separately in each arm**, recodes observations
    with time ≥ τ as events at τ (so a censoring exactly at τ is *not* a censoring), weights by 1/Ĝ(Y) with Ĝ
    right-continuous, and uses an **unweighted** derivative matrix A = Σ Z Z' ġ in the sandwich (section 10).
11. **rmst2's p-values are `1 − pchisq(z², 1)`**: 0 below about 1e-16, relative error 1e-6 at p = 1e-10 (fixture
    `refKind: "pvalue"`). The ratio contrasts are formed on the log scale as `log(r₁) − log(r₀)`.
12. **rmst2 integrates from 0**, also when times are negative (survfit integrates from min(0, smallest time)); a τ at
    or below 0 is not an error (RMST = τ, NaN p-values).

---

# Part 1: `survfit` for right-censored data

## 1. Input

`survfit(Surv(time, status) ~ group, weights, ctype = 1, stype = 1, conf.type = "log", conf.int = 0.95, robust)`.
The existing `survfit` of rStats.js (src/models/survival.ts) already reproduces the data handling (rows with a
missing value dropped, times merged as `timefix = TRUE`, groups sorted as R's factor levels, `"group=<label>"`
strata names). Additional checks, in R's words:

| input | R |
|---|---|
| a weight < 0 | error `weights must be non-negative` |
| a weight ±Inf | error `weights must be finite` |
| a weight NA | the row is dropped (`n` 11 of 12) |
| all weights 0, or every weight of a group 0 | no error: rows with `n.risk` 0, S = 1, se 0, limits 1; table `n.max` 0, `events` 0, rmean = the upper limit − t0, median NA |
| ctype or stype not 1 or 2 (0, 3, `"a"`, NA) | error `ctype must be 1 or 2` / `stype must be 1 or 2` |
| conf.int ≤ 0 or ≥ 1 (also 95) | error `confidence intervals must be between 0 and 1`; NA: `missing value where TRUE/FALSE needed` |
| conf.type not one of the six | error `'arg' should be one of “log”, “log-log”, “plain”, “none”, “logit”, “arcsin”` (an unambiguous prefix is accepted: `"p"` is plain) |

No warnings arise anywhere in the `survfit2` fixture.

## 2. The cumulative hazard (`cumhaz`, `std.chaz`) and `ctype`

At every distinct time `t` (rows at censoring-only times repeat the previous values), with the sums over event times
`s ≤ t` with d(s) > 0:

- ctype 1, Nelson-Aalen: `H(t) = Σ d/n`, `std.chaz² = Σ d/n²`.
- ctype 2, Fleming-Harrington: `H(t) = Σ_s Σ_{k=0}^{e−1} (d/e)/(n − k d/e)`, `std.chaz² = Σ_s Σ_{k=0}^{e−1}
  (d/e)/(n − k d/e)²` (Easy to get wrong 4). Without weights this is `1/n + 1/(n−1) + … + 1/(n−d+1)` and
  `Σ 1/(n−k)²`. With integer weights the result differs from replicating the rows (the replicated rows have a larger
  e); the fixture has both.

Checked: 3 events tied at the only time, n = 3: H = 1/3 + 1/2 + 1 = 1.8333, std.chaz = sqrt(1/9 + 1/4 + 1). When all
at risk die (d = n) H is finite.

## 3. The survival curve and `stype`

- stype 1: the Kaplan-Meier `S(t) = Π (1 − d/n)` (ctype changes only `cumhaz`); `std.err = sqrt(Σ d/(n(n − d)))`
  (Greenwood, weighted counts; Inf once d = n), `logse` TRUE.
- stype 2: `S(t) = exp(−H(t))` with the H of ctype; `std.err = std.chaz`, `logse` TRUE. S never reaches 0, so the
  limits and the median exist after a d = n time (fixture: single event, `S = e^-1`, limits [0.0518, 1]).
- `summary(fit, censored = TRUE)$std.err` = S × std.err (the existing `stdErr`).

R's old `type` argument ("kaplan-meier", "fleming-harrington" = stype 2 ctype 1, "fh2" = stype 2 ctype 2) is
deprecated; not covered.

## 4. Confidence limits (`conf.type`)

With `se = std.err` (logse) or `std.err/S` (robust) the standard error of log S, and `sp = S·se`:

| conf.type | lower, upper |
|---|---|
| log (default) | `S exp(−z se)`, `min(1, S exp(z se))` |
| log-log | `exp(−exp(log(−log S) − z se/log S))`, `exp(−exp(log(−log S) + z se/log S))` |
| plain | `max(0, S − z sp)`, `min(1, S + z sp)` |
| logit | with `l = log(S/(1 − S))`, `h = z sp/(S(1 − S))`: `1 − 1/(1 + exp(l − h))`, `1 − 1/(1 + exp(l + h))` |
| arcsin | with `a = asin(sqrt S)`, `h = z sp/(2 sqrt(S(1 − S)))`: `sin²(max(0, a − h))`, `sin²(min(π/2, a + h))` |
| none | no `lower`/`upper` (and no LCL/UCL columns in the table) |

These are the transformations of the `methods` vignette, confirmed on every fixture case; stype 2 uses the same
formulas with se = std.chaz. Boundaries (from the fixture):

- S = 0 with se = Inf (Greenwood after d = n): NA for log, log-log, logit, arcsin; **NaN for plain** (as the existing
  code).
- S = 1 with se = 0 (before the first event, or all censored): 1 and 1 for log, log-log, logit, plain; **NaN for
  arcsin** (0/0 in h).
- S = 0 with the robust se = 0: 0 and 0 for log, log-log, plain, logit; NA for arcsin.

## 5. Weights and the robust variance

Integer weights (and `robust = FALSE` with any weights): every formula above with the weighted n, d, c; this equals
replicating the rows for KM, Greenwood and Nelson-Aalen, not for FH (section 2). `counts` holds the unweighted
n.risk, n.event, n.censor; `fit$n` is the unweighted number of rows per curve.

Robust (infinitesimal jackknife, IJ): the default when **some weight is not an integer** (the help page: also with
`cluster` or `id`, not in scope); `robust = TRUE` forces it, `robust = FALSE` turns it off. For an estimate θ(t) (S,
or H) the influence of observation k is the derivative `∂θ(t)/∂w_k` at the observed weights, and `var θ(t) = Σ_k
(w_k ∂θ(t)/∂w_k)²` (the `methods` vignette, "Robust variance"; confirmed against numerical derivatives of the
estimators for KM, NA and FH). Explicitly, with `Y_k(s) = [x_k ≥ s]`, `dN_k(s) = [x_k = s, δ_k = 1]`, `h = d/n`:

- NA: `∂H(t)/∂w_k = Σ_{s≤t} (dN_k(s) − Y_k(s) h(s))/n(s)`.
- KM: `∂S(t)/∂w_k = −S(t) Σ_{s≤t, h(s)<1} (dN_k(s) − Y_k(s) h(s))/((1 − h(s)) n(s))`; where S = 0 the result is 0.
- FH: the derivative of `Σ_{k'=0}^{e−1} (d/e)/(n − k' d/e)` with ∂d/∂w_k = dN_k, ∂n/∂w_k = Y_k (e fixed).
- stype 2: R reports `std.err` = the IJ standard error of H (see Easy to get wrong 3).

Then `std.err` = sd of S (stype 1), `std.chaz` = sd of H, `logse` FALSE. For unit weights the IJ variance of KM equals
Greenwood (the vignette's statement; fixture `robust = TRUE` without weights), but that of NA is `Σ d(n − d)/n³`, not
`Σ d/n²`. `summary()$table`'s se(rmean) does **not** use the IJ variance (section 6.3).

## 6. `summary(fit)$table` (and `print(fit)`)

One row per curve (a named vector for a single curve; the fixture writes rowNames `"all"`), columns in this order:

| column | value |
|---|---|
| records | number of rows of the curve (unweighted, zero weights included) |
| n.max | max of n.risk (weighted) |
| n.start | n.risk at the first time (weighted); equals n.max for right-censored data |
| events | Σ n.event (weighted) |
| rmean, se(rmean) | section 6.3; absent with `rmean = "none"` |
| median, `<conf.int>LCL`, `<conf.int>UCL` | section 6.2; the names are `paste0(conf.int, "LCL")` (`0.95LCL`, `0.9LCL`); LCL/UCL absent with conf.type "none" |

`print(fit)` shows `n` (= n.max, weighted), `events`, the median and its limits, and rmean only when asked
(`print.rmean` / `rmean`; the default option `survfit.rmean` is NULL). Its footnote (`* restricted mean with upper
limit =  8`, `* restricted mean with variable upper limit`) is printing only.

### 6.1 scale

`summary(fit, scale = s)` divides the times, rmean, se(rmean), median and limits by s (fixture: rmean 5 with scale 2 →
1.75; the print footnote shows 2.5). A decision below.

### 6.2 Median

The existing rule (survival-behaviour.md item 5, `curveMedian`) applied to `surv` (so stype 2 uses exp(−H)), to
`lower` and to `upper`. With the robust variance the limits are 0 where S = 0, so the UCL can be finite where it is NA
without weights (fixture: UCL 8 vs NA).

### 6.3 rmean and se(rmean)

`rmean` option: "none" | "common" (default of summary) | "individual" | a number τ.

- Upper limit τ: the number; "common": the largest time of the fit over all curves; "individual": the largest time of
  each curve (censored times included).
- t0 = min(0, smallest time of the fit). A number τ < smallest time of the fit is an error (Easy to get wrong 5); τ =
  the smallest time works (rmean = τ − t0, se 0); τ = 1.0000001 above a first event at 1 gives se 8e-9.
- `rmean = ∫_{t0}^{τ} S(u) du` with S the step function of the curve (S = 1 before its first event, its last value
  beyond its last time). Events at t0 count (fixture `zero`: two observations at time 0, one an event).
- `se(rmean)² = Σ_{event times t_j ≤ τ, n_j > d_j} A_j² d_j/(n_j (n_j − d_j))`, `A_j = ∫_{t_j}^{τ} S(u) du`, weighted
  counts (Easy to get wrong 7). Checked to 4e-16 on the fixture.
- Other values: `"foo"`: `'arg' should be one of “none”, “common”, “individual”`; a vector: `the condition has length
  > 1`; NA: `'arg' must be NULL or a character vector`; Inf: rmean Inf/NaN without error (design rule 1: an error).
- Large times: with times × 2^1000 R's se(rmean) is NaN (A² overflows); fixture `refKind: "scaled"`. Times near the
  bottom of the range are merged by timefix (existing behaviour, as R).

## 7. What the existing `SurvfitResult` needs (proposal; see Decisions)

The existing result has the rows of `summary(fit, censored = TRUE)` (every distinct time of each stratum), which are
exactly the rows of the fit, and `median`/`medianRows`. New per-row fields fit next to them: `cumhaz`, `stdChaz`
(R's `std.chaz`); `stdErr` keeps its meaning (se of S). New options: `weights`, `ctype`, `stype`, `robust`, and the
confType values `"logit"`, `"arcsin"`, `"none"` (with "none", `lower`/`upper` NaN or absent). New per-stratum
fields: `records`, `nMax`, `nStart`, `events`, `rmean`, `seRmean` (with a `rmean` option), next to `median`. With
weights also the unweighted counts (`counts`). Whether `stdErr` should become se of log S, or a second field `logse`
be added, is a decision (1).

---

# Part 2: `survRM2::rmst2(time, status, arm, tau = NULL, covariates = NULL, alpha = 0.05)`

## 8. Input and τ

- `arm` must contain 0 and 1 only. Other codings (1/2, a third value, a single arm) stop with R's unhelpful
  `object 'NOTE' not found` (after warnings `no non-missing arguments to max; returning -Inf`). A logical arm works as
  0/1.
- `status` goes through `Surv`: 0/1, or 1/2 when all values are 1 or 2; another value becomes NA with the warning
  `Invalid status value, converted to NA` (the row then drops out of the curve but not of the τ rule).
- A missing time, status or arm: error `missing value where TRUE/FALSE needed`. A missing covariate: no error, the
  adjusted estimates are computed (with NA dropped by the fit?) but every se, limit and p is NA (fixture). Not
  determinable without the source what exactly is dropped.
- `tau` NA: `missing value where TRUE/FALSE needed`; a vector: `the condition has length > 1`; a string:
  `non-numeric argument to binary operator`.
- Default τ: Easy to get wrong 9 (the help page's cases 1 to 4 in one rule). "Last observation is an event" means
  all observations at the arm's largest time are events (both orders of a tied event and censoring give
  "censored"). Note: `"The truncation time, tau, was not specified. Thus, the default tau  <round(τ, 2)>  is used."`
- A given τ: note `"The truncation time: tau = <τ as paste, 15 significant digits>  was specified."`. τ > default:
  error, `The truncation time, tau, needs to be shorter than or equal to  <round(default, 2)>` when at least one last
  observation is an event, `The truncation time, tau, needs to be shorter than or equal to the minimum of the largest
  observed time on each of the two groups:  <round(default, 2)>` when both are censored (double spaces as R). τ =
  default is allowed.
- τ ≤ 0 or below the first time: no error. RMST = τ (also negative), se 0, the difference 0 with limits 0 and p NaN,
  the ratios 1 or NaN; τ = −1 also warns `NaNs produced`.
- `alpha`: z = qnorm(1 − α/2); the column names are `lower .<round(100(1 − α))>` (`lower .95`, `lower .90`, `.99`;
  α = 0 gives `lower .100` and infinite limits, α = 1.5 `lower .-50`): no check.

## 9. Unadjusted (no covariates)

Per arm g (KM of the arm, as survfit without weights, t0 = **0**): `rmst_g = ∫_0^τ S_g`, `var_g` = the se(rmean)²
formula of section 6.3 with upper limit τ (checked to 3e-16 against `summary(fit, rmean = τ)`). `rmtl_g = τ −
rmst_g` with the same se.

- `RMST.arm1$result` (and arm0): rows RMST, RMTL; columns `Est.`, `se`, `lower .95`, `upper .95`; RMST limits `rmst ∓
  z se`; RMTL limits `τ − (RMST upper)`, `τ − (RMST lower)` (bits); `rmst.var` = var_g; also `rmst`, `rmtl`, `tau`,
  `fit` (the survfit object), not in the fixture.
- `unadjusted.result`, rows `RMST (arm=1)-(arm=0)`, `RMST (arm=1)/(arm=0)`, `RMTL (arm=1)/(arm=0)`, columns `Est.`,
  `lower .95`, `upper .95`, `p`:
  - difference `D = rmst₁ − rmst₀`, `se = sqrt(var₁ + var₀)`, limits `D ∓ z se`, `p = 1 − pchisq((D/se)², 1)`;
  - RMST ratio: `L = log(rmst₁) − log(rmst₀)`, `se = sqrt(var₁/rmst₁² + var₀/rmst₀²)`, `exp(L)`, `exp(L ∓ z se)`, p
    from `L/se` as above;
  - RMTL ratio: the same with rmtl (an RMTL of 0, e.g. no event before τ in an arm, gives 0 and NaN).

## 10. Adjusted (Tian, Zhao & Wei 2014)

With covariates X (a vector: one column named `covariates`; a matrix or data frame: its column names, `""` when
unnamed; a factor column is not supported: R stops with `replacement has 936 rows, data has 312`), `Z_i = (1, arm_i,
X_i)` (row names `intercept`, `arm`, then the covariates):

1. `Y_i = min(x_i, τ)`; `Δ_i = 1` if `x_i ≥ τ`, else `δ_i` (the observation is recoded as an event at τ).
2. Per arm, Ĝ = the Kaplan-Meier estimate of the censoring distribution of `(Y, 1 − Δ)` (censorings are the rows with
   Δ = 0; times merged as survfit? not determinable: no near-ties in the fixtures), right-continuous: `Ĝ(Y_i)`
   includes the censorings at `Y_i` itself (an event tied with a censoring is divided by the smaller value). `w_i =
   Δ_i/Ĝ(Y_i)` (Ĝ(Y_i) > 0 whenever Δ_i = 1).
3. Three models, each solving `Σ_i w_i Z_i (y_i − μ_i) = 0`: difference `y = Y`, `μ = Z'β` (weighted least squares);
   RMST ratio `y = Y`, `μ = exp(Z'β)`; RMTL ratio `y = τ − Y`, `μ = exp(Z'β)`. The log-link solutions agree with
   `glm(family = poisson, weights = w)` at glm's default convergence to 2e-15 and with the exact root to 2e-13; R's
   own iteration (not glm: no warnings about non-integer counts, and a singular design stops with `Lapack routine
   dgesv: system is exactly singular: U[6,6] = 0` on arm64, `system is computationally singular: reciprocal condition
   number = 1.5064e-17` on x86_64) could not be pinned down to the bit without the source.
4. Variance: `V = A⁻¹ B A⁻¹`, **A = Σ_i Z_i Z_i' ġ_i** (unweighted; ġ = 1 for identity, μ_i for log), `B = Σ_i η_i
   η_i'`, `η_i = ε_i + Σ_u q(u)/π(u) (dN_i^C(u) − [Y_i ≥ u] dΛ̂^C(u))` with `ε_i = w_i Z_i (y_i − μ_i)`, the sum over
   the distinct censoring times u of i's arm (recoded data, so u < τ), `q(u) = Σ_{j in the arm, Y_j ≥ u} ε_j`,
   `π(u) = #{j in the arm: Y_j ≥ u}`, `dN_i^C(u) = [Y_i = u, Δ_i = 0]`, `dΛ̂^C(u)` = censorings at u / π(u). (Without
   censoring B = Σ ε ε'.) The variants tried and rejected: Ĝ pooled over arms, Ĝ(Y−), Δ = 0 for a censoring at τ, the
   weighted A, `q` with `Y_j > u`, the opposite sign.
5. Tables `RMST.difference.adjusted`: columns `coef`, `se(coef)`, `z` (= coef/se), `p` (= 1 − pchisq(z², 1)),
   `lower .95`, `upper .95` (coef ∓ z se). `RMST.ratio.adjusted`, `RMTL.ratio.adjusted`: `coef`, `se(coef)`, `z`, `p`,
   `exp(coef)`, `lower .95`, `upper .95` (exp of the limits). `adjusted.result`: the `arm` rows, as `Est.` (coef, or
   exp(coef)), limits, p, with the row names of section 9.
6. With adjusted results the per-arm RMST (`RMST.arm1`, ...) and `unadjusted.result` are not returned.

## 11. Boundaries in the fixtures

survfit2: one observation (event: S 0, se Inf, rmean = its time, se 0, median = the time, limits NA; censored: S 1);
all censored; all tied events at one time (FH); times with ties of event and censoring; events at time 0; negative
times (t0 < 0); a censored last time (S does not reach 0; median NA); a stratum of zero weights; all weights 0;
zero-weight rows at the end (`n.risk` 0); integer, half-integer and random non-integer weights; times × 2^±20 and
2^1000. rmst2: every default-τ case, the τ errors, τ at an event time with n = d (the term is dropped as in section
6.3), τ ≤ 0, an arm without events, ties at τ, censorings at and after τ, no censoring, times × 2^±30 and 2^600,
collinear and missing covariates.

## Where R is wrong or inaccurate

| function | problem | fixture |
|---|---|---|
| survfit, robust, stype 2 | std.err is se(H) but used as se(S): wrong summary std.err and limits | `survfit2` `refKind: "robustStype2"` (reference: summary.std.err = S·std.chaz, limits from se(log S) = std.chaz) |
| summary.survfit rmean | se(rmean) NaN for times ≈ 2^1000 (overflow of A²) | `refKind: "scaled"` (reference: 2^1000 × the unscaled table) |
| summary.survfit rmean | a numeric rmean in [t0, smallest time) stops although the area is defined | `refKind: "rmeanBelowMin"` (R's error as expected; reference table with rmean = τ − t0, se 0) |
| survfit ctype 2 | zero-weight events count in e (the FH split) | none (R's values; a decision) |
| rmst2 | p = 1 − pchisq(z², 1): 0 below ~1e-16, 1e-6 relative error at 1e-10 | `rmst2` `refKind: "pvalue"` (reference p = 2·pnorm(−\|z\|) with R's z), 13 cases |
| rmst2 | var overflows for times ≈ 2^600 (se NaN); the ratio estimates lose 3e-14 there | `refKind: "scaled"` (reference: the unscaled results × 2^600; var Inf as the true value overflows) |
| rmst2 adjusted | the coefficients are the root of the estimating equation to about 2e-13 relative only | tolerance |
| rmst2 | arm codings other than 0/1 stop with `object 'NOTE' not found` | errors |

## Permissively licensed sources

Not read for this document (it is built from experiments); for the implementers:

- lifelines (MIT): `NelsonAalenFitter` (its default variance and tie handling may differ from survival's; compare with
  section 2), `utils.restricted_mean_survival_time` (area under a KM curve).
- statsmodels (BSD-3): `SurvfuncRight` (Kaplan-Meier with Greenwood; no Nelson-Aalen).
- Papers: Nelson (1972), Aalen (1978); Fleming & Harrington (1984, Comm. Statist. 13:2469-86) for ctype 2; Klein &
  Moeschberger (2003) §4.5 for the restricted mean and its variance; Uno et al. (2014, J Clin Oncol 32:2380-2385) for
  the contrasts; Tian, Zhao & Wei (2014, Biostatistics 15:222-233) for the adjusted analysis; the infinitesimal
  jackknife as in the survival `methods` vignette.

## Decisions for the user

1. **API of the extended survfit.** (a) Extend the existing `survfit(time, status, options)` and `SurvfitResult`:
   options `weights`, `ctype` (1 | 2, default 1), `stype` (1 | 2, default 1), `robust`, `rmean`; per-row `cumhaz`,
   `stdChaz`; per-stratum `records`, `nMax`, `nStart`, `events`, `rmean`, `seRmean` (recommended; `stdErr` stays the se
   of S as now, plus a per-row `stdLogSurv`? not needed: lower/upper are given). (b) A separate `nelsonAalen()`
   function returning only the hazard. Recommendation (a), names as R's in camelCase (`ctype`, `stype` keep R's
   names; or `"kaplan-meier" | "exp-hazard"` strings? recommend R's numbers).
2. **confType.** Add `"logit"`, `"arcsin"`, `"none"` (recommended: cheap and R's); with "none", `lower`/`upper` NaN
   arrays (consistent shape, recommended) or absent, and median limits NaN.
3. **Non-integer weights.** (a) As R: robust IJ variance by default, `robust` option (recommended only if wanted;
   it is O(n·d)); (b) model-based (weighted Greenwood) always, `robust` not offered, documented difference;
   (c) throw for non-integer weights as coxph does (`non-integer weights (robust variance) are not supported yet`).
   Recommendation (c) for 1.4.0 unless a user needs survey weights; integer weights supported. If (a): fix R's stype 2
   bug (`reference`, design rule 2).
4. **Zero weights and FH.** Reproduce R's counting of zero-weight events in e (recommended: bits as R; the effect is
   only with ctype 2 and zero weights), or drop zero-weight rows first (then also no rows at their times). A group or
   all weights 0: (i) as R (rows with n.risk 0, rmean = τ − t0), (ii) Error `a group has no positive weight`.
   Recommendation (ii) for all-zero / empty groups (design rule 1), R's values otherwise.
5. **rmean default and options.** (a) Always return `rmean`/`seRmean` with `rmean: "common"` default as summary's
   table (recommended), `"individual"`, a number, `"none"`; (b) only when asked. A number below the smallest time:
   (i) R's error, (ii) the area (reference, recommended: design rule 2, the result is defined). rmean ≤ t0, Inf, NaN:
   RangeError.
6. **scale.** Not offered (recommended; the caller divides) or `scale` option as summary's.
7. **Overflow.** se(rmean) and rmst2 variances: compute with the times scaled by a power of 2 (design rule 10) and
   return the reference values (recommended).
8. **rmst2 API.** Proposal: `rmst2(time, status, arm, { tau, covariates, alpha })` (R's name, as survdiff/survfit
   keep R's names) or `rmst(...)`; `arm` 0/1 numbers or booleans (other values an Error); result
   `{ tau, tauDefault: boolean, arm1: { rmst: {estimate, se, confInt}, rmtl: {...} }, arm0, difference, ratio,
   rmtlRatio (each { estimate, confInt, pValue }), confLevel, warnings }` and with covariates `{ adjusted: {difference,
   ratio, rmtlRatio}, coefficients: { difference, ratio, rmtlRatio } (each { names, estimate, se, z, pValue, confInt
   }) }`. Keep the `note` string? Recommend no (tauDefault instead). `alpha` → `confLevel` (rStats.js style)?
   Recommend `confLevel` (0.95), with α = 1 − confLevel.
9. **rmst2 p-values.** 2·pnorm(−|z|) (reference, recommended) or R's 1 − pchisq.
10. **rmst2 degenerate input** (design rule 1): τ ≤ 0 or τ below the first time (R: zero se, NaN p) → RangeError;
    τ > default → RangeError with R's message (single message form recommended: "'tau' must be at most <τ>: the
    minimum of the largest times ..."); negative times: Error (R integrates from 0 while survfit uses t0) —
    recommended; an RMTL of 0 (NaN ratio) → NaN as R or Error? recommend NaN entries with no error (the other contrasts
    are valid); NA in time/status/arm → drop rows as survfit (R errors) or Error? recommend drop, consistent with
    survfit; NA covariates: drop the row (R: NA results) — recommended.
11. **Adjusted analysis scope.** (a) Include (recommended, user's scope); categorical covariates by the caller's
    dummy coding (matrix input only); collinear covariates → Error. The solver: Newton on the estimating equation to
    full convergence (agrees with R to ~2e-13); tests at 1e-11 relative to max(|coef|, se) for the adjusted tables.
12. **Tolerances.** survfit2: 1e-13 relative (R's values agree with the formulas to 1e-15; the IJ se to 1e-13 assumed,
    not checked beyond numerical derivatives); rmst2 unadjusted 1e-13; adjusted as 11; references where present.

## rStats.js's choices

Decided by the user on 2026-11-09. Binding. Every numbered decision above is taken as recommended in this document (the recommended option of each).
In particular: survfit gains the options ctype, stype, weights, robust and rmean and the confType values "logit",
"arcsin" and "none", the per-row fields cumhaz and stdChaz and the per-stratum table fields; non-integer weights
throw for now (as coxph did before its robust variance); rmst2's p-values are the accurate 2 pnorm(-|z|), not R's
1 - pchisq; where R is wrong (robust stype 2 limits, overflow at large times) the reference values are returned and
the difference is documented.
