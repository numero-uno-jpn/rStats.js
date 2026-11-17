# Mixed-model confidence intervals: reference behaviour

Issue: #535  
Base: `13e8d1f50f0e51f7afe0b44ba6270160a2b382dd`  
Reference target: lme4 2.0-6, Matrix 1.7-6, R 4.6.2  
Stage: 1 (specification and oracle only)

## Evidence and clean-room boundary

This document uses the public help for `confint.merMod` and the published mixed-model literature. The lme4 help describes the returned object as a numeric matrix with named rows and lower/upper columns, states that intervals are on the standard-deviation scale, documents the `profile` and `Wald` methods, and documents the `parm`, `level`, `zeta`, `signames`, and profiling controls. The mathematical description below is independent of package implementation details.

No lme4, Matrix, lmerTest, or R source is used. The existing project specifications and oracle scripts that mention source-derived details are not evidence for this new work. The oracle script calls only public fitting and confidence-interval functions and extracts only their returned values, warnings, and errors. It does not inspect model slots, closures, or internal namespaces.

Primary references:
- Bates, D., Mächler, M., Bolker, B., & Walker, S. (2015). “Fitting Linear Mixed-Effects Models Using lme4.” *Journal of Statistical Software*, 67(1), 1–48. https://doi.org/10.18637/jss.v067.i01.
- lme4 public help: `confint.merMod` and `profile.merMod` (documentation only).

## 1. Scope and notation

The API is intended for fits returned by rStats.js `lmer` and `glmer`:

- `confintLmer(fit, options?)`
- `confintGlmer(fit, options?)`

The supported methods are `"profile"` (default) and `"Wald"`. Parametric bootstrap (`"boot"`) is out of scope. The profile table itself is not a public result.

Let ψ denote one scalar parameter of interest and λ all nuisance parameters. Let ℓ(ψ,λ) be the log likelihood (or the fitted likelihood criterion where a restricted likelihood is used). Define the profile log likelihood

$$
\ell_p(\psi)=\max_{\lambda}\ell(\psi,\lambda),
\qquad \widehat\ell=\max_{\psi,\lambda}\ell(\psi,\lambda).
$$

For a deviance/criterion expressed as (D=-2\ell), write (D_p(\psi)=\min_\lambda D(\psi,\lambda)). The signed likelihood-root coordinate is

$$
\zeta(\psi)=\operatorname{sign}(\psi-\widehat\psi)
\sqrt{D_p(\psi)-D(\widehat\psi)}.
$$

For a two-sided confidence level (1-\alpha), the nominal endpoints solve

$$
\zeta(\psi_L)=-z_{1-\alpha/2},
\qquad
\zeta(\psi_U)=z_{1-\alpha/2}.
$$

This is the statistical target, not a prescription to copy a package's interpolation or root-finding implementation. Profile values must be checked against the R oracle and, where useful, an independent high-precision root calculation.

## 2. Wald intervals

For fixed-effect coefficients β with estimated covariance matrix (V_\beta=\operatorname{vcov}(fit)), the two-sided Wald interval is

$$
\widehat\beta_j\pm z_{1-\alpha/2}\sqrt{(V_\beta)_{jj}}.
$$

The public lme4 help explicitly limits Wald intervals to fixed effects. Variance-covariance parameters remain present in the result with missing lower and upper bounds. Wald intervals are based on the local curvature and do not provide an interval for standard deviations, correlations, or residual scale.

The oracle records the entire returned matrix, including row and column names, missing values, warnings, and errors. It also records the fit's input arguments separately; the fitted model object is never serialized. Every matrix cell in every row and column is serialized as a string with 17 significant digits (or an explicit `NA`, `NaN`, `Inf`, or `-Inf` token), so the `.sig01`-style rows and both returned columns are preserved without numeric JSON rounding.

## 3. Profile intervals and parameter scales

The public help states that profile intervals are based on a likelihood profile and likelihood-ratio cutoffs. It also states that the returned intervals are on the standard-deviation scale. For a correlated random-effects block, the output can therefore contain standard deviations and correlations rather than the raw elements of the relative covariance factor used by the optimiser.

The following points must be established empirically for the pinned lme4 version and preserved in the oracle:

- the exact order and names of variance parameters and fixed effects;
- the legacy names selected by `signames = TRUE` (`.sig01`, `.sig02`, `.sig03`, `.sigma` in the sleepstudy fit) and the informative names selected by `signames = FALSE`;
- how `parm` selects all parameters, fixed effects, variance-covariance parameters, integer positions, and character names;
- whether residual scale σ is included for LMMs and how it is named;
- how `level` and explicit `zeta` interact;
- the effect of profiling controls such as `maxpts`, and the warning/error behaviour when the profile is non-monotone or fails to reach a cutoff.

The mathematical distinction between the optimiser's covariance-factor coordinates and the user-facing standard-deviation/correlation coordinates must be explicit. Do not label an interval on one scale as an interval on the other.

### Observed explicit-zeta result shape

For the sleepstudy REML fit, the public call with `zeta = 1.959963984540054` returned a 6-by-2 matrix, but it was not an ordinary lower/upper confidence-interval matrix. The first column contained the upper endpoints for all six parameters; the second column contained `Inf` for `.sig01`, `.sig02`, and `.sigma`, `1` for `.sig03`, and `NA` for the fixed effects. The usual confidence-level column names were absent (the columns were unnamed). This is an unusual explicit-`zeta` result shape and must be represented exactly as returned, not relabelled as lower/upper bounds. The oracle records every row and both columns; a dedicated experiment records the complete matrix at 17 significant digits.

The complete observed matrix at 17 significant digits is:

| Row | Column 1 | Column 2 |
|---|---:|---:|
| `.sig01` | `37.712311568006385` | `Inf` |
| `.sig02` | `8.7528120136930916` | `Inf` |
| `.sig03` | `0.68514165965549501` | `1` |
| `.sigma` | `28.858136228646199` | `Inf` |
| `(Intercept)` | `265.12943967448683` | `NA` |
| `Days` | `13.575901762396368` | `NA` |



## 4. lmer and glmer

For `lmer`, both ML and REML fits are in scope. A public-output experiment on the pinned `sleepstudy` fit established that `profile()` for a REML fit is centred at the ML estimates for the variance parameters (including residual scale), and `confint(..., parm="theta_")` gives effectively the same variance-parameter intervals for REML and ML fits. Accordingly, all LMM profile coordinates, including variance parameters and fixed effects, are evaluated on the ML criterion even when the original fit was estimated by REML. The experiment and its exact output are recorded in Issue #535; no lme4 implementation source was consulted.

For `glmer`, Wald intervals are in scope for all supported fits. **The rStats.js profile-interval API is restricted to fits made with `nAGQ = 1`; calls for `nAGQ = 0` or `nAGQ > 1` must fail explicitly rather than silently approximate.** The oracle still probes the public R behaviour at `nAGQ = 0`, 1, and greater than 1 so the compatibility boundary and any difference from this deliberate API restriction are documented. No silent approximation from an unsupported quadrature fit is acceptable.

## 5. Defaults, validation, warnings, and boundaries

Public-help defaults: `level = 0.95`, `method = "profile"`, `signames = TRUE`; profile's likelihood cutoff is derived from the confidence level when `zeta` is omitted. The public help documents `parm` as integer positions or parameter names, with `"theta_"` and `"beta_"` selectors for variance-covariance and fixed-effect parameters.

The oracle probes:
- `level` values below, at, and above the allowed range;
- default and explicit `parm` selections, including names and positions;
- both `signames` settings;
- default and explicitly supplied `zeta`;
- reduced and ordinary profile point budgets;
- LMMs fitted by ML and REML;
- GLMMs with `nAGQ = 0`, 1, and greater than 1;
- a random-intercept fit whose between-group variance is exactly on the boundary;
- a correlated random-slope fit, where a correlation can approach ±1;
- a profile that may fail to reach one or both cutoffs.

The R result is an observed compatibility target, not automatically the mathematically preferred result. If an endpoint is missing, non-monotone, or suspicious, independently check the profile criterion and the endpoint equation before describing it as a correct result. Do not widen tolerances to hide root-finding error.

## 6. Oracle format

`oracle/mixedconfint.R` creates `mixedConfint.json`. Each case records:
- model kind and complete fit inputs (formula, data, family/options);
- the exact confidence-interval call options;
- the returned matrix with dimensions, row names, column names, and every cell;
- fit and call warnings, messages, or errors.

The script uses public `lme4::lmer`, `lme4::glmer`, and the public `stats::confint` generic. It does not serialize a fit object or inspect any model internals.

## Decisions for the user

1. **Output shape.** Recommendation: return a plain object with `rowNames`, `colNames`, and `table` (array of rows), matching the project's other statistical tables; retain the R matrix's row and column names exactly.
2. **Parameter names.** Recommendation: match lme4's `signames = TRUE` default, while exposing `signames: false` for informative SD/correlation names. Do not expose deprecated `oldNames`.
3. **Profile controls.** Recommendation: expose only the small, documented controls needed to make profiling tractable (initially `maxpts` and explicit `zeta`); do not expose the entire profile table or bootstrap options.
4. **REML fixed-effect profile.** The correct criterion for profiling fixed effects of a REML fit needs an explicit decision after the oracle results; recommendation: match the public lme4 result unless the published likelihood theory shows it is not a valid confidence interval.
5. **Boundary and non-monotone profiles.** Recommendation: preserve missing endpoints and warnings as explicit result data; do not invent finite limits when the profile did not reach the cutoff.

## rStats.js's choices

Decided by the user on 2026-11-17.

1. **Functions and scope.** `confintLmer(fit, options)` and `confintGlmer(fit, options)`, exported from `/mixed`;
   `method: "profile"` (the default, as lme4's) and `method: "Wald"`. No `"boot"`. The profile intervals of `glmer`
   are for `nAGQ = 1` fits only; other `nAGQ` values throw before any work (R fails for `nAGQ = 0` and is not
   followed for `nAGQ > 1`). Wald intervals are for any fit.
2. **Output shape.** `{ names, lower, upper }`, like `confint` (lm) and `glmConfint`: `names` are R's row names in
   R's order, `lower` and `upper` the two columns. Missing endpoints are `NaN` (R's `NA`), never invented finite
   limits; the warnings R gives go to the result's warnings as elsewhere in rStats.js (item 5 of the decisions).
3. **Options.** `level`, `parm` (as R's, by name or index, with `"beta_"` and `"theta_"` if the oracle covers them)
   and `signames` (default `true`, R's `.sig01` names; `false` gives the descriptive names). Not exposed: `zeta`
   (with it R returns a matrix that is not a lower/upper interval), `maxpts`, `oldNames` (deprecated), the
   profile table itself, bootstrap options.
4. **REML fits.** Follow lme4's public result for the fixed effects and the variance parameters of a REML fit.
5. **Invalid input.** Follow R where R gives a result (a `level` outside (0, 1) gives `NaN` and R's warning; an
   unknown `parm` gives an empty result and R's warning).
