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

## forecast's auto.arima (2026-11-27)

43. `tsmeta120-autoarima.R` (first refused: the checker forbade the word `trace` even as auto.arima's argument
   `trace = TRUE`; the checker now lets `trace =` through as an argument name (as `psi =` for rlm) while `trace(...)`
   and `x <- trace` stay refused; the verdicts on the existing experiments are unchanged except
   mds110-isomds-tight.R:37, whose `trace = FALSE` is likewise an argument (that line stays refused for `args`)):
   the printed traces of seven runs. **The stepwise search (Hyndman and Khandakar 2008, with its "minor
   variations"): the initial models ARIMA(2,d,2)(1,D,1), (0,d,0)(0,D,0), (1,d,0)(1,D,0), (0,d,1)(0,D,1) (with a
   constant when d + D <= 1), then (0,d,0) without the constant when d + D <= 1; from the current best the neighbours
   in the order P-1, Q-1, P+1, Q+1, (P-1,Q-1), (P+1,Q-1), (P-1,Q+1), (P+1,Q+1), then p-1, q-1, p+1, q+1, (p-1,q-1),
   (p+1,q-1), (p-1,q+1), (p+1,q+1), then the constant switched; models outside the bounds or already fitted are
   skipped; the first improvement becomes the new best and the neighbour list starts again.** This order explains
   the traces of lh, USAccDeaths and AirPassengers (with approximation) line by line.
44. `tsmeta120-autoarima2.R` (first refused: my variables `ar`, `ma`; renamed): each traced model refitted with Arima.
   - **The printed criterion = the AICc of Arima(..., method = "CSS-ML")** (agrees to the 7 printed digits; "ML" is
     0.2 off for WWWusage (2,1,2)).
   - **"Inf" = a root of the AR or MA polynomial (seasonal parts multiplied out) with modulus < 1.01**: the rejected
     models have minimum roots 1.0000 to 1.0095, the accepted ones >= 1.0185 (this run).
   - With approximation the printed values are 57 to 65 below the ML AICc.
45. `tsmeta120-autoarima3.R`: with approximation, **printed = the AICc of the CSS fit (npar = coefficients + 1,
   nobs = n - d - sD) + an offset that is constant within a series** (AirPassengers -65.2725 for every searched
   model; the final "re-fitting without approximations" line is the ML AICc). The offset is 0 when D = 0 (a long
   random walk, sunspots) and nonzero with D = 1 (USAccDeaths -155.18, log AirPassengers +80.24, co2 +24.32, nottem
   -29.59, UKgas -39.07). The CSS and ML log-likelihoods of ARIMA(0,d,0)(0,D,0) are equal, so it is not that model.
   **The rejections in approximation mode follow the CSS fits' roots** (rejected: minimum roots 0.80 to 1.0086;
   accepted: >= 1.0110).
46. `tsmeta120-autoarima4.R` (slow: several seasonal ML fits of co2 on emulated x86_64): the candidate "offset =
   -2 loglik - nobs log sigma2 - nobs (log 2 pi + 1) of an ML reference fit" for every traced model and for
   ARIMA(0,d,0)(0,D,0), (2,d,2)(1,D,1), (0,d,1)(0,D,1): none equals the series' offset (all q are within about 1 of
   0 while the offsets are -155 to +80). Not resolved after two experiments. **It does not affect the choice**: the
   offset is the same for every model searched in a series, so the ranking under approximation equals the ranking
   of the CSS AICc, and the final model is refitted without approximation; only the printed trace values differ by
   the constant. rStats.js ranks by the CSS AICc and reports the ML AICc of the final model.

## forecast's decompositions and the remaining methods (2026-11-27)

47. `tsmeta120-fdecomp.R`: a procedural slip first — the script was run once although the checker had refused it
   (the commands were chained with ";" instead of "&&"); the refusal was the string "croston" (croston's own type
   value, a function name). That run's output was deleted unread, and the script was changed to call croston's
   default type without naming it; only the run after the checker passed is used.
   Results of the checked run:
   - **mstl with one seasonal period = stl(x, s.window = 11)** (seasonal, trend, remainder, and seasadj = x -
     seasonal: 0 difference for USAccDeaths, co2, AirPassengers, nottem, UKgas; s.window = 7 and iterate = 1 also
     exact; robust = TRUE is passed to stl). **For a non-seasonal series the trend is supsmu(1:n, x)$y exactly**
     (columns Data, Trend, Remainder): stats' supsmu is needed.
   - **seasadj**: x / seasonal for a multiplicative decompose, x - seasonal for additive decompose and stl: exact.
   - **stlf = mstl(y) (default windows) + forecast(ets(seasadj, "ZZN")) + the last cycle of the seasonal component
     repeated** (mean and intervals): exact for three series (method "STL +  ETS(...)").
   - **thetaf**: the seasonality test |r_m| > qnorm(0.95) sqrt((1 + 2 sum_{i<m} r_i^2) / n) (with n >= 2m), then a
     multiplicative decompose; **ses fitted with opt.crit = "mse"** (the likelihood-fitted alpha is 2e-5 to 0.07 off);
     mean = ses mean + b/2 (h - 1 + 1/alpha - (1 - alpha)^n / alpha), b = the slope of lm(y ~ t) of the adjusted
     series, reseasonalised: exact for five series.
   - **croston**: SES with alpha on the non-zero demands and on the intervals (counted from time 0), each started at
     its first value; forecast k z / p with k = 1, 1 - alpha/2, 1 - alpha/(2 - alpha): exact, flat over h; fitted
     values NA at 1 and 0 until the first demand has been seen.
   - **tslm = lm on trend = 1..n and season = factor(cycle)**: coefficients, forecasts and 95% intervals exact.
48. `tsmeta120-supsmu.R`: a candidate supsmu from Friedman (1984, TR 5): **running lines with half-width k =
   floor(s n / 2 + 0.5) (at least 2) and a window of 2k + 1 consecutive points kept at that size (shifted inward) at
   the ends; leave-one-out residuals |y - s| / (1 - 1/m - (x - xbar)^2 / Sxx) (the slope set to 0 when Sxx <=
   (0.001 (x_n - x_1))^2); spans 0.05 / 0.2 / 0.5, their residuals smoothed with 0.2, the span with the smallest
   smoothed residual, bass: span + (0.5 - span) max(1e-7, r_min / r_woofer)^(10 - bass) when r_min < r_woofer; the
   spans smoothed with 0.2 and clamped to [0.05, 0.5], the fit interpolated linearly in span between the 0.2 smooth
   and the 0.05 or 0.5 smooth, then smoothed with 0.05; a fixed span: one running-lines smooth**: within 4e-11
   (relative to the data's range) for four series (cv, bass = 5, span = 0.3). A shrinking window at the ends (E1)
   is far off.
49. `tsmeta120-outliers.R`: **supsmu's half-width is rounded half up** (floor(s n / 2 + 0.5) exact for n = 70, 90,
   110, 130; the ceiling is 0.02 to 0.13 off). Tied x: R returns the unique x, and averaging y over ties first is
   0.09 off (not needed for forecast, which uses x = 1..n). tsoutliers: Nile (supsmu remainder) and USAccDeaths
   (mstl remainder) give R's indices with the [Q1 - 3 IQR, Q3 + 3 IQR] rule; for AirPassengers R's 12 indices are a
   subset of the first-pass candidate's 17 (mstl robust), 15 (stl periodic robust) or neither (mstl).
50. `tsmeta120-outliers2.R`: second-pass variants (remainder of the cleaned series' fit, the original minus that fit,
   with its own or the cleaned series' quartiles, union, intersection): none gives R's set for AirPassengers, and
   even iterate = 1 differs from the first-pass candidate (R: 7, 19, 30, 31, 100, 104, 116, 128, 139, 140), so the
   decomposition behind tsoutliers is not mstl(x, robust = TRUE). Not resolved after two experiments (and the
   replacements rest on na.interp's seasonal case, also open): left to the user. For USAccDeaths, co2 and nottem
   with two planted outliers every variant agrees with R.
51. `tsmeta120-ets6.R` (first refused: deparse1 of the model's call, which reaches code; the call is not recorded):
   - **ets(model = "ZZZ") = the smallest aicc among the allowed models** (errors A / M; trends N, A, Ad — no
     multiplicative trend by default; seasons N / A / M when m > 1; multiplicative components only for positive data;
     additive error with a multiplicative season excluded), each fitted as ets(y, model, damped) itself: the same
     model and aicc for eight series (Nile MNN, USAccDeaths ANA, AirPassengers MAdM, uspop AAN, co2 MAdM, lynx MNN,
     UKgas MAM, WWWusage AAdN).
   - **amse = the mean over h = 1..nmse (3) of the in-sample h-step mean squared errors**, the h-step forecasts
     from each time's states along the zero-error path (with s_{m - (k - 1) mod m}); mse = the 1-step value: exact
     for ANN, AAA, MAM.
   - hw(seasonal = "multiplicative") fits ETS(M,A,M) but stops at a lower log-likelihood (-685.83) than
     ets(y, "MAM") (-682.40): another starting point of R's optimiser; rStats.js optimises to the best optimum it
     finds, so its hw may differ from R's where R stops at a worse local optimum (to be documented).
   - **ses(initial = "simple")**: l0 = y1 fixed, alpha minimising the SSE of the one-step errors from t = 2 (R
     0.2465657, a tight optimize 0.2465643; SSE equal to 17 digits at R's alpha).

## na.interp's seasonal case, resumed (2026-11-27, asked for by the user), with designed inputs

52. `tsmeta120-nainterp3.R`: the seasonal path is **scale- and shift-equivariant but not additive** (na.interp(y1 +
   y2) differs from the sum by 0.59; the "weights" of unit perturbations differ between two bases by 0.65): a robust
   fit. A pure seasonal spike pattern comes back exactly (6e-7); a quadratic trend's missing values come back near
   the curve (7.21956 against 7.22, where linear interpolation of the neighbours would give 7.24).
53. `tsmeta120-nainterp4.R`: candidate "fitted trend + seasonal of a robust decomposition of a first filling, at the
   missing times" (5 decompositions x 13 fillings x 1-2 iterations): 0.16 to 29 off. Rejected.
54. `tsmeta120-nainterp5.R`: back to "seasonal of a decomposition of a first filling, seasonally adjusted series
   interpolated linearly, seasonal added back", robust and non-robust, on the designed inputs: **the quadratic probe
   is reproduced exactly (1e-15) with a first filling by lm on Fourier terms and a polynomial trend of degree >= 2
   and the seasonal of mstl(robust = TRUE)** (= stl(s.window = 11, robust = TRUE)); the other probes still differ.
55. `tsmeta120-nainterp6.R`: fillings with seasonal dummies or Fourier K = 1..6 and degrees 0..5, robust mstl:
   **Fourier K = 5 with degree 4 reproduces the spike + quadratic and the noisy probes (n = 48) exactly** (4e-15);
   AirPassengers (n = 144) still 1.8 off.
56. `tsmeta120-nainterp7.R`: AirPassengers on K 1..6 x degree 0..10: **K = 5, degree 6 exact** (4e-12 with all six
   missing values, 1e-13 to 1e-11 with each alone), and the same for simulated n = 72, 96, 144: the degree depends
   on n.
57. `tsmeta120-nainterp8.R`: 28 series, m = 4, 7, 12, 24, two to nine years, three missing values; the best (K,
   degree) of a grid (exact, 3e-15 to 5e-13, in every case with more than two years):
   - **K = min(5, floor(m / 2))** (m = 4: 2; 7: 3; 12 and 24: 5);
   - **degree = min(6, floor(n / 10))**, n the length including the missing values (m = 12: n = 36 -> 3, 48 -> 4,
     >= 60 -> 6; m = 4: 12, 16 -> 1, 20-28 -> 2, 36 -> 3; m = 7: 21, 28 -> 2, 35 -> 3, 42, 49 -> 4, 63 -> 6;
     floor((n - missing) / 10) fails at n = 60).
   **na.interp for a seasonal series (frequency > 1 and more than 2m observed values): fill the missing values with
   the fit of lm(x ~ fourier(K) + poly(t, degree)) on the observed ones, take the seasonal component of
   mstl(filled, robust = TRUE), interpolate x - seasonal linearly (constant beyond the ends, approx rule = 2) and add
   the seasonal back.** With two years or less (n = 24 for m = 12) R uses the linear interpolation (the default
   `linear` argument). Resolved.

## tsoutliers and tsclean, resumed (2026-11-27, asked for by the user)

58. `tsmeta120-outliers3.R`: remainder candidates for a seasonal series: **R2 = seasadj(mstl(x, robust = TRUE)) -
   supsmu(1:n, seasadj)$y** (the non-seasonal method applied after removing the seasonal component) gives R's
   iterate = 1 outliers for all five series (AirPassengers with and without planted outliers, USAccDeaths, co2,
   UKgas with 16 flagged points) with the [Q1 - 3 IQR, Q3 + 3 IQR] rule, and **the replacements = na.interp of x with
   the flagged points removed (log item 57) agree to 17 digits**. The plain mstl remainder (R1), the non-robust mstl
   and stl periodic robust variants are off.
59. `tsmeta120-outliers4.R`: iterate = 2: **the final set = the union of the first pass's flags and the flags of the
   same pass applied to the series with the first pass's points replaced** (V3): all five series; using the
   cleaned series' fit on the original x (V2, V4, V5) is off.
60. `tsmeta120-outliers5.R`: **iterate = 1, 2 exact (indices and replacements) for seven series, including
   non-seasonal ones (remainder = x - supsmu(1:n, x)), and tsclean = x with those replacements: exact for all
   seven.** iterate = 3 agrees for six series and not for UKgas (the third pass of the candidate differs: left open,
   the default is 2). tsclean with missing values in x: R's values recorded (log only; the order of interpolation and
   outlier detection is to be checked with the fixture).

## meta's metagen (2026-11-27)

61. `tsmeta120-metagen.R` (first refused: my variable `se`; renamed `seY`): the defaults (gs()): method.tau "REML",
   method.random.ci "classic", method.common.ci "classic", method.predict "V", method.I2 "Q", levels 0.95, common and
   random TRUE, prediction FALSE, method.tau.ci unset. metagen on the BCG log risk ratios against metafor (already
   reproduced by rStats.js) for method.tau REML, DL, PM, ML, SJ, with method.random.ci classic and HK:
   - **common effect (inverse variance), random effect and its se, the classic (z) and Hartung-Knapp (rma's
     test = "knha") intervals, Q, tau2, I2 = (Q - df)/Q, H = sqrt(Q/df) and the random weights 1/(se^2 + tau2) equal
     rma's to 1e-16** in all ten combinations; the tau2 interval equals confint.rma's Q-profile except with DL;
   - the prediction interval is not TE +- t(k - 2) sqrt(tau2 + se^2) (1.3e-2 off); the I2 interval is not
     metafor's (81.9-97.7%) but 1 - 1/H^2 of the H interval (88.3-94.7%).
62. `tsmeta120-metagen2.R`: five data sets (k = 3, 5, 6, 13, 30, one with Q < k), REML / DL / PM:
   - **prediction interval ("V") = TE.random +- t(k - 1) sqrt(tau2 + seTE.random^2)**, df.predict = k - 1,
     seTE.predict = sqrt(tau2 + seTE.random^2): exact in all 15; z and t(k - 2) are off;
   - **the default tau2 interval: "J" (Jackson) with method.tau = "DL", "QP" (Q-profile) otherwise** (identical to
     metagen(..., method.tau.ci = ...) in all 15);
   - the H / I2 interval: Higgins and Thompson (2002) exact when Q > k; when Q <= k the upper bound differs.
63. `tsmeta120-metagen3.R`: **H interval = exp(log max(H, 1) +- z se) with se = 0.5 (log Q - log(k - 1)) / (sqrt(2Q)
   - sqrt(2k - 3)) when Q > k and sqrt(1/(2(k - 2)) (1 - 1/(3 (k - 2)^2))) otherwise, both bounds at least 1; I2
   interval = 1 - 1/H^2 of those (at least 0)**: exact for five data sets (k = 4 to 13). **"J" = the generalised Q
   interval with weights 1/se (metafor: rma(method = "GENQ", weights = 1/se) + confint), "BJ" = with weights
   1/se^2**: exact. rStats.js's rma has no GENQ yet: the interval needs the distribution of a weighted sum of
   chi-squares (to implement from Jackson 2013 / Farebrother 1984).

## meta's metabin (2026-11-27)

64. `tsmeta120-metabin.R`: defaults method "MH", sm "RR", incr 0.5, method.incr "only0", allstudies FALSE,
   MH.exact FALSE, RR.Cochrane FALSE, Q.Cochrane TRUE (effective only with method.tau = "DL"), method.tau "REML".
   Fleiss 1993 (no zero cells) and a set with zero cells:
   - **Mantel-Haenszel OR (Robins-Breslow-Greenland variance), RR and RD (Greenland-Robins variances), Peto
     (sum(O - E)/sum(V)) and inverse variance: the common estimates and se exact (0 to 7e-17)**, with 0.5 added to the
     cells of zero-cell studies;
   - **Q = Cochran's Q with inverse-variance weights about the IV estimate** (with the default REML); tau2 is REML.
   - with zero cells the study-level RR and RD values differ from the all-cells increment (to find next).
65. `tsmeta120-metabin2.R` (zero cells and switches):
   - **study RR: log((a + 0.5)/(n1 + 0.5)) - log((c + 0.5)/(n2 + 0.5)), variance 1/(a+0.5) - 1/(n1+0.5) + 1/(c+0.5) -
     1/(n2+0.5)** (the increment added once to the group size, not twice); **study RD: the raw difference a/n1 - c/n2
     with the variance of the incremented cells**; study OR: all four cells + 0.5; Peto study values (O - E)/V and
     1/sqrt(V): all exact;
   - **double-zero studies are left out for OR and RR (k = 6 of 7) and kept for RD (k = 7)**; allstudies = TRUE keeps
     them;
   - **MH.exact = TRUE: the MH OR without any increment** (exact); with method.tau = "DL" Q is computed about the MH
     estimate (OR: exact; RR, RD: my weights were the wrong cells, to recheck in the fixture);
   - RR.Cochrane = TRUE: study values recorded.

## meta's other effect measures, bias, trim-and-fill, regression, influence (2026-11-27)

66. `tsmeta120-metaother.R`: defaults smcont "MD", method.smd "Hedges", exact.smd TRUE, sminc "IRR", smcor "ZCOR",
   smmean "MRAW", smrate "IRLN", smprop "PLOGIT"; metainc's default method is "MH", metaprop's is "GLMM" (out of
   scope). Study TE / seTE against metafor's escalc and the pooled value against rma (REML): **MD, IRR (0.5 added to
   the events of zero-event studies), ZCOR, COR, MRAW (= MN), MLN (= MNLN), IR, IRLN, IRS, IRFT, PLOGIT ((x + 0.5)/(n +
   1) for 0 or n), PFT, PAS: exact (<= 2e-15)**. SMD: TE exact with the exact J, se 4.4e-4 off; ROM, IRD, PRAW, PLN
   differ.
67. `tsmeta120-metaother2.R` (first refused: my `se`; renamed):
   - **ROM = log(m1/m2), variance s1^2/(n1 m1^2) + s2^2/(n2 m2^2)**: exact (the difference in item 66 came from my
     comparison through escalc's pooled value, not the study values);
   - **IRD: the raw difference of rates, the variance from the incremented events** (as RD for metabin): exact;
   - **metainc's MH (Greenland and Robins 1985 for person-time): IRR = sum(x1 t2/T) / sum(x2 t1/T), var(log) =
     sum(t1 t2 (x1 + x2)/T^2) / (sum(x1 t2/T) sum(x2 t1/T)); IRD = sum((x1 t2 - x2 t1)/T) / sum(t1 t2/T), var =
     sum((t1 t2/T)^2 (x1/t1^2 + x2/t2^2)) / sum(t1 t2/T)^2, no increments**: exact;
   - **PRAW: the raw x/n; PLN: log((x + 0.5)/(n + 0.5)) for a zero** (the increment added once to n): exact;
   - SMD variance: 1/n1 + 1/n2 + g^2/(2(N - 3.94)) 2.6e-5 off, three other forms 2e-4 to 6e-3.
68. `tsmeta120-metabias.R` (first refused: my `se`; renamed):
   - SMD variance, three more forms: 2e-4 to 2e-2 off. Not resolved by candidates (two experiments): next with
     designed inputs (g = 0, then varying g and n).
   - **subgroups: Q.b (common and random) = Q of the subgroup estimates with weights 1/se^2, Q.w = the sum of the
     within-subgroup Q: exact**, df = groups - 1.
   - **metabias "Egger" = regtest(model = "lm", predictor = "sei"), t on k - 2 df: exact; "Begg": Kendall's score S
     of (TE - TE.common)/sqrt(se^2 - se.common^2) against the variances, statistic S / sqrt(k(k - 1)(2k + 5)/18)
     without continuity correction (0.1220 = 2 / 16.391), normal p: exact by hand**; Thompson, Harbord, Peters
     recorded.
   - **metareg = rma(yi, sei, mods, method = "REML"): exact**; **metainf = the leave-one-out common estimates**
     (pooled "common" by default): exact; metacum recorded (common or random to check).
   - trimfill: meta k0 = 4 (17 studies after filling) against metafor's trimfill(rma(DL / REML)) k0 = 1: to find.
69. `tsmeta120-meta2.R` (designed inputs for the SMD variance):
   - with equal means (g = 0) the variance is exactly 1/n1 + 1/n2 for five (n1, n2); with the same n the excess
     var(g) - var(0) is c(N) g^2 with c constant in g (and c computed with d is c(N) J^2); c(N) against forms:
     0.030747 (N = 20), 0.010810 (50), 0.005195 (100), 0.032760 (19), 0.002837 (180) =
     **1 - (N - 4) / ((N - 2) J^2)** (e.g. N = 20: 1 - (16/18)/0.917087 = 0.030746): **SMD variance = 1/n1 + 1/n2 +
     (1 - (N - 4)/((N - 2) J^2)) g^2** (the unbiased estimator of var(g), Hedges 1981). Resolved.
   - **trimfill = metafor's trimfill on the common-effect model (method = "FE", estimator "L0")**: k0 = 4, side
     right, the common estimate -0.29103 exact; TE.random is that of the augmented data (to confirm).
   - **metacum = the cumulative common estimates** (pooled "common"): exact.
70. `tsmeta120-meta3.R` (first refused: the string "rma" as regtest's model, which is its default and is now left out;
   the first run's Harbord candidate overflowed integer products into NA, so the counts are doubles in the second):
   - **Thompson-Sharp = the REML meta-regression of TE on se (metafor regtest(rma(method = "REML"), predictor =
     "sei")): statistic = its z value (-0.80333), p from t(k - 2) (0.43880)**: exact; DL or Knapp-Hartung are off.
   - **Harbord = the t test of the intercept of lm(Z/sqrt(V) ~ sqrt(V)), Z = O - E, V hypergeometric**: exact.
   - **Peters = the t test of the slope of lm(log OR ~ 1/N, weights 1/(1/(a + c) + 1/(b + d)))**: exact.
   - **trimfill's TE.random and tau2 = rma(REML) on the observed plus filled studies; TE.common the IV estimate of
     the same**: exact.

## netmeta (2026-11-27)

71. `tsmeta120-netmeta.R`: a candidate from Ruecker (2012): incidence matrix B, weights W, L = B' W B, L+ its
   pseudoinverse; multi-arm studies weighted so that the study's effective resistances equal its comparison
   variances (L_s = pinv(-P V P / 2), edge weights -L_s[i, j]). On a two-arm network (4 treatments, 8 studies) and
   with a three-arm study added: **TE.common, seTE.common, Q, df.Q (sum over studies of arms - 1, minus n - 1),
   TE.random, seTE.random and the P-scores (mean over j of pnorm of the standardised difference; "desirable" small
   values) exact (<= 2e-15)**. Both networks gave tau2 = 0, so tau2 was not tested.
72. `tsmeta120-netmeta2.R` (first refused: my `se`; renamed): a heterogeneous network (5 treatments, 13 studies, two
   three-arm studies): tau2 candidate T1 = (Q - df) / (sum w - tr(W B L+ B' W)) is 0.0746 against R's 0.0765;
   netsplit's direct estimates with the adjusted weights agree only for comparisons without multi-arm studies;
   decomp.design (Q total / within designs / between designs and per design) recorded; netmeasures' "proportion"
   equals netsplit's direct-evidence proportion.
73. `tsmeta120-netmeta3.R` (first run stopped in my candidate: diag() of a single weight is an identity matrix; then
   a comment inserted by sed swallowed the rest of a line; both fixed):
   - **tau2 (method "DL") = max(0, (Q - df) / tr(W (I - H) S (I - H)')), H = B L+ B' W, S block-diagonal per study
     = (1/2) C C' (the true contrasts as differences of arm-level effects N(0, tau2/2); 1 for a two-arm comparison)**
     (Jackson, White and Riley 2012): 0.0764702343106727 against 0.0764702343106725. Resolved.
   - **netsplit's direct estimate = the inverse-variance pooling of the rows of that comparison with the unadjusted
     variances seTE^2 + tau2** (multi-arm contrasts used as they are), its se, and **the direct-evidence proportion =
     var(network) / var(direct)**: exact for all comparisons (a comparison without direct evidence gives NA and
     proportion 0). The network fit on the studies containing both treatments gives the same, as the effective
     resistance construction implies.
74. `tsmeta120-netmeta4.R` (first refused: the netconnection object's `$m` read as nls's element, and my variable
   `comps` (a netmeta function); the first run then stopped in netmeta: my second outcome had noise added per
   contrast, which made its multi-arm studies inconsistent, and netmeta refuses that (its tol.multiarm check) — the
   second outcome is now built from arm-level effects):
   - **decomp.design: the Q of each design = the Q of the network fitted to that design's studies alone; Q within =
     their sum, Q between = Q total - Q within**: exact (6.57205 + 48.10106 = 54.67311; per design to 1e-15, listed in
     another order).
   - **pairwise (binary, sm = "OR"): every pair of arms of a study (treat1 the earlier arm), the study's arms all
     incremented by 0.5 when any of its arms has 0 or n events (P1)**: exact; incrementing only the affected pairs is
     off.
   - **netconnection**: two subnets for a graph with two components (5 comparisons, 7 treatments).
   - **netcomb (additive component NMA): beta = (X' W X)^{-1} X' W y with X = B C (C the treatment-by-component
     matrix from "+"-separated names, the inactive "P" left out), Q.additive = the weighted residual sum of squares,
     df = comparisons - rank(X), the combination effects C beta**: exact (1e-15).
   - netposet: the matrix of P-scores per outcome recorded (P.common, M0.common ...).

## metaprop's GLMM (2026-11-27, asked for by the user: can rStats.js's glmer reproduce it?)

75. `tsmeta120-metaprop-glmm.R`: metaprop(x, n) (default method "GLMM") on three sets (k = 6, 10, 20; a zero and an
   all-events study): **TE.random, seTE.random and tau2 = glmer(cbind(x, n - x) ~ 1 + (1 | study), binomial,
   nAGQ = 7) exactly (0 difference), = metafor's rma.glmm(measure = "PLO") exactly**; nAGQ = 1 is up to 4.5e-2 off,
   nAGQ = 10, 20 up to 1e-3 (so the 7-point adaptive Gauss-Hermite rule is the one); **TE.common, seTE.common =
   glm(cbind(x, n - x) ~ 1, binomial)** exactly; meta's Q has two values = rma.glmm's QE.Wld and QE.LRT (their
   definitions to check); the random CI is "classic" (z). rStats.js's glmer already fits nAGQ > 1, so the GLMM can
   be built on it (compared with tight refits, as the earlier glmer fixtures).
76. `tsmeta120-metaprop-glmm2.R` (the GLMM brought into scope by the user, 2026-11-27; edited in place for a second
   run): **the LRT Q = the residual deviance of glm(cbind(x, n - x) ~ 1, binomial)** (3e-10, glm's convergence);
   **the Wald Q = the Wald chi-square of glm(cbind(x, n - x) ~ factor(study), binomial) for all study effects equal,
   on all studies, df = k - 1** (to 3e-15; without zero cells it is Cochran's Q of the plain logits). A study with 0
   or n events diverges in glm's iterations (22 iterations here, "converged") and contributes about 2e-5: the
   rStats.js implementation needs its glm to follow R's iterations in a separated fit (to check with the fixture).
   Leaving that study out (df k - 2) or using incremented logits is off.
77. `tsmeta120-netmeta5.R`:
   - **netcomb random: tau2 = (Q.additive - df) / tr(W (I - H)(I - H)') with H the additive model's hat matrix X (X'WX)^-1
     X'W (two-arm studies here, so S = I), then the WLS with seTE^2 + tau2**: tau2, components and their se exact.
   - **discomb (a disconnected network) = the same additive WLS**: components, Q.additive, df exact.
   - **forest values: TE.random[, ref] +- qnorm(0.975) seTE.random[, ref]**: exact.
   - **netleague: the lower triangle [i, j] = TE.random of the column treatment against the row treatment
     (= -TE.random[i, j]) with its CI, the upper triangle the direct estimates; text "est (lower to upper)" with the
     requested digits, numbers padded to a common width**: recorded.
   - **netposet's M0 = the covering relation (Hasse diagram) of "i at least as good as j in every outcome and better
     in one" on the P-scores**: the transitive edge (4 over 2 through 3) is left out; my plain relation had it.

## ndiffs with test = "pp", type = "trend" (2026-11-27, during the implementation)

The fixture (oracle/forecastArima.R, 150 series x 4 alphas) showed 2 of 600 PP-trend decisions different from my
closed form (Phillips and Perron's Z(t_alpha) with det(X'X), X = (1, t, y_{t-1}), lag trunc(4 (n/100)^0.25), the
tau_tau rows), and 4 of 600 with the general se / s form; the constant-only statistic with the tau_tau rows 598 -> 571.
The level form (log 40-41) was never in question.

78. `tsmeta120-ndiffs4.R`: a designed probe: R's p-value at d = 0 recovered by bisection on alpha, and the statistic by
   inverting the interpolation in the tau_tau row; candidates A (closed form), B (lag trunc(12 (n/100)^0.25)), C (the
   se / s form), D (A with t centred), 80 series. Four runs, the first three my own design errors (kept as
   `-run1/2/3.json`):
   - run 1 bisected on (0.0001, 0.2): all NA, **ndiffs warns and clamps alpha to [0.01, 0.1]**;
   - run 2 started at alpha = 0.1, which never differences (log 41): all NA;
   - run 3 returned NA whenever ndiffs(hi) = 0, i.e. for every p below hi (an inverted condition);
   - run 4 (`-run4.json`): 13 interior p-values. **R's statistic is less negative than A in all 13, by 0.005 to 0.066**;
     C equals A to 1e-4, B is far off (0.1 to 0.7). Not resolved.
79. `tsmeta120-ndiffs5.R`: 240 series (white, AR(0.3), AR(0.8) errors around a near unit root, lengths 20-60, 80-120,
   200-300) with my components (t value, su2, s2, Bartlett lambda2(l) for l = 0..15, det(X'X)) beside R's recovered
   p-value; forms and lag rules fitted outside R on the 63 interior rows:
   - with the tau_tau rows: lag trunc(4 (n/100)^0.25) is the closest rule (closed form 0.14 at worst, the s2 = SSR /
     (nn - 3) variant 0.068); trunc(12 (n/100)^0.25) 0.88, trunc((n - 1)^(1/3)) 0.14, no lag 1.6; the best lag per row
     scatters (2 to 9), so no single lag rule fits within 1e-2;
   - with MacKinnon's (1991) response surfaces for the critical values in place of the rows: the closed form 0.030 at
     worst (N = n or n - 1), better than the rows but not exact.
   - **Not resolved after two experiments with a designed probe: left open for the user** (the rule of
     feedback-rstats-designed-probes). The implementation keeps the closed form with the tau_tau rows (598 of 600 in
     the fixture); a next probe would fix n (one size class) and vary the statistic, so that the knots of R's p as a
     function of the statistic give the critical values independently of the form.

## nsdiffs with test = "ocsb" (2026-11-27, during the implementation)

The stl fixture (oracle/stl.R, 120 series) showed 5 nsdiffs(test = "ocsb") decisions different from "ocsb.test(y)'s
statistic > its critical value", in both directions, although that statistic itself agreed exactly.

80. `tsmeta120-nsdiffs-ocsb.R` (two runs; run 1's output kept as `-run1.json`): 300 designed series (m = 4 and 12,
   lengths 2m + 1 to 12m, seasonal random walks, deterministic seasonals, seasonal AR):
   - run 1: the statistic and lag order of ocsb.test for lag.method "fixed", "AIC", "BIC", "AICc" and maxlag 0..3,
     with the decision rule applied outside R. **nsdiffs(test = "ocsb") = [ocsb.test(y, lag.method = "AIC", maxlag =
     3) statistic > critical]: 295 of 295**; fixed lag 0: 275 of 300. The 5 others (m = 4, n = 9) are series where that
     call fails ("invalid time series parameters specified"), and **nsdiffs returns 0 for them**; n = 10 works.
     The chosen lag orders: 0 (177), 1 (50), 2 (68), never 3.
   - run 2 (edited in place): the series and the fitted model's coefficient names, estimates and residual count.
     For lag 0 the model has 47 residuals for n = 60, m = 12 (n - m - 1); for lag L, n - m - 1 - L. **The regression
     with L lags: the AR(L) coefficients a of w = Delta_m Delta_1 y by least squares without a mean, then w_t on
     w_{t-1..L}, (1 - a(B)) Delta_m y_{t-1} and (1 - a(B)) Delta_1 y_{t-m} without a constant; the statistic is the t
     value of the last**: 118 of 118 for L = 1, 2 (to 5e-15), and lag 0 is the regression of item 41 (177 of 177).
     Without the prefilter (lagged w only) it was 0 of 118.
   - The lag choice by "AIC": 12 rules tried outside R, none fits. They were the lm AIC (with and without the
     constants) of the full regression on its own rows or on a common sample, for L in 0..3 or 0..2, and the ar.ols-type
     criteria n log(RSS / (n - L)) + 2L on the AR fit of w (own rows, common rows, n or N). The best was 141 of 295.
     Those rules choose larger L than R, while R chooses 0 in 60%.
   - **Not resolved after two experiments with a designed probe (run 2): left open for the user.** rStats.js implements
     ocsb.test with a fixed lag (the prefiltered regression), and nsdiffs(test = "ocsb") with lag 0 and nsdiffs = 0 when
     the series has at most m + 5 values (only m = 4 observed; 2m + 1 fits the same data). The default nsdiffs test
     "seas" is not affected.
