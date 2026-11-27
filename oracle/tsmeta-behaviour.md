# Time series and meta-analysis: forecast, stats, tseries, meta and netmeta (1.20.0)

Reference basis: the documentation of R 4.6.2's stats (`arima`, `arima0`, `predict.Arima`, `KalmanLike`, `filter`,
`Box.test`, `diffinv`, `decompose`, `stl`, `HoltWinters`, `predict.HoltWinters`, `ar`, `supsmu`), forecast 9.0.2,
tseries 0.10.63, meta 8.5.0 and netmeta 3.7.0 (metafor 5.2.1 for the functions meta calls), and the books and papers
they cite (named where used). R 4.6.2 public-call results (x86_64) in `experiments/tsmeta120-*.R`, every attempt (the
failed ones too) in `experiments/tsmeta120-log.md` (cited as "log n"), summaries on Issue #570. No R or package source
was consulted.

ReactiveStat's calls: `stats/時系列分析/時系列分析.php` (ts, forecast's na.interp, tsoutliers, tsclean, ndiffs,
nsdiffs, ets, Arima, auto.arima, forecast, accuracy, checkresiduals, decompose, stl, tseries' adf, kpss, pp),
`季節指数分析.php` (stats::filter's centred moving average), `メタ解析/metaAnalysis.php` (metabin, metagen with
method.tau = "REML" and method.random.ci = "HK", metabias, metareg, funnel), `networkMetaAnalysis.php` (pairwise,
netmeta (random, reference.group), netrank, netgraph, funnel).

## Scope (decided by the user, 2026-11-26; metaprop's GLMM added 2026-11-27)

- **Time series (`/timeseries`):** forecast (Arima, auto.arima, arimaorder, ets, forecast, accuracy, BoxCox,
  BoxCox.lambda, InvBoxCox, ndiffs, nsdiffs, ocsb.test, na.interp, tsclean, tsoutliers, checkresiduals, meanf, naive,
  snaive, rwf, ses, holt, hw, thetaf, croston, stlf, stlm, mstl, seasadj, seasonal, trendcycle, remainder, fourier,
  seasonaldummy, tslm, findfrequency, dm.test, tsCV, CV, ma, bizdays, monthdays, easter); stats (arima and predict,
  arima0, decompose, stl, filter, HoltWinters, Box.test, ar, diffinv, and supsmu, which mstl and tsoutliers need);
  tseries (adf.test, kpss.test, pp.test, po.test, jarque.bera.test, runs.test, white.test, terasvirta.test).
- **Meta-analysis (`/tests`):** meta (metabin (MH, Peto, inverse variance), metacont, metagen, metainc, metacor,
  metamean, metarate, metaprop including its default GLMM; REML and Hartung-Knapp; subgroups; metabias (Egger, Begg,
  Harbord, Peters, Thompson-Sharp), trimfill, metareg, metainf, metacum; the values behind funnel and baujat); netmeta
  (pairwise, netmeta (common and random), netrank (P-scores), netsplit, netleague, decomp.design, netmeasures,
  netconnection, netcomb, discomb, netposet; the values behind forest and funnel).
- **Out:** plots, nnetar, tbats / bats, baggedETS, arfima, dshw, splinef, garch, rankogram.
- R's errors are not imitated (the user, 2026-11-27): where R departs from the model it documents, rStats.js follows
  the model and the documentation says where and why (section "Departures from R").

# Part 1: time series

## stats' arima (log 1-4)

ARMA(p, q)(P, Q)_s with the seasonal polynomials multiplied out; differencing (1 - B)^d (1 - B^s)^D; mean / regressors
as a regression with ARMA errors.

- **Exact likelihood without differencing:** Gamma = autocovariance / sigma^2 of the ARMA (from the psi weights),
  Gamma = L D L' with L unit lower triangular; v = L^{-1}(x - mu); sigma2 = sum(v^2 / D) / m and loglik = -0.5 (m log(2 pi
  sigma2) + sum log D + m), m the non-missing count (missing times dropped from Gamma). **residuals = v / sqrt(D)**
  (NA at missing times). **predict = the exact best linear predictor from the finite past**, se = sqrt(sigma2 (gamma0 -
  g' Gamma^{-1} g)). (log 1)
- **Differenced models: the finite prior kappa = 1e6** on the d + sD presample values (iid N(0, kappa sigma2),
  independent of the stationary ARMA part); the first d + sD innovations are left out of sigma2 and loglik; residuals
  v_t / sqrt(F_t) for all t. Computed stably through z = (y_1..y_nd, w_{nd+1}..w_n). R itself drifts at kappa >= 1e8
  (log 4); rStats.js computes the kappa = 1e6 model exactly. (log 2-4)
- **CSS:** innovations from t = n.cond + 1 (n.cond = p + sP beyond the differencing) with earlier ones 0; sigma2 = SS /
  (n - d - sD - n.cond); **loglik = -0.5 nobs (log(2 pi sigma2) + 1) with nobs = n - d - sD** (R's own definition: n.cond
  is not subtracted there). aic NA. (log 2)
- **var.coef = J Hu^{-1} J'**: Hu = the Hessian of -loglik by optimHess (steps 1e-3) with the AR parameters as
  atanh(partial autocorrelations), J the forward difference (step 1e-3) of the map back. This is R's numerical
  approximation ("only a rough guide"): rStats.js computes it the same way to agree with R (within 1e-6), and offers the
  exact Hessian as an option (Choice 2). Regressor rows differ by 1e-4 in R (regressors orthogonalised first). (log 3-4)
- The default fit stops short (coefficients 1e-6 to 2e-3); rStats.js iterates to the maximum and is compared with a
  tight refit. (log 1)
- **arima0 / ar.mle:** ar.mle = arima0 for each order up to min(order.max, 12), aic = arima0's aic minus its minimum,
  var.pred = arima0's sigma2 (log 12). arima0's likelihood (log 84, 87): the Kalman filter until the first t >= 1 with
  F_t - 1 < delta (default 0.01; negative: never), then F = 1 and the ARMA recursion on the standardised residuals.

## forecast's Arima and forecast() (log 5)

- The fit = stats' arima on BoxCox(y, lambda) with `drift = 1:n` added for include.drift (include.constant adds it for
  d + D = 1 and nothing for d + D >= 2; include.mean FALSE when differenced).
- **sigma2 = sum of all squared residuals (the first d + sD included) / (nobs - number of coefficients)**, nobs = n - d -
  sD; predict uses it. aicc = aic + 2 npar (npar + 1) / (nobs - npar - 1), bic = aic + npar (log(nobs) - 2), npar =
  coefficients + 1. fitted = InvBoxCox(BoxCox(y) - residuals). Intervals point +- qnorm(0.5 + level/200) se,
  back-transformed. biasadj: mean = InvBoxCox(m) (1 + v (1 - lambda) / (2 (lambda m + 1)^2)), v = se^2 for forecasts,
  sigma2 for fitted values; limits unadjusted.

## auto.arima (log 43-46)

- d by ndiffs on the seasonally differenced series, D by nsdiffs (below).
- **Stepwise search:** start with (2,d,2)(1,D,1), (0,d,0)(0,D,0), (1,d,0)(1,D,0), (0,d,1)(0,D,1) (with a constant when
  d + D <= 1), then (0,d,0) without the constant when d + D <= 1; from the current best the neighbours in the order P-1,
  Q-1, P+1, Q+1, (P-1,Q-1), (P-1,Q+1), (P+1,Q-1), (P+1,Q+1), then p-1, q-1, p+1, q+1, (p-1,q-1), (p-1,q+1), (p+1,q-1),
  (p+1,q+1), then the constant switched (the diagonal order corrected from the fixture's traces, 2026-11-27); skip models outside the bounds (max.p 5, max.q 5, max.P 2, max.Q 2, max.order
  for the non-stepwise search) or already fitted; the first improvement becomes the best and the list restarts;
  at most nmodels (94).
- **Criterion = Arima(..., method = "CSS-ML")'s aicc** (default ic). **A model is rejected (printed Inf) when an AR or MA
  root (seasonal parts multiplied out) has modulus < 1.01.**
- **Approximation** (default when n > 150 or m > 12): the ranking uses the CSS fit's AICc (npar = coefficients + 1,
  nobs = n - d - sD); R's printed values add a constant per series (origin not found, log 45-46; it does not change the
  ranking); the best model(s) refitted without approximation (if the refit is rejected, the next best).

## ets (log 33-38, 51)

- **The state space recursions of Hyndman et al. (2008, table 2.3)** for errors A / M, trends N, A, Ad, M, Md, seasons
  N, A, M; seasonal states with s1 the most recent; the initial seasonal states: m - 1 estimated, the m-th implied
  (-sum, or m - sum). (log 33)
- **loglik = -0.5 lik, lik = n log(sum e^2) (+ 2 sum log |mu| for multiplicative errors); aic = -2 loglik + 2 (p + 1),
  p = number of estimated parameters including initial states; bic = aic + (p + 1)(log n - 2); aicc = aic + 2 (p + 1)
  (p + 2)/(n - p - 2); sigma2 = SSE / (n - p); mse = mean squared one-step error; amse = mean over h = 1..nmse of the
  in-sample h-step MSE.** (log 33, 51)
- Restrict (default): additive error with multiplicative season refused; "ZZZ" = the smallest aicc of the allowed models
  (no multiplicative trend unless allowed; multiplicative components only for positive data). (log 33, 51)
- **Forecast means:** the zero-error state path. **Variances:** class 1 sigma2 (1 + sum_{j<h} c_j^2), c_j = alpha + beta
  phi_j + gamma [j mod m = 0]; class 2 theta_1 = mu_1^2, theta_h = mu_h^2 + sigma2 sum c_j^2 theta_{h-j}, var = (1 +
  sigma2) theta_h - mu_h^2; class 3 (MNM, MAM, MAdM): **the exact first and second moments** by propagating E[w x] and
  E[w^2 x x'] (the level error paired with the same time's seasonal update), which agrees with R for MNM and MAM to
  4e-10. Multiplicative trends: R simulates; rStats.js simulates with R's generator (Choice 6). (log 34-38)
- Estimation: R's optimiser stops early; rStats.js optimises to the optimum within the usual bounds (alpha, beta, gamma
  in [1e-4, 0.9999], phi in [0.8, 0.98], admissible region), compared with tight values.
  (Implementation, 2026-11-27: beta <= alpha, gamma <= 1 - alpha; the admissible region is the stability of F - g w'
  with the seasonal unit eigenvalue removed; multiplicative errors require positive means, while R's fits can stop at a
  negative mean, uspop MAN. Every single-model fit of the fixture reaches R's likelihood or more; with ZZZ the choice
  then differs for AirPassengers (MAM here, R MAdM) and uspop (MAN here, R AAN).)
- ses, holt, hw = ets ANN, AAN (AAdN damped, MMN exponential), AAA or MAM with the same settings; initial = "simple":
  ses l0 = y1, holt l0 = y1, b0 = y2 - y1, hw l0 = mean(y[1:m]), b0 = (mean(y[m+1:2m]) - mean(y[1:m]))/m, s = y[1:m] - l0
  (/ l0); the smoothing parameters minimise the one-step SSE. (log 34-35, 51)

## Simple methods and small functions (log 28-32, 47)

- **meanf:** mean; intervals mean +- qt(level, n - 1) sd(y) sqrt(1 + 1/n). **naive / snaive:** sigma = sqrt(mean(res^2));
  **rwf with drift:** b = (y_n - y_1)/(n - 1), sigma = sd(res); se_h = sigma sqrt(h), sigma sqrt(h (1 + h/(n - 1))),
  sigma sqrt(floor((h - 1)/m) + 1).
- **accuracy:** ME, RMSE, MAE, MPE, MAPE, MASE (scale = mean |y_t - y_{t-m}| of the training data), ACF1; test set: plus
  Theil's U.
- **ma** (centred for even orders), **fourier** (S_k, C_k; sin dropped at k = m/2; names "S1-12"), **seasonaldummy**
  (m - 1 columns, the last period omitted), **monthdays**, **easter** (Easter by the anonymous Gregorian algorithm; the
  share of Good Friday .. Easter Sunday (.. Monday) in each period, **rounded to two decimals**), **bizdays** (weekdays
  minus the holidays of New York (NYSE, with its special closings), London, NERC, Toronto, Zurich: the rules in log 31-32).
- **dm.test** (Harvey-Leybourne-Newbold with the autocovariance estimator, t(n - 1)), **CV** (CV, AIC, AICc, BIC, AdjR2 of
  an lm), **checkresiduals** (Ljung-Box, lag min(2m, n/5) or min(10, n/5), at least df + 3; df = lag - ARMA
  coefficients).
- **BoxCox / InvBoxCox** (sign-preserving), **BoxCox.lambda** ("guerrero": groups of length max(2, m) from the end,
  optimize of the CV of sd / mean^(1 - lambda) with optimize's default tolerance; "loglik": the profile log-likelihood of
  lm on a trend (+ seasonal dummies) maximised on seq(lower, upper, 0.05)).
- **tsCV** (errors stored in the origin's row), **arimaorder**, **findfrequency** (1 unless max(spec.ar of the detrended
  series) > 10; then round(1/f) at the maximum, or at the next local maximum when the maximum is at the lowest
  frequency).
- **thetaf** (seasonality test, multiplicative decompose, ses by MSE, the drift b/2 (h - 1 + 1/alpha - (1 - alpha)^n /
  alpha)), **croston** (croston / sba / sbj), **tslm** (lm with trend and season).
- **mstl** (one period: stl(s.window = 11); non-seasonal: trend = supsmu(1:n, x)), **seasadj / seasonal / trendcycle /
  remainder**, **stlf** (mstl + ets(seasadj, "ZZN") + the last seasonal cycle), **stlm** (the same model object).

## ndiffs, nsdiffs, ocsb.test (log 39-42)

- **ndiffs KPSS:** lag trunc(3 sqrt(n)/13); difference while the KPSS-table p-value (clamped to [0.01, 0.10]) is below
  alpha. **ADF:** one lagged difference, a constant (level) or a constant and trend; **PP:** Z(t_alpha) with a constant;
  both difference while p > alpha, p interpolated between the 1/5/10% Dickey-Fuller values of the row n <= 25, 50, 100,
  250, 500, more.
- **nsdiffs ("seas"):** D = 1 when the seasonal strength of mstl exceeds 0.64.
- **ocsb.test:** the t value of Delta_1 y_{t-m} in Delta_m Delta_1 y_t ~ Delta_m y_{t-1} + Delta_1 y_{t-m} - 1 (lag 0);
  **critical values = the table read off R's output for m = 2..400** (Choice 7 for larger m).

## na.interp, tsoutliers, tsclean (log 30, 52-60)

- **na.interp:** non-seasonal (or <= 2m observed): approx(rule = 2). Seasonal: fill with lm(x ~ fourier(K = min(5,
  floor(m/2))) + poly(t, min(6, floor(n/10)))), take the seasonal of mstl(filled, robust = TRUE), interpolate x - seasonal
  linearly (rule 2), add the seasonal back.
- **tsoutliers:** remainder = seasadj(mstl(x, robust = TRUE)) - supsmu(1:n, seasadj) (non-seasonal: x - supsmu(1:n, x));
  outliers outside [Q1 - 3 IQR, Q3 + 3 IQR]; replacements by na.interp of x with them removed; iterate = 2 = the union
  of the first pass and the same pass on the cleaned series (iterate = 3 differs for one series, open). **tsclean** = x
  with those replacements (missing values first interpolated: to confirm with the fixture).

## stats' filter, Box.test, diffinv, decompose, ar, HoltWinters, stl, supsmu (log 10-13, 16, 19-27, 48-49)

- filter (convolution offset floor(p/2) for sides 2; recursive with init), Box.test, diffinv, decompose (figure from the
  first observation's position), ar.yw (var.pred = v_p n/(n - p - 1)), ar.burg (var.methods 1 / 2, var.pred = v_p),
  ar.ols (var.pred = RSS/(n - p), aic = n log(RSS_k/(n - k)) + 2k on each order's rows), predict.ar.
- **HoltWinters:** start values from decompose of the first 2 periods (level and trend from lm(trend ~ 1..k)), the filter
  from t = f + 1; optimisation of the SSE (L-BFGS-B; one parameter: optimize). Additive intervals: var(residuals) (1 +
  sum_{j<h} psi_j^2). Multiplicative intervals: see "Departures from R".
- **stl:** Cleveland et al. (1990) (h widened by (q - n) %/% 2 when q > n; lowess thresholds; periodic = s.window 10n + 1,
  degree 0, then the cycle means); robustness weights with the true median (see "Departures from R").
- **supsmu:** Friedman (1984): half-width floor(s n/2 + 0.5) (at least 2), windows shifted inward at the ends,
  leave-one-out residuals, spans 0.05 / 0.2 / 0.5, bass, interpolation, final 0.05 smooth. (Tied x: not reproduced, not
  needed by forecast.)

## tseries (log 6-9, 14-15, 17-18)

- **kpss.test** (lag trunc(4 (n/100)^0.25) or trunc(12 (n/100)^0.25), KPSS table interpolation), **adf.test** (k =
  trunc((n - 1)^(1/3)); the tau_tau table interpolated over n at n - 1, then the statistic; explosive 1 - p),
  **pp.test** (Phillips-Perron closed forms with det(X'X)), **po.test** (lag from n - 1; p from the Phillips-Ouliaris
  tables Ia / Ib read off R's output, log 18), **jarque.bera.test**, **runs.test**, **terasvirta.test** (Chisq = n
  log(SSR0/SSR1), F on (df, m - df)), **white.test** (logistic phantom units with runif((lag+1) q, -range/2, range/2) by
  columns, principal components 2..qstar+1 of the scaled hidden units, Chisq = n log(SSR0/SSR1); needs R's generator).

# Part 2: meta-analysis

## metagen and the common machinery (log 61-63)

- Defaults: method.tau "REML", method.random.ci "classic", method.predict "V", common and random TRUE.
- **Common, random (rma with method.tau), HK (knha), Q, tau2, I2 = (Q - df)/Q, H = sqrt(Q/df), weights: as metafor's rma**
  (already in rStats.js).
- **Prediction interval:** TE.random +- t(k - 1) sqrt(tau2 + seTE.random^2).
- **tau2 interval:** "J" (generalised Q with weights 1/se; metafor GENQ) when method.tau = "DL", "QP" otherwise; "BJ" =
  generalised Q with weights 1/se^2. **rStats.js's rma needs GENQ** (the distribution of a weighted sum of chi-squares).
- **H / I2 intervals:** exp(log max(H, 1) +- z se), se = 0.5 (log Q - log(k - 1)) / (sqrt(2Q) - sqrt(2k - 3)) if Q > k
  else sqrt(1/(2(k - 2)) (1 - 1/(3 (k - 2)^2))); bounds >= 1; I2 = 1 - 1/H^2 (>= 0).

## metabin (log 64-65)

- Defaults: method "MH", sm "RR", incr 0.5 for studies with a zero cell ("only0"), MH.exact FALSE, method.tau "REML".
- **MH** (OR: Robins-Breslow-Greenland; RR, RD: Greenland-Robins), **Peto** (O - E, hypergeometric V), **inverse
  variance**. Study values: OR all cells + 0.5; RR events and group sizes + 0.5; RD the raw difference with the
  incremented variance; Peto (O - E)/V. Double-zero studies out for OR / RR, kept for RD. MH.exact: no increments in MH.
- **Q** = Cochran's Q with IV weights about the IV estimate; with method.tau = "DL" (Q.Cochrane) about the MH estimate.

## metacont, metainc, metacor, metamean, metarate, metaprop (log 66-69, 75-76)

- metacont: MD; **SMD (Hedges, exact J): variance 1/n1 + 1/n2 + (1 - (N - 4)/((N - 2) J^2)) g^2** (log 69); ROM.
- metainc: default MH (Greenland-Robins for person-time, no increments); IRR (events + 0.5 for zeros), IRD (raw, the
  incremented variance).
- metacor ZCOR / COR; metamean MRAW / MLN; metarate IR, IRLN (default), IRS, IRFT; metaprop PLOGIT ((x + 0.5)/(n + 1)
  for 0 or n), PFT, PAS, PRAW (raw), PLN (log((x + 0.5)/(n + 0.5))).
- **metaprop default method GLMM: glmer(cbind(x, n - x) ~ 1 + (1 | study), binomial, nAGQ = 7)** (rStats.js's glmer);
  common = glm(cbind(x, n - x) ~ 1); Q: Wald from glm(cbind ~ factor(study)) on all studies (df k - 1), LRT = the common
  glm's deviance.

## Subgroups, bias, trim-and-fill, regression, influence (log 68-70)

- Subgroups: Q.b (common, random) = Q of the subgroup estimates, Q.w = sum of within Q.
- metabias: **Egger** (regtest lm on sei, t(k - 2)), **Begg** (Kendall's S / sqrt(k(k-1)(2k+5)/18), no continuity
  correction), **Thompson** (REML regression on se, z statistic with t(k - 2) p), **Harbord** (lm(Z/sqrt(V) ~ sqrt(V))
  intercept), **Peters** (lm(log OR ~ 1/N, weights 1/(1/(a + c) + 1/(b + d))) slope).
- **trimfill** = L0 on the common-effect model; TE.random = REML on the augmented data. **metareg** = rma(mods, REML).
  **metainf / metacum** = leave-one-out / cumulative common estimates.

## netmeta (log 71-74, 77)

- **Fit (Ruecker 2012):** L = B'WB, its pseudoinverse; multi-arm weights from L_s = pinv(-P V P / 2). Q, df = sum (arms -
  1) - (n - 1).
- **tau2 (DL) = (Q - df) / tr(W (I - H) S (I - H)')**, S per study = (1/2) C C' (Jackson, White and Riley 2012).
- **P-scores** (Ruecker and Schwarzer 2015). **netsplit:** direct = IV pooling of the comparison's rows with seTE^2 +
  tau2; indirect by back-calculation; proportion = v_net/v_dir (= netmeasures' proportion). **decomp.design:** per-design
  Q from the design's own fit, within + between. **pairwise:** all arms incremented when any arm has a zero.
  **netconnection:** components. **netcomb / discomb:** additive CNMA by WLS on X = B C; random tau2 with the additive
  hat matrix. **netleague:** lower = column vs row (random), upper = direct; **forest:** TE ± z se; **netposet:** M0 = the
  covering relation of the dominance on P-scores.
- netmeta refuses inconsistent multi-arm contrasts (tol.multiarm); rStats.js does the same.

# Edge-case plan

Written 2026-11-27 (session 40): every exported function on every axis (memory feedback-rstats-comprehensive-edge-checks).

For each function, the applicable axes; R's behaviour checked by experiments where R itself breaks, rStats.js's by
invariance (the same value after a change of scale or origin where theory says so) and by clear errors.
- **Scale and origin:** the data times 1e-150, 1e-300, 1e150, 1e300, 2^1000 (overflow of squares: variances at 1e+-150
  leave the range); a common value 1e8, 1e15 added (cancellation in means, differences, sums of squares). Time series:
  arima, ets, holtWinters, stl, decompose, filters, the tests (statistics invariant to scale; tseries' and ndiffs'
  shift-invariant ones); meta: TE and seTE scaled together (common, random, tau2 scale as squares; Q, I2, z invariant),
  netmeta likewise, metabin with counts 1e6..1e9 (MH sums), metaprop near 0 and 1.
- **Degenerate data:** constant series, series of length 1, 2, m, 2m, 2m + 1 (the seasonal limits), all zeros,
  intermittent zeros (croston), a single study, two studies, Q = 0 (identical TE), seTE equal, tau2 at the boundary,
  zero cells everywhere, all events, a network with one comparison, a star, a disconnected network (refused).
- **Invalid input:** NaN / Infinity / negative se / n < events / unequal lengths / unknown options (checkOptions):
  clear errors, not NaN results.
- **Missing values:** where R allows them (na.interp, tsclean, ets's NA handling?, acf), else errors.
- **Ties and duplicates:** supsmu's tied x (documented), runs.test with ties at the median, Begg's ties, trimfill's
  tied ranks, P-score ties.
- **Size:** n = 1e5 series for the filters and tests (speed and no O(n^2) memory), k = 1000 studies (metagen, the
  generalised Q series), 30 treatments for netmeta.
- **Probabilities:** p-values near 0 and 1 (lower tail by upper-tail functions, no 1 - p cancellation), the GENQ cdf
  near 0 / 1, P-scores.
- **Combinations:** Box-Cox lambda with scale, drift with scale, subgroups with tau.common and one-study subgroups,
  forecast() dispatch on every fitted type.

# Departures from R (R's errors are not imitated; the user, 2026-11-27)

1. **predict.HoltWinters, multiplicative intervals** (log 16; R Bugzilla Bug 19369): R reads the seasonal factors at fixed
   positions of the coefficient vector (dividing by the trend coefficient b where (h - j) mod f = 0; shifted factors and
   NA without a trend). rStats.js: var_h = var(residuals) sum_{j=0}^{h-1} (psi_j s_h / s_{h-j})^2 with cyclic seasonal
   indices (equal to R for h < f with a trend).
2. **stl robustness weights** (log 24-27; R Bugzilla Bug 19370): R's scale uses a wrong lower-middle order statistic for
   about one even-length series in ten. rStats.js: 6 median |R|.
3. **forecast.ets, class 3 with a damped trend** (log 37): R forecasts T = l + b at h = 1 (the model: l + phi b).
   rStats.js: the model's l + (phi + ... + phi^h) b.
4. **forecast.ets, ANA and MNA intervals** (log 38): R places the seasonal term of c_j at (j + 1) mod m = 0. rStats.js:
   j mod m = 0 (35% narrower at h = 4 for quarterly UKgas).
5. **hw(seasonal = "multiplicative")** (log 51): R stops at a worse local optimum than ets(MAM); rStats.js optimises.
6. **arima's kappa prior** (log 4): R's filter loses accuracy for kappa >= 1e8; rStats.js computes the kappa model exactly
   (equal to R at the default 1e6).
7. **auto.arima's stepwise search after ARIMA(0,d,0) without the constant** (log 81, found during the implementation):
   when that initial model is the best, R takes its neighbours with the constant flag of the earlier best and so skips
   the neighbours without the constant (16 of 16 traces; 3 of 16 designed series and LakeHuron affected, where R stops
   at a higher AICc). rStats.js: the neighbours of the best model itself (Hyndman and Khandakar 2008).
8. **ets's amse for damped trends** (log 82, found during the implementation): R's in-sample h-step forecasts use
   T = l + (phi + phi + phi^2 + ... + phi^{h-1}) b, not the model's l + (phi + ... + phi^h) b. rStats.js: the model's.
9. **ndiffs(test = "pp"), urca's ur.pp statistic** (log 85, 88, 90; resolved in session 40, confirmed as an
   implementation error by another LLM at the user's request): ur.pp forms the sum of squares S (constant) and
   det(X'X) of (1, t, y) (trend) from the current values y_t instead of the lagged regressor y_{t-1}; also with
   use.lag = 0 its long-run variance keeps a lag-1 term (an R `1:0` loop; never reached by ndiffs, whose lag is >= 1).
   rStats.js: Phillips and Perron's (1988) form with the lagged level (as tseries' pp.test). The statistics differ by
   up to 0.025 (constant) and 0.05 (trend), p by up to 3.4e-3; no decision differed in the 1160 checked. The critical
   values (MacKinnon 1991 at N = n - 1) are R's.
10. **ocsb.test's lag selection and nsdiffs(test = "ocsb")** (log 80, 86, 89, 90; resolved in session 40, confirmed as
   an off-by-one by another LLM): forecast compares L = 1..maxlag on a common sample by the lm AIC / BIC / AICc and
   then reports and uses L - 1 lags. rStats.js (the user's decision, 2026-11-27): lags 0..maxlag compared on the same
   common sample, the chosen lag used. The criterion is R's (3387 of 3387 non-degenerate choices consistent); nsdiffs's
   decisions differ in 5 of the 120 fixture series, each explained by the off-by-one.
11. **croston's forecast** (log 91): R forecasts from the state before the last observation (its last fitted value: the
   last observation is unused when it is a demand). rStats.js forecasts from the state after it.
12. **easter(easter.mon = TRUE) on quarterly data** (log 91): R shifts the shares where the holidays span two quarters
   (it warns about a replacement length). rStats.js gives each quarter its share.
13. **hw(initial = "simple") intervals** (log 91): R's own filter uses the Holt-Winters beta* (beta = alpha beta*), and
   R puts that beta* into the ets variance formula as if it were beta (also the multiplicative mean). rStats.js uses
   the model's beta. Its sigma2 = SSE / n and the bounds [0, 1] are R's.
14. **thetaf with a seasonal adjustment** (log 91; the user's decision 2026-11-27): R's intervals are the reseasonalised
   mean +- the width on the adjusted scale, and its residuals are on the adjusted scale. rStats.js reseasonalises the
   bounds (the width times the seasonal index) and gives y - fitted.
15. **REML's tau2 near 0** (log 97-98): metafor stops its Fisher scoring when the change is below an absolute 1e-5, so
   approaching tau2 = 0 it can stop at a small positive value (2.9e-6 for a log RR), and on measures of small scale
   (IRD: variances about 5e-6) far from the maximum (5.4e-7, 10% of the variances; with a 1e-12 threshold R gives
   1e-13, and the log-likelihood at 0 is higher). rStats.js returns the maximum (0 there).
16. **Scale** (log 103-104): R's ets, hw, HoltWinters and thetaf depend on the scale of the series (2-40% at 1e-150
   times USAccDeaths, other models chosen) and most fits and tests fail beyond 1e+-150 (squares out of range).
   rStats.js divides the series by a power of two (exact) inside ets (always), HoltWinters (its SSE below 1 by a power
   of two near it; the series beyond 2^+-200), arima, forecastArima, autoArima and ar (beyond 2^+-200) and the tests
   (always; the same values bit for bit at ordinary scales), so forecasts are equivariant and statistics invariant
   from 1e-300 to 2^1000. At ordinary scales the fits stay R's; arima's kappa prior is absolute, as R's.

17. **meanf with a missing value** (log 107): R's interval uses n = the length including the NA (its t quantile's
   degrees of freedom and sqrt(1 + 1/n)). rStats.js uses the number of observed values.
18. **Short and degenerate series** (log 107): where R fails and rStats.js has a rule (tsFilter's errors aside), or
   R's rule was not imitated: auto.arima's reduced start orders for n < 10 (not found); stl's robustness weights on
   an exact fit (R's are finite through rounding noise; rStats.js compares the bisquare's limits without dividing by
   6 median |R| = 0); ets on a constant series (the model asked for at the starting parameters, sigma2 = 0); the
   AICc of ets and auto.arima's candidates without a positive denominator is Infinity.

# Open points found during the implementation (for the user)

- **ets on a flat optimum** (log 104; resolved, log 105): with beta and gamma at their lower bound 1e-4 (USAccDeaths
  AAA, MNM) Nelder-Mead stopped at different points of the optimum after an exact change of scale or a shift (log-
  likelihood differences up to 1e-2). Now every start is refined by L-BFGS-B within the box of the bounds alternated
  with Nelder-Mead: the same optimum at every scale (and shift, for additive models) to 1e-8.

- **Resolved (log 108, the user's decisions 2026-11-28):** missing values in ets / ses / holt / hw, kpss.test and
  mstl / stlf, auto.arima on exact fits and naive / rwf after a missing value now as R's.

- **Short series in ets** (log 107; for the user; decided 2026-11-28: imitate R): R fits no likelihood when n <= npars + 4 (a Holt-Winters fit with
  simple starting values, damping dropped, an additive trend added to seasonal models, fixed parameters when n < 2m)
  and drops the seasonal component when n <= m. rStats.js now only refuses AICc's without a positive denominator; it
  still fits such models by the likelihood when asked for one explicitly, and fails below four values. Imitate R's
  simple fits, or refuse such models with a clear error?

- **ets's time** (log 107): 20 s for ets(USAccDeaths) with ZZZ, 49 s on 24 values (the seasonal models 1-7 s each).

- **Box-Cox lambda = 0.5 far below unit scale** (log 107): (x^0.5 - 1) / 0.5 is -2 to 1e-75 at 1e-150 times USAccDeaths,
  so forecastArima(lambda = 0.5) forecasts 0 (R fails): the transform itself loses the information.

- **netmeasures' mean path length and minimal parallelism** (log 101): not reproduced by the flows of the aggregated
  hat matrix (3-9% and 20-40% off); rStats.js's netmeasures returns the direct evidence proportion only.


- **auto.arima's neighbour order:** the diagonal steps are (-1, -1), (-1, +1), (+1, -1), (+1, +1) (the fixture's traces;
  log 43 had the middle two the other way round), and the non-stepwise search fits the model without the constant
  first.

# Choices (decided by the user, 2026-11-27: all as recommended)

1. **Function names and entry points.** Proposed: stats' `arima` and forecast's `Arima` as `arima` and `forecastArima`
   (JavaScript is case-sensitive, but two names differing only in case invite mistakes); `autoArima`, `ets`, `forecast`
   (a dispatcher over the fitted objects), `accuracy`, `boxCox`, `boxCoxLambda`, `invBoxCox`, `ndiffs`, `nsdiffs`,
   `ocsbTest`, `naInterp`, `tsoutliers`, `tsclean`, `checkresiduals`, `meanf`, `naive`, `snaive`, `rwf`, `ses`, `holt`,
   `hw`, `thetaf`, `croston`, `stlf`, `stlm`, `mstl`, `seasadj`, `fourier`, `seasonaldummy`, `tslm`, `findfrequency`,
   `dmTest`, `tsCV`, `cvLm` (forecast's CV), `ma`, `bizdays`, `monthdays`, `easter`; stats `arima0`, `decompose`, `stl`,
   `tsFilter` (stats' `filter`; decided by the user 2026-11-27: `filter` would be confused with Array.prototype.filter and other libraries' `filter`), `holtWinters`, `boxTest`, `ar`, `diffinv`, `supsmu`; tseries `adfTest`, `kpssTest`, `ppTest`,
   `poTest`, `jarqueBeraTest`, `runsTest`, `whiteTest`, `terasvirtaTest`; meta `metabin`, `metacont`, `metagen`,
   `metainc`, `metacor`, `metamean`, `metarate`, `metaprop`, `metabias`, `trimfill`, `metareg`, `metainf`, `metacum`;
   netmeta `pairwise`, `netmeta`, `netrank`, `netsplit`, `netleague`, `decompDesign`, `netmeasures`, `netconnection`,
   `netcomb`, `discomb`, `netposet`. Entry points: time series in `/timeseries` (with acf, pacf, ccf), meta-analysis in
   `/tests` (with rma, escalc).
2. **arima's var.coef:** R's numerical Hessian (agrees with R within 1e-6; recommended as the default for comparability)
   with the exact Hessian as an option, or the exact Hessian by default.
3. **CSS loglik:** R's nobs (n.cond not subtracted) as R (recommended: it is R's documented "approximation"), or n - n.cond.
4. **auto.arima's printed trace values in approximation mode:** rStats.js reports the CSS AICc without R's per-series
   constant (its origin is unknown; the choice of model is the same).
5. **The R-random-number functions** (white.test's weights, ets simulation for multiplicative trends, forecast's
   simulate / bootstrap): use rStats.js's R-compatible Mersenne-Twister with a seed argument, so that the same seed
   gives R's values.
6. **ets simulation paths (npaths 5000)**: as 5 (R's generator), or analytic only where R has formulas.
7. **ocsb critical values beyond m = 400:** linear interpolation in log m between the recorded 400, 500, 730, 1000,
   8766, and the last value beyond (a documented approximation).
8. **metaprop's GLMM:** default as R (decided).

# Edge cases (the comprehensive pass, planned from the start)

Every published function on every axis, against R where R works and by invariance where it does not:
scales 1e±150 / 1e±300 of the data (and the effect sizes), common offsets 1e8, mixed scales of regressors, constant and
near-constant series, all-zero series, single-period and very short series (n <= 2m, n = 3), missing values (leading,
trailing, runs), very long series (n = 1e5 for the filters; 2000 for ets / arima), seasonal periods 2, 4, 7, 12, 24,
52, 365; near unit roots and non-invertible MA; exact fits (zero residual variance); ties (supsmu, Kendall); zero cells
and double zeros (metabin), zero events (metainc, metaprop), all events, k = 1, 2, 3 studies, identical studies (tau2 =
0), huge heterogeneity, extreme weights (1e±200), disconnected networks, star networks, multi-arm studies with 4 arms,
networks where every comparison is direct, inconsistent multi-arm data (refused).
