# Robust (sandwich) standard errors (rStats.js 1.3.0): the behaviour to reproduce

This file describes, in words and formulas, what the R functions below compute, for an implementation that must not
read their source. It was written by reading the R code of the packages (deparsed from the image
`rstats-oracle:4.6.2`, R 4.6.2) and checking each statement against their output; the formulas of sections 1 to 3 and
the score residuals of section 4 were re-implemented independently in R from this text and agree with the packages to
a relative 1e-14 or better on lm, weighted lm and glm fits of every family, offsets, two-column binomial responses,
aliased columns, one-, two- and three-way clustering, `multi0` and `fix`. Where this file and a fixture seem to
disagree, report it instead of working around it.

| package | version | functions |
|---|---|---|
| sandwich | 3.1-3 | `vcovHC` (`vcovHC.default`, `meatHC`), `vcovCL` (`meatCL`), `sandwich`, `bread.lm`, `bread.glm`, `estfun.lm`, `estfun.glm` |
| lmtest | 0.9-40 | `coeftest` (`.default`, `.glm`), `coefci` (`.default`, `.glm`) |
| survival | 3.8-12 | `coxph(robust, cluster)`, `residuals.coxph(type = "score" / "dfbeta")`, `summary.coxph`, `coxph.wtest` |

Oracles and fixtures (`npm run oracle -- <name>`; each runs in under 15 s and far below 1 GB):

| oracle | fixtures | cases |
|---|---|---|
| `oracle/vcovhc.R` | `vcovHC` | 195 (2 errors) |
| `oracle/vcovcl.R` | `vcovCL` | 146 (6 errors) |
| `oracle/coeftest.R` | `coeftest`, `coefci` | 246, 267 (1 error) |
| `oracle/coxphrobust.R` (x86_64 R, as `oracle/coxph.R`) | `coxphRobust` | 33 (1 error) |

`oracle/_robust.R` holds the shared model fitting (the matrix interface of `oracle/_glm.R`: `model` "lm" or "glm", `x`
without the intercept column, `y`, `intercept`, `weights`, and for glm `family`, `link`, `variance`, `offset`,
`start`). The fixtures keep R's argument names (`type`, `omega`, `sandwich`, `cluster`, `cadjust`, `multi0`, `fix`,
`df`, `level`, `parm`, `robust`) and R's output names (`naive.var`, `rscore`, `robscore`) because the API is not
decided yet (see "Decisions for the user"); a multi-way cluster is written as an array of columns (one array per
clustering dimension), not of rows. Every case records the warnings of the function (`warnings`) and, for lm/glm, those
of the fit separately (`fitWarnings`); errors are `{"error": message}`. Where R is wrong or inaccurate the case has a
`reference` and an argument `refKind` saying how it was computed (sections 2.6, 3.6).

Notation: n is the number of rows of the fit **including rows of prior weight 0** (rows with a missing value are
dropped first, as R's `na.omit`); `n_ok` the number of rows of non-zero weight (`rank + df.residual`); k the number of
non-aliased coefficients (the rank); `x_i` the i-th row of the unweighted model matrix restricted to the non-aliased
columns (in the fit's column order, intercept first); eps = 2^-52.

## Easy to get wrong

1. **The estimating function of lm carries the weight once, not its square root:** `ψ_i = w_i e_i x_i` (e the
   ordinary residual y − ŷ, w the prior weight). For glm `ψ_i = W_i z_i x_i / φ_s` with W the working weights and z
   the working residuals of the fit (R's `weights(fit, "working")` and `residuals(fit, "working")`, i.e. rStats.js's
   `GlmResult.weights` and `GlmResult.residuals`: W is from the means **before** the last update, z at the final
   means), and `φ_s = Σ (W z)² / Σ W` for every family except binomial and poisson (`φ_s = 1`). φ_s is **not** the
   Pearson dispersion of `summary.glm`; it cancels exactly against the same factor in the bread (section 1), so it
   changes only the last bits.
2. **`n` counts rows of prior weight 0, `n_ok` does not.** The bread is scaled by `n_ok`, the sandwich and the meat
   by `n`, and HC1's factor uses n. With zero weights every type is therefore off by `(n_ok/n)²` (and HC1 also by its
   factor), and the hat values (which R computes only for the rows of non-zero weight) are recycled against the n rows
   for HC2 to HC5 (R's warning `longer object length is not a multiple of shorter object length`, or silently when the
   lengths divide). The values are wrong; the fixtures give the value of the fit without those rows as `reference`.
3. **The "residuals" given to omega are recovered from ψ as `rowMeans(ψ_ij / x_ij)` over the non-zero `x_ij`, and set
   to 0 when every `|ψ_ij| < 2.2e-16` (an absolute threshold).** Data scaled small enough (`y × 2^-56` in the fixture)
   give a zero matrix; an observation with hat value 1 gets 0 and then `0/0 = NaN` in HC2 to HC5.
4. **`type = "const"` is the model-based covariance only for an unweighted lm.** For a weighted lm it is
   `(Σ (w e)²/(n − k)) A (X'X) A` with the **unweighted** X'X, and for a glm `(Σ (W z)²/(n − k)) A (X'X) A`; neither
   is `vcov(fit)` (off by 7% to 75% in the fixture; `reference` = `vcov(fit)`).
5. **HC4, HC4m and HC5 use `p = round(Σ h_i)`** (the rank, as an integer) and n of all rows; their constants are fixed
   (HC4m γ = (1, 1.5), HC5 k = 0.7): sandwich has **no arguments** for them, although the papers define them as
   parameters.
6. **vcovCL's default type is HC1 for an lm and HC0 for a glm** (the class decides: a glm is not "lm" for this test),
   and vcovCL's HC1 factor is `(n − 1)/(n − k)`, not vcovHC's `n/(n − k)`; with the default `cadjust = TRUE` the
   cluster factor `G/(G − 1)` comes on top. Without a cluster, each observation is its own cluster, so `vcovCL(lm)` =
   `vcovHC(lm, "HC1")` and `vcovCL(glm)` = `n/(n − 1) × vcovHC(glm, "HC0")`.
7. **Clustered HC2/HC3 multiply each cluster's estimating function by `sqrt((G − 1)/G)`**, which cancels `cadjust`;
   and for a weighted lm or any glm, sandwich's adjustment matrix is the **transpose** of the one that gives the
   leave-one-cluster-out jackknife (section 3.4): R's values differ from the jackknife by 1% to 23% in the fixture.
   With weights constant within each cluster (an unweighted lm, a Gamma glm with the log link) the two agree.
8. **Multi-way clustering is inclusion–exclusion over all non-empty subsets of the dimensions**, each term with its own
   `G_S/(G_S − 1)`; the intersections are formed by **pasting the labels with "_"**, so `("a_b", "c")` and
   `("a", "b_c")` fall into one cluster `"a_b_c"`. `multi0 = TRUE` replaces the full intersection by
   one-observation clusters and gives that term the factor `(n − k)/(n − 1)` under HC1 (cancelling HC1's factor) and
   1 otherwise, never `G/(G − 1)`.
9. **G is the number of factor levels** when the cluster is a factor (unused levels included, also those whose rows
   the fit dropped), otherwise the number of distinct values. A single cluster is an R error (`non-conformable
   arrays`), a missing label is an error, and with HC2/HC3 and cluster fixed effects the per-cluster block `I − H_gg`
   is singular (HC2: NaN; HC3: an error or meaningless numbers).
10. **`coeftest` and `coefci` on a glm default to `df = Inf`, hence z tests and normal quantiles for every family**,
    the quasi and gaussian families included (summary.glm uses t for those). On an lm the default is
    `df.residual`. A df that is 0, negative or not finite gives the normal distribution, and the df attribute keeps
    the value given.
11. **Rows of aliased coefficients:** with `vcov. = NULL` the fit's own `vcov()` has NA rows for them, and the
    coefficient stays in the table with NA everywhere; the sandwich matrices leave aliased coefficients out, and the
    table then has no row for them. Coefficients are matched to the covariance matrix **by name** when both have
    unique names, otherwise by position.
12. **coxph switches to the robust variance silently** when a cluster is given or a weight is not an integer; then
    `fit$var` is the robust variance, the old variance is `naive.var`, the summary column `se(coef)` is the **naive**
    standard error while z, p, the interval of exp(coef) and the Wald test use the robust one. The robust score test
    is evaluated at `init` (0 when not given), from score residuals collapsed by cluster. The dfbeta residuals use the
    **naive** variance and are multiplied by the case weight before the cluster sums.

## 1. The pieces: estimating functions, bread, hat values

For an lm with prior weights w (1 when none) and residuals `e_i = y_i − ŷ_i`, and for a glm with working weights W
and working residuals z (see "Easy to get wrong" 1):

- **Estimating functions** (`estfun`; an n × k matrix, rows of all n observations, rows of zero weight are 0): lm
  `ψ_i = (e_i w_i) x_i`; glm `ψ_i = ((z_i W_i) x_i) / φ_s` with φ_s as in "Easy to get wrong" 1. (Zeileis 2006.)
- **Bread** (`bread`; k × k): `B = n_ok · A · φ_s`, where `A` is the unscaled covariance of the fit: `(X'WX)^-1`
  from the triangular factor of the fit's QR decomposition over the non-aliased columns (R's `cov.unscaled`; lm:
  W = w; glm: the working weights). (Zeileis 2006.)
- **Meat** (`meat`, here built by the HC or CL rules): `M = (1/n) Σ_i ω_i x_i x_i'` (HC) or the cluster sums of
  section 3.
- **Sandwich**: `V = (1/n) · B M B`. With the factors written out: `V = (n_ok/n)² A (Σ ω_i x_i x_i') A φ_s²`, and since
  every ω of section 2 is proportional to `1/φ_s²`, `V` does not depend on φ_s. For data without zero weights
  (`n_ok = n`), `V = A (Σ ω_i x_i x_i') A` with ω from `u_i = w_i e_i` (lm) or `u_i = W_i z_i` (glm): the familiar
  HC0 sandwich `(X'WX)^-1 X' diag(u²) X (X'WX)^-1` (White 1980; for glm, Zeileis 2006).
- **Hat values** h_i: the diagonal of the hat matrix of the (weighted) least-squares problem of the fit,
  `h_i = w_i x_i' A x_i` (glm: `W_i x_i' A x_i`), computed from the QR factor as the squared row norms of Q; values
  above `1 − 10 eps` are set to 1 (as R's `lm.influence`; for glm see glm-behaviour.md "Influence measures"). **R
  returns them only for rows of non-zero weight** ("Easy to get wrong" 2).
- **Residual factor** given to omega (`res_i`): `rowMeans` over j of `ψ_ij / x_ij` where `x_ij ≠ 0` (0/0 is left out),
  that is `w_i e_i` (lm) or `W_i z_i / φ_s` (glm) up to the rounding of the multiplication and division; then
  `res_i = 0` for every row in which all `|ψ_ij| < 2.2e-16`. The division route matters for R's last bits only.
  Special case of `type = "const"` (only): if at least one row was zeroed by that threshold, all of res is
  recomputed directly: lm `e_i w_i` (rows with x_i = 0 then keep their residual); glm `z_i W_i`, divided by φ_s for the
  families other than binomial and poisson (`× Σ W / Σ (z W)²`).

Aliased (NA) coefficients: their columns are removed from X, ψ and A before anything else; the results have only the
non-aliased coefficients (dimnames = their names in the fit's order).

## 2. `sandwich::vcovHC(x, type = "HC3", omega = NULL, sandwich = TRUE, ...)`

### 2.1 Arguments
- `type` is matched with `match.arg` against `c("HC3", "const", "HC", "HC0", "HC1", "HC2", "HC4", "HC4m", "HC5")`: an
  exact match wins (`"HC4"` is HC4, not HC4m), otherwise a unique partial match; `"HC"` is an alias of HC0 (the
  warnings then name `HC0`). No match or an ambiguous one: error `'arg' should be one of “HC3”, “const”, “HC”, “HC0”, “HC1”, “HC2”, “HC4”, “HC4m”, “HC5”`
  (curly quotes as in the fixture; `"H"` and `"hc0"` both give it). The default is HC3.
- `omega`: `NULL` (use the type), a numeric vector of n values (used as ω directly), or a function
  `omega(res, h, df)` returning the n values of ω, called with the residual factor res, the hat values h and
  `df = n − k`. When omega is given the type's warnings are not produced.
- `sandwich = FALSE` returns the meat `M` of section 1 (k × k, divided by n) instead of V.
- `...` is passed to `sandwich()` (unused here).

### 2.2 omega of each type (Zeileis 2004, Table 1)
With `res` the residual factor, `h` the hat values, `df = n − k`, `p = round(Σ h_i)` as an integer:

| type | ω_i | source |
|---|---|---|
| `const` | `Σ_j res_j² / df` (the same for every i) | Zeileis 2004 |
| `HC0` | `res_i²` | White 1980 |
| `HC1` | `res_i² · n / df` | MacKinnon-White 1985 |
| `HC2` | `res_i² / (1 − h_i)` | MacKinnon-White 1985 |
| `HC3` | `res_i² / (1 − h_i)²` | MacKinnon-White 1985 (Long-Ervin 2000 recommend it) |
| `HC4` | `res_i² / (1 − h_i)^δ_i`, `δ_i = min(4, n h_i / p)` | Cribari-Neto 2004 |
| `HC4m` | `res_i² / (1 − h_i)^δ_i`, `δ_i = min(1, n h_i/p) + min(1.5, n h_i/p)` | Cribari-Neto-da Silva 2011 |
| `HC5` | `res_i² / sqrt((1 − h_i)^δ_i)`, `δ_i = min(n h_i/p, max(4, 0.7 n max_j h_j / p))` | Cribari-Neto et al. 2007 |

Then `M = (1/n) Σ ω_i x_i x_i'` (R: the cross product of the rows `sqrt(ω_i) x_i`, divided by n) and V as in section 1.

### 2.3 Warnings (not for `const`, not when omega is given)
- HC0 and HC1: if some `h_i > 1 − sqrt(eps)` (= 0.99999998509883881): `HC0 covariances become (close to) singular if
  hat values are (close to) 1 as for observation(s) 7` (with HC1 for that type).
- HC2, HC3, HC4, HC4m, HC5, same condition: `HC3 covariances are numerically unstable for hat values close to 1 (and
  undefined if exactly 1) as for observation(s) 7`.
- The observations are named by the row names of the model matrix: the 1-based numbers of the rows **in the data
  given** (rows dropped for a missing value keep their numbers out: in the fixture row 3 has a missing response and
  the warning names observation 7). They are joined by ", "; more than 10 are cut to the first 10 followed by "...".
- The value is computed anyway: with `h_i = 1` the residual factor of that row is (nearly) 0 and is zeroed by the
  threshold, so HC2 to HC5 give `0/0 = NaN` and the **whole matrix is NaN**; HC0/HC1 give a finite matrix.

### 2.4 Boundaries
- Rank deficiency: aliased columns are left out (k = rank), the result is rank × rank.
- `type = "HC"`: identical to HC0, warnings name HC0.
- A row whose x is all 0 (possible without intercept): its ψ is 0 and it is zeroed, so it contributes nothing; for
  `const` its residual is then still counted in `Σ res²` (special case of section 1).
- Zero prior weights: see "Easy to get wrong" 2 (wrong in R).
- Glm that did not converge, or at the boundary: the same formulas with the fit's W and z.

### 2.5 Shape
A k × k symmetric matrix with dimnames the non-aliased coefficient names (`(Intercept)`, `x1`, ... in the fixture).

### 2.6 Where R is wrong or inaccurate (fixture `refKind`)
- `subset` (zero prior weights): R's value is wrong ("Easy to get wrong" 2); `reference` = vcovHC of the fit without
  those rows (equivalently: n = n_ok and the hat values of the rows used). 9% to 53% apart in the fixture.
- `scaled` (`y × 2^-56`): R returns the zero matrix (threshold of section 1); `reference` = `2^-112 ×` vcovHC of the
  unscaled data, the exact value.
- `vcov` (`const` of a weighted lm or a glm): R's formula is not the homoskedastic covariance; `reference` =
  `vcov(fit)` (σ̂² A for lm; dispersion × A for glm with the summary.glm dispersion, 1 for binomial and poisson).
  Whether that is "right" is a decision (below).
- `exact` (a model matrix with κ ≈ 2e12: two columns 1e6 + N(0, 1) next to the intercept): `reference` = R's own
  formula evaluated with exact rational arithmetic (gmp: X'WX, its inverse, the residuals and the hat values) and
  256-bit mpfr for ω and the products. R is off by up to 8e-3 relative in single entries (1e-3 in the max norm),
  mostly from the residuals (y − ŷ cancels: the coefficients themselves are good to 4e-10). For well-conditioned
  data the same exact computation agrees with R to 4e-15 (checked by hand, not in the fixture).

## 3. `sandwich::vcovCL(x, cluster = NULL, type = NULL, sandwich = TRUE, fix = FALSE, ..., cadjust = TRUE, multi0 = FALSE)`

(`cadjust` and `multi0` reach `meatCL` through `...`.)

### 3.1 Arguments and checks, in order
- `cluster`: `NULL` (then each observation is its own cluster, labels 1..n), a vector or factor (one-way), or a list
  or data frame of such vectors (multi-way, one per dimension, d of them). (A formula `~ id` is also accepted by R,
  evaluated in the model's data; not needed for rStats.js.) If its length is not n but the fit dropped rows for
  missing values, the same rows are dropped from the cluster first (so a cluster for the original data works).
- Length ≠ n after that: error `number of observations in 'cluster' and 'estfun()' do not match`.
- A missing label in any dimension: error `cannot handle NAs in 'cluster': either refit the model without the NA
  observations in 'cluster' or impute the NAs`.
- `type`: `NULL` → HC1 for an lm, HC0 for a glm; otherwise `match.arg` against `c("HC", "HC0", "HC1", "HC2", "HC3")`
  (error `'arg' should be one of “HC”, “HC0”, “HC1”, “HC2”, “HC3”` for others, e.g. `"HC4"`, `"const"`); `"HC"` = HC0.
- The labels are compared as values (a number and its string give the same clusters; the order of the labels does not
  matter).

### 3.2 One-way, HC0 and HC1 (Zeileis-Köll-Graham 2020; Cameron-Gelbach-Miller 2011 for the cluster factor)
With G the number of clusters ("Easy to get wrong" 9) and `U_g = Σ_{i in g} ψ_i` (k-vectors):

`M = c · (1/n) Σ_g U_g U_g'`, with `c = G/(G − 1)` if `cadjust` (default) else 1; for HC1 additionally
`M ← (n − 1)/(n − k) · M`. Then V as in section 1 (`sandwich = FALSE` returns M).

When G = n (all clusters of size one) the rows are used as they are (no summing). With G = 1 R fails
(`non-conformable arrays`, with or without cadjust).

### 3.3 Multi-way (Cameron-Gelbach-Miller 2011; Zeileis-Köll-Graham 2020)
For d dimensions, the terms are all non-empty subsets S of {1..d}, ordered by size and then lexicographically (R's
`combn`: for d = 2: {1}, {2}, {1,2}; d = 3: {1}, {2}, {3}, {1,2}, {1,3}, {2,3}, {1,2,3}). The clusters of a subset are
the distinct combinations of its labels (R pastes the labels with "_", see "Easy to get wrong" 8), `G_S` their number.
`M = Σ_S (−1)^(|S|+1) · c_S · (1/n) Σ_{g in S's clusters} U_g U_g'` with `c_S = G_S/(G_S − 1)` (or 1 without cadjust),
then the HC1 factor `(n − 1)/(n − k)` on the sum.
`multi0 = TRUE` (only with d ≥ 2): the last term (the full intersection) is replaced by clusters of one observation
(`U_i = ψ_i`) and gets `c = (n − k)/(n − 1)` for HC1, 1 for HC0, whatever cadjust says.
The result can have negative eigenvalues (fixture: two-way, HC0, no cadjust).

### 3.4 HC2 and HC3 (Zeileis-Köll-Graham 2020; Bell-McCaffrey 2002; see also Kauermann-Carroll 2001)
For each term (each one-way term, or each subset of 3.3), with `res` the residual factor of section 1 (`w e` or
`W z/φ_s`, including the threshold) and `W` the weights of the fit (lm: the prior weights, or none; glm: the working
weights):
- If `G = n` for that term: `ψ_i ← ψ_i / sqrt(1 − h_i)` (HC2) or `ψ_i / (1 − h_i)` (HC3) with the hat values.
- Otherwise, with `A0 = (X'WX)^-1` (computed by R from the R factor of a new unpivoted QR of `sqrt(W) X`; = A), for
  each cluster g with rows i_g: `H_g = X_g A0 X_g' diag(W_g)` (n_g × n_g; without weights `X_g A0 X_g'`), and
  `ψ_i ← (M_g res_g)_i · x_i` for i in g, where `M_g = (I − H_g)^(-1/2)` (HC2) or `(I − H_g)^-1` (HC3).
  The power −1/2 is taken by an eigen decomposition of `I − H_g` (symmetric if R's `isSymmetric` says so, that is
  always for an unweighted lm; otherwise the general one, `V diag(λ^-1/2) V^-1`, with a warning `complex eigen values
  of X` if an imaginary part exceeds 9.09e-13 and the real parts used), with eigenvalues below `eps^(1/1.3)` =
  9.0949470177293046e-13 set to 0 first (so a singular block gives Inf and then NaN). HC3 uses a linear solve
  (singular: R's error `system is computationally singular: reciprocal condition number = ...` (or LAPACK's "exactly
  singular"), or meaningless numbers when the rounding hides the singularity).
- Then every `ψ_i ← sqrt((G − 1)/G) ψ_i`, and the term proceeds as in 3.2/3.3 (sums, `c`, sign); HC1's factor does not
  apply. With the default cadjust the factor `(G − 1)/G` and `G/(G − 1)` cancel.
- R warns `clustered HC2/HC3 are only applicable to (generalized) linear regression models` for other models (not
  reachable from rStats.js).

**The weighted case is inconsistent.** With `Hs_g = W_g^½ X_g A X_g' W_g^½` (symmetric) the leave-one-cluster-out
residuals of the weighted least-squares problem are `(I − X_g A X_g' W_g)^-1 e_g`, so the jackknife's estimating
function is `X_g' W_g (I − H_g)^-1 e_g = X_g' (I − H_g')^-1 W_g e_g`; sandwich uses `(I − H_g)^-1` where the transpose
belongs. For HC3 the symmetric form `U_g = (W_g^½ X_g)' (I − Hs_g)^-1 (W_g^-½ res_g)` gives exactly
`Σ_g (b_(−g) − b)(b_(−g) − b)'` (the jackknife without the (G − 1)/G factor; checked to 2e-15 for a weighted lm, and
for a poisson glm against the one-step jackknife of the working-response regression); the analogous HC2,
`(I − Hs_g)^-1/2`, is the Bell-McCaffrey bias-reduced linearisation (unbiased under a working model with variance
∝ 1/W). They coincide with sandwich's when W is constant within every cluster. Fixture `refKind = "natural"`: the
symmetric form (and, for lm HC3 with cadjust, `jackknife` too).

### 3.5 fix and sandwich
After V (or M, with `sandwich = FALSE`) is computed: if `fix` and the symmetric eigen decomposition `V = Q diag(λ) Q'`
has some `λ < 0`, V is replaced by `Q diag(max(λ, 0)) Q'` (Cameron-Gelbach-Miller 2011). Nothing changes
when all λ ≥ 0.

### 3.6 Where R is wrong (fixture `refKind`)
- `subset` (zero prior weights): as in 2.6; additionally a cluster whose rows all have weight 0 still counts in G.
- `natural` (HC2/HC3 of a weighted lm or a glm with clusters of more than one row): section 3.4.
- Not in references: the "_" collisions of multi-way labels (the fixture's case shows R's merged result), unused
  factor levels in G, HC2/HC3 with cluster fixed effects (fixture: HC2 NaN, HC3 R's meaningless numbers).

## 4. `lmtest::coeftest(x, vcov. = NULL, df = NULL, ...)` and `lmtest::coefci(x, parm = NULL, level = 0.95, vcov. = NULL, df = NULL, ...)`

- `est` = the fit's coefficients (NA for aliased ones). The covariance: `vcov. = NULL` → the fit's `vcov()` (lm:
  σ̂² A with NA rows and columns for aliased coefficients; glm: dispersion × A, likewise); a function → `vcov.(x, ...)`
  with the remaining arguments (e.g. `type`, `cluster`); a matrix → used as is. `se = sqrt(diag(V))` (a negative
  diagonal entry gives NaN with R's warning `NaNs produced`).
- Matching: if both est and se have names and the names of each are unique, keep the coefficients whose names occur
  among the names of se, in the order of est (coefci does this without the uniqueness check); otherwise by position.
  A matrix without dimnames is therefore used by position, one with reordered names is matched, and one with names for
  a subset gives a table of that subset.
- `df`: `NULL` → `df.residual(x)` (lm; for glm the method's default is `Inf`). Then `t` if some df is finite and all
  are > 0, else `z`. Statistic `est/se`; p-value `2 · pt(|t|, df, lower.tail = FALSE)` or `2 · pnorm(|z|, lower =
  FALSE)`.
- coeftest result: a matrix with columns `Estimate`, `Std. Error`, `t value`, `Pr(>|t|)` (or `z value`, `Pr(>|z|)`),
  row names the coefficients kept; attributes `method` (`"t test of coefficients"` / `"z test of coefficients"`), `df`
  (the df used, as given: Inf, 0 or −1 stay), `nobs` (nobs of the fit: rows of non-zero weight), `logLik`.
- coefci: `a = (1 − level)/2`; quantiles `qt(c(a, 1 − a), df)` or `qnorm`; limits `est + q · se`. Column names:
  `format(100·c(a, 1 − a), trim = TRUE, scientific = FALSE, digits = 3)` followed by " %": both numbers are printed
  with the same number of decimals, the largest needed by either to show it to 3 significant digits without trailing
  zeros (0.95 → `2.5 %`, `97.5 %`; 0.9 → `5 %`, `95 %`; 0.999 → `0.05 %`, `99.95 %`; 0.9995 → `0.025 %`, `99.975 %`;
  0.123456 → `43.8 %`, `56.2 %`). `level = 1` gives ±Inf (`0 %`, `100 %`), `level = 0` both limits at est (`50 %` twice),
  `level = 1.5` NaN with `NaNs produced`; nothing is checked.
- `parm`: NULL (all), numeric indices into the kept coefficients (out of range: error `subscript out of bounds`), or
  names (the kept coefficients whose names are in parm, in their own order; unknown names give zero rows).
- Glm: `df = Inf` by default (coeftest.glm, coefci.glm), so z/normal even for quasi families ("Easy to get wrong" 10).

## 5. Robust variance of `survival::coxph` (Lin-Wei 1989; Therneau-Grambsch 2000, chapters 4 and 7)

The fit itself is oracle/coxph-behaviour.md (same steps, same `var` before this section).

### 5.1 When it is used
- `robust` given: must be TRUE or FALSE (anything else: error `robust must be TRUE/FALSE`).
- `robust` not given: TRUE if a cluster is given or some weight is not an integer (`w ≠ floor(w)`), else FALSE. No
  message or warning. (Integer weights stay non-robust; constant non-integer weights such as 2.5 switch it on.)
- A cluster with `robust = FALSE`: warning `cluster specified with robust=FALSE, cluster ignored` and the naive fit.
- A cluster both as a `cluster()` term and the argument: warning `cluster appears both in a formula and as an
  argument, formula term ignored` (the argument is used). The term and the argument give the same results otherwise.
- `robust = TRUE` without a cluster: every observation is its own cluster.
- Cluster labels: any values; rows with a missing label are **dropped from the fit** like rows with a missing
  covariate (n decreases; fixture case with two NA labels: n = 95 of 97).
- The robust part is skipped when every coefficient is NA (also with no events): then no `naive.var`, no `rscore`, and
  the summary has no robust column.

### 5.2 Score residuals (`residuals(fit, type = "score")`)
Per stratum, using the times after the tie merging of coxph-behaviour step 1, case weights w, `r_j = exp(η_j)` with η
the linear predictor (any constant added to η cancels; R uses the fit's centred linear predictors and the
**uncentred** covariates), and `s_j` (a k-vector, starting at 0) for each observation j:

For each distinct event time t of the stratum: the risk set R = {j in the stratum: time_j ≥ t} (censored observations
at t included), the deaths D = {j: time_j = t, status_j = 1}, d = |D|, and `S0 = Σ_R w r`, `S1 = Σ_R w r x`,
`E0 = Σ_D w r`, `E1 = Σ_D w r x`, `dw = Σ_D w`.
- Breslow, or d = 1: `x̄ = S1/S0`, `λ = dw/S0`; for every j in R: `s_j −= r_j (x_j − x̄) λ`; for every j in D:
  `s_j += x_j − x̄`.
- Efron with d > 1: for m = 0, ..., d − 1 with `f = m/d`, `S0m = S0 − f E0`, `x̄_m = (S1 − f E1)/S0m`,
  `λ_m = (dw/d)/S0m`: for j in R but not in D: `s_j −= r_j (x_j − x̄_m) λ_m`; for j in D:
  `s_j += (x_j − x̄_m)/d − (1 − f) r_j (x_j − x̄_m) λ_m`.

These are R's unweighted score residuals (one row per observation used, input order). `Σ_j w_j s_j` is the score
vector u(β). Checked against R to 2e-14 (relative to the largest residual) for Efron and Breslow, with weights and
strata. (Therneau-Grambsch 2000, chapter 4, give the score residuals and Efron's weighting of tied deaths.)

### 5.3 The robust variance
`dfbeta_j = w_j · (s_j' V_naive)` (a k-row-vector; V_naive the variance of the fit, with zero rows and columns for NA
coefficients), `D_c = Σ_{j in cluster c} dfbeta_j`, `var = Σ_c D_c' D_c` (k × k). The residuals `s_j` are at the final
β (also when the iterations ran out). `naive.var` = V_naive. NA coefficients keep zero rows and columns in var.
`residuals(fit, type = "dfbeta")` is `dfbeta_j` (weighted by default). (Lin-Wei 1989; Therneau-Grambsch 2000, ch. 7.)

### 5.4 The robust score test (`rscore`)
The score residuals of 5.2 at `β0 = init` (0 when not given), i.e. with `η_j = x_j' init` (uncentred), multiplied by
w_j and summed by cluster: `T_c`; `u = Σ_c T_c`; `rscore = u' S^- u` with `S = Σ_c T_c' T_c`, solved with the
generalised Cholesky of coxph-behaviour step 4 (tolerance `toler.chol`, default 2^-39) — for k = 1, `u²/S`. A
rank-deficient S (fewer clusters than coefficients) is handled by the factorisation (two clusters, two coefficients:
rscore = 2 exactly, as in the fixture). (Therneau-Grambsch 2000, ch. 7; Lin-Wei 1989.)

### 5.5 Tests and summary with the robust variance
- `wald` = the Wald statistic of coxph-behaviour step 7 with `var` (the robust one), against `init` when given.
- Summary: `coef`, `exp(coef)`, `se(coef)` = sqrt(diag(naive.var)), `robust se` = sqrt(diag(var)), `z = coef/robust
  se`, `Pr(>|z|)` = upper chi-squared tail (1 df) of z²; the interval `exp(coef ∓ q · robust se)`; `waldtest` from the
  robust wald, df = the number k of non-NA coefficients; `robscore` = (rscore, k, upper chi-squared tail);
  `logtest`, `sctest` and `rsq` unchanged (they ignore the clustering). `used.robust = TRUE`.
- An NA coefficient: robust se 0, z and p NaN, as the naive.

### 5.6 Errors
- A single cluster (k ≥ 2): R fails with `(subscript) logical subscript too long` (the cluster sums collapse to a
  vector). Not meaningful; see the decisions.
- Zero or negative weights: `Invalid weights, must be >0` (unchanged).

## 6. Accuracy notes

| function | issue | fixture |
|---|---|---|
| vcovHC, vcovCL | zero prior weights: (n_ok/n)² scaling, recycled hat values | `reference` (`subset`) |
| vcovHC | absolute threshold 2.2e-16 on ψ (tiny data give 0) | `reference` (`scaled`) |
| vcovHC const | not the homoskedastic covariance for weighted lm and glm | `reference` (`vcov`) |
| vcovHC | κ(X) ≈ 2e12: 1e-3 relative (residual cancellation) | `reference` (`exact`) |
| vcovCL HC2/HC3 | transposed adjustment with weights varying within clusters | `reference` (`natural`, `jackknife`) |
| vcovCL HC2/HC3 | cluster fixed effects: singular blocks, NaN or meaningless | — |
| vcovCL | "_" label collisions; unused factor levels counted in G | — |
| coxph robust | single cluster fails | error recorded |

The exact references used gmp (rational X'WX, inverse, residuals, hat values) and Rmpfr (256 bits, for the powers of
HC4/HC4m/HC5); they were cheap only for the small lm cases. For ordinary data R's sandwich arithmetic is accurate to a
few ulps relative to the largest entry. Suggested test tolerance against R: 1e-12 relative to `sqrt(V_ii V_jj)` for
entry (i, j) (off-diagonal entries can be near 0); the coxph fixture comes from x86_64 R like `coxph`.

## 7. Sources the implementers may port from (permissive)

- **statsmodels** (BSD-3): `statsmodels/stats/sandwich_covariance.py` (`cov_hc0`..`cov_hc3`, `cov_cluster`,
  `cov_cluster_2groups` — two-way inclusion–exclusion, `S_crosssection`, `_HCCM`), and `RegressionResults.get_robustcov_results`
  (`cov_type = "HC0".."HC3"`, `"cluster"` with `use_correction`, `df_correction`). No HC4/HC4m/HC5, no clustered
  HC2/HC3, no multi0; its small-sample factors differ in naming: check against section 3.2.
- **lifelines** (MIT): `CoxPHFitter(robust = True, cluster_col = ...)` computes the Lin-Wei sandwich from score
  residuals; check its handling of ties (Efron) against 5.2 before porting.
- Papers, and what each states:
  White (1980): HC0 and the sandwich `(X'X)^-1 X' Ω X (X'X)^-1`. MacKinnon and White (1985): HC1 (n/(n − k)), HC2,
  HC3 (and HC3 as an approximation of the jackknife). Long and Ervin (2000): the HC0-HC3 naming and the
  recommendation of HC3. Cribari-Neto (2004): HC4 with δ = min(4, n h/p). Cribari-Neto, Souza and Vasconcellos (2007):
  HC5 with k = 0.7. Cribari-Neto and da Silva (2011): HC4m with γ = (1, 1.5). Zeileis (2004): the omega framework of
  vcovHC, `const`, the table of section 2.2. Zeileis (2006): estfun and bread of lm and glm, the scaling by n
  (section 1). Zeileis, Köll and Graham (2020): vcovCL, cadjust G/(G − 1), the HC1 factor (n − 1)/(n − k), multi-way
  clustering and multi0, the eigenvalue fix, clustered HC2/HC3 (sections 3.2-3.5). Cameron, Gelbach and Miller (2011):
  multi-way inclusion–exclusion and the fix of negative eigenvalues (3.3, 3.5). Bell and McCaffrey (2002) and
  Pustejovsky and Tipton (2018, not on the brief's list; the weighted and fixed-effects cases of CR2): the symmetric
  adjustment of 3.4. Lin and Wei (1989): the robust variance of the Cox model (5.3). Therneau and Grambsch (2000):
  score and dfbeta residuals with Efron ties, clustering, the robust score test (5.2-5.4). Zou (2004): modified Poisson
  regression (poisson log-link glm on a 0/1 outcome with HC0) — the infert cases of the fixtures.

## Decisions for the user

1. **Public API.** Proposal (rStats.js style, R's names):
   - `vcovHC(fit, { type, omega, sandwich })` and `vcovCL(fit, { cluster, type, cadjust, multi0, fix, sandwich })`
     for `LmResult`, `LmFormulaResult` and `GlmResult`, returning (a) a plain `number[][]`, or (b)
     `{ vcov: number[][], names: string[], warnings: string[] }` (rule 10 wants R's warnings in a result).
     Recommendation (b). `omega`: an array of n values or a function `(res, hat, df) => number[]`.
   - `coeftest(fit, { vcov, df })` returning `{ estimate, stdError, statistic, pValue, names, statisticName ("t
     value"/"z value"), df, method, nobs, warnings }`, and `coefci(fit, { parm, level, vcov, df })` returning
     `{ lower, upper, names, colNames, warnings }`. `vcov`: (a) a matrix only; (b) a matrix, the result object of
     vcovHC/vcovCL, or a function `(fit) => matrix | result` (arguments through a closure, not R's `...`); (c) also a
     shorthand string `"HC0"`. Recommendation (b). A matrix without names is matched by position and must be k × k
     (an Error otherwise, where R recycles).
2. **Getting X, the weights and the rows.** `LmResult` (matrix input) has only `qr`; vcovHC needs the unweighted model
   matrix, the prior weights, the hat values and, for clusters given per input row, which rows the fit dropped.
   (a) Add `x`, `weights` and `rows` (0-based input rows used, as `LmFormulaResult.rows`) to `LmResult`, and `rows` to
   `GlmModel` (additive, non-breaking; the hat values come from `qr`). (b) An extra argument `vcovHC(fit, { x, weights
   })`. Recommendation (a). Cluster length: (a) one label per input row, the fit's dropped rows dropped (R) or (b) one
   per row used. Recommendation (a), with an Error for any other length.
3. **Zero prior weights** (R wrong, 2.6/3.6): (a) R's values; (b) leave those rows out entirely (n = n_ok, hat values
   aligned, clusters with only such rows not counted) = R on the fit without them. Recommendation (b), a documented
   difference.
4. **The absolute threshold 2.2e-16** (section 1): (a) R's; (b) none: compute `res` directly as `w e` / `W z` (the
   value differs from R only in rows R zeroes, by about 1e-32 relative, except for tiny-scale data where R returns 0);
   (c) a relative threshold. Recommendation (b).
5. **`const` for weighted lm and glm** (2.6): (a) R's formula; (b) the model-based `vcov(fit)` (`reference`).
   Recommendation (b), documented; (a) only if bit-compatibility with sandwich matters more.
6. **Hat values of 1 and NaN results.** R warns and returns NaN for HC2-HC5 (whole matrix). (a) R's warning and NaN;
   (b) R's warning text, and an Error when the matrix would be NaN (rule 1); finite results near h = 1 keep R's
   numbers and warning. Recommendation (b). The observation numbers in the warning: 1-based input rows (R's row names).
7. **Ill-conditioned model matrices** (2.6 `exact`): (a) the fit's own precision (double QR; tests against R with a
   loose tolerance there and the `reference` recorded); (b) extended precision (double-double residuals and A as the
   formula lm does). Recommendation (a) unless the formula path's double-double residuals come for free.
8. **vcovCL types.** HC0 and HC1 are required. (a) Only those; (b) also HC2/HC3 as R (transposed adjustment for weighted
   lm and every glm); (c) also HC2/HC3 with the symmetric adjustment of 3.4 (equal to R for unweighted lm; the
   jackknife for HC3; differs from R by 1% to 23% for glm), documented. Recommendation (c). Singular blocks (cluster
   fixed effects): an Error (recommended) or a generalised inverse (Pustejovsky-Tipton; more work).
9. **Cluster inputs.** Labels: numbers, strings or booleans; `null`/NaN = missing → Error (R's message). A single
   cluster: Error (`at least two clusters are needed`; R fails with an unrelated message). Multi-way: an array of
   label arrays (one per dimension), intersections formed as tuples (no "_" collisions; a documented difference). G =
   the number of distinct labels among the rows used (no factor levels). Recommendation: as listed.
10. **Defaults.** vcovHC `HC3`; vcovCL HC1 for lm, HC0 for glm; cadjust true; multi0, fix false; sandwich true.
    Recommendation: keep R's (they are what users compare with), and document the lm/glm difference of vcovCL.
11. **HC4m/HC5 constants.** (a) fixed as sandwich; (b) options `gamma: [1, 1.5]` and `k: 0.7`. Recommendation (a).
12. **coeftest/coefci df for glm.** (a) lmtest's: Inf (z) for every family unless `df` is given; (b) t with
    df.residual for families with an estimated dispersion, as summary.glm. Recommendation (a), documented in the TSDoc.
    `df` ≤ 0 or non-finite: z as R (recommended) or an Error.
13. **coxph options and result.** Options `robust?: boolean` (default as R: true with a cluster or non-integer
    weights) and `cluster?: readonly (GroupLabel | null)[]` (rows with a missing label dropped like missing strata).
    Non-integer weights stop throwing. Result additions (only when the robust variance is used, otherwise absent):
    `naiveVar: number[][]`, `robustSe: number[]`, `rscore: number`, `robscore: CoxphTest`, and `usedRobust: boolean`
    always. `var` becomes the robust variance (R). For `se` (and its alias `stdError`): (a) the naive standard error
    (R's `se(coef)` column) while `z`, `p`, `lower`, `upper` and `waldtest` use `robustSe` (R); (b) `se` = the robust one
    and `naiveSe` added. Recommendation (a), as R's column names, with the TSDoc saying which is which. A single
    cluster: Error (recommended). `robust: true` with `cluster` and `robust: false` with `cluster`: R's warning.
    Exporting the score/dfbeta residuals: not now (internal; the fixture has them for debugging).
14. **Test tolerances.** 1e-12 relative to `sqrt(V_ii V_jj)` per entry against R where R is right; against
    `reference` where present and chosen.

## rStats.js's choices

Decided by the user on 2026-11-09. These are binding and override the recommendations above where they differ.

1. **API.** `vcovHC(fit, { type, omega, sandwich })` and `vcovCL(fit, { cluster, type, cadjust, multi0, fix, sandwich })`
   for `LmResult`, `LmFormulaResult` and `GlmResult`, returning `{ vcov: number[][], names: string[], warnings: string[] }`.
   `omega`: an array of n values or a function `(res, hat, df) => number[]`. `coeftest(fit, { vcov, df })` and
   `coefci(fit, { parm, level, vcov, df })` with the result shapes of Decision 1. `vcov` accepts a matrix, the result
   object of vcovHC/vcovCL, or a function `(fit) => matrix | result`. A matrix without names is matched by position and
   must be k × k (an Error otherwise). No string shorthand.
2. **Model data.** Add `x` (unweighted model matrix of the rows used), `weights` and `rows` (0-based input rows used) to
   `LmResult`, and `rows` to `GlmModel` (additive). Clusters: one label per input row; the rows the fit dropped are
   dropped; any other length is an Error.
3. **Zero prior weights.** Leave those rows out entirely (n = n_ok, hat values aligned, clusters with only such rows not
   counted) = R on the fit without them. Documented in docs/differences-from-r.md; tests against `reference`.
4. **No absolute threshold.** `res` is computed directly as `w e` (lm) / `W z` (glm, divided by φ_s as specified).
5. **`const`** returns the model-based covariance `vcov(fit)` for every fit (equal to R for an unweighted lm);
   documented; tests against `reference` for weighted lm and glm.
6. **Hat values of 1.** R's warning text (observation numbers as 1-based input rows), and an Error where R's matrix
   would be NaN; finite results near h = 1 keep R's numbers and warning.
7. **Ill-conditioned model matrices.** The fit's own precision; looser tolerance only for those cases, with a comment
   and the `reference` recorded.
8. **vcovCL types.** HC0, HC1, and HC2/HC3 with the symmetric adjustment of section 3.4 (equal to R for an unweighted
   lm; HC3 is the leave-one-cluster-out jackknife). Documented difference for weighted lm and glm; tests against
   `reference` there. Singular blocks (cluster fixed effects): an Error.
9. **Cluster inputs.** Labels: numbers, strings or booleans; `null`/NaN = missing → Error. A single cluster: Error
   (`at least two clusters are needed`). Multi-way: an array of label arrays (one per dimension), intersections formed
   as tuples (no "_" collisions). G = the number of distinct labels among the rows used. All documented.
10. **Defaults as R:** vcovHC `HC3`; vcovCL HC1 for lm, HC0 for glm (documented); cadjust true; multi0, fix false;
    sandwich true.
11. **HC4m/HC5 constants fixed** as sandwich (no options).
12. **coeftest/coefci df for glm:** lmtest's Inf (z) for every family unless `df` is given (stated in the TSDoc).
    `df` ≤ 0 or non-finite gives z, as R.
13. **coxph.** Options `robust?: boolean` (default as R: true with a cluster or non-integer weights) and
    `cluster?: readonly (GroupLabel | null)[]` (rows with a missing label dropped as missing strata). Non-integer
    weights no longer throw. Result: `usedRobust: boolean` always; when the robust variance is used, `naiveVar`,
    `robustSe`, `rscore`, `robscore`. `var` is the robust variance; `se`/`stdError` is the naive standard error (R's
    `se(coef)`), while `z`, `p`, `lower`, `upper` and `waldtest` use `robustSe` (as R), stated in the TSDoc. A single
    cluster: Error. R's warnings for `robust` with `cluster`. Score/dfbeta residuals stay internal.
14. **Tolerances.** 1e-12 relative to `sqrt(V_ii V_jj)` per entry, against R where R is right and against `reference`
    where present and chosen.
