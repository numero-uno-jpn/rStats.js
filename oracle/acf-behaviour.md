# Autocorrelation, partial autocorrelation and cross-correlation: acf, pacf, ccf

Reference basis: Box, Jenkins & Reinsel, *Time Series Analysis*; Brockwell & Davis, *Time Series: Theory and Methods* (Durbin–Levinson); R 4.6.2 public-call results in `experiments/acf111.R` and `experiments/acf111-formula.R`. No R source was consulted.

## ACF definition and normalization

For a series \(x_1,\ldots,x_N\), let \(z_t=x_t-\bar x\) when `demean=TRUE`, and \(z_t=x_t\) otherwise. The biased sample autocovariance is

\[
\widehat\gamma_k=\frac1N\sum_{t=1}^{N-k}z_tz_{t+k},\quad k=0,\ldots,L,
\qquad
\widehat\rho_k=\frac{\widehat\gamma_k}{\widehat\gamma_0}.
\]

The divisor is the full series length \(N\) at every lag, not \(N-k\). The ACF includes lag zero. The public `acf_lh` result confirms this formula: \(\widehat\gamma_0=0.29791666666666666\), \(\widehat\gamma_1=0.17145833333333335\), and \(\widehat\rho_1=0.57552447552447561\). The direct calculation and R agree to floating-point rounding for lags 0–5:
`acf_lh`, `acf_lh_covariance`, `acf_lh_nodemean_cov`, `acf_lh_correlation`.

The default maximum lag observed for a length-48 series is 16 (\(\lfloor10\log_{10}N\rfloor\)); a requested lag larger than \(N-1\) is truncated to \(N-1\), and a fractional request is floored. Cases: `acf_lh_lag_long`, `acf_lh_lag_n`, `acf_lh_lag_frac`. For a `ts` object, the returned lag is expressed in the series time unit (integer observation lag divided by frequency).

## PACF definition

Let \(r_k=\widehat\rho_k\). The Durbin–Levinson recursion is

\[
\phi_{kk}=\frac{r_k-\sum_{j=1}^{k-1}\phi_{k-1,j}r_{k-j}}
 {1-\sum_{j=1}^{k-1}\phi_{k-1,j}r_j},
\qquad
\phi_{k,j}=\phi_{k-1,j}-\phi_{kk}\phi_{k-1,k-j}.
\]

The PACF at lag \(k\) is \(\phi_{kk}\). PACF omits lag zero; `acf(type="partial")` and `pacf` return the same sequence. The independent recursion agrees with R for the first five lags of `lh`: 0.5755244755244756, -0.2234099728642975, -0.2269402016502413, 0.1027683770062222, -0.0759344196533102. Cases: `acf_lh_partial`, `pacf_lh`, `pacf_lh_lag3`, `pacf_lh_lag0`.

## CCF definition and lag orientation

For aligned series \(x\) and \(y\), the convention verified by `ccf_small` is

\[
\widehat\gamma_{xy}(k)=\frac1N
\sum_{t:\,1\le t\le N,\,1\le t+k\le N}
(x_{t+k}-\bar x)(y_t-\bar y),
\qquad
\widehat\rho_{xy}(k)=
\frac{\widehat\gamma_{xy}(k)}
{\sqrt{\widehat\gamma_{xx}(0)\widehat\gamma_{yy}(0)}}.
\]

The lag axis is \(-L,\ldots,+L\). Swapping x and y reverses the lag sequence. For `ccf_small`, the returned lags are -3 through +3 and the independently calculated values agree with R to approximately \(10^{-16}\). Cases: `ccf_small`, `ccf_deaths`, `ccf_deaths_swapped`, `ccf_deaths_lag0`, `ccf_lengths`, `ccf_ts_window`, `ccf_ts_freq_mismatch`. R intersects shifted time-series windows; support for that metadata behavior is a separate API decision. CCF partial correlation is rejected (`ccf_partial`).

## Confidence reference

The white-noise pointwise reference shown by the ACF plot is

\[
c_\alpha=\frac{\Phi^{-1}((1+\alpha)/2)}{\sqrt{n_{used}}}.
\]

For `clim_lh`, \(n_{used}=48\) and \(\alpha=.95\), the result is 0.28289643351904287; `clim_lh_99` checks .99 and `clim_presidents_pass` checks a missing-value case. This is a pointwise reference, not a simultaneous confidence band.

## Missing values and degenerate input

Default missing-value handling errors (`acf_presidents_fail`). With `na.pass`, R returns finite results for `presidents` and reports 120 observations (`acf_presidents_pass`). However, the public result does **not** agree with the direct full-length biased covariance formula, zero-filling, valid-pair normalization, or per-lag pairwise centering tested in `acf111-formula.R`. At lags 0–5, R returns 1, 0.7683746192538251, 0.6603212411614405, 0.4836640200444070, 0.3967376524654971, 0.2496747879400336; the tested global-mean/full-length calculation gives 1, 0.7481542345366193, 0.6313597832157635, 0.4624506858319328, 0.3793368782345545, 0.2387241393461726. The exact `na.pass` weighting/centering rule remains unresolved. `na.omit` and `na.contiguous` are distinct cases (`acf_presidents_omit`, `acf_presidents_contiguous`).

NaN and infinity cases are `acf_nan` and `acf_inf`; constant-series correlation normalization is undefined (`acf_constant*`). Two-column matrix input is outside the univariate API (`acf_matrix_2col`); one-column input is treated as univariate (`acf_matrix_1col`). Scale and translation checks are `acf_scale_big`, `acf_scale_small`, `acf_shift`, `ccf_scale`, and `ccf_shift`; long-series checks are `acf_long` and `acf_long_partial`.

## Decisions for the user

1. Missing values: (a) support only `na.fail`; (b) add `na.pass`; (c) add `na.omit` and `na.contiguous` too. **Recommend (a) for 1.11.0.** The exact `na.pass` formula is not established; do not approximate it.
2. CCF input: (a) equal-length vectors only; (b) R-like time-series intersection and frequency metadata. **Recommend (a)** for a stable array API; mismatched lengths should error unless time-series metadata is deliberately in scope.
3. Lag units: (a) integer observation lags; (b) scaled time-series lags. **Recommend (a)** initially.
4. CCF `type`: correlation and covariance only; R rejects partial CCF. **Recommend matching that restriction.**
5. Expose `demean` as in R rather than always centering. **Recommend yes.**

## rStats.js's choices

