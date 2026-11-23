# Autocorrelation, partial autocorrelation and cross-correlation: acf, pacf, ccf

Reference basis: Box, Jenkins & Reinsel, *Time Series Analysis*; Brockwell & Davis, *Time Series: Theory and Methods* (Durbin–Levinson); R 4.6.2 public-call results in `experiments/acf111.R`, `experiments/acf111-formula.R`, and `experiments/acf111-na-pass.R`. No R source was consulted.

## ACF definition and normalization

For a series \(x_1,\ldots,x_N\), let \(z_t=x_t-\bar x\) when `demean=TRUE`, and \(z_t=x_t\) otherwise. With complete data, the biased sample autocovariance is

\[
\widehat\gamma_k=\frac1N\sum_{t=1}^{N-k}z_tz_{t+k},\quad
\widehat\rho_k=\frac{\widehat\gamma_k}{\widehat\gamma_0}.
\]

The divisor is the full series length (N) at every lag, not (N-k). The ACF includes lag zero. The public `acf_lh` result confirms this formula. The default maximum lag for a length-48 series is 16 (\(\lfloor10\log_{10}N\rfloor\)); requests above (N-1) are truncated and fractional requests are floored. A `ts` lag is expressed in the series time unit (observation lag divided by frequency).

## PACF definition

Let \(r_k=\widehat\rho_k\). The Durbin–Levinson recursion is

\[
\phi_{kk}=\frac{r_k-\sum_{j=1}^{k-1}\phi_{k-1,j}r_{k-j}}
 {1-\sum_{j=1}^{k-1}\phi_{k-1,j}r_j},\qquad
\phi_{k,j}=\phi_{k-1,j}-\phi_{kk}\phi_{k-1,k-j}.
\]

The PACF at lag (k) is \(\phi_{kk}\); PACF omits lag zero. The independent recursion agrees with R for the complete-data `lh` case and, importantly, for the missing-data `presidents` case when it starts from the `na.pass` ACF below.

## Missing values: verified `na.pass` rule

The R 4.6.2 public result for `presidents` is now independently reproduced. The mean is calculated after excluding missing observations:

\[
\bar x=\operatorname{mean}\(x_t:x_t\ne NA\).
\]

For nonnegative lag (k), define \(P_k=\{t:x_t\ne NA,\ x_{t+k}\ne NA\}\). R's covariance is

\[
\widehat\gamma_k=
\frac{\sum_{t\in P_k}\(x_t-\bar x\)\(x_{t+k}-\bar x\)}
 {|P_k|+k},
\qquad
\widehat\rho_k=\widehat\gamma_k/\widehat\gamma_0.
\]

For `presidents`, the mean is 56.307017543859651; usable-pair counts at lags 0–10 are 114, 110, 107, 106, 105, 104, 103, 102, 101, 101, 101; the corresponding divisors are 114, 111, 109, 109, 109, 109, 109, 109, 109, 110, 111. The direct covariance agrees with `acf(type="covariance", na.action=na.pass)` to floating-point rounding, and all 11 correlations agree. PACF from this correlation sequence via Durbin–Levinson agrees with `pacf(na.action=na.pass)` at all 10 returned lags.

For CCF, the means of x and y are computed separately after excluding their NAs. At signed lag (k), use only pairs where both aligned values are present, divide the cross-product sum by \(n_{valid}+|k|\), then normalize by (\sqrt{\gamma_{xx}(0)\gamma_{yy}(0)}). A staggered-missingness pair of series with lags -5 through +5 agrees with R at all 11 lags. This also verifies the lag orientation and that centering is global per series, not re-estimated separately for each lag.

Default missing-value handling still errors (`na.fail`). `na.omit` and `na.contiguous` are distinct behaviors and remain separate API choices. The NA rule is not zero-filling, per-lag pairwise centering, or division by the original series length.

## CCF definition and lag orientation

For complete aligned series,

\[
\widehat\gamma_{xy}(k)=\frac1N
\sum_{t:\,1\le t\le N,\,1\le t+k\le N}
\(x_{t+k}-\bar x\)\(y_t-\bar y\),\qquad
\widehat\rho_{xy}(k)=
\frac{\widehat\gamma_{xy}(k)}
 {\sqrt{\widehat\gamma_{xx}(0)\widehat\gamma_{yy}(0)}}.
\]

The lag axis is \(-L,\ldots,+L\). Swapping x and y reverses the lag sequence. R intersects shifted time-series windows; support for that metadata behavior remains a separate API decision. CCF partial correlation is rejected.

## Confidence reference

The white-noise pointwise reference shown by the ACF plot is

\[
c_\alpha=\frac{\Phi^{-1}(\(1+\alpha\)/2)}{\sqrt{n_{used}}}.
\]

For `clim_lh`, \(n_{used}=48\) and \(\alpha=.95\), the result is 0.28289643351904287. This is a pointwise reference, not a simultaneous confidence band.

## Degenerate input and remaining decisions

NaN and infinity, constant-series normalization, matrix input and scaling cases remain covered by the existing oracle cases. A zero row/column or constant series makes the relevant normalization undefined; one-column matrix input is univariate, while two-column input is outside the univariate API.

## Decisions for the user

1. Missing values: recommend adding `na.pass` using the now-verified pair-count-plus-lag formula. Keep `na.omit` and `na.contiguous` as separate options rather than approximating them.
2. CCF input: recommend equal-length vectors for the first stable array API; time-series window intersection can be added as a separate feature.
3. Lag units: recommend integer observation lags initially; time-series scaled lags can be added with explicit metadata support.
4. CCF `type`: expose correlation and covariance only; R rejects partial CCF.
5. Expose `demean` as in R rather than always centering.

## rStats.js's choices

The user's decisions of 2026-11-23 (Issue #560), written by Claude. They take precedence over every other section.

1. `acf` (univariate only), `pacf` and `ccf` in `/timeseries`. `type`: correlation (default), covariance, partial (acf
   only; `ccf` rejects partial as R). `lagMax` as R (default `floor(10 * log10(N))`, at most N - 1, fractional values
   truncated, negative is R's error; `pacf` needs at least 1). `demean` as R
2. **`naAction`: `"fail"` (default, R's error) and `"pass"` only** (user's decision). `"pass"`: means without the missing
   values; the lag-k sum over the pairs where both values are present, divided by (that number of pairs + |k|); the
   correlation divides by the lag-0 value(s) (ccf: `sqrt(gamma_x(0) gamma_y(0))`); `pacf` by Durbin-Levinson from that
   correlation. `na.omit` and `na.contiguous` are not offered
3. `ccf`: two arrays of the same length (different lengths are an error, not R's window intersection); lag k pairs
   `x[t + k]` with `y[t]`, lags `-lagMax..lagMax`
4. Lags are integers (observation counts); there is no `frequency` and no time scaling (a documented difference)
5. The result has `lag`, `acf`, `type`, `nUsed` and `clim = qnorm((1 + ci) / 2) / sqrt(nUsed)` (`ci`, default 0.95, in
   (0, 1)); every component an array where R gives a vector. Multivariate series (a matrix of two or more columns) are
   an error
6. Pass condition: every fixture case. Correlations within 1e-13 absolute, covariances within 1e-12 relative (tighten if
   the computation allows; report the largest error). Non-numeric, empty and infinite input as R or a documented error
