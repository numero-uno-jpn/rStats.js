# Tests for lmer fits: lmerTest's Satterthwaite tests and lme4's model comparison

This specifies the behaviour of lmerTest 3.2.1 (Kuznetsova, Brockhoff and Christensen, 2017, "lmerTest Package:
Tests in Linear Mixed Effects Models", Journal of Statistical Software 82(13)) and of lme4's `anova()` for several
fits, as the library implements them for the results of `lmer` (src/models/lmer.ts, oracle/lmer-behaviour.md).
It is written from reading those packages' behaviour; do not read their sources (GPL) or R's, and do not use their
internal identifiers. Fixtures: `lmerTest` (oracle/lmertest.R) and `lmerCompare` (oracle/lmercompare.R).

Points that are easy to get wrong:
- The variance parameters are (theta, sigma): lme4's theta (the elements of the relative covariance factors, as
  `LmerResult.theta`) followed by the residual standard deviation sigma. They are not the variances.
- The deviance used for the derivatives is NOT the profiled criterion that `lmer` minimises: sigma is a free
  argument (formula below). At the optimum its gradient is zero in every direction, sigma included.
- lmerTest computes the Hessian and the Jacobian by numerical differentiation (Richardson extrapolation) at
  lme4's approximate optimum. The references are at the exact optimum with exact derivatives, so lmerTest's own
  numbers differ from them in about the 4th to 8th significant digit; match the references (see "Accuracy").
- The hypothesis matrices of the ANOVA tables depend only on the model matrix, the terms and the data, never on the
  fit, and lmerTest rounds them (zapsmall): reproduce the rounding, or the F values differ in the 7th digit.

## 1. The Satterthwaite machinery

Let n be the number of observations used, p the number of columns of X (after dropping aliased columns), q the
length of theta, m = q + 1. For varpar = (theta, sigma):

  d(theta, sigma) = log|L_theta|^2 + r^2(theta) / sigma^2 + n log(2 pi sigma^2)
                    [ + log|R_X|^2 - p log(2 pi sigma^2)   for a REML fit ]

where L_theta is the sparse Cholesky factor of Lambda' Z' Z Lambda + I, r^2(theta) the penalised residual sum of
squares and R_X the Cholesky factor of the fixed-effects block (oracle/lmer-behaviour.md, 1b), all at theta. The
fit's sigma^2 is r^2 / (n - p) for REML and r^2 / n for ML; at the fit (theta-hat, sigma-hat) the gradient of d is 0.

- H: the m x m Hessian of d at the fit.
- Its eigenvalues (symmetric eigendecomposition) decide warnings and the inverse, with tol = 1e-8:
  - k > 0 eigenvalues below -tol: the warning `Model failed to converge with k negative eigenvalue(s): v1 v2 ...`
    ("eigenvalue" for k = 1, "eigenvalues" otherwise; each value written like C's "%1.1e", e.g. "-3.2e-04");
  - k > 0 eigenvalues in (-tol, tol): the warning `Model may not have converged with k eigenvalue(s) close to
    zero: v1 ...` (same rules);
  - A = 2 H^+, where H^+ = sum over the eigenvalues > tol of v v' / lambda (the other directions are left out).
  A is lmerTest's `vcov_varpar`, the asymptotic covariance of varpar.
- C(varpar) = sigma^2 (R_X' R_X)^-1, the covariance of beta-hat as a function of the variance parameters (at the
  fit it is `LmerResult.vcov`). J_k = dC / d varpar_k (k = 1..m), p x p each.

The tests below use V = C(fit), A and the J_k.

### One-dimensional contrast (a vector l of length p, a right-hand side rhs, default 0)

  estimate = l' beta-hat, var = l' V l, se = sqrt(var), t = (estimate - rhs) / se,
  g_k = l' J_k l, df = 2 var^2 / (g' A g), p-value = 2 P(T_df > |t|) (upper tail of Student's t with df).

With a confidence interval at `level` (default 0.95): estimate -/+ se * q, q the upper (1 - level) / 2 quantile of
t with df. A contrast containing NaN gives NaN everywhere; an empty contrast (p = 0) gives an empty row set.

### Several rows (a matrix L, r x p; joint test)

- r = 1: the one-dimensional test of that row; F = t^2, NumDF = 1, DenDF = its df.
- r > 1: eigendecomposition of the r x r matrix L V L' (eigenvalues d_1 >= ... >= d_r, eigenvectors P). Keep the
  first q' eigenvalues greater than max(sqrt(2^-52) d_1, 0). If q' = 0 there is no test (no row). The rotated
  contrasts are the rows of P_keep' L (r' = q' rows). If q' = 1: the one-dimensional test of that rotated row
  (F = t^2, NumDF 1). Otherwise:
  - F = (sum over i of (row_i beta-hat - 0)^2 / d_i) / q', NumDF = q';
  - nu_i = 2 d_i^2 / (g_i' A g_i) with g_i,k = row_i J_k row_i';
  - DenDF: nu_1 if q' = 1; the mean of the nu_i if every difference between consecutive nu_i is below 1e-8 in
    absolute value; 2 if any nu_i <= 2; otherwise 2 E / (E - q') with E = sum of nu_i / (nu_i - 2).
  - A non-zero right-hand side with r > 1 subtracts from beta-hat the minimum-norm solution b0 of L b0 = rhs
    (b0 = ginv(L) rhs) before the quadratic form. If q' < r and rhs is not all 0, warn `Contrast is rank deficient
    and test may be affected`.
- The table row: Sum Sq = F sigma^2 NumDF, Mean Sq = F sigma^2 (sigma the fit's sigma), NumDF, DenDF, F value,
  Pr(>F) = upper tail of F(NumDF, DenDF).

### summary

The coefficient table: for each column i of X the one-dimensional test of the unit vector e_i: Estimate, Std.
Error, df, t value, Pr(>|t|) (no interval). Names as `LmerResult.fixefNames`. With `ddf: "lme4"` the table is lme4's
(estimate, standard error, t value; no df and p-value), as `LmerResult.coefTable` already is.

### contest (lmerTest's contest)

`L` is a vector (one contrast) or a matrix (rows). With `joint` (default true) the rows are tested together (the F
table row above, one row); with `joint: false` each row is tested on its own (one t-test row each, with the
interval unless `confint` is false). `rhs` (default 0) and `level` (default 0.95) as above. A contrast whose length
is not p is an error.

## 2. ANOVA tables of one fit (lmerTest's anova)

Type "III" (default), "II" or "I". For each term of the fixed-effects formula (in the order of the terms) the
hypothesis matrix L_term (rows: contrasts, columns: the columns of X) is tested jointly as in section 1; the table
has one row per term, with the term's label as the row name. A term whose hypothesis has no rows gives no row (and
is not listed). Then, if some term labels are missing from the table, they are appended as rows of NaN. An
intercept-only model (or one without fixed effects) has an empty table.

Below, "X" is the model matrix of the fit (the columns kept, with the `assign` of each column to its term), and the
term of the intercept column is "(Intercept)". If X has at most one column, or the formula has at most one term,
every type uses the Type I construction.

### Rounding (R's zapsmall and round)

zapsmall(M): with mx = the largest |entry| (NaN left out), if mx > 0 round every entry to digits = max(0, 7 -
log10(mx)) (not an integer in general), else to 7 digits. round(x, digits) is R's:
- x NaN or digits NaN: NaN; x infinite or 0, or digits > 323: x unchanged; digits < -308: 0; digits = 0: the
  nearest integer, ties to even.
- Otherwise dig = floor(digits + 0.5), work with |x| and restore the sign at the end. If l + dig > 15, where
  l = log10(2) * (0.5 + e) and e is the binary exponent of |x| (the exponent of its leading bit, as C's logb),
  return x unchanged. Otherwise (for dig <= 308) with P = 10^dig computed as a double by repeated multiplication
  (for dig < 0, P = 1 / 10^(-dig)), x10 = |x| P, i10 = floor(x10), xd = i10 / P, xu = ceil(x10) / P (all in double
  arithmetic). Return xu if (xu - |x|) < (|x| - xd), or if both differences are equal and i10 is odd; else xd.
  For dig > 308, the same with x10 = (|x| 10^308) 10^(dig - 308) and xd, xu divided by 10^308 then by
  10^(dig - 308).

### Doolittle factorisation (used by Types I and II)

For a symmetric k x k matrix S (k >= 2) without pivoting: unit lower triangular L and upper U with S = L U. Row i
of U (j = 1..k): U_ij = S_ij - sum over k' < i of L_ik' U_k'j. Then column i of L below the diagonal: L_ji = (S_ji -
sum over k' < i of L_jk' U_k'i) / U_ii, except that it is 0 when |U_ii| < 1e-6. Finally every entry of L and of U
with absolute value below 1e-6 is set to 0. The contrast matrix is L' (the transpose); its rows are indexed by
the columns of the matrix factorised.

### Type I

If X has no column: no hypotheses. If X has one column and the model has an intercept: no hypotheses (empty
table). If X has one column otherwise, L = [1]. Otherwise L = transpose of the Doolittle L of X'X. The hypothesis of
a term is the rows of L that belong to the term's columns. (Terms in the order of the formula; sequential sums of
squares.)

### Type II

"Containment": term A is contained in term B when every variable of A is a variable of B, B has at least one
variable more, and A and B have the same numeric (non-factor) variables. For each term, the terms containing it.

- A term contained in no other term gets the marginal hypothesis: the rows of the p x p identity for its columns.
- Any other term T: reorder the columns of X so that first come all columns that belong neither to T nor to the
  terms containing T (keeping their order), then the columns of T and of the terms containing T (in the order of
  that list of terms: T first, then the containing terms in formula order; within a term, in column order). With
  X_new this reordered matrix, take the transpose of the Doolittle L of X_new' X_new, keep its rows that belong to
  T (in the new order), and arrange its columns back in the original order of X.

### Type III

First build the full-dummy matrix rdX from the model frame (the rows used): for each term label, the columns of
the model matrix of `~ 0 + term` (all levels of each factor, as R codes a term without its marginal terms: for a
single factor one indicator per level; for factors in interaction one indicator per combination of levels, the
first factor varying fastest; numeric variables multiply), the terms in formula order; with an intercept, a first
column "(Intercept)" of ones. Columns named as R names them (`Aa1`, `Aa1:Bb2`, `x:flo`, ...). If some columns of
rdX are all 0, the message "Missing cells for: <their names, joined by ", ">." followed by two spaces, a line
break (U+000A) and "Interpret type III hypotheses with care." (the fixture has it as
`Missing cells for: Aa2:Bb3.  \nInterpret type III hypotheses with care.`).

Then:
1. If every factor of the fit is coded with treatment contrasts (the default), X_t = X. Otherwise rebuild the model
   matrix from the same terms and frame with treatment contrasts for every factor, and if it is not of full column
   rank keep the columns of a pivoted QR decomposition (LINPACK style, tolerance 1e-7) of rank r: the first r pivot
   columns, in pivot order. That is X_t.
2. L0 = zapsmall( transpose( ginv(X_t) rdX ) ): rows are the columns of rdX, columns the columns of X_t. ginv is
   the Moore-Penrose inverse by the SVD with tolerance sqrt(2^-52) times the largest singular value (MASS's ginv).
3. For the terms in decreasing order of their order (number of variables; ties in formula order), if the term is
   contained in other terms: replace the columns of L0 that belong to the term (columns of X_t) by their residuals
   from the least-squares regression on the columns of L0 that belong to the containing terms (QR-based, as lm.fit,
   tolerance 1e-7), then zapsmall them (the replaced block on its own).
4. Keep the rows of L0 whose names are column names of X_t, in the order of the columns of X_t: a square matrix
   L1 (rows and columns indexed by the columns of X_t).
5. The hypothesis of a term: the transpose of the columns of L1 that belong to the term, without the rows whose
   sum of absolute values is at most 1e-8. Rows are named by the term's columns of X_t.
6. If X_t is not X (step 1): map each hypothesis to the coding of X: multiply it on the right by
   zapsmall(ginv(X_t) X).

### messages and warnings

The anova and contest functions return R's messages and warnings: the Hessian warnings (section 1, once per fit),
"Missing cells" (Type III), "Contrast is rank deficient and test may be affected".

## 3. Comparing models (lme4's anova with several fits)

Input: two or more `lmer` results fitted to the same data object.
- If the numbers of observations differ: the error `models were not all fitted to the same size of dataset`. If
  the data objects are not the same (the same JavaScript object): the error `all models must be fit to the same
  data object`.
- Model names: given (`names`), else "MODEL1", "MODEL2", ... in the order given. Duplicated names are replaced by
  those generic names with the warning `failed to find model names, assigning generic names`.
- With `refit` (default true): every REML fit is refitted by maximum likelihood (the same model with REML false)
  and, if there was any, the message `refitting model(s) with ML (instead of REML)`. With refit false and some fits
  REML while others are not: the warning `some models fit with REML = TRUE, some not`; the log-likelihoods are then
  each fit's own (REML criterion for REML fits).
- npar of a fit = p + q + 1 (`LmerResult.df`). The rows are sorted by npar (stable: ties keep the given order).
- Columns per row: npar, AIC = -2 logLik + 2 npar, BIC = -2 logLik + log(n) npar, logLik, deviance = -2 logLik,
  Chisq = 2 max(0, logLik_i - logLik_(i-1)) (NaN in the first row), Df = npar_i - npar_(i-1) (NaN in the first
  row), Pr(>Chisq) = upper tail of chi-squared(Df) at Chisq, NaN when Df = 0 (and in the first row). A negative Df
  (fewer parameters) cannot occur after the sort.

## Accuracy

- References (fixture field `reference`) are at the exact optimum: theta solved in 128-bit arithmetic as in the
  fixture lmer, H by central differences in 128-bit arithmetic (step 1e-10; error far below 1e-15), J by central
  differences (step 1e-15). Match the reference df, t, F and p-values within 1e-9 (relative; p-values below 1e-300
  absolute) and the estimates and standard errors as in the fixture lmer. Analytic derivatives are expected; a
  finite-difference Hessian of an analytic gradient is acceptable only if it reaches that accuracy on every case.
- lmerTest's own values (the fixture's `expected`) come from lme4's approximate optimum and numerical derivatives:
  compare with them only within the case's distance to the reference (|library - expected| <= 2 |reference -
  expected| + 1e-8 relative), and compare the hypothesis matrices, term names, messages and warning texts exactly
  (the eigenvalues in the Hessian warnings are noise: compare the warning texts up to the numbers, and decide the
  warnings from your own H).
- `hessianEigenvalues` of the reference let a test check the warning rules.
