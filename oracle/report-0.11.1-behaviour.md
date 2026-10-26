# Fixes from an external comparison of 0.11.1 with R

An external agent compared rStats.js 0.11.1 with R 4.6.0 (webR). The differences below were confirmed with R 4.5.2
(the oracle image), which remains the reference. Each batch is one section; the fixtures named in a section hold the
new cases at the end of their case lists. Behaviour is described here, not R's code: do not read R's sources (or any
GPL package's), and do not use R's internal identifiers.

## Batch 1

### 1.1 optimize and uniroot: the ends of the interval must be finite

- `optimize(f, lower, upper)`: before anything else (and before calling `f`), `lower` must be finite (not NaN, not
  ±Inf), else the error `invalid 'xmin' value`; then `upper` must be finite, else `invalid 'xmax' value`; then
  `lower < upper`, else the existing `'xmin' not less than 'xmax'`. The order matters: `optimize(f, NaN, 1)` reports
  `xmin`, not the order of the ends. Today an infinite end makes optimize loop forever.
- `uniroot(f, lower, upper, ...)`: keep the current order of checks (the order of the ends, `f(lower)` and `f(upper)`
  evaluated and tested for NA/NaN, the extension of the interval with `extendInt`, the sign test). Then, just before
  the root search, an end that is not finite is an error: `invalid 'xmin' value` for `lower`, then
  `invalid 'xmax' value` for `upper`. So `uniroot(x => x - 0.5, 0, Infinity)` evaluates f at both ends, passes the
  sign test (f(Inf) = Inf) and then fails with `invalid 'xmax' value`; `uniroot(Math.sin, 3, Infinity)` fails earlier
  because f(Inf) is NaN (the existing f.upper message). With `extendInt`, R moves only the finite ends while
  searching for a sign change, and an infinite end still fails afterwards.
- Fixtures: `optimize` and `uniroot` (oracle/numerics.R).

### 1.2 eigen of a nonsymmetric matrix: balance first

R computes the eigenvalues and eigenvectors of a general real matrix with LAPACK's dgeev, which balances the matrix
before the Hessenberg reduction (dgebal with job "B": first permutations that isolate eigenvalues, then a diagonal
similarity scaling by powers of 2 of the rows and columns of the remaining block). The library does not balance, so a
badly scaled matrix loses most of its accuracy: for [[1, 1e8, 0], [1e-8, 1, 1e6], [0, 1e-6, 2]] (diagonally similar
to [[1, 1, 0], [1, 1, 1], [0, 1, 2]]) the eigenvalues should be 2.8019377, 1.4450419, -0.2469796 and are 2.635,
1.714, -0.348 today.

- Balance the matrix as dgebal does with job "B", then reduce and diagonalise as now, then undo the balancing on the
  eigenvectors (multiply row i by the scale factor of i, then undo the permutations in reverse order, as LAPACK's
  dgebak does), and normalise each eigenvector to unit length afterwards as now (the phase rule for complex vectors
  is unchanged).
- src/linalg/expm.ts already has a port of dgebal (LAPACK 3.12.0, modified BSD; see THIRD_PARTY_NOTICES.md) with
  jobs "P" and "S" run one after the other. Job "B" is not the same as "P" followed by "S": with "B" the scaling acts
  only on the rows and columns ilo..ihi left by the permutation step. Move the balancing to a module both files use,
  add job "B" (from the same LAPACK routine) and keep expm's results bit for bit (its fixtures must not change).
- Symmetric matrices are not balanced (R's dsyevr path does not balance).
- Fixture: `eigenGeneral` (oracle/eigen.R). Eigenvalues are compared as before; the new cases are badly scaled
  matrices (diagonal similarity with factors up to 1e8, real and complex eigenvalues, with and without vectors) and
  matrices whose zero rows or columns let the permutation isolate eigenvalues.

### 1.3 Sums and means that overflow on the way

R accumulates sums of doubles in long double (an 80-bit or 128-bit type with a much wider exponent range than
double), so an intermediate sum may exceed the largest double without overflowing; only the final result is rounded
to double. The library's double-double sums produce NaN when the high word overflows (Inf - Inf). Rules (R 4.5.2):

- `sum(x)`: the sum of all values as if accumulated without overflow, then rounded to double: ±Inf if its magnitude
  exceeds the largest double. sum([1e308, 1e308, -1e308]) = 1e308; sum([1e308, 1e308]) = Inf. NaN and ±Inf inputs
  behave as now (an Inf term gives Inf; Inf and -Inf give NaN; NaN propagates).
- `cumsum(x)`: element i is the running sum of the first i values (accumulated without overflow) rounded to double,
  so cumsum([1e308, 1e308, -1e308]) = [1e308, Inf, 1e308]. NaN propagation is unchanged.
- `prod(x)` and `cumprod(x)`: R accumulates products in long double too. prod([1e308, 10, 0.1]) = 1e308,
  cumprod([1e308, 10, 0.1]) = [1e308, Inf, 1e308], prod([1e-308, 1e-10, 1e10]) = 1e-308 (no underflow on the way).
  Today these give NaN.
- `mean(x)` (also with `trim`, which averages the kept middle values the same way): when the sum is finite as a
  double, as now (sum / n, then one correction pass with the mean of the deviations). When the sum overflows a double
  (even if the wide accumulator does not), R averages instead: the sum of x[i] / n, then a correction with the sum
  of (x[i] - m) / n. The result is the mean computed without overflow: mean([1e308, 1e308, 1e308]) = 1e308,
  mean([1.5e308, -1e308, 1.5e308]) = 6.666666666666667e307. Inf, -Inf and NaN inputs behave as now.
- `median(x)` with an even count is the mean of the two middle values by the rule above: median([1.5e308, 1.7e308])
  = 1.6e308.
- `weightedMean(x, w)`: R computes the products x[i] * w[i] in double (a product may overflow to ±Inf), drops the
  terms with w[i] = 0, sums the products by the sum rule above and divides by the sum of w (sum rule too).
  weightedMean([1e308, 1e308, -1e308], [1, 1, 1]) = 3.333333333333333e307; weightedMean([1.5e308, 1e308], [1, 1])
  = Inf (the sum exceeds the largest double, so it is Inf before the division).
- Any internal helper these functions share (src/internal/summary.ts) gets the same rule; other callers keep their
  results for finite sums. Keep the double-double accuracy where nothing overflows: no existing fixture may change.
  A way that keeps the accuracy: when the running sum overflows, redo the accumulation on values scaled by a power
  of 2 (exact), and scale back at the end.
- Fixtures: `sum`, `prod`, `mean`, `median`, `cumsum`, `cumprod`, `weightedMean` (oracle/descriptive.R).

### 1.4 Numbers as group labels: grouped by R's text of the number

R makes a factor from numbers by their text: the sorted distinct values are written with `as.character` (15
significant digits, the library's `formatR`), and values with the same text are one level. So 0.1 + 0.2 and 0.3 are
one group ("0.3"), and 1e15 and 1e15 + 1 are one group ("1e+15"). The library groups by the value itself. Rules:

- A level holds every value whose text is the same. Its value (where the library returns levels as numbers) is the
  smallest of those values (R takes the level's text from the smallest one, since the values are sorted first).
  Levels are ordered by that value. -0 and 0 remain one level.
- `table(x)`: one count per level; `values` are the levels' values as above.
- `tapply`, `split`: the groups are the levels; names and dimnames are the levels' texts as now.
- `aggregate` (formula and data frame forms): the groups are the levels; in the result, a grouping column holds the
  label of the first row (in row order) of each group, not the level's smallest value. For g = [0.1 + 0.2, 0.3, 10]
  the result's g column is [0.30000000000000004, 10].
- The same rule applies everywhere numbers become group labels or factor levels the way R's `factor()` makes them:
  the (x, g) form and formula forms of the k-sample tests (src/htest/groups.ts and its callers), and any other place
  you find. List the places you changed in your report.
- Strings and booleans are unchanged.
- Fixtures: `table` (oracle/descriptive.R), `grouping` (oracle/grouping.R), `formulaTests` (oracle/formulatests.R).

## Batch 2

### 2.1 Gamma and chi-squared distributions with an infinite shape

R has no special branch for shape = Inf; the results below are R 4.5.2's, and the library must give them. The
distribution with shape Inf (any finite scale > 0) puts all its mass at +Inf.

- `dgamma(x, Inf)` = 0 for every x that is not NaN (log: -Inf).
- `pgamma(q, Inf)`: for q < +Inf the lower tail is 0 (upper tail 1); for q = +Inf the lower tail is 1 (upper tail 0),
  with the usual log forms. Today pgamma(Inf, Inf) is NaN.
- `qgamma(p, Inf)`: the lower-tail quantile is 0 for p = 0 and Inf for every p > 0; the upper-tail quantile is Inf
  for p < 1 and 0 for p = 1 (log forms alike). Today it returns the shape-free value 1 (and qchisq 2).
- The chi-squared functions with df = Inf follow (shape df/2 = Inf, scale 2): dchisq 0, pchisq 0 below Inf and 1 at
  Inf, qchisq Inf for 0 < p (lower tail).
- A difference from R to keep and document (do not copy R): for 0 < q / scale < 1, R's pgamma(q, Inf, scale) returns
  NaN (so pchisq(q, Inf) is NaN for 0 < q < 2), while it returns the limits 0 and 1 for every other finite q. Return
  the limits (lower tail 0, upper tail 1) there too. The fixtures leave these points out; add a unit test for them.
- Fixtures: `dgamma`, `pgamma`, `qgamma`, `dchisq`, `pchisq`, `qchisq` (oracle/gamma.R).

### 2.2 tTest with equal variances and one observation in a sample

R's two-sample test needs at least 1 observation in each sample when the variances are assumed equal, and at least 2
in each when they are not; with equal variances the two samples together need at least 3. The checks, in order:
`nx < 1`, or `nx < 2` without equal variances, is the error "not enough 'x' observations"; the same for y ("not
enough 'y' observations"); then, with equal variances, `nx + ny < 3` is the error "not enough observations". The
pooled variance takes the contribution of a sample of size 1 as 0 (its sum of squares is 0). One-sample and paired
tests keep needing 2 observations. tTest([5], [1, 2, 4], { varEqual: true }) has p = 0.2697033 and is the same
as with the samples swapped (the statistic changes sign). Fixture: `tTest` (oracle/ttest.R).

### 2.3 glm: every named link in every family

R's family constructors accept, for a link given by name, any link that R's link factory knows, whatever the family:
logit, probit, cauchit, cloglog, identity, log, sqrt, 1/mu^2, inverse (and the quasi family's own rules stay as
they are). The family's list of usual links matters only for objects that are not names, which the library does not
take; a name the factory does not know is the
error "‘<name>’ link not recognised" (with the curly quotes U+2018 and U+2019). Today the library rejects a link
outside the family's usual list ("link ... not available for ... family").

- The fit then proceeds exactly as for the usual links: the family's starting means, the link's validity rules for
  eta (and the family's for mu), the step halving, the warnings. So poisson with the logit link fails while computing
  the starting linear predictor, because the logit link function rejects a mean outside [0, 1]: the error
  "Value <m> out of range (0, 1)" for the first such starting mean m in row order, written with 6 significant digits
  like C's %g (poisson's starting means are y + 0.1, so y = 1 gives "Value 1.1 out of range (0, 1)"). The
  library's logit link function must give this error wherever R's would (any mean below 0 or above 1; 0 and 1
  themselves give -Inf and Inf). Poisson with the cloglog link fails with "cannot find valid starting values:
  please specify some" (the existing message, from the validity checks).
- The AIC, deviance, residuals and the summary use the family's own functions, as now.
- Fixture: `glm` (oracle/glm.R): the new cases at the end use links outside the usual lists for each family.

### 2.4 cut with NaN among the breaks, and data without finite values

- Breaks given as a vector: R sorts them and drops NaN first, then the intervals are formed from what remains (so
  [0, NaN, 2, 4] means [0, 2, 4]; fewer than 2 remaining breaks give no interval, so every code is NaN). Duplicates
  are checked after dropping NaN.
- Breaks given as a number of intervals, when the range of the non-missing data is not finite: if there is no
  non-missing value, or the smallest value is -Inf, the error "'from' must be a finite number"; otherwise, if the
  largest value is +Inf, the error "'to' must be a finite number"; except that when every non-missing value is the
  same infinity, R fails earlier with "missing value where TRUE/FALSE needed". Empty data with a number of
  intervals is the 'from' error too. A single NaN given as the number of intervals is "invalid number of intervals"
  (as a number below 2 is today).
- Fixture: `cut` (oracle/descriptive.R).

### 2.5 cor (and cov) of matrices with fewer than 2 observations

R's correlation matrix (all three methods) is all NaN, the diagonal included, when fewer than 2 observations are
used: one row, or one complete row with use "complete.obs". With "pairwise.complete.obs" the rule applies to each
pair, the diagonal entry of a column counting that column's non-missing values. Otherwise the diagonal stays 1, as
now (also for a column with NaN under use "everything", and for a constant column, whose off-diagonal entries are
NaN). cov of one row is all NaN too. Fixtures: `corMatrix` and `cov` (oracle/descriptive.R).

### 2.6 dbinom with size = Inf

R 4.5 gives dbinom(x, Inf, p) = 0 (log: -Inf) for every x that is not NaN (non-integer x included, as for finite
sizes), except that p = 0 gives 1 at x = 0. NaN in x or p gives NaN, and p outside [0, 1] is NaN as before. pbinom
and qbinom with size = Inf stay NaN (R treats that size as invalid there). Fixtures: `dbinom` and `pbinom`
(oracle/beta.R).

### 2.7 beta and lbeta with a negative argument

R returns NaN (with a warning, which the library does not report, as for its other special functions) when either
argument is negative (beta(-1e-300, 2) is NaN). -0 counts as 0: beta(-0, b) = beta(0, b) = Inf and lbeta(0, b) =
Inf. Today the library
evaluates the analytic continuation for negative non-integers (beta(-0.5, 2.5) = -4.712). Other cases are
unchanged: beta(Inf, b) = 0, lbeta(Inf, b) = -Inf, NaN gives NaN. Fixtures: `beta` and `lbeta` (oracle/special.R).

## Batch 3

### 3.1 qr with lapack: true: qraux has min(n, p) elements

R's LAPACK QR (dgeqp3) returns one Householder scalar per reflection, so `qraux` has min(n, p) elements; for a wide
matrix the library returns p today. The LINPACK path keeps p elements. Fixture: `qr` (oracle/qr.R).

### 3.2 kappa estimated through a triangular factor: other norms become the 1-norm

When `exact` is false, R estimates the condition number through a triangular matrix in two cases: method "qr"
(the default: the R factor of the QR decomposition), and method "direct" with `triangular: true`. There:
- norm "2" is replaced by "1" (R warns "using 1-norm approximation for approximate 2-norm");
- a norm whose upper-case form is not "1", "O" or "I" ("F", "M", "E", ...) is replaced by "1" (R warns
  `norm="F" not available here; using norm="1"`);
- the infinity-norm estimate is used only for the norm written exactly "I". A lower-case "i" (and "o", "1", "O")
  gives the 1-norm estimate. (This is R's behaviour: it accepts "i" by its upper-case form but then compares the
  original string with "I".)
The library does not report these warnings (as for its other scalar functions). With method "direct" and no
`triangular`, the norm goes to the general estimate (rcond), which accepts "1", "O" and "I" in either case (as now)
and rejects any other with R's error `argument type[1]='F' must be one of '1','O', or 'I'` (with the given string in
place of F). With `exact: true` nothing changes. Fixture: `kappa` (oracle/svd.R).

### 3.3 dbeta with a = 1 or b = 1

Inside (0, 1), R's log density for shape1 <= 2 or shape2 <= 2 is (a - 1) log x + (b - 1) log1p(-x) - lbeta(a, b),
where a term with a = 1 (or b = 1) is exactly 0 and lbeta(1, 1) is exactly 0. So dbeta(x, 1, 1, log = true) is
exactly 0 (the library gives 2.6e-17 today) and dbeta(x, 1, 1) exactly 1. Make the exact cases exact without
changing the accuracy elsewhere: no existing dbeta (or lbeta) fixture case may change. Fixture: `dbeta` (oracle/beta.R).

### 3.4 findInterval with fewer than 2 break points

R decides the boundary cases with two separate rules, not by clamping the index into [1, n - 1]:
- a value left of the first point (or at it, with leftOpen) is 0, or 1 with `allInside` (or with `rightmostClosed`
  when it equals the first point);
- a value at or right of the last point (right of it, with leftOpen) is n, or n - 1 with `allInside` (or with
  `rightmostClosed` when it equals the last point).
With n = 1 both rules can apply: for vec = [1], allInside gives 1 for x = 0 and 0 for x = 1 and x = 2. With an empty
vec every value that is not NaN gives 0 (allInside or not). NaN gives NaN as now. For n >= 2 nothing changes.
Fixture: `findInterval` (oracle/descriptive.R).

### 3.5 Argument checks of tabulate, pretty, mad and approx

- `tabulate(bin, nbins)`: nbins is truncated towards 0 (2.5 -> 2, 2.9 -> 2, -0.5 -> 0, giving an empty result); a
  negative value after truncation is the error "invalid 'nbin' argument"; NaN is the error "missing value where
  TRUE/FALSE needed"; a value of 2^31 or more (Inf included) is the error "attempt to make a table with >= 2^31
  elements". Today a non-integer nbins throws "Invalid array length" and a negative one returns [].
- `pretty(x, { n, minN })`: after dropping the values of x that are not finite (an empty remainder returns []
  whatever n is, as now), R converts n and minN to integers by truncation towards 0 and checks them in this order:
  n NaN, outside the 32-bit integer range (|n| >= 2^31) or negative after truncation is the error "invalid 'n'
  argument"; then minN (default: floor(n / 3) computed from the n given, before truncation) NaN, negative after
  truncation, or greater than the truncated n is the error "invalid 'min.n' argument". So n = -0.5 is n = 0 with
  minN = -1: the minN error; n = 2.9 works as n = 2 (R gives 0, 5, 10 for x = [1, 10]); minN = 2.7 works as 2.
- `mad(x, { low or high })`: R uses the low/high rule only when the number n of values is even, and it counts the
  missing values in n unless naRm removed them. Then it takes the k-th smallest of |x - center| among the values
  that are not missing (R's partial sort drops them), with k = n / 2 (+ 1 for high); if fewer than k values are not
  missing (or k = 0, as for empty x), the error "'partial' index <k> outside bounds" (index 0 for low and 1 for
  high with an empty x). When n is odd the ordinary median of |x - center| is used, so a missing value gives NaN
  and `low` and `high` may both be true; with n even, both true is the error "'low' and 'high' cannot be both
  TRUE". The default center is the median of x (NaN if x has a missing value and naRm is false; then every
  |x - center| is missing and the even case fails with the index error). Results that are not one of these cases
  are unchanged.
- `approx(x, y, { method: "constant", f })`: f outside [0, 1], or NaN, is the error "approx(): invalid f value"
  (with the linear method f is not checked). The same for `approxfun` if the library has it.
- Fixtures: `tabulate`, `findInterval`, `mad` (oracle/descriptive.R), `pretty` (oracle/pretty.R), `approx`
  (oracle/numerics.R).

### 3.6 prcomp: rank and tol

New options of `prcomp`, R's `rank.` and `tol`:
- `rank`: the number k of components to keep. It must be one finite number whose integer part is positive, else an
  error (R's messages: "is.finite(rank.) is not TRUE", "as.integer(rank.) > 0 is not TRUE"); k = min(trunc(rank),
  n, p).
- `tol`: after the singular values are divided by sqrt(max(1, n - 1)) (the standard deviations), the components
  whose standard deviation is at most tol times the first one are dropped: the kept number is the count of sdev
  greater than sdev[0] * tol, if that is below k.
- Only `rotation` (p x k) and `x` (n x k) are cut to the kept components; `sdev` keeps all min(n, p) values, as in R.
- Fixture: `prcomp` (oracle/matrix.R).

### 3.7 factanal: scores

A new option `scores`: "none" (default), "regression" or "Bartlett"; any other string is an error. Scores need the
data: with `covmat` the error "requested scores without an 'x' matrix". With scores, the result has `scores`, an
n x factors matrix (array of rows), one row per observation:
- z: the data standardised by column (mean 0, standard deviation 1 with denominator n - 1); L: the final loadings
  (rotated, columns sorted and signed as in the result); R: the correlation matrix of the data; u: the uniquenesses.
- "regression" (Thomson's): z R^-1 L.
- "Bartlett": with W = diag(1 / u), z W L (L' W L)^-1.
- No factor covariance enters for the varimax and promax rotations (R uses one only for rotations from another
  package).
- Fixture: `factanal` (oracle/optim.R; the oracle runs on x86_64 R).
