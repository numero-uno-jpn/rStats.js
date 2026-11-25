# 1.17.0 (Tobit, beta regression, log-linear models): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the documentation and from the
output of exported functions compared with candidate formulas written for these experiments. All runs: R 4.6.2 x86_64
(`rstats-oracle-amd64:4.6.2`), AER 1.2.17, betareg 3.2.6, Formula 1.2.6, survival 3.8.12, MASS 7.3.66, scripts checked
with `scripts/r-experiment-check.mjs`. Issue #567 has the summaries.

Some scripts were edited in place between runs (marked "replaced"); the attempt is described here and the final
script keeps the search that succeeded.

## tobit and survreg (2026-11-25)

1. `regression117-tobit.R` (first version, replaced): `tobit(..., dist = "t", df = 3)` outside a `tryCatch`.
   **Failed to run**: `unused argument (df = 3)` (from `survreg.control`): tobit's t takes its degrees of freedom as
   `parms`, not `df`. The call was moved into a `tryCatch` and the error recorded.
2. (second version, replaced): `summary(tobit)$coefficients` written with `unname`. **Failed to run**: it is a
   `coeftest` object, which jsonlite cannot write; written as a plain matrix.
3. (final version): six data cases (y already clipped at 0; raw y with values below 0; both limits -0.5 and 2 clipped
   and raw; right limit only; no limits) x dist gaussian, logistic, t. Candidates against tobit's coefficients, log
   scale, log-likelihoods and variance:
   - `survreg(Surv(pmax(y, left), y > left, type = "left"))` (left limit only): difference 0 in every case.
   - `survreg(Surv(pmin(y, right), y < right))` (right limit only): difference 0.
   - `Surv(lo, hi, type = "interval2")` with `lo = NA` where `y <= left` and `hi = NA` where `y >= right`, the other
     end being y itself: difference 0 when y was already clipped, **13-22 when it was not** (the censored end must be
     the limit, not the raw y).
   **Settled:** tobit fits survreg to y clipped to [left, right], with `y <= left` left censored at `left` and
   `y >= right` right censored at `right` (a value equal to a limit counts as censored). `icoef` is the intercept-only
   fit's (difference to `tobit(y ~ 1)` 1e-16) and `loglik[1]` its log-likelihood, so McFadden's R^2 of ReactiveStat
   is `1 - loglik[2] / loglik[1]`. Fields: those of survreg plus `formula`; summary has `wald`, and prints the counts
   Total / Left-censored / Uncensored / Right-censored. `dist = "t"` with `parms = 5` gives `parms` 5.

## The Wald statistic of summary(tobit) (2026-11-25)

4. `regression117-tobit-wald.R` (first version, replaced): the candidate helper called `solve` on a 0 x 0 matrix for
   the intercept-only model. **Failed to run**; the helper returns NA there.
5. (final version): candidate `b' V^-1 b` over the coefficients other than `(Intercept)` (without Log(scale)), df = their
   number. Equal to R's `wald` to the last digit for a model with an intercept (two regressors, one, a factor, weights,
   both limits). **Without an intercept** the statistic is the same quadratic form over all coefficients (62.789 for
   x1 and x2) but R prints and tests it **on 1 Df** (the number of coefficients minus 1; p-value 2.3e-15 is
   `pchisq(62.79, 1)`'s tail). The intercept-only model has no `wald` (NULL) and prints no Wald line. Weights: tobit
   equals survreg with the same weights (difference 0). The `y` field with both limits is `type = "interval"` with
   status 0 / 1 / 2 (right / exact / left); with the left limit only it is `type = "left"`. `logLik` df = coefficients
   + 1 (scale).

## betareg: the fit (2026-11-25)

Sources read: the help pages of `betareg`, `betareg.control`, `predict.betareg`, `residuals.betareg`,
`summary.betareg` (as text from the installed Rd files), and the formulas of the papers they cite.

6. `regression117-betareg.R` (first version, replaced): the Newton step was stored in a variable `step`; the checker
   rejects the name (base's `step`). Renamed `nstep`.
7. (final version): 6 mean links x {constant phi (identity link), `y ~ x | z` (log link)}, plus phi links log
   (constant) and sqrt, and weights. Candidates and results:
   - log-likelihood `sum(w * dbeta(y, mu phi, (1 - mu) phi, log = TRUE))`: difference 0 to 6e-14. **Settled.**
   - vcov = inverse of the expected information of Simas et al. (2010) (blocks X'WX, X'CZ, Z'DZ with trigamma terms
     and the derivatives of both inverse links, times the case weights): difference 1e-17 to 2e-14. The inverse of
     the observed information (numerical Hessian): 5e-4 to 2e-2 (wrong). **Settled.**
   - starting values: mean coefficients = `lm.wfit(X, g(y), w)` (difference 0); phi0 =
     `sum(w (mu (1 - mu) / s2 - 1)) / sum(w)` with `s2 = sum(w e^2) / (sum(w) - p) * (dmu/deta)^2` at the lm's fit
     (the weighted candidate; the unweighted one differs when there are weights), given on the scale of link.phi
     (identity: phi0; log: log phi0; sqrt: sqrt phi0), and 0 for the other precision coefficients. **Settled.**
   - pseudo R^2 = squared weighted correlation of eta and g(y) (the case weights; difference 1e-16). The unweighted
     correlation differs with weights. **Settled.**
   - R's point is not the exact maximum: a Newton step on the candidate log-likelihood from R's estimates is up to
     3e-7 (constant phi with the identity link, phi about 26) and 1e-9 to 2e-9 for the log link. Iteration counts
     (BFGS function / gradient evaluations, then Fisher scoring) are printed as "Number of iterations: 12 (BFGS) + 2
     (Fisher scoring)" and kept in `summary$iterations`. An implementation that maximises more exactly agrees with R
     to about 1e-8 relative, not to the last digit.
   - names: mean coefficients by their terms, the precision ones `(phi)` (constant) or `(phi)_<term>`; logLik df =
     all coefficients. Fields of the fit and of summary recorded in the JSON.

## betareg: BC and BR (2026-11-25)

The user decided to implement all three estimators (ML, BC, BR). Source of the candidate: the general method of
Kosmidis and Firth (2010), cited by the help page. Expectations computed here by numerical integration over the beta
density per observation (not from closed forms), in the two linear predictors and carried to the coefficients by the
model matrices.

8. `regression117-betareg-bias.R` (first version, replaced): `integrate` with `rel.tol = 1e-12` stopped with
   "roundoff error was detected". Relaxed to `1e-10` with `stop.on.error = FALSE`.
9. (final version): candidate A_t = 1/2 tr(F^-1 (P_t + Q_t)), P_t = E(U U' U_t), **Q_t = E(-H U_t)**, b = -F^-1 A.
   **Failed**: the precision component near R's `bias` (1.4045 against 1.4018) but the mean components wrong (sign
   and size). What it did settle: R's `bias` field is set for BC only (NULL for ML and BR); BC = ML - `bias` exactly
   (14.18575 - 1.40181 = 12.78394); vcov of BC and BR = inverse expected information **at the BC / BR estimates**
   (1e-11; at the ML estimates 0.3-1.8 off); BC's iteration counts are ML's; BR prints
   "Number of iterations: 16 (BFGS) + 18 (quasi Fisher scoring)" and "Type of estimator: BR (bias-reduced)".
10. `regression117-betareg-bias2.R` (added): the bias split as `-F^-1` times the P part, the Q part (E(-H U_t)), and
    Q without the links' second derivatives; least squares for R's `bias` = a bP + b bQ (+ c bQ0). **Found:**
    a = 1, b = -1 (residual 1e-11 to 1e-13; the Q without link second derivatives gets weight 1e-8). So the sign of Q
    in attempt 9 was wrong: **Q_t = E(H U_t)** (H the Hessian of the log-likelihood, not its negative), the
    Kosmidis-Firth adjustment as published.
11. `regression117-betareg-bias3.R` (added): with Q_t = E(H U_t): R's `bias` and BC to 1e-10 (the integration's
    accuracy), constant and modelled phi, logit and probit, with case weights (each observation's F, P and Q times
    its weight). At R's BR estimates the adjusted score U + A is 1e-7 to 1e-11 while the score alone is 0.1-2.2.
    **Settled:** BR solves U(theta) + A(theta) = 0; BC = ML - b(ML).
