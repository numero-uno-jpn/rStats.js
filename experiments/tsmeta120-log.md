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

## tseries' unit-root tests and Jarque-Bera (2026-11-26)

6. `tsmeta120-tseries.R` (first refused by the checker: my variables `se` and `ls` collide with metafor's `se` and
   base's `ls`; renamed `seb`, `lsh`): six series (lh, LakeHuron, a random walk of 200, white noise of 30,
   log(AirPassengers), a trend plus AR(1) of 600).
   - **kpss.test:** e = y - mean (Level) or the residuals on 1, t (Trend); stat = sum(cumsum(e)^2) / (n^2 s2),
     s2 = sum(e^2)/n + 2 sum_{s<=l} (1 - s/(l+1)) sum(e_t e_{t-s}) / n, l = trunc(4 (n/100)^0.25) (lshort) or
     trunc(12 (n/100)^0.25); **p = approx(KPSS Table 1 critical values, (0.10, 0.05, 0.025, 0.01), stat, rule = 2)**:
     all within 4e-14 (statistic, lag, p) in 24 cases.
   - **adf.test:** diff(y)_t on 1, t, y_{t-1} and k lagged differences, k = trunc((n - 1)^(1/3)); stat = the t value
     of y_{t-1}: within 1e-14. p: the tau_tau table (n = 25, 50, 100, 250, 500, infinity) interpolated over n first,
     then over the statistic: with n - 1 agrees to the 5 digits printed; with n or the regression's n it does not.
   - **jarque.bera.test:** n (S^2/6 + (K - 3)^2/24) with moments divided by n, p chi-squared(2): within 2e-14.
   - pp.test: the Phillips-Perron candidate (y_t on 1, t, y_{t-1}; Z(alpha) = nn (rho - 1) - (nn^2 se^2 / s2)
     (lambda2 - su2) / 2; Z(t_alpha) likewise) is close but not equal: 4e-5 (lh, l = 3) to 1.2e-2 (white noise of
     30, l = 8). Centring t does not change it. The lags agree.
7. `tsmeta120-tseries2.R`:
   - adf.test: **p = the interpolation at n - 1, exactly** (17 digits); **alternative = "explosive" gives 1 - p**.
   - pp.test: a grid of 12 variants of the denominators (su2, s2 and the Newey-West sums over nn, nn - 3 or n): the
     best (su2 and the autocovariances over nn, s2 over nn - 3, my first candidate) is still 0.012 off. Not
     resolved by two experiments; one more candidate from the paper (the closed form with det(X'X)) goes into the
     next tseries experiment, otherwise it is left open for the user.
8. `tsmeta120-tseries3.R`:
   - **pp.test = Phillips and Perron's closed form with a trend: Z(alpha) = nn (rho - 1) - nn^6 / (24 Dx) (lambda2 -
     su2), Z(t_alpha) = sqrt(su2 / lambda2) t - (lambda2 - su2) nn^3 / (4 sqrt(3) sqrt(Dx) sqrt(lambda2))**, Dx =
     det(X'X) for X = (1, t, y_{t-1}), su2 and lambda2 over nn: within 1e-13 (1.3e-10 for LakeHuron, whose Dx is
     large). Resolved: the se^2 / s2 form of experiments 6-7 replaces the finite-sample cofactor by n^4 / 12.
     The p-values: Z(alpha) from the n(rho - 1) table and Z(t_alpha) from the tau table, at n - 1, matched the
     5 printed digits in experiment 6.
   - **runs.test = Wald-Wolfowitz**: runs R, mean 1 + 2 n1 n2 / n, variance 2 n1 n2 (2 n1 n2 - n) / (n^2 (n - 1)),
     normal p for the three alternatives: exactly equal (0 difference) on the signs about the median.
   - terasvirta.test: the degrees of freedom are right (2 for lag 1, 7 for lag 2; F with (df, n - lag - df - 1 -
     ...) where R reports 45 for lh lag 1 = 47 - 2: so F's second df = m - df) but the statistics are 1% to 37% off
     (lh lag 1: 2.7958 against 2.6593).
   - white.test (set.seed(1)): none of 8 x 2 variants (weights filled by rows / columns, logistic / tanh, principal
     components of the covariance / correlation) matches (lh: 3.2950 against 3.09 to 3.43).
   - po.test: R's lag is trunc((n - 1) / 100) = 2 and trunc((n - 1) / 30) = 9 for n = 300 (my candidate used n); the
     statistics are 0.001% to 2% off; p-values 0.01 and 0.15 (the table's ends).
9. `tsmeta120-tseries4.R`:
   - **po.test: lag = trunc((n - 1) / 100) (lshort) or trunc((n - 1) / 30); u = residuals of x1 on the others (with
     an intercept when demean); rho from u_t on u_{t-1} without a constant, e = the residuals of that; Z = nn (rho -
     1) - (lambda2 - su2) / (2 sum(u_{t-1}^2) / nn^2) with su2 = sum(e^2) / nn and lambda2 the Newey-West sum over
     nn**: within 2e-14 in 8 cases. The p-values (0.01 and 0.15, the ends of Phillips and Ouliaris' Table Ia / Ib)
     are not checked yet.
   - terasvirta.test: 8 variants (intercepts in the null and auxiliary regressions, u0 or y as the response,
     multiplier m or n): the best is 1e-3 to 0.2 off, and no variant is best for every series. Not resolved.
   - white.test: 64 variants (bias inside or separate, range 2 or 4, rows or columns, logistic or tanh, scaled or
     not): the best is 5e-4 to 1e-2 off, again a different variant per series. Not resolved: left to the user.

## stats' filter, Box.test, diffinv, decompose and ar (2026-11-26)

10. `tsmeta120-stats.R`:
   - **filter:** convolution y[i] = sum_j f[j] x[i + o - (j - 1)] with o = 0 (sides = 1) or floor(p / 2) (sides =
     2, so an even filter reaches further forward), NA when an index is outside (wrapped when circular); NA in x
     gives NA wherever it enters; recursive y[i] = x[i] + sum_j f[j] y[i - j] with init in reverse time order:
     within 4e-15 in 16 cases.
   - **Box.test:** r_k from acf (mean removed, divided by n); Box-Pierce n sum r_k^2, Ljung-Box n (n + 2)
     sum r_k^2 / (n - k), chi-squared on lag - fitdf: within 3e-16.
   - **diffinv:** diffinv(c(1, 4, 2, 7)) = 0, 1, 5, 7, 14 (starts at xi = 0); with lag 2, differences 2 and xi of
     length 4, diff(·, 2, 2) gives the input back.
   - **decompose:** trend = the centred filter (0.5, 1, ..., 1, 0.5) / f (even f) or rep(1 / f, f) (odd f); the
     per-position means of x - trend (x / trend) with NA removed, centred by subtracting (dividing by) their mean;
     random = x - trend - seasonal (x / (trend seasonal)): trend, seasonal and random within 2e-12 for co2,
     USAccDeaths, quarterly and frequency 5. For AirPassengers started in April, seasonal agrees but `figure` does
     not in my calendar order: R's figure starts at the position of the first observation (to confirm).
   - **ar.yw:** autocovariances over n, Levinson-Durbin to order.max = min(n - 1, floor(10 log10 n)), aic = n log v_k +
     2k minus its minimum, the order at the minimum, partialacf = the reflection coefficients, **var.pred = v_p n /
     (n - (p + 1))**, predict = the AR recursion about the mean with se = sqrt(var.pred cumsum(psi^2)): within 1e-13.
   - **ar.ols:** the coefficients = least squares of (x - mean)_t on 1 and its p lags (x.intercept = that intercept),
     **var.pred = RSS / (n - p)**: within 1e-14 at R's order. R's order differs from yule-walker's (lh 1 against 3):
     its AIC is still to find.
   - ar.burg (var.method 1 and 2) and ar.mle: recorded, not yet compared (ar.mle's order for the differenced
     log(AirPassengers) is 12 = its cap).
11. `tsmeta120-stats2.R`:
   - **ar.burg:** x demeaned, reflection a_k = 2 sum f_t b_{t-1} / sum (f_t^2 + b_{t-1}^2), Levinson's update of the
     coefficients, forward and backward errors updated; **var.method 1: v_k = v_{k-1} (1 - a_k^2) from sum(x^2) / n;
     var.method 2: (sum f^2 + sum b^2) / (2 (n - k))**; aic = n log v_k + 2k minus the minimum; **var.pred = v_p
     without the n / (n - p - 1) factor** (unlike ar.yw): aic, partialacf, ar within 7e-13, var.pred to 1e-15.
   - **ar.ols's aic = n log(RSS_k / (n - k)) + 2k with each order fitted on its own n - k rows** (candidate C),
     minus the minimum: within 5e-13, and the orders agree (lh 1, LakeHuron 2, sunspot 9, 21). Candidates A, B, D
     (n - k or n - pm in front, or the common rows of order.max) are off by 6 to 110.
   - **decompose's figure starts at the position of the first observation** (AirPassengers from April, USAccDeaths
     from July): equal exactly; in calendar order it is not.
   - ar.mle against tight arima(x, c(k, 0, 0), method = "ML"): the same orders (3, 2, 9, 12) but aic off by 0.014 to
     0.19 (n log sigma2 + 2k: 1.3 to 18), coefficients 1e-6 to 1e-4, the mean 1.3e-5 to 1.1 (sunspot), var.pred close
     to sigma2 without a factor. Not the same fit; arima0 is the next candidate.

## stats' HoltWinters, and ar.mle (2026-11-26)

12. `tsmeta120-hw.R` (first refused by the checker: my candidate's argument `seasonal` collides with forecast's
   `seasonal`; renamed `stype` inside the candidate only):
   - **HoltWinters with given parameters: start values from decompose() of the first 2 periods (start.periods),
     l.start and b.start = intercept and slope of lm(trend ~ 1..k) over the k non-missing trend values (not their
     time positions), s.start = the figure; the recursions of the help page from t = f + 1** (not 2f + 1); trend
     only: a = x[2], b = x[2] - x[1] from t = 3; level only: a = x[1] from t = 2. SSE, fitted and coefficients (a, b,
     s1..sp = the last p seasonal values) exactly equal (0 difference) for co2, AirPassengers (multiplicative),
     USAccDeaths, uspop and Nile. The other three start candidates are off.
   - Optimisation: R's default L-BFGS-B result equals a tight refit (factr = 1) for co2 and AirPassengers to 1e-13;
     the level-only case (optimize) stops 6e-6 from a tight optimize in alpha (SSE 7e-8 relative higher).
   - predict.HoltWinters: half-widths / qnorm are proportional to sqrt(1 + sum_{j<h} psi_j^2) with psi_j = alpha
     (1 + j beta) + gamma (1 - alpha) [j mod p = 0] (the ratio is constant in h), but the variance is not SSE / n
     (uspop 0.53 times).
   - **ar.mle = arima0(x, c(k, 0, 0)) for each order up to min(order.max, 12): aic = arima0's aic minus the minimum
     (within 6e-14), var.pred = arima0's sigma2 exactly.** (The arima fits of experiment 11 differ from arima0's.)
13. `tsmeta120-hw2.R`: **the variance of the additive (and non-seasonal) intervals is var(residuals) (mean
   removed, n - 1)**: within 6e-14 for co2 (given and optimised parameters), USAccDeaths, uspop, Nile; SSE / (n - 1)
   is off. The intervals are symmetric. The multiplicative model's intervals are not given by this formula (0.28
   off): open.
14. `tsmeta120-tseries5.R` (terasvirta.test, third try, asked for by the user; edited in place for a second run that
   adds the p-value candidates). Re-reading experiment 8: all earlier candidates had the LM form m R^2, but for lh
   lag 1, 48 log(SSR0 / SSR1) = 2.7955 was near R's 2.7958, and R's F reports the second df 45 = m - df. With lag 1
   the auxiliary span {1, x, x^2, x^3} is invariant to scaling, so the regressions were likely right and the form of
   the statistic was not. Grid: Chisq in {m R^2, n R^2, m log, n log}, F's second df in {m - df, m - df - lag - 1,
   n - df}, with and without intercepts, scale TRUE / FALSE, lags 1-3, six series (36 cases).
   - **terasvirta.test: SSR0 from y on (1, X), SSR1 from y on (1, X, the products x_i x_j (i <= j) and x_i x_j x_k
     (i <= j <= k)); Chisq = n log(SSR0 / SSR1) with n = the length of the series (not the n - lag rows), df = the
     number of products; F = ((SSR0 - SSR1) / df) / (SSR1 / (m - df)) with m = n - lag**: within 8e-14 in all 36
     cases; p-values chi-squared(df) (2e-14) and F(df, m - df) (7e-17). Resolved. The other forms are 0.1 to 0.4
     off, and without intercepts 45 to 50.
15. `tsmeta120-white.R` (white.test, third try, asked for by the user; edited in place for a second run that adds
   the p-value candidates). After experiment 14, the form of the statistic (m R^2, n R^2, m log, n log; F over
   m - qstar or m - qstar - lag - 1) crossed with 32 constructions of the hidden units (range: U(-range/2, range/2)
   or U(-range, range); weights in a (lag + 1) x q matrix filled by rows or columns, or a separate bias row first or
   last; logistic or tanh; principal components of the hidden units centred, scaled or not), on four series with
   (lag, q, qstar, seed) = (1, 10, 2, 1), (1, 10, 2, 7), (2, 10, 2, 1), (1, 6, 3, 3) (16 cases).
   - **white.test: y and its lags scaled (scale()); after set.seed, w = runif((lag + 1) q, -range/2, range/2) filled
     by columns into a (lag + 1) x q matrix W (row 1 multiplies the constant); hidden units = logistic((1, X) W);
     their principal components 2..qstar+1 from prcomp(·, scale. = TRUE); SSR0 of y on (1, X), SSR1 of y on (1, X,
     components); Chisq = n log(SSR0 / SSR1) with n the series length, df = qstar; F = ((SSR0 - SSR1) / qstar) /
     (SSR1 / (m - qstar)), m = n - lag**: within 2.4e-13 (Chisq) and 1.3e-13 (F) in all 16 cases; p-values
     chi-squared(qstar) and F(qstar, m - qstar) within 1e-16. Resolved. In experiments 8-9 the right construction
     was among the candidates but with the m R^2 form, 6.7e-2 to 0.13 off, which hid it.
   - The random weights come from R's runif after set.seed, so rStats.js reproduces R's value given the same seed
     only with R's generator (Mersenne-Twister, inversion) and the same number of draws.
16. `tsmeta120-hw3.R` (the multiplicative model's intervals, second try, asked for by the user; edited in place for
   four runs, each adding a candidate after reading the previous run's numbers):
   - Run 1: the ratio of R's half-width to the additive form sqrt(var(res) (1 + sum_{j<h} psi_j^2)) varies with h
     and with the seasonal coefficients (C1-C6: s_h, s_h / mean(s), relative residuals, psi without or with other
     seasonal terms, all 0.1 to 2 off). By hand: w_h = half^2 / var(res) at h = 1 is (alpha + gamma (1 - alpha))^2
     for co2 (0.49), USAccDeaths (0.79^2) and AirPassengers (0.72^2): psi_0 includes the seasonal term (j = 0 counts
     as j mod f = 0) and there is no leading 1. Solving USAccDeaths h = 2, 3 by hand gave
     w_h = sum_{j=0}^{h-1} (psi_j s_h / s_{h-j})^2.
   - Run 2: that candidate (C7a, cyclic seasonal index) agrees for h < f in every case and fails from h = f on (co2
     h = 12: R's w is 9.5 times larger). From h = f on, (h - j) mod f = 0 occurs in the denominator for the first
     time. co2's excess at h = 12, 30.39 = 0.49 ((s_12 / b)^2 - 1), gives b = 0.1257 if the zero index reads the
     trend coefficient.
   - Run 3 (C8: the denominator from the coefficient vector (a, b, s1..sf) at position 2 + ((h - j) mod f), so 0
     reads b): within 5.4e-14 for the four models with a trend (co2's b is indeed 0.1257). Without a trend
     (beta = FALSE) it fails from h = 2, and R itself returns NA at h = 12 and 24.
   - Run 4 (C9): **both factors are read at fixed positions as if b were always present: numerator
     coefficients[2 + ((h - 1) mod f + 1)], denominator coefficients[2 + ((h - j) mod f)];
     var_h = var(residuals) sum_{j=0}^{h-1} (psi_j num / den)^2, psi_j = alpha (1 + j beta) + gamma (1 - alpha)
     [j mod f = 0]**. Within 5.4e-14 in all five cases, and NA exactly where R gives NA (no trend: the numerator's
     position 2 + f is past the end of the vector at h = 12, 24; the other seasonal factors shift by one). Resolved:
     R's multiplicative intervals divide by the trend coefficient b where the seasonal index is 0, and read shifted
     seasonal factors when there is no trend — artefacts of the indexing, not a variance formula from the
     literature.
17. `tsmeta120-po.R` (po.test's p-values, asked for by the user): the table of Phillips and Ouliaris (1990) is not at
   hand, so it was read off R's output: 1500 data sets for each of 2..6 variables and demean TRUE / FALSE (n = 300,
   x1 = the sum of random walks + an AR(1) u with phi in [0.80, 0.995]), plus 300 each with n = 120 and 600 and both
   lags. Outside R (a script that sorts the pairs (statistic, p) inside (0.01, 0.15), groups consecutive pairs of
   equal slope into lines and intersects neighbouring lines): six linear pieces per case, knots at p = 0.025, 0.05,
   0.075, 0.10, 0.125 and ends at 0.01 and 0.15, and every critical value has exactly two decimals (k = 2, demean:
   -28.32, -23.81, -20.49, -18.48, -17.04, -15.93, -14.91). The same knots for n = 120 and 600 and for both lags:
   the table does not depend on n. (A first version of the script drew one matrix of random walks twice; removed
   before the run.)
18. `tsmeta120-po2.R` (the first run stopped: arima.sim refuses phi = 1 in the warning check; replaced by two
   independent random walks): **p = approx(crit, c(0.01, 0.025, 0.05, 0.075, 0.10, 0.125, 0.15), stat, rule = 2)
   with crit by number of variables (2..6) from Table Ib for demean = TRUE and Table Ia for demean = FALSE**:

   | k | demean = TRUE (Ib)                                     | demean = FALSE (Ia)                                    |
   |---|--------------------------------------------------------|--------------------------------------------------------|
   | 2 | -28.32 -23.81 -20.49 -18.48 -17.04 -15.93 -14.91       | -22.83 -18.89 -15.64 -13.81 -12.54 -11.57 -10.74       |
   | 3 | -34.17 -29.74 -26.09 -23.87 -22.19 -21.04 -19.95       | -29.27 -25.21 -21.48 -19.61 -18.18 -17.01 -16.02       |
   | 4 | -41.13 -35.71 -32.06 -29.51 -27.58 -26.23 -25.05       | -36.16 -31.54 -27.85 -25.52 -23.92 -22.62 -21.53       |
   | 5 | -47.51 -41.64 -37.15 -34.71 -32.74 -31.15 -29.88       | -42.87 -37.48 -33.48 -30.93 -28.85 -27.40 -26.17       |
   | 6 | -52.17 -46.53 -41.94 -39.11 -37.01 -35.48 -34.20       | -48.52 -42.55 -38.09 -35.51 -33.80 -32.27 -30.90       |

   On fresh data (another seed, n in {80, 150, 300, 1000}, random lags, 4000 tests, 976 strictly inside): **0
   difference**. Below the table: p = 0.01 with the warning "p-value smaller than printed p-value"; above:
   p = 0.15 with "p-value greater than printed p-value". Resolved.

## stats' stl (2026-11-27)

19. `tsmeta120-stl.R` (first refused by the checker: my helper `ma`, the argument `robust` and the string
   "seasonal" collide with forecast's functions; renamed `movAvg`, `isRobust`, column indices): a candidate STL
   written from Cleveland, Cleveland, McRae and Terpenning (1990): loess on 1..n with the q nearest points, h = the
   larger distance to the window's ends, tricube weights times the robustness weights, degree 1 by the lowess update
   (when sqrt(c) > 0.001 (n - 1)), jumps with linear interpolation; inner loop: detrend, cycle-subseries loess
   evaluated at 0..k+1, low-pass (moving averages np, np, 3, then loess), seasonal = C - L, deseasonalise, trend
   loess; outer loop: bisquare weights on |R| / (6 median |R|). Variants for what the paper leaves open: q > n
   widening (H1: h + (q - n) %/% 2; H2: h q / n), lowess thresholds 0.001 / 0.999 (T1) or none, the cycle means
   after a periodic fit (P1) or none.
   - **H1, T1, P1 agree in 6 of 7 cases** (co2 periodic, s.window 7 and 35; nottem 9 robust; USAccDeaths 13;
     quarterly UKgas 7): seasonal within 2e-12, trend 3e-11, weights exact. H2 is off where q > n (USAccDeaths 13:
     25), P0 by 9e-7 (the tricube weights over a window of 10 n + 1 are not quite equal). T0 makes no difference
     here. Defaults read from R's win / jump: t.window = nextodd(ceiling(1.5 np / (1 - 1.5 / s.window))),
     l.window = nextodd(np), jumps ceiling(window / 10), periodic s.window = 10 n + 1.
   - Off: USAccDeaths periodic with robust = TRUE (seasonal 35, weights 0.3).
20. `tsmeta120-stl2.R` (first refused: `do.call(stl, ...)` passes stl without calling it; rewritten with direct
   calls): s.degree 1, t.degree 0, an even l.window (made odd), all jumps 1, t.window 31, a 30-point series and
   USAccDeaths s.window 7 robust: all within 2e-11. Periodic + robust agrees for co2 and nottem (4e-12) but not for
   USAccDeaths; leaving the robustness weights out of the periodic subseries (V1) or taking the cycle means in every
   iteration (V2) makes it worse. Also off: USAccDeaths s.window 7 with inner 5, outer 3 (32).
21. `tsmeta120-stl3.R`: a grid of inner / outer on USAccDeaths: every combination with outer <= 2, and inner 1 with
   outer 3, agrees (6e-11); s.window 7 with inner 5 and outer 3 does not (R: 4 zero weights, candidate 2).
22. `tsmeta120-stl4.R` (first refused: my variable `trace` is a base function; renamed `passLog`): the candidate's
   u = |R| / h per outer pass against R's weights with outer = 1, 2, 3: passes 1 and 2 equal R's weights exactly; the
   third (the fit with pass 2's weights and 5 inner iterations) differs everywhere (70 of 72 weights). No u of pass 2
   is near a threshold (the largest 0.879), so it is not a 0.999 / 1 boundary.
23. `tsmeta120-stl5.R`: on the two failing configurations, tricube or bisquare thresholds off, H2, and robustness
   weights in the low-pass loess change nothing (or make it worse). Not resolved after five experiments: STL as in
   the paper agrees with R in 16 of 18 configurations to 1e-11; two USAccDeaths configurations with several robust
   passes and inner > 1 depart. Left to the user.
24. `tsmeta120-stl6.R` (the user asked to continue): the difference does not grow gradually: for USAccDeaths it
   stays at 1e-11 and jumps to 30 at one pass (s.window 7: outer 3 with inner >= 2; periodic with inner 1: outer 5;
   inner 5: outer 3), and with outer 2 any inner up to 12 agrees. A discrete event, not amplified rounding.
25. `tsmeta120-stl7.R`: point by point in s.window 7, inner 2, outer 3: every point differs (seasonal up to 31,
   trend up to 22); the candidate's loess never has a weight sum <= 0 (smallest 1.57 of 1264 calls); and R's final
   weights have zeros at 13, 14, 17, 38 against the candidate's 13, 17. Since outer = 2 (the fit those weights come
   from) agrees, **the weights computed from an agreeing fit differ: the robustness scale, not the fit**.
26. `tsmeta120-stl8.R`: R's remainder with outer = k - 1 and R's weights with outer = k give the implied scale
   h_i = |R_i| / sqrt(1 - sqrt(w_i)), the same for every point. Where R agrees, h = 3 (s_36 + s_37) = 6 median (to
   1e-12). In s.window 7, inner 2, outer 3, h = 478.9827, while 6 median = 569.4991; a search over all pairs gives
   **h = 3 (s_25 + s_37)** to 5e-14: the upper middle order statistic is right, the lower one is the 25th. (The
   periodic case could not be checked this way: its returned seasonal is the cycle means, not the internal one.)
27. `tsmeta120-stl9.R`: 400 random series (n 30..121, frequency 4 or 12, t(2) noise), s.window 7, inner 2: R's
   remainder with outer 0 and weights with outer 1. **Odd n: 182 of 182 use 6 median. Even n: 195 of 218; the other
   23 (10.6%) use h = 3 (s_a + s_b) (to 1e-9) where one of a, b is a middle position (n/2 + 1 in 13 cases, n/2 in
   10) and the other is an unrelated rank** (n = 34: ranks 4 and 18; n = 112: 56 and 97). R's robustness scale
   takes, for even n in about one case in ten, a wrong order statistic for one of the two middle values — the
   behaviour of a partial sort that places only one of two requested positions correctly. This explains the two
   USAccDeaths configurations of items 19-23 (n = 72: ranks 25 and 37 instead of 36 and 37). Resolved as far as
   the cause; reproducing R's wrong element would need the exact partial-sort algorithm, which the output does not
   show. rStats.js: the true median (6 median |R|), as the paper and the help page describe.

## forecast's simple methods and small functions (2026-11-27)

28. `tsmeta120-fsimple.R` (first refused by the checker: my variable `se` and the strings "naive", "snaive" used as
   case labels; renamed `seM`, "m_naive" ...; the first run's JSON was broken by checkresiduals printing its test,
   now captured with capture.output and kept in the output):
   - **meanf**: mean, fitted = mean, intervals mean +- qt(level, n - 1) sd(y) sqrt(1 + 1/n): exact.
   - **naive / rwf / snaive**: fitted y_{t-1} (+ the drift (y_n - y_1)/(n - 1)) or y_{t-m}; point forecasts exact;
     **sigma = sqrt(mean(res^2)) for naive and snaive, sd(res) for rwf with drift**; se_h = sigma sqrt(h), sigma
     sqrt(h (1 + h/(n - 1))) (drift), sigma sqrt(floor((h - 1)/m) + 1) (snaive), normal quantiles: ratios 1 to
     1e-6 for every h. (fc$model$sigma holds sigma^2.)
   - **accuracy**: training ME, RMSE, MAE, MPE, MAPE, MASE (scale = mean |y_t - y_{t-12}| of the training data),
     ACF1; test set the same plus Theil's U = sqrt(sum ((y_{t+1} - f_{t+1}) / y_t)^2 / sum ((y_{t+1} - y_t) / y_t)^2)
     over the test set; Theil's U is NA for the training row: all exact to 17 digits.
   - **ma** (odd, even centred, even not centred = the filters of the help page), **fourier** (S_k, C_k with t = 1..n,
     t = n + 1..n + h for h; sin dropped at k = m/2; names "S1-12", "C1-12", ...), **dm.test** (HLN with the
     autocovariance estimator over n, t(n - 1), 12 cases), **CV** (CV, AIC = n log(SSE/n) + 2(k + 2), AICc, BIC,
     AdjR2), **checkresiduals** (Ljung-Box, lag = min(2m, n/5) here 24, at least df + 3; df = lag - number of
     ARMA coefficients): exact.
   - **seasonaldummy**: 11 columns Jan..Nov (December omitted), by the cycle position of each row.
   - **monthdays**: days in the month with leap Februaries (28, 29, 28 for 1999, 2000, 2001).
   - easter: 1 in the month (quarter) of Easter Sunday for 2000-2004 (2002 in March / Q1); years where Good Friday
     and Easter Sunday fall in different months are still to check.
29. `tsmeta120-fsmall2.R` (first refused by the checker: tsCV(Nile, rwf, ...) passes rwf without calling it; a
   wrapper function that calls rwf is used instead. The first run then stopped in my own candidate, rwf with a drift
   on one observation; guarded with tryCatch, left NA):
   - **easter**: Easter Sunday by the anonymous Gregorian algorithm (2008-2027) and the share of Good Friday ..
     Easter Sunday (.. Monday) in each month or quarter: with easter.mon = TRUE exact (2018: 0.5 / 0.5); without the
     Monday 3.3e-3 off where the share is 2/3 or 1/3 (e.g. 2018 March/April), i.e. **R rounds the shares to two
     decimals** (0.67 / 0.33) — to confirm.
   - bizdays: R's counts minus Monday-Friday counts are 0 to -3 per month and differ by FinCenter (New York:
     January -2, February -1, ...; Zurich April -3): the holiday calendars of each financial centre. Not yet matched.
   - findfrequency: round(1 / frequency at the maximum of spec.ar of the detrended series) gives R's 7, 12, 10, 11,
     12, 12 for six series; for white noise (AR(0), flat spectrum) R returns 1 and the candidate Inf: the rule for
     "no dominant frequency" is still to find.
   - **BoxCox** (log for 0, (sign(x)|x|^l - 1)/l, also for negative x), **InvBoxCox** (the inverse, sign-preserving
     where l z + 1 < 0: (-0.5)^2 -> -0.25), attr "lambda": exact.
   - **BoxCox.lambda "guerrero"**: groups of length max(2, frequency) **taken from the end** (the incomplete first
     part dropped: with 137 points the from-the-start candidate is 0.05 off), minimise sd(r)/mean(r), r = sd_i /
     mean_i^(1 - lambda), over [-1, 2]: R agrees with a tight optimize to 1e-5 (R's optimize tolerance; to
     confirm with the default tolerance). **"loglik"**: the profile log-likelihood of lm on a trend (+ seasonal
     dummies) **maximised on the grid seq(-1, 2, by = 0.05)** (R 0.2, 0.65, ... exactly the grid's best; the tight
     maximum is 0.198, -0.667 ...).
   - **na.interp** for a non-seasonal series = approx(..., rule = 2) (constant at the ends): exact. The seasonal case
     is recorded, not yet compared.
   - tsCV: h = 3 exact when the errors of origin t are stored in row t (not at t + h as the help page's e[t+h]
     suggests); h = 1 has NA at 1 and 100 and needs the same check.
   - **arimaorder**: c(p, d, q) or c(p, d, q, P, D, Q, Frequency) named.
30. `tsmeta120-fsmall3.R`:
   - **easter: the shares are rounded to two decimals** (round(share, 2)), with and without easter.mon, monthly and
     quarterly, 1990-2035: exact.
   - **tsCV**: h = 1 equal to y[t + 1] - f in position t (NA at 1, where R's first fit is missing, and at n): exact.
   - **BoxCox.lambda "guerrero" = optimize(cv, c(lower, upper)) with optimize's default tolerance**: exact (0
     difference) for five series and for lower = 0, upper = 1.
   - **bizdays "NERC"**: weekdays minus New Year's Day, Memorial Day, Independence Day, Labor Day, Thanksgiving and
     Christmas (Sunday to Monday, Saturday not moved): exact 2000-2025. New York: the NYSE rules agree except four
     months, the special closings (2001-09, 2004-06, 2007-01, 2012-10).
   - findfrequency: the period at the global maximum (F2) agrees except where R returns 1 for a visible peak; na.interp
     for a seasonal series: no variant of "first filling + robust STL + linear interpolation of the seasonally
     adjusted series" matches (best 9.7).
31. `tsmeta120-fsmall4.R` (first refused: the case label "mstl" is a function's name; renamed):
   - findfrequency on 600 series: R returns 1 in every case with max(spec) <= 9.77 and agrees with F2 in every case
     with max(spec) >= 10.08: **a threshold of 10 on the maximum of spec.ar's spectrum**; one series with the maximum
     at the lowest frequency returned 7 (a later local maximum).
   - na.interp (seasonal): 75 combinations (19 first fillings x 4 decompositions): the best is 1.84 off. Not resolved
     after two experiments: left to the user.
   - bizdays: **Zurich** (1 and 2 January, Good Friday, Easter Monday, 1 May, Ascension, Whit Monday, 1 August, 25
     and 26 December, Sechselaeuten = 3rd Monday of April, Knabenschiessen = 2nd Monday of September, none moved)
     **exact 1995-2025**. New York: MLK Day only from 1998, and no 2018 / 2025 days of mourning; London / Toronto:
     the Boxing Day rule when Christmas falls on Friday or Saturday.
32. `tsmeta120-fsmall5.R` (first refused: my variable `rq` is quantreg's function; renamed `rQ`):
   - **findfrequency: 1 if max(spec) <= 10; otherwise round(1 / f) at the maximum; if the maximum is at the lowest
     frequency, the largest value after the spectrum first rises (both readings of "first rises" agree), 1 if that
     is the last frequency**: 800 of 800 fresh series exact.
   - **bizdays**, 1990-2030, monthly and quarterly: **London, NERC, Toronto, Zurich exact**; New York exact except
     April 1994: the NYSE closing for President Nixon's funeral (27 April 1994), to be added to the special closings
     (27 Apr 1994, 11-14 Sep 2001, 11 Jun 2004, 2 Jan 2007, 29-30 Oct 2012; not 5 Dec 2018 or 9 Jan 2025). The
     corrected rules: NYSE New Year's Day on Saturday is not moved; London Boxing Day on Saturday -> Monday 28;
     Toronto with Christmas on Saturday closes Monday 27 only.

## forecast's ets (2026-11-27)

33. `tsmeta120-ets.R` (first refused by the checker: my variable `se`; renamed `sea`. The first run then stopped:
   ets refuses ANM and AAM with "Forbidden model combination"; the second run records such errors): R's own
   estimates (fit$par) put into a candidate filter written from Hyndman et al. (2008, table 2.3) for every
   combination of additive / multiplicative errors, trends N, A, Ad, M, Md and seasons N, A, M (13 models on Nile,
   uspop, USAccDeaths, AirPassengers):
   - **The state space recursions of table 2.3, with the seasonal initial states s0 = the most recent (s_{t-1}),
     s1, ..., and the m-th one implied (additive: -sum; multiplicative: m - sum; par holds m - 1 of them)**:
     residuals (e = y - mu or (y - mu)/mu), fitted mu and the whole states matrix within 2e-12 for all 13 models.
     The reversed seasonal order (SB) is far off.
   - **loglik = -0.5 lik with lik = n log(sum e^2) (+ 2 sum log |mu| for multiplicative errors)** (no 2 pi or n
     constants: the full Gaussian form is 1 to 150 off); **aic = -2 loglik + 2 (p + 1)** with p = length(par)
     (smoothing parameters and initial states); **bic = aic + (p + 1)(log n - 2)**; **aicc = aic + 2 (p + 1)(p + 2)
     / (n - p - 2)**; **sigma2 = sum e^2 / (n - p)**; **mse = mean((y - mu)^2)**: all within 2e-13.
   - With restrict = TRUE (the default), additive errors with a multiplicative season are refused.
34. `tsmeta120-ets2.R` (first refused by the checker: my `se` and the ets object's `$m`, which the checker reads as
   nls's `m` element; renamed, and the period taken from frequency(fit$x)):
   - **Class 1 (Hyndman et al. 2008, ch. 6): var_h = sigma2 (1 + sum_{j<h} c_j^2), c_j = alpha + beta phi_j + gamma
     [j mod m = 0]**: ANN, AAN, AAdN exact (1e-15); **class 2: theta_1 = mu_1^2, theta_h = mu_h^2 + sigma2
     sum_{j<h} c_j^2 theta_{h-j}, var_h = (1 + sigma2) theta_h - mu_h^2**: MNN, MAN, MAdN exact; intervals symmetric,
     normal quantiles. The seasonal models were off through my own point forecasts (the seasonal index runs the other
     way: the last row's s1 is the most recent).
   - Class 3 (MNM, MAM, MAdM): the same under two seeds, so analytic; multiplicative trends (MMN, MMdM): different
     under two seeds, so simulated.
   - hw(additive) = forecast(ets(y, "AAA", damped = FALSE)) exactly; ses, holt and hw(multiplicative) differ from the
     plain ets fits by 0.003 to 18 (other settings of ets inside the wrappers, to find); initial = "simple" returns an
     ets-class object whose first fitted value is y1 (ses) — to examine.
35. `tsmeta120-ets2.R`, second run (edited in place: the seasonal index of my point forecasts reversed, a class 3
   candidate added, the wrappers' parameters recorded):
   - **Point forecasts of classes 1 and 2 = the zero-error state recursion, the last row's s1 being the most recent
     (period n + k uses s_{m - (k - 1) mod m})**: exact for all 12 models of classes 1 and 2.
   - **Class 1 and class 2 variances exact for AAA, AAdA, MAA, MAdA** (and the non-seasonal ones); ANA (2.5e-4) and
     MNA (1e-5) are slightly off — no trend with an additive season: to find.
   - Class 3: R's point forecasts differ from mu~_h s_h by 0.2 to 0.7 (AirPassengers, values about 450), and the
     section 6.3 variance candidate (theta of the non-seasonal part, (1 + gamma^2 sigma2)^floor((h-1)/m)) is 5e-3 to
     7e-2 off: to find.
   - ses / holt against ets(ANN / AAN): parameters 5e-4 / 2e-3 apart, log-likelihoods 1.5e-6 / 5.6e-6 apart: the same
     model reached from different starting values by an optimiser that stops early (rStats.js: to the optimum and
     compared with a tight refit). hw(multiplicative) against ets(MAM): alpha 0.315 against 0.395 — a different local
     optimum or a different model, to find.
   - **initial = "simple"** (Hyndman and Athanasopoulos): ses l0 = y1 (alpha estimated, 0.24657); holt l0 = y1,
     b0 = y2 - y1 (3.93, 1.38 for uspop); hw l0 = mean(y[1:m]) (9651.75), b0 = (mean(y[m + 1:m]) - mean(y[1:m])) / m
     (-77.77), s = y[1:m] - l0: exact; the smoothing parameters are then estimated (by what criterion: to find).
36. `tsmeta120-ets3.R`: per horizon. **Class 3 point forecasts equal mu~_h s_h for h <= m and, for MNM, are multiplied
   by exactly (1 + alpha gamma sigma2)^k beyond (k = floor((h - 1) / m); 9 digits)**: the expectation of the level
   error times the same time's seasonal update (1 + gamma e). For MAM the factor varies with h (the trend's
   response to the error). ANA's half-width equals the class 1 formula except at h = m and 2m.
37. `tsmeta120-ets4.R` (edited in place for three runs): a candidate for the exact first and second moments of class 3,
   derived for this experiment from the model of table 2.3: y_{n+h} = T_{n+h} s* (1 + e_{n+h}) prod_i (1 + gamma
   e_{t_i}) with t_i = n + h - i m; the trend states x follow x' = (A + B e) x, so M1 = E[w x] and M2 = E[w^2 x x']
   propagate exactly (paired steps: M1' = (A + gamma sigma2 B) M1, M2' = (1 + gamma^2 sigma2) A M2 A' + 2 gamma
   sigma2 (A M2 B' + B M2 A') + sigma2 (1 + 3 gamma^2 sigma2) B M2 B'; other steps M1' = A M1, M2' = A M2 A' + sigma2
   B M2 B'); E[y] = s* c'M1, var = s*^2 (1 + sigma2) c'M2 c - E[y]^2.
   - **MNM and MAM (AirPassengers, USAccDeaths, co2): mean within 3e-15, sd within 4e-10 for h = 1..36**: R computes
     the exact moments.
   - MAdM: off by 7.4e-5 at h = 1, growing (run 2 printed the ratios). **Run 3: with the damping applied after the
     trend in the forecast (T = l + b, b' = phi b, so T_{n+h} = l + (1 + phi + ... + phi^{h-1}) b) R agrees (6e-14)**
     — while R's in-sample filter (item 33) and its class 1 / 2 forecasts (items 34-35: AAdN, AAdA, MAdN, MAdA)
     use l + phi b (T_{n+h} = l + (phi + ... + phi^h) b). R's class 3 damped forecasts are inconsistent with its own
     model: the forecast at h = 1 is l + b instead of the model's l + phi b.
38. `tsmeta120-ets5.R` (first run stopped in my own candidate: sapply over an empty vector gives a list; vectorised):
   **ANA and MNA (no trend, additive season): R's c_j has the seasonal term at (j + 1) mod m = 0 instead of j mod m
   = 0** (for class 1 the same as counting floor(h / m) seasonal cycles instead of floor((h - 1) / m)): within 2e-15
   in five cases (USAccDeaths, nottem, quarterly UKgas); the correct formula is off by 4e-6 to 0.35 (UKgas: the
   quarterly half-width at h = 4 is 35% too wide). With a trend (AAA, AAdA, MAA, MAdA) R places the term correctly.
   Two departures of forecast.ets from the model (items 37, 38); rStats.js uses the model's formulas (the user's rule:
   R's errors are not imitated).

## forecast's ndiffs, nsdiffs and ocsb.test (2026-11-27)

39. `tsmeta120-ndiffs.R`: 500 series (AR(1) with phi 0.5-0.99, with or without a drift; integrated; doubly
   integrated) for ndiffs, 300 seasonal series for nsdiffs (analysed outside R with a script that applies candidate
   decision rules to the recorded statistics):
   - **nsdiffs (test "seas"): D = 1 when F_s = max(0, 1 - var(remainder) / var(seasonal + remainder)) of mstl(x) exceeds
     0.64: 300 of 300**; with stl(x, "periodic") 288 of 300.
   - ndiffs (KPSS, level): "statistic > 0.463 at d = 0, 1" gives 466 of 500; in every miss R differences more, i.e.
     R's statistic is larger than mine (with lag trunc(4 (n/100)^0.25)): the lag differs. With alpha = 0.01 R
     returns 0 even for statistics far above 0.739 (158 of 500 agree): consistent with **rejecting when the p-value
     interpolated in the KPSS table (clamped to [0.01, 0.10]) is below alpha**, which is never true for alpha =
     0.01. ADF (drift, k = trunc((n - 1)^(1/3))): at best 410 of 500 with a fixed critical value.
   - ocsb.test(AirPassengers): statistic 1.5188, critical -1.803 ("5% critical value"), lag order 0 by "fixed"; the
     object has statistics, critical, method, lag.method, lag.order, fitted.model, data.name (no p-values).
40. `tsmeta120-ndiffs2.R` (first refused: my variable `se`; renamed. Edited in place for a second run adding ADF with
   k = 1, 2): statistics of several variants recorded for d = 0, 1, 2 on 500 series, the decision rules applied
   outside R:
   - **KPSS: lag trunc(3 sqrt(n) / 13)** (n = the length of the differenced series): **500 of 500 for type "level"
     (critical 0.463) and "trend" (0.146)**; trunc(4 (n/100)^0.25) 466 / 448, trunc(12 (n/100)^0.25) 363 / 293, 0
     421 / 381.
   - **ADF: one lagged difference (k = 1), a constant ("level") or a constant and a trend ("trend"); difference while
     the statistic is not below the 5% Dickey-Fuller critical value taken from the row of the table for the length's
     size class (n <= 25, 50, 100, 250, 500, more; tau_mu: -3.00, -2.93, -2.89, -2.88, -2.87, -2.86; tau_tau: -3.60,
     -3.50, -3.45, -3.43, -3.42, -3.41)**: 500 of 500 for both; interpolating the table over n: 497 / 496; other k
     (0, 2, trunc((n - 1)^(1/3)), trunc(12 (n/100)^0.25), AIC) 207 to 477.
   - **PP: Z(t_alpha) with a constant (y_t on 1, y_{t-1}), lag trunc(4 (n/100)^0.25), the same tau_mu rows: 500 of
     500**; Z(alpha) with fixed critical values 485 at best.
   - Not distinguished yet: "n <= boundary" or "n < boundary" for the size class, and the 1% / 10% columns.
41. `tsmeta120-ndiffs3.R`: 600 series of differenced lengths 25, 26, 50, 51, 100, 101, 250, 251, 500, 501 and several
   alpha; 18 seasonal series for ocsb.test:
   - **ADF size class: the row with n <= 25, 50, 100, 250, 500, else the last (n = the length of the series being
     tested)**: 600 of 600 (the "<" reading 599).
   - **ndiffs ADF / PP: the p-value is interpolated linearly between the 1%, 5% and 10% critical values of that row
     (p = 0.01 below the 1% value, 0.10 above the 10% value), and the series is differenced while p > alpha**:
     600 of 600 for alpha = 0.01, 0.025, 0.05 and 0.10 (so alpha = 0.10 never differences). **KPSS: differenced
     while the p-value interpolated in the KPSS table (clamped to [0.01, 0.10]) is < alpha**: 600 of 600 for alpha =
     0.025 and 0.07 (alpha = 0.01 never differences). Rows of the 1% / 10% columns: tau_mu -3.75, -3.58, -3.51,
     -3.46, -3.44, -3.43 / -2.63, -2.60, -2.58, -2.57, -2.57, -2.57.
   - **ocsb.test (lag 0, "fixed"): the t value of the coefficient on Delta_1 y_{t-m} in the regression of
     Delta_m Delta_1 y_t on Delta_m y_{t-1} and Delta_1 y_{t-m} without a constant**: exact (0 difference) in 18 cases;
     with a constant or seasonal dummies 0.5 to 12 off. The critical value depends only on m and decreases smoothly in
     size (-1.952 for m = 2, -1.803 for 12, -1.711 for 60).
42. `tsmeta120-ocsbcrit.R`: the smoothing function behind the critical values is not shown, so **the values are read
   off as data for m = 2..400, 500, 730, 1000, 8766** (the same for two different series per m: 0 difference); the
   table is in `experiments/tsmeta120-ocsbcrit.json` and goes into rStats.js as data (outside it: the nearest
   tabulated m is not good enough; for m above 400 rStats.js interpolates linearly in log m between the recorded
   points, a documented approximation).
