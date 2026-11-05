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
- **Stage 2c**: the fit for the binomial and poisson families with `nAGQ = 1` (and `nAGQ = 0`), exported as `glmer`
  from the area `mixed`.
- **Stage 2d**: the other families (Gamma, inverse.gaussian, gaussian with a non-identity link).
- **Stage 2e**: adaptive Gauss-Hermite quadrature, `nAGQ > 1`.
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
  accepting `cbind(a, b)` with two column names as the one special left-hand side) is decided in stage 2c.

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
only change where lme4's PIRLS starts. Whether the API offers them is decided in stage 2c.

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
single random-effects term with one column: error `nAGQ > 1 is only available for models with a single, scalar
random-effects term` (stage 2e).

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

## The fit (stage 2c; to be written)

What the fit stage will need, briefly (lme4's defaults, `glmerControl()`):

- **Two phases.** Phase 1 (`nAGQ0initStep = TRUE`): minimise the nAGQ = 0 deviance over `θ` with BOBYQA from the
  initial θ (or `start`), lower bounds of the structure, no upper bounds. If `nAGQ = 0` this is the fit (followed by
  the boundary check below). Otherwise phase 2 minimises the nAGQ deviance over `(θ, β)` jointly with Nelder-Mead,
  starting from phase 1's θ and phase 1's PIRLS `β` (or `start`), with the lower bounds of θ and no bounds on β;
  the deviance function's `lp0` is phase 1's final linear predictor. Nelder-Mead's initial steps are 0.02 for θ
  and `0.2 × min(sd_j, 10)` for β (`sd_j` from `R_X` of phase 1's last PIRLS, the unscaled standard errors), with
  `xt = 5e-4 ×` those.
- **Boundary check** (`boundary.tol = 1e-5`): each element of θ within 1e-5 of its (lower) bound but not on it is set
  to the bound if that lowers the deviance; then the deviance is evaluated at the final parameters.
- **Results.** θ̂ and β̂ (for nAGQ ≥ 1 the optimiser's, for nAGQ = 0 phase 1's PIRLS `β`), `u` from the evaluation at
  the final parameters, the deviance = the optimiser's minimum (`deviance(fit)`, `logLik`, `AIC`, `BIC` follow from
  it; to be specified). lme4's convergence checks (derivatives by finite differences, "Model failed to converge
  ...") are not reproduced, as for lmer.
- As for lmer, the reference will be the exact minimiser of the exact-mode deviance of this file. lme4's own
  deviance function is perturbed at the 1e-6 level by its PIRLS (above), so lme4's estimates may be farther from
  the exact minimiser than for lmer; the fixture will record both.

## Adaptive Gauss-Hermite quadrature (stage 2e; to be written)

## glmerSummary and glmerAnova (stage 3; to be written)

## predict (stage 4; to be written)
