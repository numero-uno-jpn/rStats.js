# Generalised linear mixed models (lme4's glmer): the behaviour to reproduce

This file describes, in words, what lme4 2.0.6 (with reformulas, Matrix 1.7.4, R 4.5.2) computes, for an
implementation that must give the same results without reading their source. It was written by reading that source
and checking it against R's output. lme4 is GPL: implement the method from the paper below and this file, not from
lme4's code. Where this file and a fixture seem to disagree, report it instead of working around it: the fixture may
be wrong.

The method: D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4",
Journal of Statistical Software 67(1), doi:10.18637/jss.v067.i01 (open access), whose notation is used here as in
`oracle/lmer-behaviour.md`: `b = Λ_θ u`, `u` the spherical random effects, `Z`, `X`, `θ`, `β`. The paper treats
linear models in detail; for the generalised case this file is the specification. Everything that glmer shares with
lmer (the formula, the model frame, `X`, `Z`, `Λ_θ`, the order of the terms, the initial `θ` and its bounds) is
specified in `oracle/lmer-behaviour.md` (stage 1a) and not repeated here; the glm families, links, deviance
residuals and starting values are those of `oracle/glm-behaviour.md` except where this file says otherwise.

The work is done in stages; each stage has its own section and fixture:

- **Stage 2a**: this specification of the structure (what differs from lmer) and of the Laplace deviance, with the
  oracle `oracle/glmerdev.R` and its fixture `glmerDeviance`.
- **Stage 2b**: the Laplace deviance at given parameters (internal, nothing exported), tested against
  `glmerDeviance`.
- **Stage 2c** (with 2d, merged): the fit and its results for all families with `nAGQ = 1` and `nAGQ = 0`, exported
  as `glmer` from the area `mixed`, with the oracle `oracle/glmer.R` and its fixture `glmer`.
- **Stage 2e**: adaptive Gauss-Hermite quadrature, `nAGQ > 1`, with the oracles `oracle/glmeragqdev.R` (the
  deviance at given parameters, fixture `glmerAgqDeviance`) and `oracle/glmeragq.R` (the fit, fixture `glmerAgq`).
- **Stage 3**: `glmerSummary` and `glmerAnova`.
- **Stage 4**: `predict`.

## Easy to get wrong

1. **The deviance is not the sum of the deviance residuals.** lme4's Laplace deviance is `log det(L_θ L_θ') + ‖u‖² +
   aic`, where `aic` is the glm family's `aic` term (−2 log-likelihood, not the deviance): for the binomial family
   it includes `log choose(m, k)`, for poisson `log y!`. PIRLS, on the other hand, minimises the *penalised deviance*
   `Σ d_i + ‖u‖²` with the deviance residuals `d_i`. The two differ by a term that does not depend on `u` only for
   the families without a scale parameter.
2. **Families with a scale parameter (Gamma, inverse.gaussian, gaussian) have no scale in the deviance function's
   parameters**: the dispersion is estimated inside the `aic` term as `D / Σw` (D the sum of the deviance residuals
   at the current means, Σw the sum of the prior weights), and the `aic` term includes the constant **+2** that R's
   family `aic` adds for the scale parameter. Neither the PIRLS weights nor the penalty `‖u‖²` involve the scale.
3. **The log determinant uses the working weights of the conditional mode.** lme4 itself computes it with the
   weights of the means *before* its last PIRLS update and stops PIRLS early (relative change of the penalised
   deviance below 1e-7), so its deviance is off by up to about 5e-6 (relative) and its `u` by up to 2e-4 (relative
   to the largest element) in the fixture. The fixture's reference is the exact conditional mode; see "Accuracy".
4. **With `nAGQ = 1` the fixed effects are not estimated by PIRLS**: the deviance is a function of `(θ, β)`, with
   `Xβ` added to the offset and PIRLS solving for `u` only. With `nAGQ = 0` it is a function of `θ` only and PIRLS
   solves for `u` and `β` jointly (the `β` is then the one of the penalised IRLS, not a maximum likelihood estimate).
   In both cases there is **no** `log det(R_X)` term (unlike lmer's REML criterion).
5. **lme4's link and variance functions are its own**, not R's family objects, for the links logit, probit,
   cauchit, cloglog, log, identity and inverse and for the five families: they clamp differently from R's `glm`
   (see "Links and families as lme4 computes them"). The links sqrt and 1/mu^2 are R's family functions.
6. **Gamma's starting means are the mean of y**, not y as in `glm` (lme4 replaces them, unless starting values are
   given).
7. **Every evaluation of the deviance function starts its PIRLS from the same fixed linear predictor**, not from
   the previous evaluation's solution; the result does not depend on earlier evaluations.
8. **glmer accepts as many levels as observations** (`nlev ≤ n`, and `n ≥ nl × nc` per term), unlike lmer (`<`):
   there is no residual variance to identify.
9. A **character** response is an error for the binomial family in R ("response must be numeric or factor"); a
   factor response is 1 for every level but the first.

## The model structure: what differs from lmer

### Family and link

`glmer(formula, data, family, ...)`. The family is a glm family object, a family function or its name:
`binomial`, `poisson`, `Gamma`, `inverse.gaussian` or `gaussian`, each with the links allowed by
`oracle/glm-behaviour.md` ("Families, links and their functions") and the same default link (binomial logit, poisson
log, Gamma inverse, inverse.gaussian 1/mu^2, gaussian identity). R's default family of glmer is gaussian.

- `gaussian` with the **identity** link (also the default family) is not fitted by glmer: R warns `calling glmer()
  with family=gaussian (identity link) as a shortcut to lmer() is deprecated; please call lmer() directly` and
  returns `lmer`'s fit (REML). gaussian with the log or inverse link is an ordinary glmer model.
- `quasibinomial`, `quasipoisson` and `quasi`: error `"quasi" families cannot be used in glmer` (the first check of
  all).
- lme4 also runs with MASS's negative binomial families (`glmer.nb`); they are not part of this project.

### The response

The response is read from the model frame, then the family's `initialize` step of R's `glm` runs, with lme4's own
checks around it, in this order:

1. A matrix response with more than one column for a family other than binomial, or with more than two columns:
   error `can't handle matrix-valued responses: consider using refit()`.
2. Type: for binomial, a numeric, logical (TRUE = 1) or factor response is accepted, anything else (a character
   vector) is the error `response must be numeric or factor`. For the other families a logical response is
   converted to 0/1 and anything else that is not numeric (factor, character) is the error `response must be
   numeric`.
3. A non-finite value (Inf; NA and NaN rows were already dropped by the model frame): error `NA/NaN/Inf in 'y'`.
4. Offset: one value per row (see below). Prior weights: a negative weight is the error `all(weights >= 0) is not
   TRUE`; without weights all are 1.
5. The family's checks and starting means `μ0` are those of `oracle/glm-behaviour.md` ("Inputs and starting means"),
   with the same messages: binomial `y values must be 0 <= y <= 1`, the warnings `non-integer #successes in a
   binomial glm!` and `non-integer counts in a binomial glm!`, poisson `negative values not allowed for the
   'Poisson' family`, Gamma `non-positive values not allowed for the 'Gamma' family`, inverse.gaussian `positive
   values only are allowed for the 'inverse.gaussian' family`, gaussian with the log or inverse link `cannot find
   valid starting values: please specify some`. **For Gamma, every starting mean is then replaced by the
   (unweighted) mean of the starting means**, that is of y.
6. `Response is constant` (error) if the response after step 5 (for binomial the proportions) has fewer than two
   distinct values.

The binomial response forms, with prior weights `w` (1 by default):

- **0/1 values, or proportions with weights**: `y` as given (rows with weight 0 get `y = 0`), the binomial size
  `n_i = 1`, the prior weights `w`. A proportion `s/m` with weight `m` is the same model as `cbind(s, m − s)`, with
  the same deviance.
- **Logical**: TRUE is 1, FALSE is 0.
- **Factor**: `y = 0` for the first level and 1 for every other level.
- **Two columns `cbind(s, f)`** (successes, failures): `n_i = s_i + f_i`, `y_i = s_i / n_i` (0 where `n_i = 0`), the
  prior weights become `w_i n_i`, starting means `(n y + 0.5)/(n + 1)`. In the formula the left-hand side is written
  `cbind(s, f)` (R evaluates it as a call; the columns may themselves be expressions in R, such as `size - inc`).
  rStats.js formulas do not support function calls; how the API lets the user give the two columns (for example
  accepting `cbind(a, b)` with two column names as the one special left-hand side) was decided: G1 in "rStats.js's
  choices".

Non-integer poisson counts are accepted; the `aic` term then calls R's `dpois`, which warns `non-integer x =
1.500000` (six decimals) for each such value at every evaluation; each distinct message is reported once.

### Prior weights and offset

`weights` and `offset` are arguments (one value per row of `data`, or expressions evaluated in it). In the formula,
`offset(expr)` terms may also appear; all of them and the `offset` argument are **added**. Rows with a missing weight
or offset are dropped with the others (the model frame). A length that differs from the number of rows of `data` is
the error `variable lengths differ (found for '(offset)')` (or `'(weights)'`). Weights may be 0 (the row then
contributes nothing; binomial sets its `y` to 0). The offset enters the linear predictor `η = offset + Xβ + ZΛ_θ u`.

### Starting values

`start`: a numeric vector (θ only) or a list with `theta` (or `par`) and `fixef` (or `beta`); they are only the
starting point of the optimiser (stage 2c), never of the initial PIRLS below. `mustart` and `etastart` (one value per
row) replace the starting means `μ0` (and, for `etastart`, the starting linear predictor) of the initial PIRLS; they
only change where lme4's PIRLS starts. The API does not offer them (G4).

### The structure and its checks

The model frame, `X`, `Z`, `Λ_θ`, `θ`'s layout, initial value and bounds are those of lmer (stage 1a), with these
differences in the checks of `oracle/lmer-behaviour.md` ("Checks, in this order"):

- Check 0: no row left is not the error `0 (non-NA) cases` but `Invalid grouping factor specification, g`, with the
  name of the **first** grouping factor in the order of the terms after expansion and **before** the reordering of
  the terms (`(1 | h) + (1 | g)` gives `h`; `(1 | g/h)` gives `h:g`).
- Check 3 becomes `nlev > n`, which cannot happen: a grouping factor may have as many levels as there are rows.
- Check 4 becomes `n < nl_k × nc_k`, with the message `number of observations (=30) < number of random effects (=40)
  for term (x | g); the random-effects parameters are probably unidentifiable` (`<` instead of `<=`, and without
  "and the residual variance (or scale parameter)").
- Checks 1, 2, 5 (rank deficiency of X: the message) and 6 (scales: the warning) are unchanged.

The checks of the structure come before those of the response, except the family check (quasi families, gaussian
identity) which comes first of all. Then lme4 runs the initial PIRLS (below), whose failure is an error at this
point (for example `PIRLS loop resulted in NaN value`).

`nAGQ` (default 1) is an integer from 0 to 100 (R truncates a non-integer; above 100: error `nAGQ <= 100L is not
TRUE`; a negative value behaves as 0 in R, which the API should reject instead). `nAGQ > 1` is only allowed for a
single random-effects term with one column, with two different messages: see "When it is allowed" in "Adaptive
Gauss-Hermite quadrature (stage 2e)".

## Links and families as lme4 computes them

`eps` = 2^−52. For the links below lme4 uses its own inverse link `μ(η)` and derivative `μ'(η) = dμ/dη`:

| Link | μ(η) | μ'(η) |
|---|---|---|
| logit | `max(eps, min(1 − eps, plogis(η)))` | `max(eps, dlogis(η))` = `max(eps, e^η/(1 + e^η)²)` |
| probit | `min(1 − eps, pnorm(η))` (no lower clamp) | `dnorm(η)` (no clamp) |
| cauchit | `min(1 − eps, pcauchy(η))` | `dcauchy(η)` |
| cloglog | `max(eps, min(1 − eps, −expm1(−e^η)))` | `max(eps, exp(η − e^η))` |
| log | `max(eps, e^η)` | `max(eps, e^η)` |
| identity | `η` | 1 |
| inverse | `1/η` (no clamp) | `−1/η²` |

The links sqrt (`μ = η²`, `μ' = 2η`) and 1/mu^2 (`μ = 1/√η`, `μ' = −1/(2 η^1.5)`) are R's family functions; the link
function itself (used once, for the starting linear predictor) is always R's. The variance functions are
`V(μ)` = binomial `max(eps, μ(1 − μ))`, poisson `μ`, Gamma `μ²`, inverse.gaussian `μ³`, gaussian 1. The deviance
residuals `d_i` are those of `oracle/glm-behaviour.md` with `y log(y/μ)` taken as 0 when `y = 0` (for binomial both
terms, `y log(y/μ)` and `(1 − y) log((1 − y)/(1 − μ))`).

The `aic` term, with `D = Σ d_i` at the current means, `w` the prior weights (after the binomial step above), and
the `n_i` of the binomial response:

- binomial: with `m = n` if some `n_i > 1`, otherwise `m = w`; `k_i = round(m_i y_i)`, `m_i ← round(m_i)`:
  `−2 Σ_{m_i > 0} (w_i / m_i) log dbinom(k_i; m_i, μ_i)`.
- poisson: `−2 Σ w_i log dpois(y_i; μ_i)`.
- Gamma: `φ = D / Σw`; `−2 Σ w_i log dgamma(y_i; shape 1/φ, scale μ_i φ) + 2`.
- inverse.gaussian: `Σw (log(2π D / Σw) + 1) + 3 Σ w_i log y_i + 2`.
- gaussian: `N (log(2π D / N) + 1) + 2 − Σ log w_i`, `N` the number of rows (not Σw).

These are R's family `aic` functions; the rounding is R's `nearbyint` (half to even).

## The Laplace deviance (stage 2a)

### Definition (nAGQ = 1)

Given `θ` (any finite values of the length of the structure's `θ`; values below the lower bounds are accepted) and
`β` (one per column of `X` after aliased columns were dropped), with `o` the offset and `M = ZΛ_θ` (n × q):

- `η(u) = o + Xβ + M u`, `μ_i = μ(η_i)`.
- The **conditional mode** `ũ` minimises the penalised deviance `pdev(u) = Σ_i d_i(y_i, μ_i, w_i) + ‖u‖²`.
  Equivalently `ũ = M' s(ũ)` with the score `s_i = w_i (y_i − μ_i) μ'_i / V(μ_i)` (−½ the derivative of `d_i` in
  `η_i`). For the canonical links (binomial logit, poisson log) `pdev` is strictly convex and `ũ` unique.
- The working weights at the mode `W_i = w_i μ'_i² / V(μ_i)` (the Fisher weights, also for non-canonical links) and
  `L_θ L_θ' = M' W M + I` (`ldL2 = log det(M'WM + I)`, twice the log determinant of the Cholesky factor).
- **Deviance** = `ldL2 + ‖ũ‖² + aic(μ(ũ))`, the aic term of the previous section with `D = Σ d_i` at `μ(ũ)`.
  (This is −2 times the Laplace approximation of the log-likelihood, up to the constant that the aic term fixes.)

Also reported (fixture): `u = ũ`, `b = Λ_θ ũ`, `μ`, `devResid = Σ d_i`, `ussq = ‖ũ‖²`, `pdev = devResid + ussq`,
`ldL2`, `aic`.

### Definition (nAGQ = 0)

The deviance is a function of `θ` only: `(ũ, β̃)` minimise `pdev(u, β) = Σ d_i + ‖u‖²` jointly, with
`η = o + Xβ + M u`; the deviance is `ldL2 + ‖ũ‖² + aic(μ)` at `(ũ, β̃)`, with `ldL2` as above (only the `u` block:
no term for `β`). `β̃` is reported as `beta`.

### lme4's penalised IRLS (PIRLS)

lme4 computes the mode by penalised iteratively reweighted least squares. One evaluation at `θ` (and `β`):

- **Start.** The deviance function stores a linear predictor `lp0` when it is built (below). The first iteration
  uses `η0 = o_base + lp0` (`o_base` the model's offset, without `Xβ`) and `μ0 = μ(η0)`. For nAGQ = 1 the offset
  used from then on is `o = o_base + Xβ`; for nAGQ = 0, `o = o_base`. The start depends only on `lp0`, never on an
  earlier evaluation (with the one exception under step halving below); the oracle checks that evaluating at other
  parameters in between does not change any result.
- **Iteration** `k = 0, 1, …, maxit − 1` (`maxit = 100`), from the current `η`, `μ`:
  1. Weights `W_i = w_i μ'(η_i)² / V(μ_i)` and working response `z_i = (η_i − o_i) + (y_i − μ_i)/μ'(η_i)`.
  2. Factor `M'WM + I` at the current `θ` (and for nAGQ = 0 the blocks `R_ZX`, `R_X` of the paper for the weighted
     `X`).
  3. Solve the weighted penalised least squares problem: nAGQ = 1: `u_new = (M'WM + I)⁻¹ M'W z`; nAGQ = 0:
     `(u_new, β_new)` minimise `‖W^½ (z − Xβ − M u)‖² + ‖u‖²` (the problem of lmer's stage 1b with `y` replaced by
     `z` and rows weighted by `W^½`). These are the **new values**, not increments.
  4. `η = o + M u_new` (nAGQ = 1; `Xβ` is in `o`) or `o + Xβ_new + M u_new`, `μ = μ(η)`, `pdev = Σ d_i + ‖u_new‖²`.
  5. **Converged** if `|pdev_old − pdev| / pdev < tolPwrss` (`tolPwrss = 1e-7`; `pdev_old` is the largest double at
     `k = 0`, so the first iteration never converges). This is tested before the next step, so a slight increase
     of `pdev` within the tolerance is accepted.
  6. Otherwise, if `pdev` is NaN or `pdev > pdev_old`: **step halving**, up to 20 times while `pdev` is NaN or
     `> pdev_old`: `u_new ← (u_prev + u_new)/2` (and `β_new ← (β_prev + β_new)/2` for nAGQ = 0), with `u_prev`,
     `β_prev` the values at the start of this iteration; recompute `η`, `μ`, `pdev`. Then a NaN `pdev` is the error
     `PIRLS loop resulted in NaN value`, and `pdev − pdev_old > tolPwrss` (an **absolute** difference) is the error
     `(maxstephalfit) PIRLS step-halvings failed to reduce deviance in pwrssUpdate`. At `k = 0` halving happens only
     for a NaN `pdev`, and `u_prev` is then whatever the previous evaluation left (lme4's only dependence on earlier
     evaluations); an implementation should halve towards its own starting point instead.
  7. `pdev_old = pdev`.
- Not converged after `maxit` iterations: error `pwrssUpdate did not converge in (maxit) iterations`.
- **Result**: `ldL2` from the factorisation of step 2 of the **last** iteration (weights of the means before its
  update), `‖u‖²` and the aic term at the final `μ`. Because of this lag and the early stop, lme4's value is not
  exactly the deviance at the mode (see "Accuracy").

**`lp0`.** glmer builds the deviance function (`nAGQ = 0` first) by running PIRLS once for `u` and `β` jointly
(nAGQ = 0 rules) at the **initial θ** of the structure, starting from `η0 = o_base + link(μ0)` with the starting
means `μ0` of "The response" (or `etastart`); `lp0` is its final `Xβ + Mu` (without the offset). An error of this
run is an error of glmer (on the fixture's Gamma data with the inverse link, it diverges at θ = 1: `PIRLS loop
resulted in NaN value`, so `glmer` fails there although the deviance is well defined at smaller θ). For the second
phase of the fit (nAGQ ≥ 1), `lp0` is replaced by the linear predictor at the end of the first phase (stage 2c). The
oracle builds lme4's function without that first phase, so its `lp0` is the one of the initial run (for the two
cases noted in the oracle, that run is made at the case's θ instead of the initial θ).

### What the implementation must compute (stage 2b)

The deviance **at the exact conditional mode** (the definitions above), not lme4's early-stopped value: run PIRLS
(or Newton's method) until the mode is reached to rounding error (for example until the change of `u` is below
about 1e-13 relative to its largest element and `pdev` no longer decreases), then compute the weights, `ldL2` and
the aic term **at the mode**. PIRLS is Fisher scoring, so for non-canonical links it converges only linearly and
needs more iterations than lme4 runs. Start each evaluation from a fixed point that does not depend on earlier
evaluations: for nAGQ = 1, `u = 0` (`η = o + Xβ`) is suitable; for nAGQ = 0, the family's starting means as lme4's
initial run. Keep step halving (towards the previous iterate) for divergence and NaN, and throw the errors above
(with lme4's messages) when it fails; the fixture has no error case.

Easy to get wrong here:

1. The weights in `ldL2` are those **at the mode** (the reference); lme4's lag of one iteration is not reproduced.
2. A `θ` with zeros (a singular `Λ_θ`) is valid: the corresponding `u` are 0 and `ldL2` is still finite (0 when
   `Λ_θ = 0`).
3. For nAGQ = 1, lme4 reports the given `β` (its internal fixed effects are 0 and `Xβ` sits in the offset).
4. The clamps of lme4's links do not act at the fixture's parameters (the oracle checks it), but must be kept so that
   PIRLS behaves as lme4's far from the data (μ never exactly 0 or 1 for the binomial links).

### The fixture glmerDeviance (`oracle/glmerdev.R`)

The comment at the top of the oracle describes the fields. Arguments: `formula`, `data` (with `dataTypes`),
`family`, `link`, optional `weights` and `offset` (one value per row of `data`), `nAGQ` (`"1"` or `"0"`), `theta`,
and `beta` (nAGQ = 1). Expected (lme4's values): `deviance`, `beta`, `u`, `b`, `mu` (one per row used), `devResid`,
`ussq`, `pdev`, `ldL2`, `aic`; `reference`: the same fields at the exact mode (200-bit arithmetic), and
`newtonSteps` (information). The 55 cases cover the five families with the links binomial logit, probit, cloglog,
cauchit and log, poisson log and sqrt, Gamma log, inverse and identity, inverse.gaussian 1/mu^2, log and inverse,
gaussian log and inverse; scalar and vector-valued terms, `||`, two crossed grouping factors, prior weights, an
offset, the two-column and proportion-with-weights binomial forms (same deviance), a factor response (written as
strings in the fixture; R's column is a factor) and a missing value; `θ` near lme4's estimate, on the boundary
(zeros) and far from the optimum. The oracle checks the reference by evaluating lme4's own weights, log determinant
and aic term at the reference mode: they agree within 1e-12 (relative; the largest difference is 3e-13 absolute on
deviances of 60 to 400) in every case.

**Accuracy required**, against `reference`: `deviance`, `devResid`, `pdev`, `aic`: relative 1e-10; `ldL2` and `ussq`:
absolute `1e-10 × max(1, |value|)`; `u`, `b`, `mu`, `beta`: each element within `1e-9 ×` the largest absolute
element of the reference vector. Against `expected` (lme4): not checked tightly; the test should print the largest
differences, which in the fixture are: `deviance` 4.9e-6 (relative to max(1, |value|)), `aic` 6.8e-6, `ldL2` 6.0e-5,
`u` and `b` 2.2e-4, `mu` 8.9e-5, `beta` (nAGQ = 0) 8.5e-6 (relative to the largest element). A check that the
deviance is within 1e-4 (relative) and the vectors within 1e-3 of lme4's is a safe guard against gross errors.

## rStats.js's choices

Decided by the user (2026-11-05) where R's behaviour cannot or should not be copied; later stages follow them.

- **G1 Two-column binomial response.** The left-hand side may be `cbind(a, b)` with two column names (successes,
  failures), for the binomial family only (other families: R's error `can't handle matrix-valued responses: consider
  using refit()`). It is the only function call accepted in a formula, and only there and only by glmer: `cbind` with
  expressions (`cbind(s, n - s)`), any other function call, and `cbind` in lm, glm or lmer formulas stay syntax
  errors. `.` on the right-hand side stands for the columns other than both of `cbind()`; a missing value in either
  column drops the row. The proportion with prior weights is the other way to give a binomial response.
- **G2 String response.** For the binomial family a string column is a factor (R: error `response must be numeric or
  factor`): its levels ordered as lmer orders factor levels (by code point, or as the option `levels` gives them,
  unused levels dropped), the first level failure (0), every other success (1). A boolean column is logical (TRUE is
  1) for every family. Strings for the other families: `response must be numeric`.
- **G3 gaussian with the identity link** (also the default family): a RangeError telling to use lmer (R warns that
  this shortcut is deprecated and returns lmer's fit).
- **G4 `mustart` and `etastart`** are not offered for now (starting values of θ and β are, in the fit); they can be
  added later without breaking anything.
- **G5 A negative `nAGQ`** is a RangeError (R uses 0). A non-integer is truncated as R does; above 100 is R's error.

Choices of the implementation (stage 2b) where this document was silent:

- The prior weights and the offset are arrays (one value per row of `data`; `null` or NaN missing, which drops the
  row) or the name of a numeric column. An infinite offset (`the offset must be finite`) or weight (`non-finite
  weights not allowed`) is an error, as in rStats.js's glm.
- Order of the checks: the family (G3, quasi), `nAGQ`'s value, the lengths of weights and offset, the structure
  (`No random effects terms specified in formula` before `Invalid grouping factor specification`), `nAGQ > 1` with
  more than one scalar term, then the response in the order of "The response".
- The aic term is that of rStats.js's glm (`familyAic`), equal to R's except that rows with prior weight 0 are left
  out of the sums (for gaussian R's `− Σ log w_i` is then +Inf and its `N` counts them).
- The initial PIRLS of lme4 (`lp0`) is not run when the structure is built: it belongs to the fit (stage 2c), whose
  error there (`PIRLS loop resulted in NaN value`) is therefore not yet reproduced.
- The first step of nAGQ = 0 (from `η0 = o + g(μ0)`, which is not of the form `o + Xβ + Mu`) is halved only for a
  NaN `pdev`, towards `u = 0, β = 0`.

Choices of the specification of stage 2e:

- `nAGQ > 1` with the wrong random-effects terms is checked at the structure (as in stage 2b), with R's two
  messages chosen by R's rule ("When it is allowed"); R checks them later (after phase 1).
- The AGQ deviance of Gamma, inverse.gaussian and gaussian holds the dispersion at 1, as R's does (reproduced, not
  corrected).

## The fit and its results (stage 2c)

### What lme4 does (glmerControl's defaults)

lme4 minimises the Laplace deviance of the previous sections in two phases; it is described here so that the
differences from rStats.js are clear, not to be copied.

1. **Initial PIRLS.** When the deviance function is built, the nAGQ = 0 PIRLS runs once at the structure's
   **initial θ** (1 for diagonal elements, 0 otherwise; a `start` does not change this point) from the starting
   means `μ0` (section "lme4's penalised IRLS", `lp0`). Its errors are glmer's errors, before any optimisation:
   `PIRLS loop resulted in NaN value`, `(maxstephalfit) PIRLS step-halvings failed to reduce deviance in
   pwrssUpdate`, `pwrssUpdate did not converge in (maxit) iterations`. The fixture's case with Gamma, the inverse
   link and the data of glmerDeviance is such an error (`PIRLS loop resulted in NaN value`).
2. **Phase 1** (`nAGQ0initStep = TRUE`): the nAGQ = 0 deviance (a function of θ only; β from the joint PIRLS) is
   minimised over θ with BOBYQA (package minqa, its default control), from the initial θ or `start$theta`, with the
   lower bounds of θ (0 for diagonal elements, −∞ otherwise) and no upper bounds. For `nAGQ = 0` this is the fit:
   then a **boundary check** follows (`boundary.tol = 1e-5`): each element of θ within 1e-5 above its lower bound
   (not on it) is set to the bound, one at a time, if that lowers the deviance; the deviance is evaluated again at
   the final θ. For `nAGQ ≥ 1` phase 1 has no boundary check.
3. **Phase 2** (`nAGQ ≥ 1` only): the nAGQ deviance is minimised over `(θ, β)` jointly with lme4's Nelder-Mead,
   from phase 1's θ and the β of phase 1's last PIRLS (or `start$fixef`), with the lower bounds of θ and no bounds
   on β; every evaluation's PIRLS starts from the linear predictor at the end of phase 1 (`lp0`). Nelder-Mead's
   initial steps are 0.02 for each element of θ and `0.2 min(s_j, 10)` for β_j (`s_j` the square roots of the
   diagonal of `(R_X'R_X)⁻¹` of phase 1's last PIRLS), its tolerance on the parameters `xt = 5e-4 ×` those steps.
   Then, unless the result is singular (some diagonal element of θ below 1e-4), and if `n < 10000` and
   `length(θ) + length(β) < 20`, lme4 computes the gradient and the **Hessian of the deviance in (θ, β) by central
   differences with step 1e-4** at Nelder-Mead's result (`deriv12`), and runs its convergence checks on them. Then
   the boundary check of step 2 (on the elements of θ only), and a final evaluation.
4. The fitted model holds the state of the deviance function's **last evaluation** (at the final parameters):
   `u`, `μ`, `η`, the weights and the factorisation; and `opt$fval`, the optimiser's value at the final parameters.

lme4's deviance is perturbed at the 1e-6 level by its PIRLS (it stops at a relative change of 1e-7 and uses the
weights of the previous iterate; "Accuracy" above), so Nelder-Mead stops 1e-6 to 1e-3 from the minimiser (fixture:
θ up to 4.4e-4, β up to 2.7e-3 relative to the largest element, more where lme4 fails to converge) and, more importantly, **its finite-difference
Hessian is noisy**: the standard errors of the fixed effects are off by up to 1.3% (cbpp: 0.3032 instead of
0.3066), and in the fixture's case `y ~ x + (x | g)` (Gamma, log) lme4 warns that the model failed to converge and
its standard errors are 0.004 instead of 0.26 and 0.16. The same central differences (step 1e-4 or 1e-3) of the
exact deviance at the exact optimum agree with the exact Hessian to about 1e-7: the error is lme4's PIRLS, not the
differences. With `nAGQ = 0` lme4 is much closer (1e-5).

### The estimate of rStats.js

**The estimate is the exact minimiser** of the Laplace deviance computed at the exact conditional mode (as
`glmerDeviance` does), not lme4's early-stopped value (G6):

- `nAGQ = 1`: `(θ̂, β̂)` minimises `d₁(θ, β)` subject to the lower bounds of θ (none on β).
- `nAGQ = 0`: `θ̂` minimises `d₀(θ)`; `β̂` is the β of the joint mode at `θ̂`.

**Boundary.** As for lmer: an element whose minimiser is on its bound is **exactly 0**. The Laplace deviance does
not change when a column of a block `T_k` changes sign (`Λ_θ → Λ_θ D`, `u → D u` leave `b`, `‖u‖²` and
`det(Λ'Z'WZΛ + I)` unchanged), so lmer's treatment applies as it is (`src/models/lmer.ts`, header comment: minimise
θ without bounds, change the sign of a column whose diagonal element ends negative, set diagonal elements that go
below 1e-4 max(1, max |θ|) to exactly 0 and hold them while the others converge, release one whose derivative is not
0), β taking part as free elements. The fixture has three boundary optima: `y ~ x + (x | g)` (binomial; the last
diagonal element), `y ~ x + (1 | g)` (poisson on data without a group effect, nAGQ 1 and 0) and inverse.gaussian
with 1/mu^2.

**Start and local minima.** First the nAGQ = 0 minimisation from the initial θ (or `start.theta`), as lme4's phase 1
but to the exact minimiser; for `nAGQ = 0` that is the fit. For `nAGQ = 1`, the minimisation of `d₁` starts from that
θ and the β of the joint mode there (or `start.fixef`). Then, as lmer, the boundary points of whole terms are
compared (each term with a nonzero block removed in turn, held at 0, the rest minimised; restart from the best if
lower by more than 1e-8 max(1, |d|)). In the fixture every reference is the minimum reached from lme4's estimate
(none moved).

**How.** Not prescribed, but the accuracy below needs a good gradient: the exact-mode deviance is accurate to about
1e-14 (relative), so central differences of it give the gradient to about 1e-8 only (with Richardson extrapolation
somewhat better), and some curvatures are small (Gamma, inverse link: `∂²d/∂θ² ≈ 0.43`). The analytic gradient is
available by the implicit function theorem: with `φ` one parameter, the mode equation `G(ũ, φ) = M' s − ũ = 0`
(nAGQ = 0: `(ũ, β̃)` and the joint equations) gives `dũ/dφ = H⁻¹ ∂G/∂φ` with `H = −∂G/∂u` (the observed
Hessian of `pdev/2`, the Fisher one plus the term of `∂W`); then `d/dφ` of `ldL2 = log det(M'WM + I)` is
`tr((M'WM + I)⁻¹ ∂(M'WM)/∂φ)` with `∂W_i = W_i'(η_i) ∂η_i` along `∂η = ∂(Xβ + ZΛ)/∂φ ũ + M dũ/dφ`, and `d/dφ`
of `‖ũ‖² + aic` is its partial derivative at fixed `ũ` (for binomial and poisson `aic − Σd_i` does not depend on μ,
so `‖u‖² + aic` is stationary in `u` at the mode) plus, for the families with a dispersion, `∂aic/∂D · dD/dφ` along
`dũ/dφ`. Either way, finish with Newton steps on the free elements until the gradient is at rounding level.

**Failures.** Before the minimisation, the initial PIRLS of lme4 (point 1 above) is run: the nAGQ = 0 PIRLS at the
structure's initial θ from `μ0`, with lme4's step halving (the PIRLS of stage 2b does this as its nAGQ = 0
evaluation); its errors are glmer's errors with lme4's messages (the fixture's error case). During the
minimisation an evaluation that fails (NaN, step halving that cannot reduce the penalised deviance, no
convergence) counts as +∞ (the step is rejected), since rStats.js's path differs from lme4's; if the minimisation
cannot proceed at all, throw an Error.

### API

```ts
glmer(formula: string, data: DataFrame, options?: GlmerOptions): GlmerResult
```

`GlmerOptions`: `family` (`"binomial" | "poisson" | "Gamma" | "inverse.gaussian" | "gaussian"`, default
`"gaussian"`, which with the identity link is G3's error), `link` (the family's default), `weights` and `offset`
(G7), `nAGQ` (0 to 100, default 1; G5; above 1 see "Adaptive Gauss-Hermite quadrature"), `start`
(`{ theta?, fixef? }`), `contrasts` and `levels` as lmer. A start only chooses where the search begins. Its errors,
all RangeErrors, in R's order (checked in R; the numbers are the expected lengths, here those of a model with
length(θ) = 3 and 4 fixed effects):

1. with `nAGQ = 0`, any `start.fixef`: `'start' has invalid names "fixef"` (before the lengths are looked at);
2. `start.theta` not of the length of θ: `starting value of 'par' has length not equal to 3`;
3. a diagonal element of `start.theta` below 0: minqa's `Starting values violate bounds`;
4. `start.fixef` not of the length of β: `starting value of 'fixef' has length not equal to 4`.

All four come **after** lme4's initial PIRLS (point 1 of "What lme4 does"): R checks the start when the optimiser
is set up, after the deviance function was built, so on data where the initial PIRLS fails (the Gamma, inverse link
case of the fixture) a wrong start still gives `PIRLS loop resulted in NaN value` (checked in R with errors 1 and 2;
3 and 4 are checked later still). Errors 1 to 3 belong to lme4's phase 1 and error 4 to phase 2; for `nAGQ > 1` R's first message about the
random-effects terms comes between 3 and 4 (see "When it is allowed" in the next section).

### The results

`GlmerResult` mirrors `LmerResult` where the meaning is the same. With `n` the rows used, `p` the fixed effects,
the exact optimum and, at it, the conditional mode `ũ` (and, nAGQ = 0, `β̂`), `η̂ = o + Xβ̂ + ZΛ_θ̂ ũ` (`o` the
offset), `μ̂ = μ(η̂)` (lme4's links; no clamp is active in the fixture), the prior weights `w`, the deviance
residuals `d_i` and the Fisher weights `W_i = w_i μ'(η̂_i)² / V(μ̂_i)`:

| Field | Meaning (R) |
|---|---|
| `formula` | the formula |
| `family`, `link`, `nAGQ` | new: the family, the link and nAGQ (0 to 100) |
| `nObs`, `rows` | `nobs(fit)`: the rows used (rows with prior weight 0 included); their 0-based indices in `data` |
| `theta` | `getME(fit, "theta")` |
| `fixefNames`, `fixef` | the columns of X and β̂ (`fixef(fit)`) |
| `coefTable` | `{ estimate, stdError, zValue }` from `coef(summary(fit))`; `zValue = estimate / stdError`, labelled `z value` by R for binomial and poisson and `t value` for the other families (the same quantity; glmerSummary, stage 3, adds `Pr(>\|z\|)`, which R gives for every family) |
| `vcov` | `vcov(fit)`, below |
| `vcovFrom` | new: `"hessian"` or `"RX"`, which of the two formulas below gave `vcov` |
| `sigma` | `sigma(fit)`, below |
| `varCorr` | `VarCorr(fit)`: as lmer but **not scaled by sigma**, for every family: `Σ_k = T_k T_k'`, `sd` the square roots of its diagonal, `corr` as lmer (NaN off the diagonal where an `sd` is 0) |
| `ranef` | `ranef(fit)`: `b = Λ_θ̂ ũ`, laid out as lmer's (R's conditional variances, `condVar`, are not given, as for lmer) |
| `fitted` | `fitted(fit)`: `μ̂` (for a binomial response the probability, also for `cbind`) |
| `linearPredictor` | new: `predict(fit)` (link scale): `η̂`, offset included |
| `residuals` | `residuals(fit)`, R's default type for glmer, the **deviance** residuals: `sqrt(max(0, d_i))` where `y_i > μ̂_i`, otherwise `−sqrt(max(0, d_i))` |
| `pearsonResiduals` | new: `residuals(fit, "pearson")`: `sqrt(w_i) (y_i − μ̂_i) / sqrt(V(μ̂_i))` |
| `workingResiduals` | new: `residuals(fit, "working")`: `(y_i − μ̂_i) / μ'(η̂_i)` |
| `responseResiduals` | new: `residuals(fit, "response")`: `y_i − μ̂_i` (y the proportion for `cbind`) |
| `deviance` | `deviance(fit)`: `Σ max(0, d_i)`, the sum of the squared deviance residuals. **Not −2 logLik** |
| `logLik`, `df` | `logLik(fit)` = `−d/2` with `d` the minimum of the deviance optimised (`d₁(θ̂, β̂)`, `d₀(θ̂)` for nAGQ = 0, or the AGQ deviance `D_K(θ̂, β̂)` for nAGQ = K > 1, stage 2e); `df = p + length(θ) + s`, `s` = 1 for Gamma, inverse.gaussian and gaussian (the dispersion), 0 for binomial and poisson |
| `AIC`, `BIC` | `−2 logLik + 2 df`, `−2 logLik + log(nObs) df` |
| `singular` | `isSingular(fit)`: a diagonal element of some `T_k` below 1e-4 |
| `messages`, `warnings` | below |

`LmerResult`'s `REML` and `REMLcrit` have no counterpart (R: `REMLcrit` and `deviance(fit, REML = TRUE)` are errors
for a GLMM).

**sigma.** 1 for binomial and poisson. For Gamma, inverse.gaussian and gaussian: `sqrt((Σ_i w_i (y_i − μ̂_i)² /
V(μ̂_i) + ‖ũ‖²) / n)`, the sum of the squared Pearson residuals plus the squared length of `ũ`, over the number of
rows (lme4's `sigmaML` from its penalised weighted residual sum of squares; not a usual dispersion estimate, but what
R returns). It enters only `sigma` and the `"RX"` covariance.

**vcov.** R's default (`use.hessian` = whether the Hessian exists):

- `"hessian"` when `nAGQ ≥ 1`, the fit is not singular, `n < 10000` and `length(θ) + p < 20`: `vcov = 2 [H⁻¹]_ββ`
  (symmetric), `H` the Hessian of the deviance `d₁` in `(θ, β)` at the optimum (all elements of θ, also the
  off-diagonal ones) and `[·]_ββ` the block of β of its **inverse** (so the uncertainty of θ is taken into account).
  No sigma factor (for Gamma and the others the dispersion is inside the deviance). rStats.js uses the exact Hessian
  at the exact optimum (lme4: central differences with step 1e-4 at Nelder-Mead's result; see above). If `H` is not
  positive definite (at an exact interior minimum it is, up to rounding), R warns `variance-covariance matrix
  computed from finite-difference Hessian is\nnot positive definite or contains NA values: falling back to var-cov
  estimated from RX` and uses the second formula: rStats.js does the same.
- `"RX"` otherwise (nAGQ = 0, singular fits, larger problems): `vcov = sigma² (R_X'R_X)⁻¹` with `R_X'R_X = X'WX −
  X'WZΛ (Λ'Z'WZΛ + I)⁻¹ Λ'Z'WX` at θ̂ and the Fisher weights `W` at the mode (lme4: those of its last PIRLS
  iteration).

For a singular fit the formula changes from one to the other, so near the boundary the standard errors jump; and
since lme4 decides at Nelder-Mead's θ, its choice can differ from the reference's where the two disagree on
singularity (not in the fixture). `stdError` = the square roots of the diagonal of `vcov`.

**Messages.** The structure's messages (rank deficiency), then `boundary (singular) fit: see help('isSingular')` if
the fit is singular **and** `n < 10000` and the number of optimised parameters (`length(θ) + p` for nAGQ = 1,
`length(θ)` for nAGQ = 0) is below 20 (lme4 runs its convergence checks, which give this message, only then; lmer
gives it always).

**Warnings.** Those of the structure and the response (stage 2b; for example `non-integer #successes in a binomial
glm!`), and those of the deviance evaluations that R would give (poisson's `non-integer x = ...`), each once. lme4's
warnings about its optimiser and its convergence checks are **not reproduced** (as for lmer): `Model failed to
converge with max|grad| = ...`, `Model failed to converge: degenerate  Hessian with ... negative eigenvalues`,
`Model is nearly unidentifiable: very large eigenvalue\n - Rescale variables?`, `Model is nearly unidentifiable:
large eigenvalue ratio\n - Rescale variables?`, `Hessian is numerically singular: ...`, `unable to evaluate scaled
gradient`, `convergence code ... from Nelder_Mead`, and vcov's `variance-covariance matrix computed from
finite-difference Hessian\nand from RX differ by >1e-04: consider 'use.hessian=TRUE'` (given only when
`use.hessian = FALSE` is asked for). The one exception is the fallback warning of vcov above.

### The fixture glmer (`oracle/glmer.R`)

The comment at the top of the oracle describes the fields and how the reference was computed (double-precision
search from lme4's estimate, then Newton's method in 110-bit arithmetic with the gradient from central differences
of the 110-bit deviance; the gradient at the reference is below 1e-15, mostly about 1e-17; the Hessian for `vcov`
in 110-bit arithmetic, accurate to about 1e-14). Arguments: `formula`, `data` (with `dataTypes`), `family`, `link`,
optional `weights` and `offset`, `nAGQ` (`"1"` or `"0"`). `expected` holds lme4's values with `vcovFrom`, `messages`
and `warnings`; `reference` the same fields at the exact optimum, where `messages` and `warnings` are what rStats.js
must give (rules above), plus `devianceAtLme4` (the exact deviance at lme4's estimates), `gradient`, `newtonSteps`
and `start` (information). 32 cases (one error): cbpp (two-column and proportion with weights, the same model;
logit, probit, cloglog; nAGQ 0), 0/1 binomial (scalar, vector-valued on the boundary, crossed, nAGQ 0, a factor
response written as strings (G2), missing values, non-integer prior weights with R's warning), poisson (log, sqrt,
crossed, nAGQ 0, `||`, offset, weights, grouseticks of 1995 with `(1 | LOCATION/BROOD)`, an optimum on the boundary
with nAGQ 1 and 0), Gamma (log: scalar, nAGQ 0, correlated vector-valued, weights; inverse; inverse on glmerdev's
data: the error), inverse.gaussian (log; 1/mu^2 on the boundary), gaussian with the log link (nAGQ 1 and 0). The
oracle takes about 5 minutes.

**Accuracy required**, against `reference`:

- `logLik`, `AIC`, `BIC`: relative 1e-10; `deviance` (Σ d_i, first order in the parameters): relative 1e-7.
- `theta`, `fixef`, `sigma` (relative), `varCorr` (`sd`; `corr` absolute), `ranef` values, `fitted`,
  `linearPredictor` and the four residual vectors: within 1e-7 × the largest absolute value of the reference
  vector.
- `vcov`, `stdError`, `zValue`: within 1e-6 × the largest absolute value (`"hessian"` needs the Hessian of the
  deviance to about 1e-7; `"RX"` is as accurate as θ̂).
- Elements of θ that are 0 in the reference exactly 0; `singular`, `vcovFrom`, `df`, `nObs`, the names and levels,
  `messages` and `warnings` equal to the reference's; the error case: the error message.

Against `expected` (lme4): `−2 logLik ≤ devianceAtLme4 + 1e-10 |devianceAtLme4|` (the reference satisfies it in
every case; lme4's own `−2 logLik` is not comparable, its deviance being off by up to 5e-6), and the test log should
print the largest difference from lme4 of each field. In the fixture they are: θ 2e-3 (4.4e-4 without the case
where lme4 fails to converge), β 2.7e-3 (relative to the
largest element), `logLik` 5e-6 (relative), standard errors 1.3% except the case where lme4 fails to converge (98%),
the vectors `fitted` etc. 4e-3, `sigma` 8e-4.

## Adaptive Gauss-Hermite quadrature (stage 2e)

With `nAGQ = K > 1` lme4 replaces the Laplace deviance `d₁(θ, β)` of stage 2a by an adaptive Gauss-Hermite
quadrature (AGQ) deviance `D_K(θ, β)` and minimises it as it minimises `d₁` (stage 2c). Everything else (the
structure, the conditional mode, the results) is that of `nAGQ = 1`, except what this section says.

### When it is allowed

`nAGQ` is an integer from 0 to 100 (structure section; G5). `K > 1` requires **exactly one random-effects term
with exactly one column**: `(1 | g)` or a scalar slope `(0 + x | g)`, with any family, link, prior weights, offset
and response form (`cbind`, proportions with weights, factor). There are two messages, from two different checks
(checked in R). With the terms in lmer's order (decreasing number of levels; terms with the same number of levels
keep the order of the formula, `oracle/lmer-behaviour.md`):

1. more than one distinct grouping factor, or a first term with more than one column: `nAGQ > 1 is only available
   for models with a single, scalar random-effects term`. Examples: `(1 | g) + (1 | h)`, `(1 | g/h)`, `(x | g)`,
   `(x | g) + (1 | g)`;
2. otherwise, more than one term (all on the same factor, the first one scalar): `AGQ only defined for a single
   scalar random-effects term`. Examples: `(x || g)` (two terms after expansion), `(1 | g) + (0 + x | g)`,
   `(1 | g) + (x | g)`, `(1 | g) + (1 | g)`.

In R both come late: message 1 after the initial PIRLS, the checks of `start.theta` (errors 2 and 3 of "API") and the
whole of phase 1, and before the check of `start.fixef`'s length; message 2 at the first evaluation of the AGQ
deviance, after that check. rStats.js checks both at the structure, where stage 2b already checks message 1 (see
"rStats.js's choices"); the order differs from R's only when an input has several errors.

### The quadrature rule

For `K` points, the rule for the **standard normal density** `φ(z) = exp(−z²/2)/√(2π)`:

- the nodes `z_1 < … < z_K` are the zeros of the probabilists' Hermite polynomial `He_K`, with `He_0 = 1`,
  `He_1(x) = x`, `He_(k+1)(x) = x He_k(x) − k He_(k−1)(x)`;
- the weights are `w_k = 1 / Σ_(j=0..K−1) He_j(z_k)² / j!` (the Christoffel numbers of the orthonormal polynomials
  `He_j / √(j!)`); they are positive and sum to 1, and `Σ_k w_k f(z_k) = E f(Z)`, `Z ~ N(0, 1)`, exactly for
  polynomials `f` of degree up to `2K − 1`.

Equivalently (Golub-Welsch): the nodes are the eigenvalues of the symmetric tridiagonal `K × K` matrix with zero
diagonal and off-diagonal elements `√1, √2, …, √(K−1)`, and `w_k` is the square of the first component of the
normalised eigenvector of `z_k`. The rule is symmetric (`z_(K+1−k) = −z_k`, `w_(K+1−k) = w_k`) and for odd `K` the
middle node is 0. For `K = 2`: `±1`, weights `1/2`; `K = 3`: `0, ±√3`, weights `2/3, 1/6`. For `K = 100` the nodes
reach ±18.96 and the smallest weight is 3.3e-79 (no underflow); `log w_k + z_k²/2` stays below 0.

lme4 does not compute the rule: it reads a table (made with the package fastGHQuad from the physicists' rule,
nodes multiplied by √2 and weights divided by their sum) and then **symmetrises** it: `z_k ← (z_k − z_(K+1−k))/2`,
`w_k ← (w_k + w_(K+1−k))/2` (so the middle node of an odd rule is exactly 0). The table differs from the exact rule
by up to 1.6e-14 in the nodes and 1.5e-13 (relative) in the weights (`K = 100`; 2e-16 and 6e-16 for `K ≤ 5`), which
changes the deviance by less than 1e-13 (relative). The implementation should compute the exact rule to rounding
error (for example Golub-Welsch, or Newton's method on the recurrence from approximate nodes, then the weights by the
formula above), symmetrise it the same way and set the middle node of an odd rule to exactly 0; it may cache the rule
for each `K`.

### The deviance at given (θ, β)

Notation: the single term has `q` levels; row `i` belongs to level `g(i)`; `c_i = Z_i θ` (the term's column times
θ: `θ` for `(1 | g)`, `θ x_i` for `(0 + x | g)`), so `η_i(u) = o_i + X_i β + c_i u_(g(i))`. Then:

1. The **conditional mode** `ũ` and everything at it exactly as for `nAGQ = 1` (stage 2a: `Xβ` in the offset, the
   mode of `pdev(u) = Σ_i d_i + ‖u‖²`; stage 2b: the exact mode): `η̃`, `μ̃`, the prior-weighted deviance residuals
   `d_i` and the Fisher weights `W_i = w_i μ'(η̃_i)² / V(μ̃_i)`.
2. `M'WM + I` is **diagonal** (one scalar term): `L_j² = 1 + Σ_(i: g(i)=j) W_i c_i²`; `ldL2 = Σ_j log L_j²` as in
   stage 2a. The **conditional standard deviation** of level `j` is `σ_j = 1/L_j`.
3. For each level `j` and node `k`, with `t = z_k σ_j` (the node moved to the mode and scaled):
   `Δ_jk = (ũ_j + t)² − ũ_j² + Σ_(i: g(i)=j) [ d_i(μ(η̃_i + c_i t)) − d_i(μ̃_i) ]`,
   the change of level `j`'s share of the penalised deviance when `u_j` alone moves from `ũ_j` to `ũ_j + t` (lme4's
   link and variance functions, with their clamps, and the deviance residuals of the family with the prior weights;
   rows with `c_i = 0` do not change). A node `z_k = 0` has `Δ_jk = 0`.
4. **Deviance**:

   `D_K(θ, β) = Σ_i d_i + ‖ũ‖² + ldL2 − 2 Σ_j log( Σ_k w_k exp(−(Δ_jk − z_k²)/2) )`

   (compute each term as `exp(log w_k + z_k²/2 − Δ_jk/2)`; lme4 takes the log of the product over levels instead of
   the sum of logs, the same value). The last term is called `quad` in the fixture.

Where it comes from: level `j`'s contribution to the likelihood is `∫ exp(−(Σ_(i∈j) d_i(u) + u²)/2) du / √(2π)`;
substituting `u = ũ_j + σ_j z` and applying the rule to the integrand divided by `φ(z)` gives
`exp(−devc_j/2) σ_j Σ_k w_k exp(−(Δ_jk − z_k²)/2)` with `devc_j = Σ_(i∈j) d_i + ũ_j²`, whose `−2 log` summed over
levels is `D_K`. Consequences, all checked in R:

- **There is no aic term**: the likelihood of each observation is replaced by `exp(−d_i/2)`, the likelihood relative
  to the saturated model **with the dispersion fixed at 1**. `D_K` is not comparable with `d₁` or with glm's −2
  log-likelihood. For binomial responses with `n_i = 1` and prior weights 1 (0/1 data) the aic term equals `Σ d_i`
  and the two scales agree; for binomial counts and for poisson, `aic − Σ d_i` does not depend on the parameters, so
  the estimates are those of the full likelihood but `logLik` is shifted (cbpp: `logLik` −92.03 with `nAGQ = 1`,
  −50.06 with `nAGQ = 2`).
- **For Gamma, inverse.gaussian and gaussian (log or inverse link) the dispersion is not estimated** but held at 1:
  `D_K` is not a likelihood of the model with its dispersion, and the estimates differ from `nAGQ = 1` far beyond the
  quadrature error (fixture data, Gamma with the log link: θ 0.648 with `nAGQ = 1`, 0.305 with `nAGQ = 5`;
  inverse.gaussian with the log link: θ 1.66 with `nAGQ = 1`, 0 (boundary) with `nAGQ = 3`). This is what R computes
  and rStats.js reproduces it (see "rStats.js's choices").
- With a one-point rule (`z = 0`, `w = 1`) the formula would give `Σ d_i + ‖ũ‖² + ldL2`, the Laplace deviance with
  `Σ d_i` instead of the aic term; lme4 never uses it: `nAGQ = 1` is `d₁` (stage 2a).
- At `θ = 0`: `ũ = 0`, `σ_j = 1`, `Δ_jk = z_k²`, so `quad = 0`, `ldL2 = 0` and `D_K = Σ d_i` at `μ(o + Xβ)` (no
  quadrature at all).
- `D_K` is even in θ (`θ → −θ` with `ũ → −ũ` and a symmetric rule), so lmer's sign and boundary treatment applies
  as for `d₁`.
- The scale `σ_j` uses the Fisher weights also for non-canonical links (those of `M'WM + I`); rStats.js uses them at
  the exact mode, lme4 those of its last PIRLS iteration (as its `ldL2`), so lme4's `D_K` differs from the exact one
  by up to 1.6e-6 (relative) in the fixture (most cases below 1e-8).
- A node whose `Δ_jk` is NaN (a mean outside the family's range, possible with the inverse links far from the data)
  makes the deviance NaN; as for other failed evaluations (stage 2c, "Failures") the evaluation counts as +∞. Not
  seen in the fixtures (no clamp of lme4's links is active at any node of either fixture; the oracle checks it).

### The fixture glmerAgqDeviance (`oracle/glmeragqdev.R`)

Arguments: `formula`, `data` (with `dataTypes`), `family`, `link`, optional `weights` and `offset`, `nAGQ` (a string,
`"2"` to `"100"`), `theta` (one value) and `beta`. Expected (lme4's deviance function after its initial PIRLS):
`deviance`, `u`, `b`, `mu`, `devResid` (`Σ d_i`), `ussq`, `ldL2`, `quad`, and `nodes`, `weights` (lme4's rule);
`reference`: the same at the exact mode with the exact rule (110-bit arithmetic), plus `condSd` (the `σ_j`). 23
cases: cbpp with `K` = 2, 3, 5, 9, 25 and 100 at the same parameters (the deviance converges in `K`: 100.1149,
100.0789, 100.0114, 100.01005, 100.010042 for 25 and 100), far from the optimum, the proportion with weights (the
same deviance as `cbind`), probit; 0/1 binomial far from the optimum, θ = 0, cloglog, `(0 + x | g)`, missing values,
a factor response (written as strings); poisson with an offset, prior weights, the sqrt link; Gamma (log, three `K`,
weights), inverse.gaussian (log), gaussian (log).

**Accuracy required**, against `reference`: `deviance`, `devResid`: relative 1e-10; `ldL2`, `ussq`, `quad`: absolute
`1e-10 × max(1, |value|)`; `u`, `b`, `mu`: within `1e-9 ×` the largest absolute element; `condSd`: relative 1e-10;
the rule: `nodes` within `1e-14 × max(1, |z|)`, `weights` relative 1e-11 (the smallest weights of `K = 100` are
sensitive to the last bits of their nodes; their effect on the deviance is nil). Against `expected` (lme4): print the largest differences
(deviance 1.6e-6 relative, at 1e-8 or less in most cases); a check within 1e-4 (relative) guards against gross
errors.

### The fit

As stage 2c ("The estimate of rStats.js") with `d₁` replaced by `D_K`: **the exact minimiser of `D_K(θ, β)`**
(computed at the exact conditional mode with the exact rule) over θ ≥ 0 and β, started from the exact minimiser of
the nAGQ = 0 deviance `d₀` from the initial θ (or `start.theta`) and its β (or `start.fixef`), with lmer's boundary
treatment (θ̂ exactly 0 when the minimiser is on the bound; θ held at 0 and released as there) and the comparison
with the boundary point of the term (θ = 0, β minimised; the rule of stage 2c). lme4 does the same as for
`nAGQ = 1` (initial PIRLS, phase 1 with BOBYQA on `d₀`, phase 2 with Nelder-Mead on `D_K` from the end of phase 1,
the finite-difference Hessian, the boundary check); the start, its errors and the initial PIRLS errors are those of
`nAGQ = 1` ("API"). The fixture's references were reached from lme4's estimates; none moved to the boundary point.
The analytic gradient is not required (G11); `D_K` is as smooth as `d₁` (it is accurate to about 1e-14 relative when
the mode is exact).

### The results

Every field of "The results" is computed as for `nAGQ = 1` at the AGQ optimum `(θ̂, β̂)` and the conditional mode
`ũ` there, with these differences:

- `nAGQ`: `K`.
- `logLik = −D_K(θ̂, β̂)/2`, so `AIC` and `BIC` too are on the AGQ scale (no aic term; see above). `df` is unchanged
  (`p + 1 + s`; the dispersion is counted for Gamma, inverse.gaussian and gaussian although `D_K` holds it at 1).
- `vcov`: the same rule (`"hessian"` when the fit is not singular, `n < 10000` and `1 + p < 20`), with `H` the
  Hessian of `D_K` in `(θ, β)` at the optimum; `"RX"` (singular fits) is unchanged: `sigma² (R_X'R_X)⁻¹` with the
  Fisher weights at the mode (the quadrature does not enter it).
- `ranef`, `fitted`, `linearPredictor`, the four residual types, `deviance` (`Σ max(0, d_i)`), `sigma`, `varCorr`:
  the definitions of `nAGQ = 1` at `(θ̂, β̂, ũ)`; the random effects are the **conditional modes** `Λ_θ̂ ũ`, not
  means under the quadrature (lme4 restores the mode after the quadrature).
- `singular`, `messages` (`boundary (singular) fit: see help('isSingular')` under the same conditions), `warnings`:
  unchanged.

For stage 3: R's summary heads the fit `Generalized linear mixed model fit by maximum likelihood (Adaptive
Gauss-Hermite Quadrature, nAGQ = K)` (`(Laplace Approximation)` for `nAGQ = 1`, and the AGQ wording also for
`nAGQ = 0`), and `anova` comparing a fit with `nAGQ > 1` with a `glm` fit is the error `GLMMs
with nAGQ>1 have log-likelihoods incommensurate with glm() objects` (between glmer fits with different `nAGQ` R
gives no error and compares the incommensurate log-likelihoods).

### The fixture glmerAgq (`oracle/glmeragq.R`)

The fields, the reference's computation (double-precision search from lme4's estimate, the boundary point,
Newton's method in 110-bit arithmetic; the gradient at the reference below 1e-17 except inverse.gaussian, 4e-16) and
the accuracy required are those of the fixture glmer, with `D_K` for the deviance (`devianceAtLme4` is `D_K` at
lme4's estimates). The oracle uses `oracle/glmer.R`'s functions unchanged through `oracle/_glmeragq.R` and takes
about 8 minutes. 21 cases (5 errors): cbpp with `K` = 2, 5, 25, the proportion with weights (9), probit (9); 0/1
binomial with `K` = 3 and 10, `(0 + x | g)` with the optimum on the boundary (`"RX"`, singular), missing values (7);
poisson (log 5, offset 9, on the boundary 5); Gamma (log, 3 and 9), inverse.gaussian (log 5, on the boundary),
gaussian (log 3); the errors `(1 | g) + (1 | h)`, `(x | g)` (message 1), `(x || g)`, `(1 | g) + (x | g)` (message
2) and `nAGQ = 101`. Largest differences of lme4 from the reference: θ 1.6e-5, β 8e-4 (relative to the largest
element, on 0/1 data whose β are about 0.01), standard errors 4e-5 (relative), `logLik` 1.1e-7 (relative), `fitted`
3e-5, `sigma` 1e-5: lme4's AGQ fits are much closer than its Laplace fits.

## glmerSummary and glmerAnova (stage 3; to be written)

## predict (stage 4; to be written)
