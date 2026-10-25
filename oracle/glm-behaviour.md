# glm: R's behaviour to reproduce

Behaviour of R 4.5.2's `glm` and its methods, for the matrix interface of rStats.js (fixtures `glm`,
`glmConfint` and `glmAnova` from `oracle/glm.R`, `oracle/glmconfint.R` and `oracle/glmanova.R`). It was written
by someone who read R's source, as a description of what R does, without its code; implementations must be written
from this description, R's documentation and the fixtures, not from R's source (R is GPL; rStats.js is MIT). The
messages in quotes are R's and are part of the behaviour. eps is 2^-52 throughout; w denotes the prior weights after
the response is read (for a two-column binomial response, multiplied by n).

Points that are easy to get wrong:
- A power link with lambda <= 0 IS the log link (named "log"), and lambda = 1 the identity link.
- The boundary flag is set after either kind of step halving (divergence or out of bounds).
- "no observations informative at iteration <k>" is a warning (the fit stops, not converged), not an error.
- The gaussian AIC sums log w over all rows, so a prior weight of 0 makes it infinite, as in R.
- The working weights used afterwards (dispersion, influence, standard errors) are those of the last least squares
  step, computed from the means before the last update.

## Families, links and their functions
Variance functions V(mu): gaussian 1; binomial and quasibinomial mu(1 - mu); poisson and quasipoisson mu; Gamma mu^2; inverse.gaussian mu^3; quasi as its `variance` ("constant" 1, "mu(1-mu)", "mu", "mu^2", "mu^3").

Allowed links (anything else is an error; the default is first):
- gaussian: identity, log, inverse
- binomial and quasibinomial: logit, probit, cauchit, log, cloglog
- poisson and quasipoisson: log, identity, sqrt
- Gamma: inverse, identity, log
- inverse.gaussian: 1/mu^2, inverse, identity, log
- quasi: identity (default), logit, probit, cloglog, inverse, log, 1/mu^2, sqrt, and power links

The power link with exponent lambda: lambda <= 0 is the log link and lambda = 1 the identity link (named "log" and "identity"). Otherwise it is eta = mu^lambda, its name is "mu^" followed by lambda rounded to 3 decimals, the inverse is max(eta^(1/lambda), eps) and d mu/d eta is max((1/lambda) eta^(1/lambda - 1), eps). eps is 2^-52 throughout.

Inverse links and derivatives d mu/d eta, with R's clamps:
- logit: the mean is t/(1 + t) with t = eps for eta < -30, t = 1/eps for eta > 30 and t = e^eta otherwise. The derivative is eps when |eta| > 30, else e^eta/(1 + e^eta)^2. The link function is log(mu/(1 - mu)).
- probit: eta is clamped to [-c, c] with c = -qnorm(eps) before pnorm; the derivative is max(dnorm(eta), eps) (unclamped eta).
- cauchit: the same with c = -qcauchy(eps), pcauchy, max(dcauchy(eta), eps).
- cloglog: mean -expm1(-exp(eta)) clamped to [eps, 1 - eps]; derivative max(exp(e) exp(-exp(e)), eps) with e = min(eta, 700); link log(-log(1 - mu)).
- log: mean and derivative max(exp(eta), eps).
- identity: mean eta, derivative 1.
- sqrt: mean eta^2, derivative 2 eta.
- inverse: mean 1/eta, derivative -1/eta^2.
- 1/mu^2: mean 1/sqrt(eta), derivative -1/(2 eta^1.5).

Valid linear predictors: sqrt, 1/mu^2 and power links need all eta finite and > 0; inverse needs all eta finite and nonzero; the other links accept any eta.
Valid means: binomial and quasibinomial all finite and in (0, 1); poisson, quasipoisson and Gamma all finite and > 0; gaussian and inverse.gaussian any; quasi with "mu(1-mu)" all in (0, 1), with "mu", "mu^2" or "mu^3" all > 0, with "constant" any.

Deviance contributions d_i (prior weight w_i):
- gaussian and quasi "constant": w (y - mu)^2
- binomial, quasibinomial and quasi "mu(1-mu)": 2 w [y log(y/mu) + (1 - y) log((1 - y)/(1 - mu))], each term taken as 0 when its y-factor is 0
- poisson and quasipoisson: 2 w [y log(y/mu) - (y - mu)] for y > 0, and 2 w mu for y = 0
- quasi "mu": 2 w [y log(y/mu) - (y - mu)] with log(y/mu) taken as log 1 when y = 0
- Gamma: -2 w [log(y/mu) - (y - mu)/mu], with log(y/mu) taken as 0 when y = 0
- quasi "mu^2": max(-2 w [log(r) - (y - mu)/mu], 0), where r = y/mu for y > 0 and r = 1/mu for y = 0
- inverse.gaussian and quasi "mu^3": w (y - mu)^2 / (y mu^2)

## Inputs and starting means (per family; errors are thrown before fitting)
Below, w denotes the prior weights after this step (for a two-column binomial response, multiplied by n).
- Rows with NA (NaN) in y, x, weights or offset are dropped first (R's na.omit); fitted values, residuals and the like have the remaining rows only. Lengths of y and x that differ are an error: "variable lengths differ (found for 'x1')".
- binomial and quasibinomial, vector y: y of rows with prior weight 0 is set to 0; any y outside [0, 1] is the error "y values must be 0 <= y <= 1"; starting means (w y + 0.5)/(w + 1). For binomial only (not quasibinomial): if any |w y - round(w y)| > 1e-3, warn "non-integer #successes in a binomial glm!".
- binomial and quasibinomial, two-column y (s, f): for binomial only, if any count differs from an integer by more than 1e-3, warn "non-integer counts in a binomial glm!". n = s + f; y becomes s/n (0 where n = 0); the prior weights are multiplied by n; starting means (n y + 0.5)/(n + 1). Any other number of columns: error "for the 'binomial' family, y must be a vector of 0 and 1's\nor a 2 column matrix where col 1 is no. successes and col 2 is no. failures" (with 'quasibinomial' for that family).
- poisson: negative y is the error "negative values not allowed for the 'Poisson' family" (quasipoisson: "... for the 'quasiPoisson' family"); starting means y + 0.1.
- Gamma: y <= 0 is the error "non-positive values not allowed for the 'Gamma' family"; starting means y.
- inverse.gaussian: y <= 0 is the error "positive values only are allowed for the 'inverse.gaussian' family"; starting means y.
- gaussian: without starting values, the inverse link with some y = 0 or the log link with some y <= 0 is the error "cannot find valid starting values: please specify some"; starting means y.
- quasi: "constant" y; "mu(1-mu)" y clamped to [0.001, 0.999]; "mu", "mu^2", "mu^3": y, with 0.1 added where y = 0.

## Fitting (iteratively reweighted least squares, McCullagh and Nelder §2.5)
- Starting linear predictor: if `start` is given (its length must equal the number p of columns, intercept first; otherwise the error "length of 'start' should equal <p> and correspond to initial coefs for c(\"(Intercept)\", \"x1\", \"x2\")", listing the column names in that form), eta = X start + offset, and start counts as the previous coefficients for step halving. Otherwise eta = link(starting means), and there are no previous coefficients yet.
- If the starting mean or linear predictor is invalid: error "cannot find valid starting values: please specify some".
- The deviance D is the sum of the deviance contributions.
- Each iteration, up to `maxit` (default 25):
  1. Only rows with positive prior weight are used. If V(mu) is NaN for one of them: error "NAs in V(mu)"; if it is 0: error "0s in V(mu)". If d mu/d eta is NaN for one of them: error "NAs in d(mu)/d(eta)".
  2. The rows used are those with positive prior weight and nonzero d mu/d eta. If there are none: warn "no observations informative at iteration <k>", mark not converged, stop iterating.
  3. Working response z = (eta - offset) + (y - mu)/(d mu/d eta), working weights W = w (d mu/d eta)^2 / V(mu). Solve the least squares problem of sqrt(W) z on sqrt(W) X with the QR decomposition of src/linalg/qr.ts (R's limited column pivoting) with tolerance min(1e-7, epsilon/1000). Columns found aliased get NA coefficients at the end (and 0 while iterating).
  4. If a coefficient is not finite: warn "non-finite coefficients at iteration <k>", mark not converged, stop.
  5. New eta = X b + offset, mu = the inverse link of eta, D = deviance.
  6. If D is not finite: with no previous coefficients, error "no valid set of coefficients has been found: please supply starting values"; otherwise warn "step size truncated due to divergence" and repeatedly replace b by the midpoint of b and the previous coefficients (recomputing eta, mu and D) until D is finite; more than maxit halvings is the error "inner loop 1; cannot correct step size". Set the boundary flag.
  7. Then, if eta or mu is not valid: the same with the warning "step size truncated: out of bounds" and the error "inner loop 2; cannot correct step size" (halving until both are valid, then recompute D). Set the boundary flag. The boundary flag is reset to false at the start of each step 5, so it reports the last iteration.
  8. Converged when |D - D_previous| / (|D| + 0.1) < epsilon (default 1e-8); otherwise b becomes the previous coefficients and D the previous deviance.
- After the loop: warn "glm.fit: algorithm did not converge" if not converged; warn "glm.fit: algorithm stopped at boundary value" if the boundary flag is set; for the binomial family only (not quasibinomial), warn "glm.fit: fitted probabilities numerically 0 or 1 occurred" if some mu > 1 - 10 eps or mu < 10 eps; for the poisson family only, warn "glm.fit: fitted rates numerically 0 occurred" if some mu < 10 eps. A warning given several times is reported once (the fixtures list each message once, in order of first appearance).
- `iter` is the number of iterations run (0 for a model without columns).
- A model without any column (no intercept and no x; the intercept-only model is an ordinary fit with one column): eta is the offset; an invalid eta is the error "invalid linear predictor values in empty model" and an invalid mean "invalid fitted means in empty model"; rank 0, iter 0, converged and boundary both true, no warnings, working weights and residuals from that mean.
- The working residuals are (y - mu)/(d mu/d eta) at the final eta. The working weights reported (used by the dispersion, the influence measures and the standard errors) are those of the last least squares step, that is computed from the means before the last update, and 0 for rows not used.
- Null deviance: with an intercept, the deviance of the constant mean sum(w y)/sum(w); without one, of the inverse link of the offset. With an intercept and an offset, R instead fits the intercept-only model with that offset (starting from the final means of the full fit, same control) and uses its deviance; if that fit does not converge, warn "fitting to calculate the null deviance did not converge -- increase 'maxit'?".
- Degrees of freedom: n_ok = rows minus rows with prior weight 0; df.null = n_ok - (1 if intercept); df.residual = n_ok - rank.
- AIC = family AIC + 2 rank, with the family AIC: gaussian n (log(2 pi D/n) + 1) + 2 - sum(log w) over all n rows (a zero weight makes it infinite); binomial -2 sum over rows with m > 0 of (w/m) log dbinom(round(m y), round(m), mu), where m is the binomial size n if any n > 1 and the prior weight otherwise; poisson -2 sum w log dpois(y, mu) (dpois warns "non-integer x = <value>" with six decimals for non-integer y, as R's dpois does; those warnings appear in the fixture); Gamma with phi = D/sum(w): -2 sum w log dgamma(y; shape 1/phi, scale mu phi) + 2; inverse.gaussian sum(w) (1 + log(2 pi D/sum(w))) + 3 sum(w log y) + 2; the quasi families NA.

## summary.glm
- Dispersion: 1 for binomial and poisson; otherwise, if df.residual > 0, the sum over rows with positive working weight of W r^2 (r the working residual) divided by df.residual, with the warning "observations with zero weight not used for calculating dispersion" if some working weight is 0; if df.residual = 0, NaN.
- The unscaled covariance is (R'R)^-1 from the R factor of the last QR decomposition (rank columns, in pivot order); the scaled one is that times the dispersion. The coefficient table lists the non-aliased coefficients in pivot order: estimate, standard error, estimate/se, and the p-value 2 pnorm(-|t|) ("z value") for binomial and poisson, 2 pt(-|t|, df.residual) ("t value") otherwise, and NaN for the last three when the dispersion is estimated and df.residual = 0.

## Residuals
- response: y - mu; working: as above; pearson: (y - mu) sqrt(w)/sqrt(V(mu)); deviance: sign(y - mu) sqrt(max(d_i, 0)) when df.residual > 0, and all 0 when df.residual = 0. All have one value per row (after dropping NA rows).

## Influence measures
- Rows with prior weight 0 are left out (the results are shorter by their number).
- hatvalues: the diagonal of the hat matrix of the last weighted least squares problem (from its QR decomposition); values above 1 - 10 eps are set to 1.
- rstandard: deviance residual / sqrt(dispersion (1 - h)); infinite values become NaN. Here the deviance residuals whose absolute value is below 100 eps times their median absolute value are first set to 0.
- cooks.distance: (pearson residual/(1 - h))^2 h/(dispersion rank); infinite values become NaN.

## predict
- Link scale: eta for the data; for newdata X0 (and its offset, 0 if not given) eta0 = X0 b + offset0.
- Standard error on the link scale: sqrt(sum over the non-aliased columns of (x0' R^-1)^2) times sqrt(dispersion), with R the factor of the last QR decomposition and x0 the unweighted model row (for the data too: the unweighted model matrix, not the weighted one).
- Response scale: the inverse link of eta, and the standard error times |d mu/d eta| at eta.
- A dispersion argument replaces the summary's dispersion.

## confint (profile likelihood)
- For coefficient j with estimate b_j, refit with b_j fixed at b (the column moved into the offset, the other columns refitted, same family, prior weights and offset), D(b) its deviance. The signed root is z(b) = sign(b - b_j) sqrt((D(b) - D) / phi) with phi the summary's dispersion; for test = "Rao", (D(b) - D) is replaced by the score statistic of the restricted fit: with its working residuals and working weights, the weighted least squares fit of those residuals on the full model matrix (with an intercept term only if the model has one), and the statistic is its null sum of squares minus its residual sum of squares.
- The limits solve z(b) = qnorm((1 - level)/2) and z(b) = qnorm((1 + level)/2). The cutoff is the normal quantile also for families with an estimated dispersion.
- R's own confint interpolates a spline through a grid of z values (about 1/5 of a standard error apart) and is up to 5e-4 standard errors from the exact limits. Compute the exact limits, compare them with the references in glmConfint.json, and document the difference from R in docs/differences-from-r.md.
- The references were computed with the full fit and every refit iterated until the coefficients stop changing (a fixed 100 iterations), with the dispersion and the score from those converged fits; R's own convergence rule stops earlier (see "What was measured"). So iterate your refits to convergence of the coefficients, not only of the deviance.
- An aliased coefficient has NA limits. A limit where z does not reach the cutoff is NA.

## anova
- Sequential table for one fit, terms added in order (x1, x1 + x2, ...): rows "NULL" (df.null, null deviance), then one row per term with the refit's df.residual and deviance (refits use the same prior weights, offset, family and control, and the same start if one was given), the last being the full fit. Columns "Df" (decrease of df.residual, NA in the first row), "Deviance" (decrease of the deviance, floored at 0, NA in the first row), "Resid. Df", "Resid. Dev". The row names are "NULL" and the term names.
- Comparison of several fits (anova(fit1, fit2, ...)): one row per fit, named "1", "2", ...: "Resid. Df", "Resid. Dev", then "Df" and "Deviance" as differences from the previous row (NA in the first, not floored, so they can be negative). All fits must have the same number of rows: otherwise the error "models were not all fitted to the same size of dataset".
- test = "Rao": a column "Rao" (NA in the first row): for each row the score statistic of the smaller model against the larger one: take the working residuals and working weights of the smaller model's fit, fit them by weighted least squares on the larger model's matrix, and take the weighted sum of squares about their weighted mean (about 0 for a model without intercept) minus the weighted residual sum of squares. The smaller model of the first term is the intercept-only model (or the empty one). In comparisons, when a row has more degrees of freedom than the previous one (Df < 0), the roles are swapped and the statistic is negated.
- Default test (R 4.4 and later): if a dispersion is given, "Chisq"; else for binomial and poisson "Chisq"; else "F". test = FALSE adds no test columns.
- The dispersion used: the given one, else the summary dispersion of the full fit (comparisons: of the fit with the smallest df.residual). Its degrees of freedom: infinite for binomial and poisson, otherwise that fit's df.residual (also when a dispersion is given).
- Chisq and LRT: column "Pr(>Chi)" = upper tail of chi-squared with |Df| degrees of freedom at Deviance/dispersion times sign(Df) (or Rao/dispersion for test "Rao"); NA where Df = 0 or the value is negative.
- F: columns "F" = (Deviance/Df)/dispersion (NA where Df = 0 or negative) and "Pr(>F)" = upper tail of F(|Df|, dispersion df). For binomial and poisson (infinite dispersion df), warn "using F test with a 'binomial' family is inappropriate" (or 'poisson'). With dispersion df 0, the F test is dropped (no test columns).
- Cp: column "Cp" = Resid. Dev + 2 dispersion (n - Resid. Df), with n the number of rows of the model matrix (including rows of weight 0).

## Measurements (for the tolerances)

- With R's default epsilon = 1e-8 the coefficients are up to 2.5e-4 (relative) away from the maximum likelihood estimate (binomial with log link; 1e-4 to 1e-5 for inverse.gaussian/identity, cauchit and cloglog). The default-epsilon cases can only match R closely if the iterations follow R's (the specification above).
- The epsilon = 1e-14 cases (37) are also stopped by R's rule. Because the deviance is stationary at the estimate, their coefficients can still be about 1e-7 (relative) away from the estimate (cauchit, log-binomial, inverse.gaussian with the identity link): they check R's iterations with a tighter stop, not the estimate itself.
- The tolerance of the QR decomposition is min(1e-7, epsilon/1000), so with epsilon = 1e-14 an exactly collinear column is no longer found aliased.
- y - mu cancels when the fit is good: the response, working and Pearson residuals of a well-fitting case can differ from R by more than 1e-12 relative to themselves (1.4e-12 in case 76, quasi with variance mu^3 and log link, 22 iterations). Compare such residuals relative to |y| (or |mu|), and explain the rule.
- glm.json case 130 has y of length 10 and x of 40 rows: R's error "variable lengths differ (found for 'x1')".
- An inverse.gaussian fit with the inverse link converges in 2 iterations: its deviance is quadratic in the coefficients.
