# Meta-analysis: reference behaviour

Issue: #529  
Base: `ff9517c8cf35d0e509582bb9db5338f217e77531`  
Reference: R 4.6.2, metafor 5.2.1, metadat 1.6.0  
Stage: 1 only (behaviour specification and R fixture generators)

## Evidence and clean-room boundary

This specification is based on:
- the public help pages for `escalc`, `rma.uni`, `confint.rma`, `predict.rma`, and `regtest`;
- published statistical papers and textbooks cited below;
- public calls to the exported functions in metafor 5.2.1 and the resulting values, warnings, and errors recorded by the R experiment scripts.

No source code from metafor, metadat, or R was read or used. No internal namespace calls are part of the experiments. Package output is evidence about the reference implementation, not proof that every numerical result is mathematically correct. Any anomalous result must be checked independently before it is proposed as desired behaviour.

## Scope

The ROADMAP item is a univariate inverse-variance meta-analysis with:
- equal/fixed-effect synthesis;
- random-effects synthesis using DerSimonian-Laird (DL) and restricted maximum likelihood (REML);
- the heterogeneity statistics and test;
- confidence intervals for the pooled effect and for heterogeneity;
- prediction intervals for a future study's true effect;
- the classical Egger regression test.

The target package versions are metafor 5.2.1 and metadat 1.6.0. The R oracle uses R 4.6.2. The BCG example is `metadat::dat.colditz1994`, 13 prospective studies of BCG vaccination and tuberculosis.

## 1. Data and effect sizes

### Generic effect estimates

For independent studies (i=1,\ldots,k), the core input is an effect estimate (y_i) and its within-study sampling variance (v_i). The standard error is (s_i=\sqrt{v_i}). The generic effect-size path does not require the library to know how each study produced (y_i) and (v_i).

The public `rma` help accepts `yi` with `vi`, or `yi` with `sei`; when `measure="GEN"`, these are supplied estimates and sampling variances. The `escalc` help also documents generic estimates via `measure="GEN"`, `yi`, and `vi`.

### Binary outcomes

For a two-group (2\times2) table with treatment counts (a_i,b_i) and control counts (c_i,d_i), the log risk ratio is

$$
y_i=\log\left(\frac{a_i/(a_i+b_i)}{c_i/(c_i+d_i)}\right).
$$

For nonzero cells, its usual large-sample variance is

$$
v_i=\frac{1}{a_i}-\frac{1}{a_i+b_i}
    +\frac{1}{c_i}-\frac{1}{c_i+d_i}.
$$

The log odds ratio is

$$
y_i=\log\left(\frac{a_i d_i}{b_i c_i}\right),\qquad
v_i=\frac1{a_i}+\frac1{b_i}+\frac1{c_i}+\frac1{d_i}.
$$

Zero-cell handling is not a cosmetic detail. The `escalc` help exposes `add`, `to`, and `drop00`; its documented defaults are `add=1/2`, `to="only0"`, and `drop00=FALSE`. The effect-size measure and correction policy must be selected explicitly for a JavaScript API rather than hidden behind one generic binary-data call.

### Continuous outcomes

For independent groups with means (m_{1i},m_{2i}), standard deviations (sd_{1i},sd_{2i}), and sample sizes (n_{1i},n_{2i}), the raw mean difference is

$$
y_i=m_{1i}-m_{2i},\qquad
v_i=\frac{sd_{1i}^2}{n_{1i}}+\frac{sd_{2i}^2}{n_{2i}}.
$$

A standardized mean difference requires a choice of pooled or heteroscedastic standardization, small-sample bias correction, and sampling-variance approximation. These choices are not interchangeable. The public `escalc` help documents multiple SMD variants and `vtype` choices.

### Reference data

`dat.colditz1994` has 13 studies and the columns `tpos`, `tneg`, `cpos`, `cneg`, `ablat`, and `alloc`, among others. The package help example computes log risk ratios with `escalc(measure="RR", ai=tpos, bi=tneg, ci=cpos, di=cneg)`. This is the principal end-to-end data set in the oracle.

## Observed BCG reference snapshot

The public experiment ran under R 4.6.2, metafor 5.2.1, and metadat 1.6.0. For the 13-study `dat.colditz1994` log-risk-ratio data:

| Method | Pooled estimate | SE | tau2 | I2 (%) | H2 |
|---|---:|---:|---:|---:|---:|
| EE | -0.430285163654091 | 0.040498751710864 | 0 | 92.117346854562 | 12.686084006864 |
| FE | -0.430285163654091 | 0.040498751710864 | 0 | 92.117346854562 | 12.686084006864 |
| DL | -0.714117222073227 | 0.178742089535403 | 0.308760262862376 | 92.117346854562 | 12.686084006864 |
| REML | -0.714532348365101 | 0.179781531780361 | 0.313243325980895 | 92.221386074966 | 12.855760803112 |

All four fits report (Q=152.23300808237326), (df=12), (Q_p=1.9967645908460005\times10^{-26}). EE and FE are numerically identical for this dataset, although the printed model labels differ. This single probe does not establish that they are interchangeable for every input.

For REML, the Q-profile 95% interval for tau2 is [0.119695312816638, 1.11148626221544], while the profile-likelihood interval is [0.115239399672938, 0.964666425362115]. The default prediction interval is [-1.86669234660707, 0.437627649876867]; the explicit Riley interval is [-2.00837605069052, 0.579311353960316]. The classical Egger `model="lm", predictor="sei"` test returns t=-1.40128200228933, df=11, p=0.188706995081979.

These are reference outputs for fixture validation, not universal targets for other datasets or methods.

## 2. Equal/fixed-effect model

Let (w_i=1/v_i). The inverse-variance pooled estimate is

$$
\widehat\mu_{FE}=\frac{\sum_i w_i y_i}{\sum_i w_i},\qquad
\operatorname{Var}(\widehat\mu_{FE})=\frac1{\sum_i w_i},\qquad
SE(\widehat\mu_{FE})=\sqrt{\frac1{\sum_i w_i}}.
$$

A Wald statistic for (H_0:\mu=0) is (z=\widehat\mu/SE(\widehat\mu)), with a two-sided normal-tail p-value unless another alternative is selected. A (100(1-\alpha)\%) Wald interval is

$$
\widehat\mu_{FE}\pm z_{1-\alpha/2}SE(\widehat\mu_{FE}).
$$

The public `rma.uni` help distinguishes `method="EE"` (equal-effects) from `method="FE"` (fixed-effects). Both are relevant names in the target interface; whether rStats.js should expose both aliases or one is a user decision. Their observed output fields and any distinctions must be checked by the R fixtures.

## 3. Heterogeneity: Cochran's Q, I-squared, and H-squared

For an intercept-only inverse-variance model, Cochran's statistic is

$$
Q=\sum_{i=1}^{k}w_i(y_i-\widehat\mu_{FE})^2,
\qquad df=k-1.
$$

Under the null hypothesis of a common true effect and known within-study variances, (Q) is compared with a chi-squared distribution with (k-1) degrees of freedom. The upper-tail p-value is (P(\chi^2_{k-1}\ge Q)). With moderators, the analogous residual heterogeneity statistic is (Q_E); this is outside the initial intercept-only scope unless the user chooses meta-regression.

The conventional summaries are

$$
I^2=100\%\times\max\left(0,\frac{Q-df}{Q}\right),\qquad
H^2=\frac{Q}{df}.
$$

There is an important estimator-dependent convention in metafor. Its public `print.rma` help documents the more general definitions

$$
\widetilde v=\frac{(k-1)\sum_i w_i}{(\sum_i w_i)^2-\sum_i w_i^2},
\qquad
I^2=100\%\times\frac{\widehat\tau^2}{\widehat\tau^2+\widetilde v},
\qquad
H^2=\frac{\widehat\tau^2+\widetilde v}{\widetilde v}.
$$

These definitions ensure (I^2=0,H^2=1) when (widehat\tau^2=0), and are consistent with the fitted heterogeneity estimate. For DL, they coincide with the conventional Q-based formulas. REML may therefore give I-squared and H-squared that differ from the conventional Q-based summaries. This distinction must not be flattened into one formula.

## 4. Random-effects model

Assume

$$
y_i\mid\theta_i\sim N(\theta_i,v_i),\qquad
\theta_i\sim N(\mu,\tau^2).
$$

For a given (	au^2\ge0), define

$$
w_i(\tau^2)=\frac1{v_i+\tau^2},\qquad
\widehat\mu(\tau^2)=\frac{\sum_i w_i(\tau^2)y_i}{\sum_i w_i(\tau^2)},
\qquad
SE(\widehat\mu)=\left(\sum_i w_i(\widehat\tau^2)\right)^{-1/2}.
$$

### DerSimonian-Laird

Using the fixed-effect weights, let

$$
C=\sum_i w_i-\frac{\sum_i w_i^2}{\sum_i w_i}.
$$

The method-of-moments estimator is

$$
\widehat\tau^2_{DL}=\max\left(0,\frac{Q-(k-1)}{C}\right).
$$

It is non-iterative. If (Q\le k-1), the estimate is on the boundary at zero.

### Restricted maximum likelihood

For a candidate (	au^2\ge0), the restricted log likelihood, up to constants independent of (	au^2), is

$$
\ell_R(\tau^2)=-\frac12\left[
\sum_i\log(v_i+\tau^2)
+\log\left(\sum_i\frac1{v_i+\tau^2}\right)
+\sum_i\frac{(y_i-\widehat\mu(\tau^2))^2}{v_i+\tau^2}
\right].
$$

The REML estimate maximizes this function over the non-negative parameter space. It generally requires numerical optimization. This objective provides an independent mathematical target; it does not prescribe a particular optimizer or reproduce package internals.

The metafor 5.2.1 public help states that ML, REML, and EB estimates are obtained iteratively with Fisher scoring; for those methods the documented default initial value is the Hedges estimator, convergence is based on the change in (	au^2) falling below (10^{-5}), and the default maximum is 100 iterations. A different initial value, threshold, maximum iteration count, and step adjustment can be supplied through `control`. These are reference-package observations, not a requirement to copy its iteration algorithm. Stage 3 must independently assess numerical accuracy and convergence behaviour.

For an intercept-only model, the pooled random-effects estimate is (widehat\mu(\widehat\tau^2)), with normal-theory Wald inference by default. The public `rma.uni` help documents `test="z"` as the default; `test="t"` and `test="knha"` are alternatives.

## 5. Confidence intervals and prediction intervals

### Pooled effect

For the default z test, the interval for the pooled effect is

$$
\widehat\mu\pm z_{1-\alpha/2}SE(\widehat\mu).
$$

The reference help documents the fitted confidence level default as 95 percent. The inference distribution changes for `test="t"` or `test="knha"`.

### Between-study variance

The public `confint.rma` help documents Q-profile (default for DL and REML) and profile-likelihood (`type="PL"`) intervals for (	au^2). The Q-profile interval is obtained by inverting the noncentral chi-squared relationship for Q; the profile-likelihood interval is based on the likelihood-ratio criterion. The square-root interval for (	au), and corresponding intervals for I-squared and H-squared, are also returned. These methods answer different inferential questions and must not be conflated.

The lower endpoint is constrained by (	au^2\ge0). A likelihood or Q-profile interval may meet the boundary. The help notes that iterative endpoint searches can fail at extremes, return missing bounds, or require endpoint adjustment. An interval can also be empty when both bounds fall below the parameter space; the reference documents this as a possible outcome.

### Prediction interval

For a random-effects model, the prediction interval describes the distribution of the true effect in a new study from the same population, not the uncertainty in the pooled mean alone. The public `predict.rma` help returns `pred`, `se`, `ci.lb`, `ci.ub`, and, for random-effects models, `pi.lb` and `pi.ub`.

The reference default uses the fitted model's test distribution. With `test="z"`, normal critical values are used; with t/Knapp-Hartung tests, a t distribution with (k-p) degrees of freedom is used. The help explicitly notes that this default differs from the Riley et al. (k-2) suggestion. A Riley-style interval can be requested in R using `predtype="riley"`. This is a material API choice for rStats.js.

A commonly cited approximation is

$$
\widehat\mu\pm t_{k-2,1-\alpha/2}
\sqrt{\widehat\tau^2+SE(\widehat\mu)^2}.
$$

It must not be described as the metafor default without qualification.

## 6. Egger regression test

The original Egger test regresses the standard normal deviate on precision:

$$
\frac{y_i}{s_i}=\beta_0+\beta_1\frac1{s_i}+\varepsilon_i.
$$

The intercept (eta_0) is tested against zero. In the classical unweighted linear-regression formulation, the test uses the fitted intercept's t statistic and residual degrees of freedom (k-2). A nonzero intercept is evidence of a relationship between effect estimates and their standard errors, often described as funnel-plot asymmetry or small-study effects.

The public `regtest` help distinguishes `model="lm"` (classical weighted regression with a multiplicative dispersion term) from `model="rma"` (mixed-effects meta-regression; default). The classical Egger test is `model="lm", predictor="sei"`. The random/mixed-effects version is not numerically identical in general. The help warns that these tests do not directly prove publication bias: other mechanisms can create funnel-plot asymmetry, including mathematical coupling between estimates and their sampling variances.

The initial ROADMAP request says Egger's test; the exact model variant and returned fields must be settled in Decisions for the user.

## 7. Defaults, errors, warnings, and boundaries

### Documented defaults in metafor 5.2.1

- `rma`: `method="REML"`, inverse-variance weighted estimation, `test="z"`, and `level=95`.
- `escalc`: `add=1/2`, `to="only0"`, `drop00=FALSE`, and `correct=TRUE` where applicable.
- `regtest`: `model="rma"` and `predictor="sei"`.
- `predict` and `confint`: use the level stored in the fitted model when no level is supplied.

### Input and boundary cases to probe

The oracle must include:
- (k=1): no heterogeneity degrees of freedom. In the public R 4.6.2 probe, REML returned tau2=0, Q(df=0)=0, and Qp=1, with a finite pooled estimate and standard error. Preserve this as an observed reference result, but do not interpret a zero-df Q test as informative evidence of homogeneity.
- (k=2): very limited heterogeneity information and unstable small-sample inference.
- identical study estimates: Q=0 and tau2=0 in the observed DL probe.
- (Q\le k-1): DL estimate at zero; REML may also attain the boundary.
- a single zero sampling variance, negative variance, missing value, and non-finite input.
- zero cells in binary studies, with default correction and alternative zero-cell policies.
- very large and very small finite effects and variances, where products, squares, weights, and likelihood terms can overflow or underflow.
- REML with deliberately restrictive iteration controls, to observe non-convergence and warnings.
- Egger regression with too few studies, constant standard errors, or a singular design.
- confidence-interval endpoint searches near the boundary and at extreme heterogeneity.

Additional observed R 4.6.2 boundary results: for k=2 with y=(0.1,0.2) and v=(0.04,0.05), REML returned tau2=0, Q=0.1111111, df=1, and Qp=0.7388827. DL returned tau2=0 for identical study estimates and for a case with Q<df.

The reference help and papers establish the model and algorithms, but they do not settle every error message, warning, or degenerate result for every boundary. Those are empirical observations to be recorded in the fixtures. If R's result appears mathematically suspect, compute an independent high-precision or exact reference before calling it a defect.

### Result fields to record

For a fitted univariate model, the documented public result includes coefficient estimates `beta`, `se`, `zval`, `pval`, `ci.lb`, `ci.ub`; heterogeneity `tau2`, `se.tau2`, `QE`, `QEp`, `I2`, `H2`; and study count `k`. Prediction and confidence-interval results have the named fields described above. Fixtures should preserve full numeric precision, names, dimensions, warnings, and errors.

## 8. References

Public reference documentation (consulted as help pages, not source code):
- [`escalc` reference](https://wviechtb.github.io/metafor/reference/escalc.html)
- [`rma.uni` reference](https://wviechtb.github.io/metafor/reference/rma.uni.html)
- [`confint.rma` reference](https://wviechtb.github.io/metafor/reference/confint.rma.html)
- [`predict.rma` reference](https://wviechtb.github.io/metafor/reference/predict.rma.html)
- [`regtest` reference](https://wviechtb.github.io/metafor/reference/regtest.html)
- [`dat.colditz1994` reference](https://wviechtb.github.io/metadat/reference/dat.colditz1994.html)

- Borenstein, M., Hedges, L. V., Higgins, J. P. T., & Rothstein, H. (2009). *Introduction to Meta-Analysis*. Wiley.
- Cochran, W. G. (1954). The combination of estimates from different experiments. *Biometrics*, 10(1), 101–129.
- DerSimonian, R., & Laird, N. (1986). Meta-analysis in clinical trials. *Controlled Clinical Trials*, 7(3), 177–188. https://doi.org/10.1016/0197-2456(86)90046-2
- Egger, M., Davey Smith, G., Schneider, M., & Minder, C. (1997). Bias in meta-analysis detected by a simple, graphical test. *BMJ*, 315, 629–634. https://doi.org/10.1136/bmj.315.7109.629
- Higgins, J. P. T., & Thompson, S. G. (2002). Quantifying heterogeneity in a meta-analysis. *Statistics in Medicine*, 21, 1539–1558. https://doi.org/10.1002/sim.1186
- Riley, R. D., Higgins, J. P. T., & Deeks, J. J. (2011). Interpretation of random effects meta-analyses. *BMJ*, 342, d549. https://doi.org/10.1136/bmj.d549
- Viechtbauer, W. (2005). Bias and efficiency of meta-analytic variance estimators in the random-effects model. *Journal of Educational and Behavioral Statistics*, 30(3), 261–293. https://doi.org/10.3102/10769986030003261
- Viechtbauer, W. (2010). Conducting meta-analyses in R with the metafor package. *Journal of Statistical Software*, 36(3), 1–48. https://doi.org/10.18637/jss.v036.i03
- Hartung, J., & Knapp, G. (2001). On tests of the overall treatment effect in meta-analysis with normally distributed responses. (The 2001 paper is a relevant alternative-inference reference; the metafor help cites the later Knapp & Hartung 2003 regression paper for `test="knha"`.)

## Decisions for the user

1. **Effect-size API and supported measures.** Should Stage 2 expose only generic `yi`/`vi` inputs, or also an `escalc`-like function? If effect sizes are included, recommended initial measures: `RR` (log risk ratio), `OR` (log odds ratio), `MD` (mean difference), and `SMD` (Hedges-corrected standardized mean difference). Should zero-cell correction options (`add`, `to`, `drop00`) be exposed? Recommendation: generic input first; add a small, explicitly specified effect-size helper only if desired, with RR/OR and MD/SMD as separately validated measures.
2. **Data hand-off.** Should a fit accept parallel arrays `yi` and `vi`, or the result of `escalc`, or both? Recommendation: accept `yi` and `vi` directly; if an effect-size helper is approved, its result should be directly consumable without copying or renaming fields.
3. **Model names.** Should the API expose `metaAnalysis` (or `rma`) with `method: "EE" | "FE" | "DL" | "REML"`? Should `FE` and `EE` both be accepted? Recommendation: one function named `metaAnalysis`, accept `"FE"` and `"DL"`/ `"REML"`; include `"EE"` only if the public probes show it is a distinct compatibility case. Avoid a dotted `rma.uni` JavaScript name.
4. **Inference.** Should Stage 2 implement only the default z/Wald inference, or also `test: "t"` and Knapp-Hartung (`"knha"`)? Recommendation: default z first; defer t/Knapp-Hartung because it changes standard errors, tests, confidence intervals, and prediction intervals together.
5. **Heterogeneity intervals.** Should `confint` support Q-profile only, or Q-profile plus profile likelihood? Recommendation: Q-profile first, with a clearly named option for profile likelihood only if the iterative numerical scope is accepted.
6. **Prediction interval convention.** Should the default match metafor's model-based interval (normal critical value for z inference; t with (k-p) df for t/knha), or the widely cited Riley (k-2) interval? Recommendation: match metafor's documented default and expose Riley as an explicit alternative only if needed.
7. **Egger test.** Should it be the classical `model="lm", predictor="sei"` test, or metafor's default `model="rma"` variant? Recommendation: classical Egger first, with the regression intercept, standard error, t statistic, df, and p-value returned explicitly. Do not label the result as a direct test of publication bias.
8. **Meta-regression.** Include moderator matrices/formulas now, or intercept-only models only? Recommendation: defer meta-regression; it expands the design matrix, residual heterogeneity, moderator omnibus tests, and prediction semantics.
9. **Other methods.** Include ML, HE, PM, SJ, EB, and other `rma.uni` estimators? Include `ranktest`, `trimfill`, `rma.mh`, `rma.peto`, or plotting? Recommendation: defer all; keep this ROADMAP item focused on EE/FE, DL, REML, Q/I²/H², intervals, and Egger.
10. **Export surface.** Add these functions to `src/entries/tests.ts`, or create a dedicated `meta-analysis` entry point? Recommendation: a dedicated entry point (and root re-export) keeps model fitting and effect-size calculations out of the hypothesis-test subpath; the user should decide based on CDN size and naming.


## 9. Expanded estimators and meta-regression

The approved scope contains eleven values of method: "EE", "FE", "DL", "HE", "HS", "HSk", "SJ", "ML", "REML", "EB", and "PM". The aliases "CO" and "VC" for HE are not additional approved values. EE is equal-effects synthesis; FE is fixed-effects synthesis. Both use inverse-sampling-variance weights by default and have \(\widehat{\tau}^2=0\). The remaining methods estimate a non-negative between-study (or residual) variance.

For any candidate \(\tau^2\), define \(w_i(\tau^2)=1/(v_i+\tau^2)\). The pooled estimate for an intercept-only model is
\[
\widehat\mu(\tau^2)=\frac{\sum_i w_i(\tau^2)y_i}{\sum_i w_i(\tau^2)}.
\]
The DL estimate is the method-of-moments expression in Section 4. For the intercept-only case, let \(\bar y=k^{-1}\sum_i y_i\). The Hedges/Cochran estimator is
\[
\widehat\tau^2_{HE}=\max\left(0,\frac{1}{k-1}\sum_i(y_i-\bar y)^2-\frac{1}{k}\sum_i v_i\right).
\]
The generalized Hunter-Schmidt estimator is
\[
\widehat\tau^2_{HS}=\max\left(0,\frac{Q-k}{\sum_i 1/v_i}\right),
\]
where \(Q\) is Cochran's inverse-variance weighted statistic. HSk is the Hunter-Schmidt estimator with the small-sample-size correction of Brannick et al. (2019); it is a distinct estimator and must not be silently replaced by HS. Its exact correction must be checked against the paper before implementation, rather than guessed from the label.

For Sidik-Jonkman, start with
\[
\widehat\tau_0^2=\frac1k\sum_i(y_i-\bar y)^2,\qquad
a_i=\frac{\widehat\tau_0^2}{v_i+\widehat\tau_0^2},\qquad
\widehat\mu_{SJ}=\frac{\sum_i a_i y_i}{\sum_i a_i},
\]
and then
\[
\widehat\tau^2_{SJ}=\frac1{k-1}\sum_i a_i(y_i-\widehat\mu_{SJ})^2.
\]
The ML estimate maximizes
\[
\ell_{ML}(\mu,\tau^2)=-\frac12\sum_i\left[\log(v_i+\tau^2)+\frac{(y_i-\mu)^2}{v_i+\tau^2}\right]
\]
over \(\mu\in\mathbb R\) and \(\tau^2\ge0\). REML maximizes the restricted likelihood in Section 4. EB is the empirical-Bayes estimator; in the reference package EB and PM are documented as identical. PM is the Paule-Mandel estimator, defined by solving the generalized Cochran equation \(Q(\tau^2)=k-1\) for an intercept-only model, with the non-negative solution and boundary at zero when the equation does not cross zero above zero. This equality is a reference-package statement to verify numerically in fixtures, not a reason to alias distinct user-facing method names.

The reference documents the following numerical controls:
- ML, REML, and EB use Fisher-scoring iterations; the default initial \(\tau^2\) is the HE estimate, convergence threshold is \(10^{-5}\), and maximum iterations is 100. tau2.init, threshold, maxiter, and stepadj can change the run.
- PM uses a scalar root search; default tolerance is \(\epsilon_{double}^{1/4}\), maximum iterations 100, and upper search bound \(\max(100,10\,MAD(y)^2)\). Controls include tol, maxiter, and tau2.max.
- Negative variance estimates are outside the parameter space. HE, HS, HSk, and DL truncate them to zero; ML/REML/EB keep the estimate non-negative during iteration. PM searches from zero by default.
- Non-positive sampling variances are problematic. A zero variance gives infinite inverse-variance weight for EE/FE; several random-effects estimators are undefined at zero variance. Negative variances must not silently be accepted as ordinary positive variances.

### Meta-regression

For study \(i\), let \(x_i\) be the row of the model matrix (including an intercept unless disabled), and let \(p\) be the number of coefficients. The mixed-effects meta-regression model is
\[
y_i=x_i^\mathsf{T}\beta+u_i+\varepsilon_i,\qquad
u_i\sim N(0,\tau^2),\quad \varepsilon_i\sim N(0,v_i).
\]
For fixed \(\tau^2\), with \(W=\operatorname{diag}\{1/(v_i+\tau^2)\}\),
\[
\widehat\beta=(X^\mathsf{T}WX)^{-1}X^\mathsf{T}Wy,\qquad
\operatorname{Var}(\widehat\beta)=(X^\mathsf{T}WX)^{-1}.
\]
The heterogeneity estimate is the residual \(\tau^2\) after accounting for the moderators. The residual heterogeneity statistic is
\[
Q_E=(y-X\widehat\beta)^\mathsf{T}W(y-X\widehat\beta),\qquad df=k-p.
\]
The omnibus moderator test \(Q_M\) tests that the selected \(m\) moderator coefficients are jointly zero. Under the default z inference it is asymptotically chi-squared with \(m\) degrees of freedom; for test="t" or "knha", the omnibus test is F-based with numerator df \(m\) and denominator df \(k-p\). By default the intercept is excluded from this omnibus test. The returned public fields include QM, QMp, QE, QEp, p, and m.

The pseudo-\(R^2\) for a mixed-effects model with an intercept is the proportion of total heterogeneity removed by the moderators:
\[
R^2=100\times\max\left(0,\frac{\widehat\tau^2_{RE}-\widehat\tau^2_{ME}}{\widehat\tau^2_{RE}}\right)\%,
\]
with \(R^2=0\) when the total heterogeneity estimate is zero. It is estimator-dependent and may be unstable for small \(k\). In a fixed-effects meta-regression, the reference instead reports adjusted weighted-least-squares \(R^2\); do not conflate the two. Residual \(I^2\) and \(H^2\) are computed from residual heterogeneity and the model's residual degrees of freedom, not from the intercept-only \(Q\).

The approved input forms are a numeric moderator vector or a numeric \(k\times q\) model matrix. The reference also accepts a one-sided formula; categorical variables and interactions are expanded into a model matrix. Stage 2 must state whether the existing formula machinery can represent the required subset. Redundant columns can be removed when the model matrix is rank-deficient; if full rank cannot be obtained, fitting fails. With \(k\le p\), residual degrees of freedom are zero or negative and inferential quantities may be undefined.

### Inference: z, t, and Knapp-Hartung

For test="z", each coefficient uses \(z_j=\widehat\beta_j/SE(\widehat\beta_j)\), a two-sided standard-normal p-value, and a Wald interval \(\widehat\beta_j\pm z_{1-\alpha/2}SE(\widehat\beta_j)\). The default level is 95%.

For test="t", coefficient statistics use a t distribution with \(k-p\) degrees of freedom, and intervals use the corresponding t critical value. For test="knha", let \(q_{KH}=Q_E/(k-p)\). The Knapp-Hartung adjustment uses
\[
\widehat{\operatorname{Var}}_{KH}(\widehat\beta)=q_{KH}(X^\mathsf{T}WX)^{-1},
\]
and uses t inference with \(k-p\) degrees of freedom. In meta-regression the omnibus test is correspondingly F-based. With very small residual degrees of freedom, these statistics can be undefined; when the estimated adjustment factor is small, Knapp-Hartung can yield standard errors smaller than z-based standard errors (the separate ad-hoc floor is not in scope).

### Effect-size measures: RD and ZCOR

For a \(2\times2\) table, the risk difference is
\[
RD_i=p_{1i}-p_{2i}=\frac{a_i}{a_i+b_i}-\frac{c_i}{c_i+d_i}.
\]
With no zero-cell correction, its usual large-sample sampling variance is
\[
v_i=\frac{p_{1i}(1-p_{1i})}{a_i+b_i}+
\frac{p_{2i}(1-p_{2i})}{c_i+d_i}.
\]
The zero-cell policy remains explicit even where RD's point estimate is finite: add is the non-negative correction, to is "only0" (default), "all", "if0all", or "none", and drop00 defaults to false. With drop00=true, studies with \(a_i=c_i=0\) or \(b_i=d_i=0\) are marked missing rather than contributing information. If no correction is applied and a measure is undefined, the result is missing rather than an invented finite value.

For a correlation \(r_i\) from sample size \(n_i\), Fisher's transformation is
\[
z_i=\operatorname{atanh}(r_i)=\frac12\log\frac{1+r_i}{1-r_i},\qquad
v_i=\frac{1}{n_i-3}.
\]
The input must satisfy \(|r_i|<1\) and \(n_i>3\) for finite values. Values at or beyond the endpoints, or sample sizes too small for a positive variance, produce non-finite or invalid results and must be probed rather than silently clipped. For SMD, the approved behaviour remains the Hedges-corrected measure with the documented default large-sample variance approximation; other vtype variants are outside the approved scope.

### Heterogeneity intervals: confint type

For univariate models the supported choices are type="QP" (Q-profile) and type="PL" (profile likelihood). Q-profile inverts the noncentral chi-squared distribution for the Q statistic; PL inverts the likelihood-ratio criterion based on the ML/REML likelihood. Both produce intervals for \(\tau^2\), and monotone transformations give intervals for \(\tau=\sqrt{\tau^2}\), \(I^2\), and \(H^2\). The default type is Q-profile except for methods for which the reference specifies another method; the oracle must record the actual default by estimator. The lower endpoint is constrained by \(\tau^2\ge0\). Endpoint searches can fail or hit the configured upper bound; an interval can be empty or contain missing bounds. PL is especially aligned with ML/REML fits but is not an exact interval in the Q-profile sense.

### Prediction at new moderator values

For new moderator rows \(X_{new}\), the predicted mean effects are
\[
\widehat y_{new}=X_{new}\widehat\beta,\qquad
SE(\widehat y_{new})=\sqrt{x_{new}^\mathsf{T}\widehat V(\widehat\beta)x_{new}}.
\]
When the fitted model includes an intercept, it is automatically added to moderator values unless the supplied matrix already includes the intercept or the caller disables it. A vector of values represents multiple predictions for a single moderator; for multiple moderators, supply a matrix with one row per requested prediction and one column per moderator. The prediction interval also includes the estimated residual heterogeneity; with newmods, the reference requires newscale to calculate prediction intervals for a location-scale model, which is outside scope. The default prediction interval follows the fitted test distribution; predtype="riley" uses the Riley \(k-2\) convention. New moderator values and returned prediction vectors/matrices must preserve row labels and all rows.

### Expanded oracle cases, errors, and resource limits

The oracle must cover each of the eleven approved estimators on the same non-degenerate BCG input, and at least one boundary input where \(\widehat\tau^2=0\). It must record z/t/knha inference for a random-effects fit and a moderator fit; a numeric moderator matrix (and formula form if supported by the harness); \(Q_M\), \(Q_E\), \(R^2\), coefficient arrays, and new-value predictions; RD with default and alternate zero-cell options; ZCOR including its endpoint boundary; and both QP and PL intervals.

The oracle must also capture errors/warnings for singular moderator matrices, too few studies relative to \(p\), non-positive variances, zero-cell tables with all-zero groups, \(r=\pm1\), \(n\le3\), and non-convergent iteration controls. It must not include inputs that exhaust the reference runner's memory or time budget. In particular, the REML fit with all three sampling variances equal to \(10^{300}\) was killed at both 1 GB and 2 GB and is excluded from the executable oracle; record it as an unverified resource-exhaustion boundary only. Any similarly pathological ML/REML/EB input that approaches the 120-second/2-GB runner limit must be documented, not executed as a fixture case.

## rStats.js's choices


Decided by the user on 2026-11-17 (the Decisions above; binding for the rest of the work).

1. **Scope.** `escalc`, `rma` (= `rma.uni`) with moderators (meta-regression), its methods `confint` and `predict`, and
   `regtest`. Estimators: all of `rma.uni`'s `method` values except `"PMM"`, `"GENQ"` and `"GENQM"`, that is `"EE"`,
   `"FE"`, `"DL"`, `"HE"`, `"HS"`, `"HSk"`, `"SJ"`, `"ML"`, `"REML"`, `"EB"` and `"PM"`. Inference: R's `test` values
   `"z"`, `"t"` and `"knha"` (Knapp-Hartung). Deferred: `ranktest`, `trimfill`, `rma.mh`, `rma.peto`, `rma.glmm`,
   `rma.mv`, plotting, and the estimators and options not listed.
2. **Effect sizes.** `escalc` with six measures: `"RR"`, `"OR"`, `"RD"` (two-by-two tables), `"MD"`, `"SMD"` (two
   means; `"SMD"` with Hedges' correction, as R) and `"ZCOR"` (Fisher's z of a correlation), with R's zero-cell options
   (`add`, `to`, `drop00`). The other measures are deferred.
3. **Names and data.** R's names: `escalc`, `rma`, `regtest`; the methods take the model's name as a suffix like
   `predictCrr`: `confintRma`, `predictRma`. R's argument names in camelCase. `rma` accepts the `yi` and `vi` arrays
   and the result of `escalc` (used directly, without renaming fields). Moderators: a numeric matrix (or array of
   columns) as R's `mods`, and the formula form if the existing formula machinery (`src/models/formula.ts`) covers it;
   say in stage 2 which is done. `method` accepts every value in 1, including both `"EE"` and `"FE"`.
4. **Intervals and tests.** `confintRma` with R's `type` (Q-profile and profile likelihood at least, as in the
   fixtures). `predictRma` with R's default and `predtype = "riley"`. `regtest` with R's default `model = "rma"` and
   `model = "lm"`, and R's `predictor` values for these.
5. **Entry point.** Exported from `src/entries/tests.ts`, as the survival functions of 1.4.0.
6. **Where metafor is wrong** (found in the experiments, confirmed by an independent computation): use the correct
   value and record the difference, as for the sample sizes (`docs/differences-from-r.md`).
