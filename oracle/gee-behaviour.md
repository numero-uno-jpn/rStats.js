# Generalized estimating equations: reference behaviour

Issue: #545  
Base: `d41e20295c6fed3031bc7eb59c0cc76be2f7160b` (`work/regression-1.8`)  
Reference: R 4.6.2, geepack 1.3.13  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification is based on Liang and Zeger (1986), Prentice (1988), Halekoh, Højsgaard and Yan (2006), Pan (2001), the public geepack 1.3.13 reference manual, and the public-function outputs in `experiments/regression18-gee.R` and `.json`. No geepack or R source, implementation excerpt, function body, or fit closure was read or used. The current CRAN reference manual identifies geepack 1.3.13 and documents the supported correlation and variance options.

## 1. Marginal mean model and estimating equations

For cluster $i$ with $m_i$ observations, let $Y_i$ be the response vector and $X_i$ the model matrix. The marginal mean is

$$
\mu_i=E(Y_i\mid X_i),\qquad
g(\mu_{ij})=x_{ij}^{\mathsf T}\beta+o_{ij},
$$

where $g$ is the selected GLM link and $o_{ij}$ is an optional offset. The supported families are Gaussian, binomial, Poisson, and Gamma, with links already supported by the rStats.js GLM family layer.

The generalized estimating equation is

$$
\sum_i D_i^{\mathsf T}V_i^{-1}(Y_i-\mu_i)=0,
\qquad D_i=\frac{\partial\mu_i}{\partial\beta^{\mathsf T}},
$$

with working covariance

$$
V_i=\phi A_i^{1/2}R_i(\alpha)A_i^{1/2}.
$$

$A_i$ contains the marginal variance functions and $R_i(\alpha)$ is the chosen working correlation. The mean parameter estimate is consistent under the usual GEE conditions even if the working correlation is misspecified; efficiency can depend on that choice. The method is marginal, not a subject-specific random-effects model.

The default working correlation is independence. The reference supports independence, exchangeable, AR(1), unstructured, user-defined, and fixed structures. Exchangeable uses one common within-cluster correlation; AR(1) depends on wave distance; unstructured estimates pair-specific correlations; user-defined and fixed structures use the supplied correlation design vector `zcor`. `waves` labels within-cluster measurement order and is especially important for AR(1), gaps, and missing waves.

## 2. Cluster layout, scale, and convergence

The `id` vector identifies clusters and must have one entry per observation. The reference requires rows from each cluster to be contiguous; it warns when this is not satisfied and can interpret the clusters incorrectly. Observations should therefore be sorted by cluster and, where relevant, by wave. Singleton clusters are valid for ordinary structures but do not contribute pairwise entries to a supplied `zcor`. For fixed structures, the manual requires a correlation vector when cluster sizes are unequal and excludes singleton clusters from that vector.

The scale parameter $\phi$ is estimated unless `scale.fix = TRUE`, in which case `scale.value` is the fixed value. The reference default is `scale.fix = FALSE`, `scale.value = 1`. The default iteration control uses a maximum of 25 Fisher-scoring iterations and convergence tolerance $10^{-4}$; convergence is based on the absolute change in parameter estimates. This tolerance is comparatively coarse. The oracle therefore records a tight refit using a smaller tolerance and a larger iteration limit; the tighter estimate is the primary numerical comparison, while the ordinary fit characterizes reference defaults.

The public help states that geeglm operates on complete data. Missing rows must be removed explicitly before fitting (or rejected by the calling layer); silent partial-cluster deletion is not a safe default. The oracle records the reference behaviour for unsorted ids and missing values.

## 3. Variance estimators and summary

The default `std.err = "san.se"` is the robust empirical sandwich covariance. In schematic form, with bread $B=(\sum_iD_i^\mathsf TV_i^{-1}D_i)^{-1}$ and cluster score $U_i=D_i^\mathsf TV_i^{-1}(Y_i-\mu_i)$,

$$
\widehat{\operatorname{Var}}(\widehat\beta)
=B\left(\sum_iU_iU_i^\mathsf T\right)B.
$$

The other requested choices are cluster jackknife estimates:

- `jack`: approximate jackknife variance;
- `j1s`: one-step jackknife variance;
- `fij`: fully iterated jackknife variance.

All three delete one cluster at a time in their inferential target, but differ in how the deleted-cluster estimates are obtained: approximate linearized update, one-step update, or a full refit for each deletion. The manual names these three methods but does not give a complete algorithmic specification sufficient to reproduce every finite-sample detail. The oracle records their standard errors on the same fixed data.

The summary coefficient table contains the estimate, standard error, Wald statistic, and two-sided Wald p-value. The summary also reports working-correlation parameter estimates and their standard errors, and the scale estimate and its standard error. `vcov` returns the coefficient covariance matrix. The public oracle captures all rows and columns rather than selected coefficients.

## 4. Model comparison and QIC

The single-fit `anova` method reports sequential Wald chi-square tests for model terms. The multi-fit method compares fitted models and is intended for compatible nested mean models fitted to the same clustered observations. The reference experiment records a nested pair. Comparisons should not be treated as likelihood-ratio tests: GEE is based on estimating equations rather than a full likelihood.

The quasi-likelihood information criteria are defined for model selection in this non-likelihood setting. Pan (2001) motivates the QIC correction to the quasi-likelihood criterion. The geepack QIC method returns QIC, QICu, quasi-likelihood, CIC, the number of mean-effect parameters, and corrected QIC (QICC). Smaller values are preferred within the corresponding comparison purpose. QIC is useful for working-correlation selection; QICu is for comparing mean specifications with the same working correlation and quasi-likelihood form; CIC is proposed as a more robust alternative when comparing working correlations.

## 5. Prediction

Prediction uses the fitted marginal mean model. The default prediction scale is the linear predictor; `type = "response"` applies the inverse link and returns the marginal mean. For new observations, the new data must provide all model predictors and any offset expression. Predictions are marginal means and do not include cluster-specific random effects or conditional forecasts.

## 6. Observed warnings, errors, and boundaries

The pinned public-function output establishes:

- Independence, exchangeable, AR(1), and unstructured fits are recorded for Gaussian and binomial examples; Poisson with offset and Gamma examples are also recorded.
- Jackknife `jack`, `j1s`, and `fij` produce distinct standard errors in the recorded exchangeable binomial example.
- A fixed-scale call with `scale.fix = TRUE, scale.value = 4` returns the error `variable lengths differ (found for '(scale.value)')` in the pinned environment. This appears to be a reference defect, not a statistical requirement.
- The unsorted-id example emits the documented warning and does not represent the intended cluster ordering.
- The one-observation-per-cluster case is accepted for exchangeable correlation; the estimated working correlation is not informed by within-cluster pairs.
- The missing-response case is not accepted as an ordinary complete-data fit unless rows are removed before fitting.
- The constructed binomial separation case is included to expose convergence and finite-estimate boundaries.
- The `fixed` structure is exercised with an explicit correlation matrix converted to a `zcor` vector; a single-fit `anova` was omitted because it did not finish within the experiment time limit.
- The nested-model comparison and new-data prediction outputs are recorded.

Reference warnings and errors are observations, not normative API design. In particular, an implementation should not reproduce a software defect in fixed-scale handling.

## 7. Formula-level specification and numerical verification

These formulae are grounded in Liang and Zeger (1986), Prentice (1988), Halekoh, Højsgaard and Yan (2006), Yan and Fine (2004), and Pan (2001), and checked against successful public-output experiments on commit 9c698624. No package or R implementation source was used.

### 7.1 Mean model and estimating equations

For cluster i,
\[
\mu_i=g^{-1}(X_i\beta+o_i),\quad
D_i=\partial\mu_i/\partial\beta^\mathsf T,\quad
A_i=\operatorname{diag}\{v(\mu_{ij})\},\quad
V_i=\phi A_i^{1/2}R_i(\alpha)A_i^{1/2}.
\]
The estimate solves
\[
\sum_iD_i^\mathsf TV_i^{-1}(Y_i-\mu_i)=0.
\]
In the 12-cluster, 3-wave Gaussian identity check, beta=(2.82583888888889,0.592741666666667); ordinary and tight independence/exchangeable fits agree to at least 14 significant digits. Exchangeable alpha is -0.117003308068869 and AR(1) alpha is -0.201175106522640. The independent residual-moment calculations reproduce the displayed alpha values to 10 significant digits. With gaps in waves, AR(1) alpha is -0.318769908479073 versus -0.173965690243595 when default consecutive waves are used; thus R_ijk=alpha^|wave_j-wave_k|, not row adjacency.

### 7.2 Working correlation and scale

Let r_ij=(Y_ij-mu_ij)/sqrt(v(mu_ij)) be Pearson residuals. The Gaussian scale estimate is
\[
\widehat\phi=N^{-1}\sum_{i,j}r_{ij}^2.
\]
The 36-observation output is 0.173445234552469; the independent residual sum divided by 36 agrees to 14 significant digits, confirming denominator N rather than N-p.

For exchangeable correlation,
\[
\widehat\alpha_{\rm ex}=
\frac{\sum_i\sum_{j<k}r_{ij}r_{ik}}
{\widehat\phi\sum_i m_i(m_i-1)/2}.
\]
For unstructured correlation,
\[
\widehat\alpha_{jk}=
\frac{\sum_{i:\,j,k\ {\rm observed}}r_{ij}r_{ik}}
{\widehat\phi K_{jk}},
\]
where K_jk counts clusters contributing that pair. Independent pairwise calculations reproduce the exchangeable and unstructured entries in gee-check to the displayed 10–14 significant digits. For AR(1), define empirical lag moments c_d=sum(r_ij*r_ik)/(K_d*phi), over pairs at wave distance d, and minimize
\[
\sum_dK_d(c_d-\alpha^d)^2.
\]
The independent minimization gives -0.2011751065 versus R -0.201175106522640 (10 significant digits). User-defined and fixed structures use the supplied zcor design vector, not these moment estimators.

### 7.3 Robust sandwich covariance

Set
\[
B=\sum_iD_i^\mathsf TV_i^{-1}D_i,\quad
U_i=D_i^\mathsf TV_i^{-1}(Y_i-\mu_i),\quad
M=\sum_iU_iU_i^\mathsf T.
\]
Then
\[
\widehat{\operatorname{Var}}(\widehat\beta)=B^{-1}MB^{-1}.
\]
The independent calculation reproduces all four entries of the 2-by-2 coefficient covariance for independence, exchangeable, AR(1), and unstructured structures to the 14 digits displayed by R. The independence matrix is
\[
\begin{pmatrix}
0.00369049728137860&-0.0000763672646604936\\
-0.0000763672646604937&0.00589825936921296
\end{pmatrix}.
\]

### 7.4 Jackknife estimators

Let beta_(-i) be the estimate after deleting cluster i and betaBar_(-) their mean. The fully iterated delete-one-cluster jackknife is
\[
V_{\rm fij}=\frac{K-1}{K}\sum_i
(\widehat\beta_{(-i)}-\bar\beta_{(-)})
(\widehat\beta_{(-i)}-\bar\beta_{(-)})^\mathsf T.
\]
jack is the approximate linearized delete-cluster variance; j1s uses a one-step estimating-equation update; fij uses fully iterated deleted-cluster fits. The 20-cluster binomial public output gives standard errors (intercept, age, smoke):
- jack: (2.07996073698671, 0.0689921399814322, 1.72724040576257)
- j1s: (2.07996071483039, 0.0689921392266380, 1.72724039081664)
- fij: (2.27397698715797, 0.0766159868082854, 1.96766808272340)
jack and j1s agree to at least 8 significant digits here; fij is observably different. In the 12-cluster Gaussian check all three display the same standard errors (0.0541109771033312, 0.0684076804109764), so the distinction is retained as a method choice rather than collapsed.

### 7.5 QIC family

Let Q be quasi-likelihood, p the number of mean parameters, and Omega_I the model-based covariance under independence:
\[
QIC=-2Q+2\,\operatorname{tr}(\Omega_I V_R^{-1}),\quad
QICu=-2Q+2p,\quad CIC=\operatorname{tr}(\Omega_I V_R^{-1}),
\]
\[
QICC=QIC+\frac{2p(p+1)}{K-p-1}.
\]
The 12-cluster check returns (QIC,QICu,Q,CIC,p,QICC) =
(9.40832555125884,10.2440284438889,-3.12201422194444,1.58214855368498,2,10.7416588845922). Substitution reproduces QIC, QICu, and QICC to 14 significant digits (QICC uses K=12).

### 7.6 Wald inference, prediction, waves, and controls

For restriction R beta = r,
\[
W=(R\widehat\beta-r)^\mathsf T
(R\widehat V R^\mathsf T)^{-1}(R\widehat\beta-r)
\sim\chi^2_{\operatorname{rank}(R)}.
\]
Single-fit anova is sequential, testing each term conditional on preceding terms; nested fits use the corresponding block restriction. Prediction on the link scale is X_new beta + offset; response prediction applies the inverse link. The public prediction output records both scales.

The public geese.control values are trace=0, jack=0, j1s=0, fij=0, maxit=25, epsilon=0.0001. Tight refits use epsilon=1e-10 and maxit=200. In the Gaussian check, independence/exchangeable coefficients match tight fits to 14 digits, AR(1) to 7–8 digits, and unstructured to at least 12 digits. id identifies clusters; waves provides within-cluster measurement labels and determines lag distance. The unsorted-id case warns and changes cluster sizes; rows must therefore be grouped by id. Incomplete rows must be omitted explicitly and cluster membership rebuilt.

## 8. Unresolved behaviour

1. scale.fix=TRUE, scale.value=4 still returns “variable lengths differ (found for '(scale.value)')” in the pinned fixed_scale call. The exact call was rerun and fails reproducibly; this is treated as a reference defect, not a target formula.
2. Single-fit anova for the fixed working-correlation structure did not finish within 40 seconds in the earlier ohio_fixed run. The fixed fit and zcor construction are recorded; no further time was spent on this slow path.
3. The validation matrix for arbitrary user-defined zcor, unequal cluster sizes, and all missing-wave patterns is not exhaustive. userdefinedToeplitz and wavesGap verify the basic cases; unsupported layouts should be rejected until specified.
4. The public summary reports standard errors for working-correlation and scale parameters, and the oracle captures the corresponding alphaVar/gammaVar and dispersion tables. Their nuisance-parameter estimating-equation sandwich has not yet been independently reconstructed entry-by-entry. The 12-cluster Gaussian and 20-cluster binomial public values are retained; no unsupported closed-form shortcut is claimed.
5. The current rStats.js branch has provisional code paths for jack, j1s, and fij. jack uses a full-bread linearized deletion, j1s uses the bread with the deleted cluster contribution removed for its one-step update, and fij refits after each cluster deletion. These choices have not yet been compared with the newly expanded public-output fixture; they are not accepted as matching R until coefficient covariance and summary standard errors are compared. In particular, the exact finite-sample distinction between jack and j1s remains unresolved.
6. The AR(1) moment minimization is numerically close but not yet at the same precision as the recorded R values: on the balanced 12-cluster check the current estimate differs by about 8.0e-8, and on the wave-gap check by about 1.15e-6. The tests currently use 6 and 5 decimal-place tolerances respectively and require convergence. The expanded fixture will decide whether this is the public default/tight-control distinction or a remaining estimating-equation discrepancy; no 10-digit equivalence is claimed yet.

## Decisions for the user

1. **Jackknife compatibility.** (A) implement all three variants with separate definitions and tests; (B) implement only sandwich first. **Recommendation: A**, because the public outputs distinguish them.
2. **Fixed-scale error.** (A) reproduce the observed error; (B) implement documented fixed-scale equations and treat the pinned error as a defect. **Recommendation: B.**
3. **Cluster ordering.** (A) require contiguous sorted clusters; (B) reorder internally and preserve output row order. **Recommendation: B**, if all model-frame vectors are permuted consistently.
4. **Missing data.** (A) reject incomplete data; (B) use existing model-frame omission and rebuild clusters. **Recommendation: B**, with explicit row mapping.
5. **Fixed-correlation helpers.** (A) export equivalents of the helper functions; (B) accept validated zcor only initially. **Recommendation: B.**

## rStats.js's choices

Decided by the user on 2026-11-21 (Issue #545), on the recommendations above. These choices take precedence over every
other section of this file.

1. **Jackknife:** all three (`jack`, `j1s`, `fij`), each with its own definition and tests against R.
2. **Fixed scale:** `scale.fix` with a given scale value fits the documented equations with the scale held at that
   value. R 4.6.2 / geepack 1.3.13 fails on this call (section 8, item 1): a fault in geepack, recorded as a known
   difference from R; the tests use an independent calculation.
3. **Cluster order:** rows of a cluster need not be contiguous. rStats.js groups them internally (a stable reordering)
   and returns fitted values, residuals and the like in the user's row order. R treats each contiguous run of an id as
   its own cluster (a known difference from R).
4. **Missing values:** the existing model-frame rule of the regression functions (rows with NA are dropped); the
   clusters, waves and working correlations are built from the remaining rows.
5. **`zcor`:** accepted as a validated design matrix (or vector); no helpers like `genZcor` or `fixed2Zcor` in 1.8.0.
