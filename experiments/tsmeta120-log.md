# 1.20.0 (time series: forecast, stats, tseries; meta-analysis: meta, netmeta): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the documentation (the help pages)
and from the output of exported functions compared with candidate formulas written for these experiments (from the
help pages and the books and papers they cite). All runs: R 4.6.2 x86_64 (`rstats-oracle-amd64:4.6.2`), forecast
9.0.2, tseries 0.10.63, meta 8.5.0, netmeta 3.7.0, scripts checked with `scripts/r-experiment-check.mjs`. Issue #570
has the summaries.

## stats' arima without differencing (2026-11-26)

1. `tsmeta120-arima.R` (first run refused by the checker: my own helper names `expand`, `ar`, `ma` and the list
   elements `$m`, `$psi` collide with reference functions and with rlm's / nls's elements; renamed to `expandPoly`,
   `arc`, `mac`, `nused`, `psiw`, no other change). Seven ARMA fits from the help page's examples (lh AR(1), AR(3),
   ARMA(1,1), MA(2) without a mean, presidents AR(1) with NAs, presidents (2,0,1)x(1,0,0)_4, LakeHuron AR(2) with a
   regressor), each with the default CSS-ML and refitted with `method = "ML"`, `optim.control = list(reltol = 1e-15,
   maxit = 2000)`. Candidate: the exact Gaussian likelihood from the Toeplitz autocovariance matrix (ARMAacf scaled by
   1 + sum psi^2 from ARMAtoMA; seasonal polynomials multiplied out; missing times' rows and columns dropped),
   Gamma = L D L', v = L^{-1}(x - mu).
   - **loglik = -0.5 (m log(2 pi sigma2) + sum log D + m) with sigma2 = sum(v^2 / D) / m** (m = the non-missing
     observations): equal to R's loglik and sigma2 within 1e-14 (2.4e-12 for LakeHuron, whose values are larger),
     at R's default and at the tight estimates.
   - **residuals = v / sqrt(D)** (the standardized one-step errors, on the scale of e_t): equal within 3e-13
     (candidate (a), v, is off by up to 14). With NAs the residual is NA at the missing times.
   - **predict = the exact best linear predictor from the finite past**, se = sqrt(sigma2 (gamma0 - g' Gamma^{-1} g)):
     equal within 3e-14. The psi-weight approximation is off by 1e-5 for the seasonal model.
   - var.coef: not the inverse of my central-difference Hessian of -loglik (relative steps 1e-4): off by 7e-6 to 2e-3.
   - The default fit stops short of the maximum: coefficients 1e-6 to 2e-3 (relative) from the tight fit, loglik
     1e-9 to 7.5e-6 lower. As for polr / nls before: rStats.js iterates to the maximum and is compared with the tight
     fit.
   - nobs = the non-missing observations (48, 114 of 120, 98), n.cond = 0, code 0.
2. `tsmeta120-arima2.R`: var.coef, differenced models and CSS.
   - var.coef candidate V1 = solve(optimHess(coef, -loglik)) (default steps 1e-3): still off by 8e-5 to 9e-4.
   - Differenced models (lh (1,1,0), USAccDeaths (0,1,1)x(0,1,1)_12, LakeHuron (1,1,1) with a drift regressor),
     candidate = the exact ARMA likelihood of the differenced series: loglik off by 8e-10 (d = 1) to 1.1e-3 (the
     airline model), sigma2 by up to 4e-5; the forecasts integrated back agree for lh and LakeHuron (se 4e-16, 4e-6)
     but not for the airline model (9e-3). R's residuals of the first d + sD observations are not 0: for lh the
     first is 0.0024 = x_1 / sqrt(1e6), which points to the help page's finite prior kappa = 1e6 rather than an
     exact diffuse prior.
   - **CSS:** the innovations from t = n.cond + 1 with earlier ones 0 (n.cond = p + sP beyond the differencing:
     3, 2, 13, 1) equal R's residuals (1e-13), the first n.cond residuals are 0, **sigma2 = SS / (n - d - sD -
     n.cond)**, but **loglik = -0.5 nobs (log(2 pi sigma2) + 1) with nobs = n - d - sD (n.cond not subtracted)**:
     -28.3107 for lh AR(3) (45 terms in sigma2, 48 in loglik); the candidates with 45 do not match. aic is NA.
3. `tsmeta120-arima3.R`:
   - Candidate K for differenced models: presample y_0..y_{1-nd} iid N(0, kappa sigma2), kappa = 1e6, the exact
     Gaussian likelihood of y_1..y_n by a Cholesky factor of kappa A A' + B Gamma B', the first nd innovations
     left out of sigma2 and loglik, residuals v_t / sqrt(F_t) for all t. Off by 1e-9 (d = 1, drift), 3e-7 (airline)
     and 9e-5 (lh (1,2,0)); the forecasts by 3e-10 to 1e-4.
   - var.coef: central-difference Hessians of the exact -loglik with steps 1e-1 to 1e-6 settle at the same value
     (so mine is the exact Hessian), and R's var.coef stays 6e-4 to 2e-3 from it; candidate T (optimHess in the
     atanh(pacf) space, mapped with the exact Jacobian) is the same. Elementwise, R's AR rows are scaled by one
     factor (lh AR(1): variance x 0.998852, covariance with the mean x 0.999426, the mean's variance x 1.000000;
     ARMA(1,1): the MA block exact). 0.999426 = 1 - 1e-3 tanh(u) with u = atanh(0.574): the error of a forward
     difference of tanh with step 1e-3.
4. `tsmeta120-arima4.R`:
   - **var.coef = J Hu^{-1} J'** with Hu = optimHess (steps 1e-3) of -loglik in the space (atanh(pacf) of the AR
     parameters, the other coefficients) and **J the forward difference, step 1e-3, of the map back** (identity for
     MA, mean, regressors): within 4e-7 to 1.4e-6 for lh AR(1), AR(3), ARMA(1,1), MA(2). A central J (1e-3 off) or
     an exact Hu (1e-5 to 6e-3 off) do not match. With a regressor (LakeHuron) the regressor's row is still 1e-4
     off (the help page says regressors are orthogonalized before fitting; not followed further).
   - **kappa, computed stably** (z = (y_1..y_nd, w_{nd+1}..w_n), whose innovations are those of y): R with the
     coefficients fixed and kappa = 1e6 agrees within 6e-11 in loglik and 3e-8 in the residuals for d = 1, d = 2
     and the airline model, so the 9e-5 of experiment 3 was my rounding. With kappa = 1e4 R's loglik differs by
     3.2 and 7.1 for d = 2 and the airline model (fewer observations reach the 1e4 gain that excludes them); with
     kappa = 1e8 and 1e12 R itself drifts (up to 2e-4 in loglik, 4e-2 in residuals): R's own Kalman filter loses
     accuracy with a large kappa. rStats.js: the kappa = 1e6 prior exactly, in the stable form.

## forecast's Arima and forecast() for Arima fits (2026-11-26)

5. `tsmeta120-farima.R` (edited in place between two runs; the second adds the rescaled sigma2 to the candidate):
   eight fits (lh AR(1); LakeHuron (1,1,0) with include.drift, with include.constant, and (1,2,0) with
   include.constant; AirPassengers airline with lambda = 0, with biasadj, and (1,1,0)x(0,1,1) with lambda = 0.3 and
   biasadj; USAccDeaths (1,0,0)x(0,1,1) with a trend regressor), each compared with stats' arima on BoxCox(y) with
   the drift column `drift = 1:n` added when asked (include.constant adds it for d + D = 1, and nothing for d = 2;
   include.mean is FALSE when include.constant and differenced).
   - First run: coef, loglik, residuals (on the transformed scale), aicc, bic and the point forecasts equal
     exactly, the intervals did not (lh: 0.023 off). The interval half-widths over qnorm(0.5 + level / 200) give one
     se per horizon, 1.0215 times stats' se for lh = sqrt(48 / 46).
   - **forecast's sigma2 = sum of all squared residuals (the first d + sD included) / (nobs - number of
     coefficients)**, nobs = n - d - sD (lh 0.206076, 2 coefficients; LakeHuron 97 - 2), and predict uses it.
   - Second run with that sigma2: every quantity equal exactly (0 difference): coef, loglik, sigma2,
     **aicc = aic + 2 npar (npar + 1) / (nobs - npar - 1)**, **bic = aic + npar (log(nobs) - 2)** with npar =
     coefficients + 1, **fitted = InvBoxCox(BoxCox(y) - residuals)**, intervals = point +- qnorm(0.5 + level / 200)
     se back-transformed, and with biasadj **mean = InvBoxCox(m) (1 + v (1 - lambda) / (2 (lambda m + 1)^2))** with
     v = se^2 for forecasts and v = sigma2 (forecast's) for fitted values; the interval limits are not adjusted.
