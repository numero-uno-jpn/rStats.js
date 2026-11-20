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
h_{\rm HS}=n^{-1/3}\{1.5\phi(z_\tau)^2z_{1-\alpha/2}^2\}^{1/3},
\quad
h_{\rm B}=n^{-1/5}\{4.5\phi(z_\tau)^4\}^{1/5}.
\]
For n=16, tau=.5, alpha=.05, the independently evaluated values are 0.385563455061825 and 0.372003099908465; the public bandwidth output agrees to 14 significant digits.

For each row,
\[
\widehat s_i=
\frac{x_i^\mathsf T\widehat\beta_{\tau+h}-x_i^\mathsf T\widehat\beta_{\tau-h}}{2h},
\quad \widehat f_i=1/\widehat s_i,\quad
H=X^\mathsf T\operatorname{diag}(\widehat f_i)X,\quad J=X^\mathsf TX,
\]
and
\[
\widehat V_{\rm nid}=\tau(1-\tau)H^{-1}JH^{-1}.
\]
The 16 local sparsities in br_0.5 range from 2.91780765326840 to 7.78082040871574. The reported H inverse is
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
The iid score covariance uses \(\tau(1-\tau)\sum_i x_ix_i^\mathsf T\); iid=FALSE uses the observation-specific score covariance. The reported interval endpoints are the lower and upper endpoints of the accepted set after profiling nuisance coefficients. At alpha=.05, the public intervals are intercept [1.96894923868268,4.53894801798403] and slope [0.580560930960114,1.06404864074146]. At alpha=.1 they are [1.14573004521032,5.07238472881931] and [0.557058220755292,1.18030276287381]. The non-iid alpha=.05 intervals are [1.96269708518447,4.54056234486899] and [0.575837208334820,1.07606187567548]. These public values are recorded; independent root-by-root reconstruction of the nuisance-profiled endpoints is not yet complete.

For a nested restriction \(R\beta=r\), the Wald statistic is
\[
W=(R\widehat\beta-r)^\mathsf T
\{R\widehat V R^\mathsf T\}^{-1}(R\widehat\beta-r).
\]
The public multiTau result is ndf=2, ddf=46, Tn=1.95304970194872, pvalue=0.153425200963809 for joint=TRUE and the single-slope joint=FALSE test in this one-predictor design. The two-predictor experiment records the four-restriction joint test and separate two-restriction tests.

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

1. The score definition and all public rank endpoints are recorded, but independent numerical reconstruction of the nuisance-profiled inversion endpoints has not been completed. The alpha=.05, alpha=.1, and iid=FALSE public intervals were compared and retained above; no endpoint is claimed to have passed an independent root-by-root check.
2. The RNG call, dimensions, orientation, and final seed states are verified for all bootstrap methods. The finite-sample perturbation mapping from the generated pwy, mcmb, and wxy variates into each replicate is not fully reconstructed from the compact public output; that remaining detail must be derived from the cited methods papers, not inferred from package internals.
3. The exact intermediate estimator of the iid summary sparsity \(1/\widehat f_0\) is not exposed by the public return values. The covariance formula was inverted using all four covariance entries and gives \(\widehat f_0=0.128571428571429\), while the separately exposed adaptive-kernel diagnostic gives 0.151672956703647 and residual quantile spacings give different values. This discrepancy was explicitly checked; no estimator formula is asserted until it can be established from the permitted literature/help.

## Decisions for the user

1. **Non-unique solutions.** (A) require the same vertex as br; (B) accept any minimizer whose objective and quantile optimality conditions are satisfied. **Recommendation: B**, because non-unique optima need not have a unique coefficient vector.
2. **Bootstrap random stream.** (A) reproduce R set.seed and the verified draw calls for all four methods; (B) use an rStats.js-specific reproducible stream. **Recommendation: A.** RNG calls, dimensions, orientation, and post-call states are identified for xy, pwy, mcmb, and wxy. The remaining perturbation transforms are a separate formula task.
3. **Out-of-range tau.** (A) reproduce reference path output; (B) reject values outside (0,1). **Recommendation: B**, because these are not valid quantile probabilities.

## rStats.js's choices

