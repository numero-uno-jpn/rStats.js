# Tobit regression, beta regression and log-linear models: tobit, betareg, loglin and loglm (draft, 1.17.0)

Reference basis: the documentation of AER 1.2-17 (`tobit`), betareg 3.2-6 (`betareg`, `betareg.control`,
`predict.betareg`, `residuals.betareg`, `summary.betareg`), stats (`loglin`) and MASS 7.3-66 (`loglm`, `loglm1`), and
the papers they cite: Ferrari and Cribari-Neto (2004), Simas, Barreto-Souza and Rocha (2010), Espinheira, Ferrari and
Cribari-Neto (2008), Dunn and Smyth (1996), Kosmidis and Firth (2010), Haberman (1972, AS 51). R 4.6.2 public-call
results (x86_64) in `experiments/regression117*.R`, every attempt (the failed ones too) in
`experiments/regression117-log.md`, summaries on Issue #567. No R or package source was consulted.

The calls followed are ReactiveStat's (`scripts/多変量/Tobit回帰.php`, `ガンマ・ベータ回帰.php`).

## Scope (decided 2026-11-25)

- `tobit(formula, data, options)` (AER's): `left` (default 0), `right` (default Infinity), `dist` (the survreg
  distributions; ReactiveStat uses gaussian, logistic, weibull, lognormal, exponential), `df` for t, `weights`;
  `tobitSummary(fit)` with the Wald test. Built on the existing `survreg`.
- `betareg(formula, data, options)` (betareg's): `y ~ x` (constant phi) and `y ~ x | z` (modelled phi); mean links
  logit, probit, cloglog, cauchit, log, loglog; phi links identity, log, sqrt; `type` "ML", "BC", "BR" (all three,
  the user's decision); `weights`. Responses must be in (0, 1): 0 or 1 is an error (the user's decision; R switches
  to the extended-support "xbetax" distribution). `betaregSummary`, `betaregConfint`, `betaregPredict`,
  `betaregResiduals` (all seven types, the user's decision).
- `loglin(table, margin, options)` (stats') and `loglm(formula, data, options)` (MASS's) with `loglmAnova`.
- Gamma regression: the existing `glm` (Gamma, inverse.gaussian); nothing new.
- Entry point `/regression`.

## tobit (log 1-5, 20)

`tobit(formula, left, right, dist)` = `survreg` on the response clipped to [left, right]:
`y <= left` is left censored at `left`, `y >= right` right censored at `right` (a value equal to a limit is
censored), others exact. With both limits finite this is `Surv(lo, hi, type = "interval2")`, lo = NA / hi = left for
the left censored and lo = right / hi = NA for the right censored; with one limit the "left" or right censoring of
survreg (identical results). Same for every distribution, also the log-time ones (the limits on the scale of y).
Everything else (iterations, `icoef` = intercept-only fit, `loglik` = [null, model]) is survreg's.

- t: R takes the degrees of freedom as `parms`; `df =` is an error in R. rStats.js: `df` (as its `survreg`).
- Errors: `left >= right`: "all(left < right) is not TRUE"; every y censored: survreg's "initial iteration failed
  (use starting estimates?)"; a log-time distribution with y <= 0 at the default left = 0: "Invalid survival times
  for this distribution".
- logLik df = coefficients + number of free scales; AIC = -2 loglik + 2 df.
- McFadden's R^2 (ReactiveStat, earlier versions) = 1 - loglik[2] / loglik[1]; the LR test against `y ~ 1` =
  2 (loglik[2] - loglik[1]) on (df - idf), which is survreg's `chi`.

### summary: the Wald statistic

`wald = b' V^-1 b` over the coefficients other than "(Intercept)" (Log(scale) excluded), V their block of vcov. Its
df is **p - 1** (p = number of regression coefficients) and the p-value `pchisq(wald, p - 1, lower = FALSE)`. With an
intercept this is the number of coefficients tested; **without an intercept R tests p coefficients on p - 1 df** (kept
as R). Intercept-only model: no Wald test. Observations: Total, Left-censored, Uncensored, Right-censored.

## betareg (log 6-15)

Notation: mu_i = g1^-1(x_i' beta), phi_i = g2^-1(z_i' gamma), a = mu phi, b = (1 - mu) phi, w the case weights.

### The fit
- log-likelihood `sum w_i log dbeta(y_i; a_i, b_i)`.
- vcov = inverse of the expected information (Simas et al. 2010), with d1 = dmu/deta1, d2 = dphi/deta2,
  t1 = psi'(a), t2 = psi'(b): `W = w phi^2 (t1 + t2) d1^2`, `C = w phi (t1 mu - t2 (1 - mu)) d1 d2`,
  `D = w (t1 mu^2 + t2 (1 - mu)^2 - psi'(phi)) d2^2`; K = [[X'WX, X'CZ], [Z'CX, Z'DZ]].
- starting values (R's, for reference; any start that reaches the maximum will do): beta0 = weighted least squares of
  g1(y) on X; phi0 = sum(w (m (1 - m) / s2 - 1)) / sum(w), m the lm's fitted means, s2 = sum(w e^2) / (sum(w) - p) *
  d1(eta)^2; gamma0 = (g2(phi0), 0, ...).
- R maximises by BFGS then Fisher scoring until the squared step < 1e-8. R's estimates are not the exact maximum (a
  Newton step from them is up to 3e-7 for phi about 26, identity link). **rStats.js maximises to convergence; the
  fixtures are compared at a relative tolerance of about 1e-6 for the estimates and quantities built on them.**
  Iteration counts are not R's.
- pseudo R^2 = the squared (weighted, case weights) correlation of eta1 and g1(y).
- names: mean coefficients by their terms; precision `(phi)` (constant phi with the identity link) or `(phi)_<term>`
  (modelled phi, and constant phi with the log or sqrt link: `(phi)_(Intercept)`).
- The log link: R fails with "initial value in 'vmmin' is not finite" when its start gives a mean of 1 or more (the
  log-likelihood at the start is not finite); rStats.js gives the same error from the same start.
- df.null = n - 2, df.residual = n - p - q; nobs = observations with non-zero weight; rows with a missing value are
  dropped; a zero weight gives the same coefficients as dropping the row.
- link.phi default: identity for `y ~ x`, log for `y ~ x | z`.

### BC and BR (Kosmidis and Firth 2010)
U the score, F = K the expected information, H the Hessian of the log-likelihood.
A_t = 1/2 tr(F^-1 (P_t + Q_t)), P_t = E(U U' U_t), Q_t = E(H U_t) (each observation's terms times w_i); b = -F^-1 A.
- BC: theta = theta_ML - b(theta_ML); the result's `bias` = b(theta_ML).
- BR: solve U(theta) + A(theta) = 0 (quasi Fisher scoring theta <- theta + F^-1 (U + A) from ML).
- vcov, loglik, pseudo R^2 and everything predicted: at the BC / BR estimates.
- Closed forms (for the implementation, derived here and checked against R's `bias` to 1e-10): with L = (log y,
  log(1 - y)), the scores in (eta1, eta2) are linear in L: s1 = phi d1 (L1 - L2 - E), s2 = d2 (mu L1 + (1 - mu) L2 - E).
  So E(s_a s_b s_c) = sum C_ai C_bj C_ck kappa_ijk with the third cumulants of L (kappa_111 = psi''(a) - psi''(phi),
  kappa_222 = psi''(b) - psi''(phi), mixed -psi''(phi)) and E(H_ab s_c) = (dC_a / deta_b) Sigma C_c' with Sigma the
  covariance of L (psi'(a) - psi'(phi), psi'(b) - psi'(phi), -psi'(phi)).
- **R floors the second derivative of the inverse link at eps for cloglog and loglog** (log 22-24): where
  d2mu/deta2 is negative R uses about 0 in the bias terms (logit's negative values are used as they are). Kept as R
  (it moves BC and BR estimates by about 1e-4).

### summary, confint, predict
- Wald z = estimate / se, p = 2 pnorm(-|z|); confint = estimate -/+ qnorm((1 + level) / 2) se, rows as the names.
- Printed (for reference): quantile residuals' five-number summary, the two tables, "Type of estimator: ML (maximum
  likelihood)" / "BC (bias-corrected)" / "BR (bias-reduced)", log-likelihood on df, pseudo R^2, iterations.
- predict types: response (mu), link (eta1), precision (phi), variance mu (1 - mu) / (1 + phi), quantile / density /
  probability at `at`: elementwise when `at` has as many values as rows (default), else a rows x at matrix
  (`elementwise: false` forces the matrix); parameters (mu, phi).

### residuals (default quantile)
With y* = log(y / (1 - y)), mu* = psi(a) - psi(b), v = psi'(a) + psi'(b), each times sqrt(w) except response:
- quantile: qnorm(pbeta(y; a, b)); response: y - mu; pearson: (y - mu) / sqrt(mu (1 - mu) / (1 + phi))
- deviance: sign(y - mu) sqrt(2 |l(y; mean y, phi) - l(y; mean mu, phi)|) (the absolute value: l at mean y is not
  always above l at mu)
- weighted: (y* - mu*) / sqrt(phi v); sweighted: (y* - mu*) / sqrt(v); sweighted2: (y* - mu*) / sqrt(v (1 - h)),
  h the diagonal of W^1/2 X (X'WX)^-1 X' W^1/2 with W = w phi v d1^2 (= `hatvalues`)

### Errors
- y outside [0, 1]: "invalid dependent variable, all observations must be in [0, 1]"; y equal to 0 or 1: rStats.js
  error (R fits xbetax).
- bad link, link.phi, type: "'arg' should be one of ..." with R's lists.

## loglin (log 16-17)

IPF: fit = start; a cycle adjusts the margins in the given order, each by fit <- fit * observed margin / fitted margin
(0 where the fitted margin is 0). The deviation of a cycle = the largest |observed - fitted| margin difference seen
**just before** each adjustment. Stop when the deviation < eps (default 0.1) or after `iter` cycles (default 20;
"algorithm did not converge" then). A model that fits in one cycle reports 2 iterations (the second cycle sees ~0).
No margins: 0 iterations, fit = start * sum(table) / sum(start).
- lrt = 2 sum obs log(obs / fit) over cells with obs > 0 and fit > 0; pearson = sum (obs - fit)^2 / fit over fit > 0.
- df: cells - 1 - sum over the terms of the hierarchical model of prod(levels - 1); no adjustment for zeros.
- param (zero-sum constraints): the ANOVA decomposition of log(fit), names "(Intercept)", factor names, "A.B"; terms
  by size, then in colex order (P.Q, Q.R, P.S, R.S); every parameter NA when a fitted value is 0 (log 25).
- margin: numbers replaced by names where there are names.

## loglm (log 18-19)

loglin with the margins = the formula's maximal terms in the order of the terms object, eps 0.1, iter 40, param TRUE.
`a:b`, `a*b`, `a/b` give the same margin. A data frame with frequencies on the left builds the full array; cells not
present are structural zeros (start 0) and each takes one df off. deviance = lrt. residuals: deviance (default)
sign(o - f) sqrt(2 |o log(o / f) - (o - f)|), pearson (o - f) / sqrt(f), response o - f. anova: models in order and a
"Saturated" row: Deviance, df, Delta(Dev), Delta(df), P(> Delta(Dev)).

## API decisions (mine, to be confirmed by the user before release)

- Tables for loglin / loglm: `{ counts, dim, names?, levels? }` with counts in R's order (first index fastest), or
  nested arrays (first index outermost); loglm also takes a DataFrame with a frequency column.
- betareg's results keep R's names in camelCase (`pseudoRSquared`, `dfNull`, `dfResidual`, `linkPhi`).
- tobit's t takes `df` (rStats.js's survreg), not `parms`.
