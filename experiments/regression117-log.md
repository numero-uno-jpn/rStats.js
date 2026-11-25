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

## betareg: residuals, predictions, confint, input errors (2026-11-25)

With y* = logit(y), mu* = digamma(mu phi) - digamma((1 - mu) phi), v = trigamma(mu phi) + trigamma((1 - mu) phi).

12. `regression117-betareg-resid.R` (first version, replaced): a variable `se` (a name the checker rejects, as in
    earlier versions); renamed `sev`. (BSD sed has no `\b`; the rename used `[[:<:]]`.)
13. (final version): candidates for the seven types, constant and modelled phi, with and without weights.
    - quantile = `qnorm(pbeta(y, mu phi, (1 - mu) phi))`, response = y - mu, pearson = (y - mu) / sqrt(mu (1 - mu) /
      (1 + phi)): difference 0 without weights. The default type is quantile.
    - weighted: of the candidates (y* - mu*) / sqrt(v), / sqrt(phi v), sqrt(phi) (y* - mu*) / sqrt(v), **the second**
      (0). sweighted: **(y* - mu*) / sqrt(v)** (the values equal the first candidate; not divided by sqrt(1 - h)).
      sweighted2: **(y* - mu*) / sqrt(v (1 - h))** (4e-16) with h the diagonal of W^1/2 X (X'WX)^-1 X' W^1/2,
      W = w phi v (dmu/deta)^2 (= `hatvalues`, 6e-17; with weights only when W includes w). The names do not follow
      the order of the paper's equations as one might guess; recorded as found.
    - deviance with the saturated mean y and `max(., 0)`: **0.10 off** (wrong).
    - predict: response, link, precision, variance = mu (1 - mu) / (1 + phi), density, quantile = qbeta, probability;
      `at` of the same length as the rows is taken elementwise by default (3 rows, at = 3 values gave a vector),
      `elementwise = FALSE` gives a rows x at matrix, a single `at` a vector; `parameters` has columns mu, phi.
    - confint = Wald with qnorm (0 and 2e-16), rows `(Intercept)`, `x1`, `(phi)_(Intercept)`, `(phi)_z1`, columns
      "2.5 %" "97.5 %". summary z and p = Wald with 2 pnorm(-|z|) (0).
    - errors: y < 0 or > 1: "invalid dependent variable, all observations must be in [0, 1]"; y = 0 or 1 switches to
      xbetax (here it failed for want of the package statmod; rStats.js will reject it, the user's decision); bad link:
      "'arg' should be one of ..." with the six (mean), three (phi), ML/BC/BR (type). A missing y drops the row
      (nobs 49); a zero weight gives the same coefficients as dropping the row.
14. `regression117-betareg-resid2.R` (added): weights: **every type except response is multiplied by sqrt(w)**
    (quantile, pearson, weighted, sweighted, sweighted2 to 4e-16). Deviance candidates with the mean maximised at the
    fitted phi (`optimize`), with the sign of y* - mu*: 0.15-1.9 off (wrong; the maximised log-likelihood is above
    the one at mean y by up to 2.7, so it is not the saturated term R uses).
15. `regression117-betareg-dev.R` (added): the values side by side: R's deviance^2 / 2 equals `l(y | mean y) -
    l(y | mean mu)` in absolute value; 4 of 50 observations have a negative difference (mean y is not the maximum).
    **Settled:** deviance = sign(y - mu) sqrt(2 |l(y | y, phi) - l(y | mu, phi)|) (2e-13), times sqrt(w).

## loglin (2026-11-25)

Sources: the help page of `loglin` (IPF as in Haberman 1972, AS 51; margins in the given order; convergence when the
largest absolute margin difference is below `eps`; df without adjustment for structural zeros; parameters with
zero-sum constraints).

16. `regression117-loglin.R` (first version, replaced): candidate variables `ca` and `cb` (rejected by the checker:
    ca's function); renamed `cand_a`, `cand_b`.
17. (final version): IPF candidates (scale the fit by observed / fitted margin, 0 where the fitted margin is 0) with
    the deviation (a) the largest |observed - fitted| margin difference seen **before** each adjustment during a cycle,
    (b) measured after the cycle. **(a) settled**: iteration count and printed deviation equal R's in all 13 cases
    (2-way, 3-way with 4 margin sets, names, sampling zeros, a start with a structural zero, eps 1e-8, iter 2, 4-way,
    saturated, empty margin list), fit to 3e-14; (b) gives one iteration fewer and fits 0.01-0.05 off. Consequences:
    a model that fits in one cycle prints "2 iterations: deviation 3.6e-15" (the second cycle sees the deviation);
    `iter` reached prints the last deviation and warns "algorithm did not converge"; the empty margin list does 0
    iterations, fit = start * sum(table) / sum(start), param only "(Intercept)".
    lrt = 2 sum obs log(obs / fit) over cells with obs > 0 **and fit > 0** (the structural zero's observed 8 is left
    out: lrt 4.135 while the plain formula gives NA); pearson = sum over fit > 0. param: names "(Intercept)", factor
    names, "A.B" for interactions; candidate = the zero-sum decomposition of log(fit) (grand mean, main effects,
    two-way terms) to 7e-16.

## loglm (2026-11-25)

Source: the help pages of `loglm` and `loglm1` (eps 1/10, iter 40, param TRUE; one df off per structural zero).

18. `regression117-loglm.R` (first version, replaced): a list element `m` (the checker's nls `m` rule) and `unclass`;
    renamed `mg`, plain matrices. (second version, replaced): `as.matrix(anova)` keeps the class; written as a plain
    numeric matrix.
19. (final version): loglm = loglin with the margins = the formula's maximal terms in the order of the terms object
    (`~ Hair + Eye:Sex + Hair:Eye` -> Eye.Sex, Hair.Eye; `^2` expanded; numbers as dimension names give margin names
    `.v1` ...), eps 0.1, iter 40: fit and lrt difference 0 in 7 forms. Fields: lrt, pearson, df, margin, fitted,
    param, call, formula, frequencies, deviance, nobs, terms. Printed "Statistics:" table with Likelihood Ratio and
    Pearson, X^2, df, P(> X^2). residuals: default deviance = sign(o - f) sqrt(2 |o log(o / f) - (o - f)|) (0 log 0 = 0),
    pearson (o - f) / sqrt(f), response o - f (all 0). anova: "LR tests for hierarchical log-linear models", rows
    Model 1..k and "Saturated" with Deviance, df, Delta(Dev), Delta(df), P(> Delta(Dev)). Data frame with frequencies:
    lrt equals glm(poisson)'s deviance to 7e-6 (IPF's eps), df equal; two missing cells: df 7 = 9 - 2, as glm.

## tobit with the positive distributions (2026-11-25)

ReactiveStat (`Tobit回帰.php`) also passes weibull, lognormal and exponential to tobit (and stopped printing McFadden's
R^2: AIC and the likelihood-ratio test against `y ~ 1` only).

20. `regression117-tobit-logdist.R` (added): weibull, lognormal, exponential, loglogistic, rayleigh x limits (1, Inf),
    (-Inf, 4), (1, 4), (0, Inf): tobit = `survreg(Surv(lo, hi, type = "interval2"))` with lo = NA, hi = left where
    y <= left and lo = right, hi = NA where y >= right (difference 0 in all 20). AIC = -2 loglik + 2 df with df =
    coefficients + 1 (2 for exponential and rayleigh, whose scale is fixed at 1 and 0.5). Errors: zeros in y with
    weibull and the default left = 0: "Invalid survival times for this distribution" (the limit 0 is log 0);
    left >= right: "all(left < right) is not TRUE"; every y censored: "initial iteration failed (use starting
    estimates?)". Gaussian with zeros at the default left = 0 fits.

## Gamma regression (2026-11-25)

21. No experiment: ReactiveStat (`ガンマ・ベータ回帰.php`) calls `glm(family = Gamma(link) | inverse.gaussian(link))`,
    `summary`, `confint(level)` (profile likelihood), `AIC`, `summary$dispersion`, and the null model's `logLik` for
    the likelihood-ratio test. The existing fixtures cover these: `oracle/glm.R` (Gamma with inverse, identity, log,
    sqrt, 1/mu^2 links and inverse.gaussian, aic), `oracle/glmconfint.R` (Gamma and inverse.gaussian),
    `oracle/glmformula.R` (Gamma with the formula entry). Nothing new to implement.

## betareg: the bias terms of cloglog and loglog (2026-11-25)

The implementation (closed forms of the Kosmidis-Firth adjustment, in the behaviour file) agreed with
`oracle/betareg.R` everywhere except BR with link cloglog (and link.phi sqrt), 3e-4 off.

22. `regression117-betareg-sqrt.R` (added): R's ML, BC and BR for {logit, cloglog} x {log, sqrt}, compared outside R
    with rStats.js: logit agrees to 1e-10 with both precision links; cloglog's ML agrees, its BC and BR are 1e-5 to
    8e-4 off with both. So the mean link, not the precision link.
23. `regression117-betareg-d2.R` (added): R's BC bias for all six mean links: logit, probit, cauchit, log agree to
    3e-11; cloglog and loglog do not (3e-4, 7e-4). Candidates for cloglog's second derivative of the inverse link
    in the bias terms (the exact one, its negative, 0, the first derivative, -d1 e^eta, loglog's, d1 e^eta (1 - e^eta)):
    **none fits** (all 1e-4 to 3e-3 off).
24. `regression117-betareg-d2b.R` (added): intercept-only models with constant phi (all observations share eta, so the
    bias is linear in the one value d2(eta0)); five data sets with means 0.1 to 0.9; the value R uses solved from the
    intercept's bias. **Found:** where the exact d2 is positive (cloglog with eta < 0, loglog with eta < 0) R's value
    equals it (8 digits); where it is negative R's value is 0 (1e-15 to 5e-13, i.e. floored at about eps). logit's
    negative values are used unfloored (attempts 9-11). **Settled:** for cloglog and loglog, d2 = max(exact, eps).
    With that floor rStats.js agrees with R's BC and BR for every link.
