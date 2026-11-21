# Quantile regression: reference behaviour

Issue: #545  
Base: `d41e20295c6fed3031bc7eb59c0cc76be2f7160b` (`work/regression-1.8`)  
Reference: R 4.6.2, quantreg 6.1  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification uses the public quantreg 6.1 reference manual, Koenker and Bassett (1978), Koenker and d'Orey (1987, 1994), Koenker (1994, 2005), Gutenbrunner and Jurečková (1991), Portnoy and Koenker (1997), Hall and Sheather (1988), Bofinger (1975), Powell (1991), and the public-function output in `experiments/regression18-rq.R` and `.json`. No quantreg or R source, implementation excerpt, function body, or fit closure was read or used.

## 1. Model and objective

For observations $(y_i,x_i)$, quantile level $0<\tau<1$, and nonnegative case weights $w_i$, the linear conditional-quantile model estimates $\beta_\tau$ by

$$
\widehat\beta_\tau=\arg\min_\beta
\sum_{i=1}^n w_i\rho_\tau(y_i-x_i^\mathsf T\beta),
\qquad
\rho_\tau(u)=u\{\tau-\mathbf 1(u<0)\}.
$$

The design matrix follows the formula model matrix, including its intercept and factor contrasts. The objective is a convex, piecewise-linear function. The estimate need not be unique: a set of coefficient vectors can attain the same minimum, especially with tied responses or more observations exactly on the fitted hyperplane than the design rank requires. Residuals are $y-X\widehat\beta_\tau$ and the reported objective (often named $\rho$) is the weighted sum above.

For several quantiles, the fit returns one coefficient column per requested $\tau$; each quantile is a separate minimization. This is not a joint non-crossing fit: fitted quantile curves may cross.

## 2. Algorithms and convergence

The requested methods are:

- `br`: a Barrodale–Roberts linear-programming method, based on the modified L1 algorithm of Koenker and d'Orey (1987, 1994). It returns a basic feasible optimum (a vertex when the optimum is not unique).
- `fn`: a Frisch–Newton interior-point method, based on the primal/dual interior-point approach described by Portnoy and Koenker (1997). Its convergence tolerance controls the numerical stopping accuracy.

Both target the same convex objective. The reference manual explicitly notes that in a non-unique problem `fn` may return a point near the centroid of the solution set, whereas `br` stops at a vertex. Therefore exact coefficient equality between methods is not a valid general correctness criterion. A valid independent check is: objective value is minimal to numerical tolerance and primal feasibility / subgradient optimality conditions hold. For unique optima, coefficients should agree tightly.

The reference defaults to `method = "br"`; `tau = 0.5`; unit weights; and formula-based model construction. `na.action` is applied to the model frame and the documented default is `na.fail`. Weights must be nonnegative, and the manual recommends strictly positive weights because zero weights are ambiguous. `tau` outside (0,1) requests the full quantile process in the reference, rather than an ordinary single-quantile fit.

## 3. Inference and summary

The reference summary supports the following standard-error procedures:

- `rank`: confidence limits obtained by inversion of a regression-rank test (Koenker, 1994). The default assumes iid errors; the optional non-iid score construction is documented separately. The procedure can be expensive and is used by default only below the documented sample-size cutoff (the observed default is rank for n < 1001).
- `iid`: asymptotic covariance under iid errors, based on the regression-quantile asymptotics of Koenker and Bassett (1978).
- `nid`: a Huber sandwich covariance using a local estimate of sparsity, relying on local linearity of the conditional quantile function in $\tau$ and $x$. The bandwidth can use Hall–Sheather (1988) or Bofinger (1975); the reference option `hs = FALSE` selects the latter.
- `ker`: a Powell (1991) kernel estimate of the sandwich covariance. When `covariance = TRUE`, the summary also returns the coefficient covariance matrix.
- `boot`: bootstrap standard errors, with `bsmethod` choices `xy`, `pwy`, `mcmb`, and `wxy`, and replication count `R`.

The coefficient table contains estimates, standard errors, test statistics and p-values for the asymptotic methods; rank inference reports estimate and confidence bounds. The exact column names differ by method. The reference output records the full table and warning/message channels. A multi-quantile summary contains a separate coefficient table for each requested quantile.

For the bootstrap methods, the reference's R random-number generator is part of the observable procedure. The existing output records the four methods at `set.seed(1)`, `R = 200`, and another xy run at `set.seed(42)`, `R = 50`. These outputs alone do not yet establish the exact sequence of random draws and resampling transformations needed to reproduce R's stream bit-for-bit.

## 4. Prediction

Prediction evaluates $x_{new}^\mathsf T\widehat\beta_\tau$ for each requested quantile. Confidence intervals are requested with `interval = "confidence"`. The documented interval types include `none`, `percentile`, and `direct`. The percentile method requires bootstrap standard errors; the recorded non-bootstrap call fails with that explicit requirement. Interval bounds are pointwise, not simultaneous bands, and do not enforce non-crossing across quantiles.

## 5. Model comparison

For nested models at a common quantile, `anova` provides a Wald comparison and a rank-based alternative. The rank test is based on regression-rank scores (Gutenbrunner and Jurečková, 1991); its score choice and trimming options apply to this test. The Wald version uses a covariance estimate such as `nid` or `ker`.

For a multi-quantile fit, `anova` can test equality of slopes across quantiles, jointly or one slope at a time (`joint`). Intercepts are not part of the slope-homogeneity hypothesis. These are distinct hypotheses from comparing nested predictor sets at a single quantile. The oracle records both the joint and separate forms and the nested-model Wald and rank tables.

## 6. Observed warnings, errors, and boundaries

The pinned public output establishes:

- A non-unique solution may be returned without a fitting warning; a subsequent summary can warn `Solution may be nonunique`.
- On the constructed non-unique problem, `br` and `fn` return different coefficient vectors with the same optimal objective, consistent with the documented vertex-versus-interior-point distinction.
- An exact fit can have zero objective and degenerate rank confidence bounds; `nid` may fail because its covariance calculation is singular.
- A rank-deficient design produces `Singular design matrix` in the recorded example.
- `tau = 1.5` is interpreted as a request for a quantile-process object by the reference. A negative tau likewise returns a process over (0,1), with its solution path available through the documented process result.
- A weighted fit is accepted; the observed weighted example's `nid` summary warns about non-positive sparsity estimates.
- Missing rows are omitted in the recorded example.
- The default summary for n below 1001 uses `rank`; the recorded `rank` output includes confidence bounds.
- `predict(type = "percentile")` without bootstrap inference errors as described above.

These are reference observations, not all recommended API policies. In particular, reference error strings are not normative API design.

## 7. Formula-level specification and numerical verification

The pinned values below come from the successful R 4.6.2 / quantreg 6.1 public-output run in experiments/regression18-oracle-rq.R on commit 9c698624. Seeded bootstrap probes are from successful runs 2703e24c and ebc1ff0d. All independent calculations use emitted data and public outputs only.

### 7.1 Objective and weights

For \(u_i=y_i-x_i^\mathsf T\beta_\tau\),
\[
Q_\tau(\beta)=\sum_iw_i\rho_\tau(u_i),\qquad
\rho_\tau(u)=u\{\tau-\mathbf1(u<0)\}.
\]
The weighted oracle returns coefficients (4.2, 0.733333333333333), equal to the unweighted result to 15 displayed significant digits on this particular design.

### 7.2 iid covariance

The iid score approximation is
\[
\widehat V_{\rm iid}=
\frac{\tau(1-\tau)}{\widehat f_0^2}(X^\mathsf TX)^{-1}.
\]
The br, tau=.5 public covariance is
\[
\begin{pmatrix}
1.84595134350036&-0.200163398692810\\
-0.200163398692810&0.0444807552650689
\end{pmatrix}.
\]
The emitted design has \(X^\mathsf TX=((16,72),(72,664))\). Solving the common density from the four covariance entries gives \(\widehat f_0=0.128571428571429\) (sparsity 7.77777777777778); substitution reproduces all four entries to 14 significant digits. The separately exposed adaptive-kernel diagnostic density is 0.151672956703647 and is not the density used in this iid covariance. The public output does not expose the exact intermediate estimator that supplies the summary's \(\widehat f_0\); it is therefore unsafe to identify it with the adaptive-kernel diagnostic or a residual quantile-spacing estimate.

### 7.3 Hall–Sheather, Bofinger, and nid

With \(z_\tau=\Phi^{-1}(\tau)\) and standard normal density \(\phi\),
\[
h_{\rm HS}=n^{-1/3}z_{1-\alpha/2}^{2/3}\left\{\frac{1.5\phi(z_\tau)^2}{2z_\tau^2+1}\right\}^{1/3},
\quad
h_{\rm B}=n^{-1/5}\left\{\frac{4.5\phi(z_\tau)^4}{(2z_\tau^2+1)^2}\right\}^{1/5}.
\]
For n=16, alpha=.05, the public values at tau=.25/.5/.75 are HS 0.267035449857894 / 0.385563455061825 / 0.267035449857894 and Bofinger 0.239394531706056 / 0.372003099908465 / 0.239394531706056; the corrected formulas agree to 14 significant digits.

For each row, let
\[
d_i=x_i^\mathsf T(\widehat\beta_{\tau+h}-\widehat\beta_{\tau-h}),
\quad \widehat f_i^+=\max\{0,2h/(d_i-\epsilon)\},
\quad \epsilon=2^{-26},
\]
and set
\[
H=X^\mathsf T\operatorname{diag}(\widehat f_i^+)X,\quad J=X^\mathsf TX.
\]
and
\[
\widehat V_{\rm nid}=\tau(1-\tau)H^{-1}JH^{-1}.
\]
The 16 local sparsities in br_0.5 range from 2.91780765326840 to 7.78082040871574. The positive-part density uses the small denominator offset epsilon = 2^-26; omitting it causes a 4.49e-9 covariance discrepancy in the first entry. With this offset, the reported H inverse is
\[
\begin{pmatrix}.449608363105377&-.0458794947868339\\-.0458794947868339&.0146982328743403\end{pmatrix},
\]
and J is ((16,72),(72,664)). Independent sandwich multiplication gives covariance entries .415407811808214, -.0376121265902385, -.0376121265902386, .0200055184586616, agreeing to 13–14 significant digits. The Bofinger covariance is .446244902552827, -.0404041986885277, -.0404041986885277, .0214905940171049 and is the second bandwidth check. Non-positive local densities produce the public warning “1 non-positive fis” in the weighted stackloss case; this is an invalid local density and must not be inverted silently.

### 7.4 ker covariance

With the local kernel density estimate \(\widehat f_i\), set \(H_K=X^\mathsf T\operatorname{diag}(\widehat f_i)X\). The covariance is
\[
\widehat V_{\rm ker}=\tau(1-\tau)H_K^{-1}JH_K^{-1}.
\]
For br_0.5, H inverse is (1.45394576725491, -.156468233408406; -.156468233408406, .0355557696853512), J is the same design cross-product, and the public covariance is (4.33002859631191, -.462288709117642; -.462288709117643, .107508005317309). Direct multiplication agrees to at least 13 significant digits.

### 7.5 rank inference and anova

The rank score is
\[
S(\beta)=\sum_i x_i\{\mathbf1(y_i\leq x_i^\mathsf T\beta)-\tau\}.
\]
**Rank intervals (identified on 2026-11-21 by the coordinator; `experiments/regression18-rank-path.R` and `.out.txt`).**
For \(H_0:\beta_j=b\) the restricted problem regresses \(y-x_jb\) on the other columns \(X_{-j}\). Its dual solution
\(\hat a\) (the regression rank scores at \(\tau\), \(0\le\hat a_i\le1\), \(X_{-j}^\mathsf T\hat a=(1-\tau)X_{-j}^\mathsf T\mathbf 1\))
gives, with \(\tilde x\) the residual of \(x_j\) after least-squares projection on \(X_{-j}\) (iid = TRUE),
\[
T(b)=\frac{\sum_i\tilde x_i\{\hat a_i-(1-\tau)\}}{\sqrt{\tau(1-\tau)\sum_i\tilde x_i^2}} .
\]
\(T\) is a step function of \(b\). R follows the restricted problem from \(b=\hat\beta_j\) outward by parametric linear
programming:
- an *event* is a value of \(b\) at which a non-basic residual reaches 0. The residual changes sign; the basis is kept when
  the basic dual values stay in \([0,1]\), and otherwise the row enters and the leaving row is the one that keeps the dual
  feasible. All rows whose residual is 0 at the same \(b\) are processed before \(T\) is recorded;
- at \(\hat\beta_j\) the restricted basis is the full basis less one row. When several are dual feasible (the same dual
  vector), the leaving row is the one whose residual becomes positive just beyond \(\hat\beta_j\);
- \(T\) is recorded after each event, and the endpoint is the linear interpolation, between the two consecutive events at
  which \(T\) first crosses \(\pm t_{n-p,1-\alpha/2}\) (Student's t, not the normal), of the \(b\) where it equals the
  critical value.

R's default is `alpha = 0.1` (rStats.js `level = 0.9`). Checks: the 16-row example's four slope limits at alpha 0.05 and
0.1 to all digits; the n = 1000 case of `defaultSEswitch` (four limits, 4e-14); stackloss (p = 4, `summary_se_warnings`),
seven of eight limits to 1e-14. The eighth (Air.Flow lower: 0.52307 here, 0.51278 in R) and the 16-row intercept's
lower limits are on integer data with tied events: the dual is degenerate there and R's path passes another optimal
vertex. \(T(b)\) itself agrees with R's own restricted fits at every \(b\) tried (Part 3 of the experiment); only the
event points used for the interpolation differ. Recorded as a known difference. For iid = FALSE the limits of the
16-row example are in the experiment's output; they are not reproduced yet (section 8).

For a nested restriction \(R\beta=r\), the Wald statistic is
\[
W=(R\widehat\beta-r)^\mathsf T
\{R\widehat V R^\mathsf T\}^{-1}(R\widehat\beta-r).
\]
The public multiTau result is ndf=2, ddf=46, Tn=1.95304970194872, pvalue=0.153425200963809 for joint=TRUE and the single-slope joint=FALSE test in this one-predictor design. Tn is the F statistic W/ndf, not the unscaled chi-square W. For a multiple-tau fit with m quantiles and r tested slopes, ndf=r(m-1) and ddf=n-(r+1)(m-1); nested single-tau comparisons use ddf=n-p. The two-predictor experiment records the four-restriction joint test and separate two-restriction tests.

### 7.6 Confidence prediction

For type=none,
\[
\widehat q_\tau(x_0)\pm t_{1-\alpha/2,n-p}
\sqrt{x_0^\mathsf T\widehat Vx_0}.
\]
Type=direct uses the fitted conditional quantiles at the lower and upper quantile levels selected by the bandwidth rule. Type=percentile uses empirical quantiles of bootstrap predictions. The Engel output gives fits 361.572523021646, 641.662798626356, 1481.93362544049. The none intervals are [348.017815862078,375.127230181214], [619.734433040921,663.59116421179], [1378.57212377153,1585.29512710944]; direct intervals are [358.044512801943,372.786462548665], [599.493259333344,669.029869864692], [848.719406283614,1826.15799607033]; percentile intervals are [342.457064773490,390.388556590329], [622.379024697960,655.618769132687], [1318.55308532152,1555.95419458380].

### 7.7 Bootstrap random-number stream

Successful seeded probes at n=235, R=40, tau=.5, set.seed(1), identify each RNG call and the n-by-R column-major layout:
- xy: sample.int(n,n*R,replace=TRUE), state index 284; both sample and xyU probes match.
- pwy: runif(n*R), state index 40; uniform and pwyU probes match.
- mcmb: rnorm(n*R), state index 80; normal probe matches.
- wxy: rexp(n*R,rate=1), state index 528; exponential and wxyU probes match.
The repeated xy call returns identical=TRUE. The seed after summary(se="boot", bsmethod="xy") equals the state after direct xy bootstrap, confirming identical stream consumption. No source or function body was used.

### 7.8 Defaults and coverage

The defaultSEswitch experiment confirms rank at n=1000 and nid at n=1001; therefore the default is rank for n<=1000 and nid for n>1000. The successful oracle covers br/fn, tau=.25/.5/.75, weights, factor predictors, multi-tau tests, prediction intervals, non-unique/exact/singular/missing/out-of-range cases, all four bootstrap methods, and the default boundary. The earlier 60000-byte-truncated output on b5fc491f is not used for numerical claims.

## 8. Unresolved behaviour

The consolidated public-output probe in `experiments/regression18-rq-inference.R` (commit `d2e5e920`, R 4.6.2) exited 0. It emitted the small 16-row design, residuals, all requested summary outputs, rank intervals, and seeded raw draws plus bootstrap coefficient matrices. The following items remain unresolved after these probes; no implementation formula is inferred from package internals.

1. **iid density estimate.** On the 16-row design, the public iid summary reports `scale = 0.128571428571429` and covariance
   `[[1.84595134350036,-0.200163398692810],[-0.200163398692810,0.0444807552650689]]`.
   The residual-based candidate diagnostics did not identify the exact estimator: Gaussian density estimates at zero were
   0.129178297294227 and 0.120788728503014 after excluding the two exact-fit residuals (bandwidth choices nrd and nrd0),
   and 0.152618319387231 / 0.151872099454079 when retaining them. Residual quantile spacings for types 1–9 were also emitted and do not establish the reported scale. The common density is therefore still not specified.
2. **rank interval endpoints.** Resolved for iid = TRUE (section 7.5), except on degenerate (tied) data. iid = FALSE (the weighted projection of Koenker 1994) is not reproduced and not offered yet.
3. **bootstrap perturbation maps.** The consolidated probe emitted `B`, `U` where exposed, raw draws, and post-call RNG kind for xy, pwy, mcmb and wxy on a 16-row design with four replicates. The raw draw streams are confirmed (sample indices, uniforms, standard normals, exponentials), but the finite-sample transformation from pwy/mcmb/wxy draws to each replicate's fitted coefficients is still not established from the methods papers and public output. Do not claim the bootstrap standard errors match yet.
4. **ker bandwidth.** The small-design public `Hinv` and covariance imply a common residual density of approximately 0.0839500524748983 when expressed against the emitted (X^\mathsf TX). The public result does not expose the kernel bandwidth directly. Fitting the emitted H inverse to candidate kernel matrices identifies a Gaussian kernel to 4.9e-14 relative error, with the unnormalised Hessian form H = (1/h) sum_i phi(residual_i/h) x_i x_i^T and inferred h = 4.512859542966 for this 16-row case (the fitted scale factor is exactly n=16). The kernel shape is therefore strongly identified, but the rule that selects this bandwidth is not recovered from the public output. Keep ker unresolved and do not generalise this one inferred h to other samples.

**Focused stage-2 public-output follow-up (2026-11-21; `experiments/regression18-stage2-probe.R`, commit `1c020099`).** On the 16-row design, the public iid covariance with Hall–Sheather bandwidth is unchanged. Recomputing its common density from the public covariance and the public design cross-product gives `f0 = sqrt(tau * (1 - tau) * inverse(X'X)[1,1] / V[1,1])`. The resulting value is 0.128571428571429; the Bofinger bandwidth gives 0.111607142857143. On Engel (n=235), the corresponding values are 0.00528140821834639 and 0.00516691095353234. Residual-quantile difference quotients for types 1–9, with and without exact-fit residuals, did not reproduce both public values to the required precision. The probe's JSON field named `impliedDensity` used the inverse cross-product in the denominator and is not a density; those values are not used here. The bandwidths and residual-spacing candidates themselves are valid public-output diagnostics.

For `ker`, the additional public `Hinv`, `J`, covariance, and `density()` bandwidth candidates (nrd/nrd0/SJ) did not identify the bandwidth-selection rule. The earlier one-case Gaussian-kernel fit remains a one-case identification only. For bootstrap, the new `summary(..., se="boot")` result had NULL `B` and `U`; it adds no replicate-map evidence. The prior direct public bootstrap probes still identify the RNG streams and column-major layout, but not the pwy/mcmb/wxy transformations.

The implementation uses the Hall–Sheather bandwidth, the local fitted-quantile slopes, and the positive-part density correction epsilon = 2^-26. This correction resolves the initial covariance discrepancy: the public H inverse and covariance are reproduced to 13–14 significant digits on the 16-row oracle design. The strict covariance test remains in CI as the numerical guard. The iid, rank, ker and bootstrap tests remain explicit `it.todo` items until their formulas are resolved.


### Final stage-2 recheck (2026-11-21)

The single combined follow-up probe `experiments/regression18-rq-final-probe.R` (commit `5951531f`) did not produce a JSON result. R 4.6.2 exited with status 1 after warning that the small-design Barrodale–Roberts solution may be nonunique, then raised:

```
Error in array(x, c(length(x), 1L), if (!is.null(names(x))) list(names(x),  :
  'data' must be of a vector type, was 'NULL'
Calls: as.matrix -> as.matrix -> as.matrix.default -> array
```

The failure indicates that the probe passed a `NULL` value to an unguarded `as.matrix()`; the public-output log does not identify which object was `NULL`. Static inspection of the probe (not an R execution result) shows that the first unguarded conversion is `as.matrix(wxySummary$B)`, so a NULL bootstrap-draw field there is the leading candidate. This is not promoted to a confirmed diagnosis without a successful public run. Consequently this run supplies no new numerical evidence for iid, ker, rank, or bootstrap. The four corresponding implementation tests remain `it.todo`. The previous independently successful probes and numerical findings above are retained, but none of the four unresolved formula choices is promoted on the basis of this failed run. The experiment was intentionally not pushed a second time, in accordance with the one-push limit.
6. **Not in 1.8.0** (the user's decision on 2026-11-21, Issue #545): `se = "iid"`, `"ker"` and `"boot"`, and the rank
   intervals with `iid = FALSE`, because they could not be matched with R from its public output (section 8). Asking
   for them is an error that says so; they are recorded as not yet supported.
7. **Rank intervals on tied data:** where events tie (integer data) the dual can be degenerate and R's path passes
   another optimal vertex, so a limit can differ from R's (section 7.5). A known difference, not a fault in R.
