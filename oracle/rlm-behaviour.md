# Robust linear regression: reference behaviour

Issue: #540  
Base: `40ae0753ee2ff90121e4a616c006340c26becb64` (`work/regression`)  
Reference: R 4.6.2, MASS 7.3-66  
Stage: 1 (behaviour specification and oracle only)

## Evidence and clean-room boundary

This specification is based on:

- the public MASS help for robust linear regression and its documented arguments, returned quantities, and references;
- Huber (1981), *Robust Statistics*;
- Hampel, Ronchetti, Rousseeuw, and Stahel (1986), *Robust Statistics: The Approach Based on Influence Functions*;
- Rousseeuw and Yohai (1984), *Robust Regression by Means of S-Estimators*;
- Yohai (1987), *High Breakdown-Point and High Efficiency Robust Estimates for Regression*;
- Venables and Ripley (2002), *Modern Applied Statistics with S*, 4th ed.;
- the public-function outputs in `experiments/regression-rlm.R` and `experiments/regression-rlm.json` on the pinned working branch.

The oracle calls public fitting, summary, coefficient, residual, fitted-value, and covariance methods. It reads only documented fit quantities (`s`, `w`, `wresid`, `conv`, `converged`, `k2`, and `df.residual`). It does not inspect fit internals containing executable code.

A web search for the statistical literature unexpectedly displayed a snippet of GPL-licensed implementation code in a result list. That snippet was not used as evidence and is excluded from the source set. No MASS or R source, mirror, implementation excerpt, closure, or unclassed fit was read, recalled, or used.

## 1. Scope and notation

The model is a linear regression with a robust estimate of its coefficient vector. Let

$$
y_i=x_i^\mathsf T\beta+\varepsilon_i,\qquad
r_i(\beta)=y_i-x_i^\mathsf T\beta,
$$

where the design row includes the intercept when the formula has one. Let $s>0$ be a robust residual scale and $u_i=r_i/s$ the standardized residual.

An M-estimator minimizes a sum of robust losses,

$$
Q(\beta;s)=\sum_{i=1}^n a_i\,\rho(u_i),
$$

where $\rho'(u)=\psi(u)$, and $a_i$ represents any case-frequency weight. Its coefficient estimating equation is

$$
\sum_{i=1}^n a_i x_i\psi(r_i/s)=0.
$$

For inverse-variance weights $v_i$, the working residual and design are scaled by $\sqrt{v_i}$; equivalently the estimating equation is formed from $\sqrt{v_i}r_i$ and $\sqrt{v_i}x_i$. This differs from case weights, which represent replicated observations. The distinction is observable in the oracle: case weights can make the returned IWLS weights exceed one, whereas inverse-variance weights are applied to the working design and residual.

The M-estimator is not automatically high-breakdown. Huber's convex loss has a unique coefficient solution when the design is full rank, but Hampel and bisquare are redescending and can have multiple local minima. Their solutions can depend materially on the initial coefficient vector.

The requested implementation scope is:

- `method = "M"` and `method = "MM"`;
- Huber, Hampel, and Tukey bisquare $\psi$-functions;
- the `summary` coefficient table, robust residual scale, and covariance quantities;
- `scale.est = "MAD"`, `"Huber"`, or `"proposal 2"`;
- initialization, `k2`, `maxit`, `acc`, observation weights, and `wt.method`.

Prediction, confidence intervals, and model-comparison methods are outside this specification.

## 2. Psi functions and iteratively reweighted least squares

### 2.1 Psi functions

The psi-function interface has two distinct numerical outputs:

- `deriv = 0` returns the IRLS weight function $w_\psi(u)=\psi(u)/u$, with its continuous value at $u=0$;
- `deriv = 1` returns $\psi'(u)$.

This is important: the value returned for `deriv = 0` is not $\psi(u)$ itself. The score contribution is $u\,w_\psi(u)=\psi(u)$.

**Huber.** With tuning constant $k$,

$$
\psi(u)=
\begin{cases}
u,& |u|\leq k,\\
k\,\operatorname{sign}(u),& |u|>k,
\end{cases}
\qquad
w_\psi(u)=
\begin{cases}
1,& |u|\leq k,\\
k/|u|,& |u|>k.
\end{cases}
$$

Away from the two corners, $\psi'(u)=1$ inside the central interval and $0$ outside. At $|u|=k$, the recorded derivative is the inside value (logical true, numerically 1). The default is $k=1.345$, conventionally chosen for approximately 95% asymptotic efficiency under Gaussian errors. The public oracle confirms the weight values on both signs of the tuning boundary and in the tails. The derivative is represented as a logical vector in the R output.

Huber's score is monotone and its loss is convex. It downweights arbitrarily large residuals but never gives them exactly zero weight.

**Hampel.** With $0<a<b<c$,

$$
\psi(u)=
\begin{cases}
u,& |u|\leq a,\\
a\,\operatorname{sign}(u),& a<|u|\leq b,\\
a\,\dfrac{c-|u|}{c-b}\operatorname{sign}(u),& b<|u|<c,\\
0,& |u|\geq c.
\end{cases}
$$

The corresponding weight is $\psi(u)/u$, with value one at zero. The derivative is $1$ in the central region, $0$ in the constant-score region, $-a/(c-b)$ in the descending tail (on either side), and $0$ beyond the rejection point. Derivatives at the piecewise joins require an explicit one-sided convention.

At the recorded joins, the derivative takes the inner-interval value at $|u|=a$ (1) and $|u|=b$ (0); it is 0 at the rejection point $|u|=c$. The central interval includes $|u|=a$, and the constant-score interval includes $|u|=b$. The defaults are $a=2$, $b=4$, and $c=8$. Thus observations with $|u|\geq8$ have zero score and zero IRLS weight for a fixed scale.

**Tukey bisquare (biweight).** With tuning constant $c$,

$$
\psi(u)=
\begin{cases}
u\left(1-(u/c)^2\right)^2,& |u|<c,\\
0,& |u|\geq c,
\end{cases}
$$

and

$$
w_\psi(u)=
\begin{cases}
\left(1-(u/c)^2\right)^2,& |u|<c,\\
0,& |u|\geq c.
\end{cases}
$$

Inside the support,

$$
\psi'(u)=\left(1-(u/c)^2\right)\left(1-5(u/c)^2\right),
$$

and it is zero outside. The default is $c=4.685$. This is redescending: sufficiently large residuals receive zero score and zero IRLS weight. It is therefore sensitive to initialization and can have multiple local minima.

The oracle's `psi_grid` records the three weight functions and derivatives over negative, zero, positive, transition, and tail arguments. The grid agrees with these mathematical definitions and default tuning constants.

### 2.2 IRLS coefficient updates

For a fixed scale and current coefficient vector, calculate standardized residuals $u_i$, evaluate $w_{\psi}(u_i)$, and solve the corresponding weighted least-squares problem. In the unweighted case the update minimizes

$$
\sum_i w_{\psi}(u_i)\left(y_i-x_i^\mathsf T\beta\right)^2.
$$

For inverse-variance weights $v_i$, the least-squares system additionally uses $v_i$. For case weights $a_i$, it uses $a_i$ as frequency weights. The final estimating equation is the weighted score equation in Section 1.

The algorithm alternates coefficient updates and, for M estimation, scale updates until the selected convergence vector changes by less than `acc`, or `maxit` iterations have been used. The default convergence vector is the residual vector. A documented alternative is to monitor coefficients or weights; a null test vector disables this convergence test. The oracle records the successive convergence values in `conv` and the final Boolean in `converged`.

This is a description of the statistical IRLS procedure, not a prescription to reproduce a particular source-level update order or internal variable naming.

## 3. Scale estimation and initialization

### 3.1 M-estimation scale

The default `scale.est = "MAD"` is a normal-consistent median absolute deviation scale. In the unweighted case its target is

$$
s_{\mathrm{MAD}}=
\frac{\operatorname{median}_i |r_i|}{0.6745}. The rounded constant is intentional: the recorded reference fixture scales agree with this definition to the stored precision, including the weighted-median case.
$$

For weighted observations, the median is interpreted with the relevant observation weights. The scale is recomputed from the current residuals during M fitting.

The alternatives `"Huber"` and `"proposal 2"` select Huber's Proposal 2 scale estimate. They are aliases in the public interface and produce identical oracle results. The scale is defined by a robust scale equation of the form

$$
\frac{1}{n-p}\sum_i \chi(r_i/s)=b,
\qquad
\chi(u)=\min(u^2,k_2^2),
\qquad
b=E\{\min(Z^2,k_2^2)\},\quad Z\sim N(0,1).
$$

where $p$ is the number of fitted coefficients. The denominator is established by the supplied 'stackloss-scale-huber' fitTight check: with $k_2=1.345$, the reported fit gives a scale-equation residual of $-1.1\times10^{-15}$ using $n-p$, but $-0.135$ using $n$. The rStats.js fit before the correction satisfies the $n$ equation to $2.2\times10^{-16}$ and has the different scale $2.30648597055$, whereas the R fitTight scale is $2.85513271974$. This is evidence for the $n-p$ divisor, not merely a preference for matching an iteration flag.

For weighted fits, the implementation uses $N-p$ for case/frequency weights, where $N=\sum_i a_i$, and $n-p$ for inverse-variance weights (the original observation count). These weighted Proposal 2 extensions are mathematically natural but have not been directly verified: the current fixture contains no Proposal 2 case combined with observation weights.

The tuning constant `k2` is $1.345$ by default. It belongs to the Proposal 2 scale equation; it is distinct from the tuning constant supplied to the coefficient psi-function. In particular, changing the Huber psi tuning constant does not redefine `k2`.

On the `stackloss` oracle data, MAD gives $s=2.44071379481485$, whereas either Proposal 2 name gives $s=2.85587287890784$. The corresponding coefficients differ because the scale changes the standardized residuals and hence the IRLS weights.

### 3.2 Initial coefficients

For M estimation, the default `init = "ls"` starts from a least-squares fit. A numeric vector can supply initial coefficients in design-column order. A previously fitted object with a coefficient component can also supply starting coefficients. The documented `"lts"` option uses a least-trimmed-squares starting fit; the public help describes 200 initial samples. A starting fit is a source of coefficients, not an instruction to use its executable internals.

The initial down-weighting vector `w` defaults to all ones. It is distinct from the observation-level `weights` argument and from the psi-derived IRLS weights.

Redescending functions need a good starting point. The oracle's default least-squares start and its numeric-start case converge to close but not identical results on `stackloss`; Hampel with an LTS start and Hampel with the default least-squares start also converge to different coefficient vectors. This is consistent with multiple local minima and is not by itself evidence of a numerical defect.

### 3.3 MM estimation

MM estimation combines a high-breakdown S-estimator with a high-efficiency M-estimator:

1. obtain an initial coefficient vector and scale from an S-estimator;
2. hold that robust scale fixed while refining the coefficients with a redescending M-estimator, conventionally Tukey bisquare.

The MASS help documents $k_0=1.548$ for the initial S-estimator. For large samples relative to the number of coefficients, this choice gives a breakdown point of approximately one half. The final bisquare tuning constant must exceed $k_0$; the default $c=4.685$ does so.

The S-estimator's scale is defined through a bounded residual loss and a scale equation, with the coefficient vector chosen to minimize the resulting scale. Its high breakdown point comes from this initial S-estimation stage; it is not a property of ordinary M estimation with a bisquare score alone.

The oracle confirms that MM coefficients depend on the random initial S-estimation search. On `stackloss`, seeds 1, 2, and 123 produce visibly different coefficient vectors. Two consecutive unseeded fits also produce different coefficients. Seed 2 and seed 123 happen to find very similar solutions, but they are not bit-identical. This is an inherent reproducibility issue in the reference procedure, not ordinary floating-point nondeterminism.

The public help specifies that case weights are not supported for MM estimation. The fixed-scale MM stage is not the same algorithm as M estimation with `scale.est = "MAD"` or Proposal 2. The oracle's `MM_with_psi` case returns the same fit as the default MM case for the same seed, consistent with MM selecting its prescribed bisquare final estimator rather than the caller's M-estimation psi choice.

## 4. Defaults and fitting controls

The documented defaults and observed interface are:

| Argument | Default / behaviour |
| --- | --- |
| `method` | `"M"`; alternatively `"MM"` |
| `psi` | Huber |
| Huber tuning | $k=1.345$ |
| Hampel tuning | $a=2,\ b=4,\ c=8$ |
| Bisquare tuning | $c=4.685$ |
| `scale.est` | `"MAD"`; alternatives `"Huber"` and `"proposal 2"` |
| `k2` | $1.345$, for Huber Proposal 2 scale |
| `init` | `"ls"` for M; MM selects its S-estimator initialization |
| `w` | all ones, initial down-weighting |
| `weights` | absent, equivalent to unit observation weights |
| `wt.method` | `"inv.var"`; alternatively `"case"` |
| `maxit` | $20$ IRLS iterations |
| `acc` | $10^{-4}$ |
| convergence vector | residuals |
| formula intercept | included unless the formula removes it |

The formula interface accepts ordinary numeric and factor predictors. The matrix interface accepts a design matrix and response vector. Missing observations are omitted by the model-frame process. The returned coefficient names follow the design-matrix column names, including `(Intercept)` and factor contrast columns.

The public help distinguishes two meanings for `weights`:

- `wt.method = "inv.var"`: weights are inverse variances. The response and design are weighted by their square roots; the working residuals are correspondingly weighted. The returned `w` contains the robust IWLS weights, not the inverse-variance multipliers.
- `wt.method = "case"`: weights are case/frequency weights. They multiply the robust IWLS weights and are equivalent in interpretation to replicated observations. The returned `w` can therefore exceed one.

The `stackloss` oracle confirms that inverse-variance and case weighting produce different coefficient estimates and standard errors. Case weighting also changes the effective residual degrees of freedom. The MM method does not support case weights.

## 5. Summary, covariance, and degrees of freedom

The public `summary` coefficient table contains all estimated regression coefficients, including the intercept when present. Its columns are exactly:

- `Value`: the coefficient estimate;
- `Std. Error`: the reported standard error;
- `t value`: $\widehat\beta_j/\operatorname{SE}(\widehat\beta_j)$.

The observed table has no p-value column. The row order and names match the coefficient vector. The oracle records the complete `cov.unscaled` and `vcov` matrices as well as the summary table.

The fit's `s` is the robust scale used by the fit. In the observed M cases, `summary` reports this as `sigma`. It is not generally the same as `stddev`: for example, the `stackloss` Huber fit has $s=\sigma=2.4407$, but `stddev = 2.6739$. The summary standard errors are based on `stddev$ and the reported unscaled covariance matrix; the corresponding covariance relation in the oracle is

$$
\widehat{\operatorname{Var}}(\widehat\beta)
=\texttt{stddev}^{\,2}\,\texttt{cov.unscaled},
\qquad
\operatorname{SE}(\widehat\beta_j)
=\texttt{stddev}\sqrt{\texttt{cov.unscaled}_{jj}}.
$$

This relation is verified numerically by the returned `vcov` and summary values. It is important not to substitute the robust scale `s` for `stddev` in this reported standard-error calculation.

The asymptotic basis for M-estimator covariance is the linearization of the estimating equation. In a fixed-design formulation, let

$$
A=\sum_i a_i x_i x_i^\mathsf T\psi'(u_i),
\qquad
B=\sum_i a_i^2 x_i x_i^\mathsf T\psi(u_i)^2
$$

(with the precise weight convention adjusted for inverse-variance versus case weights). A sandwich covariance has the general form

$$
\widehat{\operatorname{Var}}(\widehat\beta)
\ \propto\
s^2 A^{-1}BA^{-1}.
$$

The proportionality and finite-sample correction depend on the chosen sampling/weight convention and the scale treatment. The observed MASS summary exposes `cov.unscaled` and `stddev`; the oracle verifies their numerical relationship but does not, by itself, identify every finite-sample correction in the covariance calculation. That detail should not be reverse-engineered from implementation. rStats.js should use a documented statistical covariance estimator and state explicitly if its result differs from the MASS summary convention.

The `df.residual` component of an `rlm` fit is deliberately `NA`; it must not be used by ordinary least-squares methods to estimate a residual scale from a residual mean square. The summary's `df` is a three-element quantity: coefficient rank, residual degrees of freedom, and coefficient rank. In the unweighted `stackloss` case it is $(4,17,4)$. With case weights, the effective sample size reflects their sum; the example with total case weight 32 reports $(4,28,4)$.

## 6. Warnings, errors, and boundaries

### 6.1 Convergence and warnings

The implementation default is a 1000-iteration budget and a dimensionless tolerance of $10^{-10}$. It checks the normalized residual of each coefficient's standardized estimating equation and the relative change in the recomputed scale fixed point. The tolerance describes numerical solution accuracy, not the definition of the estimator. Callers may supply other iteration limits and tolerances. A fit that reaches its iteration limit without meeting both criteria is returned with `converged = FALSE$, its convergence history, and a warning of the form:

`'rlm' failed to converge in N steps`

The oracle's `phones_maxit2` case returns coefficients and diagnostics with `converged = FALSE` and warns after two iterations. The `phones_acc` case uses `acc = 10^{-10}$ and `maxit = 50`; it also returns a fit with `converged = FALSE$ and a warning because the final convergence value remains above the requested tolerance. A non-converged result must not be silently represented as a successful fit.

### 6.2 Errors and input validation

The pinned oracle establishes these errors:

- invalid `method` (for example `"S"`) is rejected; the allowed values are `"M"` and `"MM"`;
- invalid `scale.est` (for example lowercase `"mad"`) is rejected; the allowed values are `"MAD"`, `"Huber"`, and `"proposal 2"`;
- a rank-deficient design is rejected rather than silently dropping aliased columns. The collinear example reports `'x' is singular: singular fits are not implemented in 'rlm'`.

The public interface also requires observation weights to have the correct length and to be non-negative. The implementation should reject invalid lengths, negative weights, non-finite design/response values after missing-row handling, and a design with fewer independent columns than columns requested. A zero robust scale needs explicit handling rather than division by zero.

### 6.3 Exact and nearly exact fits

For data lying exactly on a line, the oracle returns the exact coefficients to floating-point precision, but the robust scale is a small positive residual caused by numerical rounding ($s\approx2.6\times10^{-15}$), not exactly zero. The resulting standard errors are correspondingly tiny and the t statistic can be extremely large. This is a numerical boundary, not evidence that a positive residual scale is known exactly.

When only some observations lie exactly on the fitted line and others are gross outliers, an M fit need not recover the uncontaminated line. In the `exact_fit_some` example, the default Huber M fit is pulled substantially by the outliers and has a large scale. This is expected for an M-estimator with a least-squares start and does not contradict the high-breakdown guarantee of the distinct MM procedure.

### 6.4 Contamination near one half

The bisquare M fit in `half_outliers` has a scale of about 24 and does not recover the generating line. A redescending score can reject observations only relative to the current scale and current fit; it does not confer a 50% breakdown point on an ordinary M-estimator. The MM procedure is designed to obtain a high-breakdown starting estimate, but its finite-sample behaviour still depends on the S-estimator search and on the contamination geometry.

### 6.5 Very large and very small scales

Multiplying the response by $10^{100}$ or $10^{-100}$ produces finite fits in the oracle. Coefficients and the robust scale change by the corresponding factor, while the standardized residual pattern and robust weights remain comparable. An implementation should therefore avoid unscaled intermediate sums and divisions that overflow or underflow, and should use scale-aware linear algebra.

The extreme-scale cases are important tests of numerical stability. They do not establish that every design matrix or every response magnitude is safe; the design itself can still be ill-conditioned or rank deficient.

### 6.6 Redescending bisquare with an LTS start

The `stackloss-bisquare-lts` case did not converge even in the strict `fitTight` refit (`acc = 10^{-15}`, `maxit = 2000`). Its convergence history reaches a small numerical cycle rather than satisfying the requested stopping tolerance. This is an observed boundary of this particular redescending fit; oscillation of the IRLS fixed-point iteration is a plausible explanation, but the oracle does not establish the cause.

A non-converged result must remain explicitly marked `converged = false` and retain its warning and convergence diagnostics. Increasing the iteration limit or tightening the tolerance must not be treated as evidence of convergence, and tests must not silently accept this case as a successful fit. The deterministic LTS implementation should be assessed by its own objective and the final M-step estimating equations, as specified in the selected choices, rather than by requiring this reference iteration to converge.

### 6.7 Deterministic high-breakdown starts and MM refinement

For an LTS start, let p be the number of fitted coefficients and n the number of usable rows. The
finite-sample trimming count selected for this implementation is h = floor(n / 2) + floor((p + 1) / 2). For a coefficient
vector b, write r_i(b) = y_i - x_i^T b; its objective is

$$
L_h(b) = \sum_{i=1}^{h} (r^2)_{(i)}(b).
$$

The implementation obtains elemental coefficient candidates from full-rank subsets of p rows. A C-step
replaces the current subset by the h observations with the smallest absolute residuals, refits least squares,
and retains the step only when the objective does not increase. This monotone refinement is repeated until the
coefficient vector stops changing or 50 steps have been taken. For the exhaustive small-sample search, the LTS criterion at the public exact-subset coefficients is recomputed
from the same h smallest squared residuals and must reproduce the public exact crit. The refined rStats.js
criterion is then required to be no larger than that exact-coefficient criterion; its coefficients need not match.

For the S start, use the bounded Tukey biweight loss

$$
\rho(u) =
\begin{cases}
1-(1-u^2)^3 & |u|<1,\\
1 & |u|\ge 1,
\end{cases}
$$

with the fixed consistency constant c = 1.548 and standardized residual u_i = r_i/(c s). At a
coefficient vector b, the S scale s is the positive solution of

$$
\frac{1}{n-p}\sum_{i=1}^{n}\rho\left(\frac{r_i(b)}{c s}\right)
= \frac12.
$$

The S objective is the smallest such scale over coefficient vectors. The denominator is n-p (not n);
the value c = 1.548 and this divisor are the user's binding choice 1. The older c = 1.547 and n-divisor
description is superseded and must not be used.

The S refinement alternates between solving this scalar scale equation and weighted least squares with
Tukey weights (1 - u_i^2)^2 inside |u_i|<1 and zero outside; a step is retained only if the scale does
not increase. This gives a deterministic finite candidate approximation to the scale-minimization problem
in Rousseeuw & Yohai (1984). The exact scale equation is solved numerically to near machine precision.

The deterministic candidate set is defined without random numbers. If choose(n,p) is no larger than the
candidate budget, all elemental subsets are evaluated. Otherwise, the search evaluates evenly spaced
lexicographic combinatorial ranks from the first through the last subset. The budget is

$$
B(n,p)=\min\left(10000,\max\left(1,\left\lfloor\frac{750000}{np}\right\rfloor\right)\right).
$$

All evaluated candidates are scored, and only the best 16 are refined (50 steps maximum each). When
B(n,p) < choose(n,p), the fit carries a warning with the evaluated and total candidate counts and explicitly
states that a high-breakdown start is not certified. Thus the deterministic search is reproducible and bounded;
it is not represented as a proof of the global optimum for a capped search.

For MM, the selected S coefficients and S scale are the initial estimate and fixed scale. The final regression
coefficients solve

$$
\sum_{i=1}^{n} x_i\,\psi\left(\frac{r_i(b)}{s_S}\right)=0,
$$

using a redescending score (bisquare by default, c = 4.685). Redescending IRLS updates use a fixed half-step
to prevent oscillation between distinct roots. The scale is held at sS throughout the
M step. This follows the three-stage construction in Yohai (1987): a high-breakdown initial estimate, a robust
initial scale, and a more efficient redescending M estimate at that fixed scale. MM with case weights remains
an explicit error; inverse-variance weights are handled by applying their square roots to residuals.

For S, solve the scale equation at the public exact-subset coefficients and compare the reference's reported
scale with that value at relative tolerance 1e-4. Require the minimized rStats.js S scale to be no larger than
the scale at those exact coefficients (apart from rounding); do not compare coefficient vectors. For LTS,
recompute the criterion at the public exact-subset coefficients and verify that it reproduces the reported
exact crit; require the refined rStats.js criterion to be no larger than that value. Do not compare coefficient
vectors. The final
MM estimating equations must have normalized residual at most 1e-8. Random-seed MM coefficients are not
used as targets.
## 7. Oracle coverage and unresolved reference behaviour

The initial oracle covers:

- Huber, Hampel, and bisquare M fits on `stackloss`, including alternate tuning and scale choices;
- default and numeric initial coefficients;
- MM fits with three fixed seeds, two consecutive unseeded fits, and an explicit alternate psi argument;
- Huber, bisquare, and MM fits on `phones`;
- iteration-limit and stringent-accuracy warnings;
- inverse-variance and case weights;
- factor predictors, intercept-only and matrix interfaces, and missing rows;
- exact fits, partial exact fits with outliers, a rank-deficient design, contamination near one half, and response scales $10^{100}$ and $10^{-100}$;
- psi weights and derivatives on a signed grid;
- public Huber location/scale estimates for an independent reference point.

### 7.1 Covariance scale: verification for Hampel and observation weights

The finite-sample scale formula selected in `rStats.js's choices` item 2 was checked against the recorded public outputs, using only the reported residuals, robust scale, observation weights, and the documented psi definitions. No fit internals or implementation source were used.

For a case with $N$ effective observations and $p$ fitted coefficients, let $u_i$ be the standardized residual, $d_i=\psi'(u_i)$, and $q_i$ the multiplicity used in the covariance-scale calculation. Define

$$
\bar d=\frac{\sum_i q_i d_i}{N},\qquad
\widehat{\operatorname{Var}}(d)=
\frac{\sum_i q_i(d_i-\bar d)^2}{N-1},
$$

and

$$
\kappa=1+\frac{p}{N}
\frac{\widehat{\operatorname{Var}}(d)}{\bar d^2}.
$$

Then

$$
\texttt{stddev}=
s\,\kappa\,
\frac{\sqrt{\sum_i q_i\psi(u_i)^2/(N-p)}}{\bar d}.
$$

The weight conventions that reproduce the oracle are:

- **No observation weights:** $q_i=1$, $N=n$, and $u_i=r_i/s$.
- **Inverse-variance weights** $v_i$: retain the original $n$ observations with $q_i=1$ and $N=n$, but use the working standardized residual $u_i=\sqrt{v_i}\,r_i/s$. The inverse-variance weights belong in the weighted design cross-product used for `cov.unscaled`; they are not frequency multiplicities in the scalar correction.
- **Case/frequency weights** $a_i$: use $q_i=a_i$, $N=\sum_i a_i$, and $u_i=r_i/s$. This is equivalent to expanding each row into $a_i$ replicated observations. In particular, the sample variance of $d$ uses divisor $N-1$, not $n-1$.

For both weighted conventions, the unscaled covariance is the inverse weighted design cross-product, $(X^\mathsf T QX)^{-1}$, with $Q$ containing the observation weights. The covariance matrix is then $\texttt{stddev}^2\,\texttt{cov.unscaled}$.

The numerical checks are:

| Oracle case | $N$ | Psi | Calculated `stddev` | Oracle `stddev` |
| --- | ---: | --- | ---: | ---: |
| `stackloss_huber` | 21 | Huber | 2.6739075698560018 | 2.673907569856 |
| `stackloss_hampel` | 21 | Hampel | 3.2426031482154363 | 3.24260314821544 |
| `phones_huber` | 24 | Huber | 14.579938134573222 | 14.5799381345732 |
| `weights_inv` | 21 | Huber | 3.297309741387644 | 3.29730974138764 |
| `weights_case` | 32 | Huber | 2.334238895843905 | 2.33423889584391 |

The case-weight example uses 21 rows with weights 1 for the first 10 rows and 2 for the remaining 11 rows, so its effective frequency count is $N=32$. The inverse-variance example uses the same input weights but keeps $N=21$ and applies their square roots to the working residuals. Confusing these two conventions does not reproduce the reported `stddev`.

The Hampel check uses its documented $(a,b,c)=(2,4,8)$ score and derivative. It confirms that the same finite-sample correction applies to this redescending psi; no Huber-specific assumption is needed in the formula. The `stackloss_hampel` result was computed from its reported raw residuals and $s=3.0883164084184$.

Across these five checks, the calculated and oracle values agree to approximately $10^{-15}$ relative error. This closes the covariance-formula and weight-extension question for the tested public-output cases. It is numerical confirmation of the selected Huber (1981, section 7.6) convention, not a claim that arbitrary non-integer frequency weights or every possible weight design have separately been tested.

The following details remain open for an implementation decision or a later focused experiment:

1. The exact one-sided derivative convention at the Hampel and Huber piecewise joins should be specified if tests call the derivative exactly at those breakpoints.
2. The MM S-estimator is stochastic in the reference. Reproducing R's exact random-number consumption and subset-search path is a separate compatibility decision; matching the distribution of candidate subsets is not sufficient for bit-for-bit coefficient identity.
3. The oracle includes a case with scale near machine precision, but does not map the transition from a tiny positive scale to a mathematically zero scale for every psi and initialization.

No additional R experiment is required for the covariance formula and weight conventions documented above. A broader check of non-integer case weights would be a separate question.

## Decisions for the user

1. **MM randomness and reproducibility.** The reference MM estimator uses a random subset search for its initial S-estimator. The `stackloss_MM_seed1`, `seed2`, and `seed123` results differ, and `stackloss_MM_noseed_twice` confirms that two unseeded calls can return different coefficients. Options:
   - reproduce R's RNG stream and the same random subset search closely, using rStats.js's existing `src/random/` implementation;
   - use rStats.js's RNG with a documented deterministic seed/default, while allowing callers to set a seed;
   - use a deterministic S-estimator initialization/search, accepting that coefficients will not generally match a particular R seed.
   
   **Recommendation:** prefer a deterministic, reproducible S-estimator search for the default rStats.js behaviour, with an explicit seed option only if a randomized search is exposed. Do not make the global random stream advance implicitly on every MM fit. Exact R seed compatibility can be a separately documented opt-in only if the extra complexity is justified. This prioritizes reproducibility and predictable library behaviour over matching one arbitrary R subset draw.
2. **MM initial S-estimator algorithm.** Options include a deterministic exhaustive subset search for small datasets plus a bounded deterministic candidate strategy for larger datasets, or a seeded random search. **Recommendation:** choose a deterministic candidate strategy with a documented effort limit, and report when the search cannot establish a reliable high-breakdown start. Do not claim the 50% breakdown property if the search budget or sample size is insufficient.
3. **M-estimator covariance.** Options are (a) reproduce the MASS `stddev`/`cov.unscaled` summary convention after an independent derivation, or (b) return a statistically explicit sandwich covariance based on the selected psi, scale, and observation-weight semantics. **Recommendation:** use the sandwich estimator, document the finite-sample convention, and do not copy a numerical formula whose derivation has not been independently established. If exact MASS summary compatibility is a priority, request a targeted experiment before deciding.
4. **Summary helper names.** Options include `rlmSummary` and `rlmVcov`, following `polrSummary` and `polrVcov`, or a single `summaryRlm` helper. **Recommendation:** export `rlmSummary` and `rlmVcov`; keep the fitted model's coefficient vector and robust scale directly accessible.
5. **Psi helper names.** Options include R-like dotted names (`psi.huber`) or JavaScript camel case (`psiHuber`, `psiHampel`, `psiBisquare`). **Recommendation:** use camel case, consistent with the TypeScript API, and expose tuning constants as typed options.
6. **Weights API.** Options are to reproduce `wt.method` exactly or expose separate `caseWeights` and `varianceWeights` properties. **Recommendation:** use explicit `caseWeights` and `varianceWeights` names to prevent the two statistical meanings from being confused. If R-compatible `weights`/`wt.method` aliases are accepted, validate that they are mutually consistent.
7. **Non-convergence.** Options are to throw, return a fit marked as non-converged, or return it with a warning. **Recommendation:** return coefficients and diagnostics with `converged = false` and a warning, matching the useful information in the oracle; never label the fit as converged.
8. **Rank deficiency.** Options are to drop aliased columns or reject the fit. **Recommendation:** reject a rank-deficient design with a clear error, matching the observed reference behaviour and avoiding ambiguous robust coefficients.
9. **Exact-fit scale.** Options are to retain a small positive floating-point scale, clamp it to a scale-aware floor, or treat it as zero and reject subsequent standardization. **Recommendation:** use a scale-aware floor only for safe arithmetic, preserve an explicit exact-fit diagnostic, and avoid presenting meaningless finite standard errors as reliable inference.
10. **MM case weights.** The reference does not support case weights for MM. **Recommendation:** reject this combination explicitly rather than silently changing the estimator.
11. **Tuning constants and scale defaults.** Options are to match MASS defaults or select different constants. **Recommendation:** retain Huber $k=1.345$, Hampel $(2,4,8)$, bisquare $c=4.685$, MAD scale, and Proposal 2 $k_2=1.345$ as the documented defaults; keep the psi tuning constant separate from the scale tuning constant.
12. **Result shape.** Options are to return a minimal coefficient object or an `lm`-like result with residuals, fitted values, weights, scale, convergence history, and covariance. **Recommendation:** return named coefficients, fitted values, residuals, robust scale, robust weights, convergence diagnostics, and an explicit covariance object. Do not set an ordinary residual degrees of freedom value that invites least-squares scale estimation.

## Stage 3 implementation notes

- MM S-scale refinement uses relative scale and coefficient tolerances, so multiplying the response by a positive constant multiplies the fitted coefficients, robust scale, and standard errors by that constant (within floating-point limits).
- When more than half of the positive-weight observations lie on the fitted regression surface to machine-relative precision, the fit returns that surface with scale zero and converged status. This includes the all-observations-exact case. Robust weights identify the inliers; scale-based inference (standard errors, t statistics, and covariance) is undefined and is returned as NaN with a warning.
- Deterministic elemental-subset search has a 5,000,000 row-evaluation budget and can examine all 4,950 two-row subsets for n=100, p=2. The existing choices text is unchanged.

## rStats.js's choices

Decided by the user on 2026-11-19.

1. **MM: a deterministic S-estimator** (Decisions 1 and 2; amended 2026-11-19). No random numbers. Every elemental
   subset is examined while their number is small enough for about a second of work (tens of thousands; stackloss
   has 5985), without a warning; only above that is a fixed, documented set of candidates used, with a warning that a
   high-breakdown start is not certified. The same input always gives the same fit.
   **The S scale is that of MASS** (found from public outputs, `experiments/regression-rlm-sscale.R`, `.json` and
   `.check.txt`): $s$ solves
   $$\frac{1}{n-p}\sum_i \rho\!\left(\frac{r_i}{c\,s}\right) = \frac12,\qquad
   \rho(u) = \begin{cases}1-(1-u^2)^3 & |u|<1\\ 1 & |u|\ge 1\end{cases},\qquad c = 1.548$$
   ($c$ is `lqs`'s documented `k0`; MM's `s` is this scale). It reproduces MASS's reported `scale` to a relative
   1.5e-5 to 6.6e-5 for stackloss, phones and three location samples, and for `k0` = 2 and 3; the remainder is taken
   to be MASS solving the scale equation loosely (rStats.js solves it exactly). Dividing by $n$ instead (the first
   implementation) gave about half MASS's scale and so about half its MM standard errors. `crit` is a different
   quantity and is not used.
   **Comparison with R:** MASS's `nsamp = "exact"` (documented in `?lqs`, passed through by `rlm`) examines every
   subset and is deterministic, so rStats.js's exhaustive S search is compared with
   `lqs(..., method = "S", nsamp = "exact")` (amended 2026-11-19). **MASS's exact S reports two different fits:**
   its coefficients are those of the best elemental subset, but its residuals and `scale` belong to a refined fit
   (`experiments/regression-rlm-sscale.residuals.txt`: the residuals differ from $y - X\hat\beta$ at the reported
   coefficients by up to 0.62). That refined fit is rStats.js's S estimate: MASS's residuals differ from rStats.js's
   by at most 2.0e-5 on stackloss, and the coefficients implied by MASS's residuals (−36.92530, 0.84957479, 0.43047554,
   −0.07354065) agree with rStats.js's (−36.92542, 0.84957481, 0.43047391, −0.07353885) to MASS's loose refinement.
   rStats.js is therefore compared with MASS's **residuals and `scale`** (to a relative 1e-4, MASS's loose solution of
   the scale equation), not with MASS's reported coefficients. **`rlm(..., method = "MM")` does not use `nsamp = "exact"`**
   (`experiments/regression-rlm-mm-nsamp.R` and `.out.txt`: after `set.seed(1)` the "exact" MM equals the random MM
   of seed 1 to every digit, and it changes with the seed and between arm64 and x86_64), so MASS's MM is never
   compared (a known difference). rStats.js's final MM step is checked independently: the bisquare estimating
   equations ($c = 4.685$) at the fixed S scale, and the covariance by Huber's formula of item 2
2. **Covariance: Huber's (1981) formula, which reproduces MASS's `summary`** (Decision 3). The covariance is
   $\texttt{stddev}^2 (X^\top X)^{-1}$ (`cov.unscaled` equals $(X^\top X)^{-1}$ to 8e-11 in `stackloss_huber`), with
   $$\texttt{stddev} = s\,\kappa\,\frac{\sqrt{\sum_i \psi(r_i/s)^2/(n-p)}}{\overline{\psi'}},\qquad
   \kappa = 1 + \frac{p}{n}\,\frac{\widehat{\mathrm{Var}}(\psi')}{\overline{\psi'}^{\,2}},$$
   where $\psi'$ is evaluated at $r_i/s$, $\overline{\psi'}$ is its mean over the $n$ observations and
   $\widehat{\mathrm{Var}}$ is the sample variance (divisor $n-1$). This is the finite-sample correction of Huber
   (1981, section 7.6). Checked by the coordinator from public outputs only (no source): it equals MASS's `stddev`
   to 7e-16 to 4e-15 in `stackloss_huber`, `stackloss_bisquare`, `stackloss_scale_Huber` and `stackloss_MM_seed1`
   (with Huber's psi, $k = 1.345$, and the bisquare, $c = 4.685$). How it extends to prior weights (`weights_inv`,
   `weights_case`) and to Hampel's psi is to be checked against the oracle the same way before it is implemented
3. **Names:** `rlm`, `rlmSummary`, `rlmVcov`, and the psi functions `psiHuber`, `psiHampel`, `psiBisquare`
   (Decisions 4 and 5)
4. **Weights: R's form** (not Decision 6's recommendation): `weights` and `wtMethod` (`"inv"`, the default, or
   `"case"`), as in R and consistent with `glm` and the other functions
5. **Non-convergence:** coefficients and diagnostics with `converged = false` and a warning (Decision 7)
6. **Rank deficiency:** an error, as R (Decision 8)
7. **Exact fits:** a scale-aware floor for safe arithmetic only, an explicit exact-fit diagnostic, and no
   presentation of meaningless standard errors as reliable inference (Decision 9)
8. **MM with case weights:** an error (Decision 10). A known difference from R: contrary to the premise of Decision
   10, MASS 7.3-66 fits this combination without a warning and the weights change the fit (`error-mm-case-weights`
   of `oracle/rlm.R`: scale 1.912 against 1.983 without weights). rStats.js still refuses it (decided 2026-11-19),
   since its deterministic S-estimator does not match R's MM anyway and a weighted S-estimator is not defined here
9. **Constants:** MASS's defaults: Huber $k = 1.345$, Hampel $(2, 4, 8)$, bisquare $c = 4.685$, MAD scale, Proposal 2
   with $k_2 = 1.345$; the psi constant kept separate from the scale constant (Decision 11)
10. **Result:** named coefficients, fitted values, residuals, robust scale, robust weights, convergence diagnostics;
    the covariance from `rlmVcov` (Decision 12)
11. **`init = "lts"`: a deterministic least-trimmed-squares start** (decided 2026-11-19). Use
    $h = \lfloor n/2\rfloor + \lfloor (p+1)/2\rfloor$ (amended 2026-11-19; MASS's `crit` uses it:
    `experiments/regression-rlm-lts-h.R` and `.out.txt` with $n = 20$, $p = 3$ give 12, where
    $\lfloor (n+p)/2\rfloor$ would be 11) and minimize the sum of the h smallest squared residuals, as in the LTS
    criterion described by Rousseeuw & Leroy (1987). Generate the same deterministic elemental subsets and use
    the same candidate budget as item 1. Rank candidates by the LTS objective, refine the best 16 by C-steps
    (select the h smallest absolute residuals and refit least squares), and stop each refinement after 50
    steps or when the coefficients stop changing. Warn when the candidate budget does not cover every
    choose(n,p) subset; do not claim that the high-breakdown start is certified in that case. No random
    numbers are used. A known difference from R, whose LTS start uses a random subset search. For Huber's psi
    the start does not change the solution; for the redescending Hampel and bisquare psi it can. Fits started
    from LTS are therefore checked by the LTS objective and by the estimating equations of the M step, not
    against MASS's coefficients. The objective is MASS's `crit` (the sum of the $h$ smallest squared residuals),
    which reproduces MASS's exact `crit` from its coefficients to every digit; rStats.js's LTS objective must not be
    larger than MASS's exact `crit`. With its refinement it is lower (stackloss 1.6371 against 1.6574, phones
    3.4313 against 3.4503), so the coefficients differ (amended 2026-11-19)
