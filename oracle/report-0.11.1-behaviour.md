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
