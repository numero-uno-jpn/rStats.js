# Linear mixed models (lme4's lmer): the behaviour to reproduce

This file describes, in words, what lme4 2.0.6 (with reformulas, Matrix 1.7.4, R 4.5.2) computes, for an
implementation that must give the same results without reading their source. It was written by reading that source
and checking it against R's output. lme4 is GPL: implement the method from the paper below and this file, not from
lme4's code. Where this file and a fixture seem to disagree, report it instead of working around it: the fixture may
be wrong.

The method: D. Bates, M. Mächler, B. Bolker, S. Walker (2015), "Fitting Linear Mixed-Effects Models Using lme4",
Journal of Statistical Software 67(1), doi:10.18637/jss.v067.i01 (open access). Its notation is used here: the
random effects `b = Λ_θ u` with `u ~ N(0, σ² I)`, `Z` the random-effects model matrix, `θ` the covariance
parameters, `X` the fixed-effects model matrix.

The work is done in stages; each stage has its own section and fixture. **Stage 1a**: the structure of the model
(formula, `X`, `Z`, `Λ_θ`, the initial `θ` and its bounds), with nothing fitted and nothing exported. **Stage 1b**:
the profiled deviance and the penalised least-squares solution at a given `θ` (section "The profiled deviance"),
still internal. **Stage 1c**: the fit and its results, exported as `lmer` from the new area `mixed` (section "The
fit and its results").

## Easy to get wrong

1. **The random-effects terms are reordered by their number of levels**, decreasing, but only when the numbers are
   not already non-increasing; ties are then put in the **reverse** of their order before sorting. See "Order of the
   terms".
2. **`a/b` as a grouping factor becomes the terms `b:a` and `a`**, in that order and with those names (the
   variables of each term reversed, then the list of terms reversed). `a:b` written directly stays `a:b`.
3. **`(x || g)` is split into separate terms**, `(1 | g)` and `(0 + x | g)`, each with its own covariance block. With
   a factor `f`, `(f || g)` gives `(1 | g)` and `(0 + f | g)`, and the second has one indicator column **per level**
   of `f` (no intercept, so no contrasts).
4. **The left-hand side of a bar always uses treatment contrasts** (`contr.treatment`); the `contrasts` option
   applies only to the fixed-effects part.
5. **Levels of an interaction grouping factor** (`a:b`) are only the combinations present in the data, ordered by
   the level of the first factor, then of the second; the label is the two labels joined by `:`.
6. **A numeric grouping variable becomes a factor whose levels are its distinct values sorted numerically**, with
   R's `as.character` labels (15 significant digits: 0.30000000000000004 is `0.3`).
7. Aliased columns of `X` are **dropped** (not kept as NaN coefficients as in `lm`), and R reports this with a
   **message**, not a warning.
8. The check that warns about predictors on very different scales also fires for a **single** column whose standard
   deviation is above 1000 or below 0.001.

## Formulas with random-effects terms

A random-effects term is `(lhs | group)` or `(lhs || group)`. It must be a summand of the right-hand side (possibly
inside parentheses, for example `y ~ x + ((1 | g))`); elsewhere (`x * (1 | g)`) the formula may be rejected with a
SyntaxError starting with "invalid formula". The **fixed-effects part** is the right-hand side with the
random-effects terms removed; it is expanded and coded exactly as in `lm` (see `oracle/anova-behaviour.md`), including
`- 1`, `0 +`, and the `contrasts` and `levels` options. If nothing is left, the fixed part is `1` (intercept only).
A formula without response is rejected (any error). Function calls in a formula remain unsupported, as in `lm`.

`lhs` is an ordinary right-hand side (`1`, `x`, `0 + x`, `x + z`, `x * z`, `f`, `1 + x`, `-1 + x`, `x - 1`, ...),
expanded and coded as a model matrix with an intercept unless removed, with **treatment contrasts for every
factor** (whatever `contrasts` says), and the coding rule of `lm` (contrasts or indicators). The names of its
columns are the model matrix's (`(Intercept)`, `x`, `flo`, `x:z`, `LTRUE`, ...).

`group` is a variable, or an expression of variables with `:`, `/`, `*`, `+` and parentheses. It is expanded into
one or more grouping factors:

- Expand `group` as a formula right-hand side (the rules of `lm`'s terms: `a*b` gives `a`, `b`, `a:b`; `a/b` gives
  `a`, `a:b`; `(a + b)` gives `a`, `b`; terms sorted by degree; the variables of a term in order of first appearance
  in `group`). Each term is one grouping factor, named by its variables joined by `:`.
- If `group` contains `/` anywhere, reverse the order of the variables within each name (`a:b` becomes `b:a`) and
  then reverse the list. `a/b` gives `b:a`, `a`; `b/a/f` gives `f:a:b`, `a:b`, `b`.
- The term `(lhs | group)` becomes one term `(lhs | name)` per grouping factor, in that order, all with the same
  `lhs`.

`(lhs || group)` is first split by `lhs`: expand `lhs` (as a right-hand side); if it has an intercept the first new
term has the left-hand side `1`; then one term per term label `t` of the expansion, with the left-hand side
`0 + t`, in the order of the expansion. Each new term `(new lhs | group)` is then expanded by `group` as above. The
new terms take the place of the original one. Examples: `(x + z || a)` is `(1 | a)`, `(0 + x | a)`, `(0 + z | a)`;
`(0 + x || a)` is `(0 + x | a)`; `(x || a/b)` is `(1 | b:a)`, `(1 | a)`, `(0 + x | b:a)`, `(0 + x | a)` before the
reordering below.

**Labels.** Each term has a label: its left-hand side as written, a space, `|`, a space, and the grouping factor's
name: `1 | g`, `x | a`, `0 + x | a`, `x * z | a`, `-1 + x | a`, `x - 1 | a`, `1 | b:a`. The left-hand side is printed
as R deparses it: binary `+`, `-`, `*` and `%in%` with a space on each side, `:`, `/` and `^` without spaces,
unary minus and plus without a space, parentheses kept as written. The labels appear in error messages.

## The model frame

The variables of the whole formula (response, fixed part, the left-hand sides and the grouping expressions of all
bars) are taken from the data. **A row with a missing value in any of them is dropped**, as in `lm`. If no row is
left: error `0 (non-NA) cases`. An unknown variable: the same error as `lm` (`object 'Q' not found`). Factors are
formed as in `lm` (see `oracle/anova-behaviour.md`, "Data and missing values": strings become factors of the
values in the rows kept; the `levels` option sets the order and levels without a row left are dropped; a boolean
column in `X` or in the left-hand side of a bar is coded with **both** levels `FALSE` and `TRUE` even if one of them
has no row left, so `y ~ x + L + (1 | g)` with `L` always `TRUE` has a constant `LTRUE` column, aliased with the
intercept and dropped with the message of check 5). A grouping variable that is numeric is also turned into a factor (rule 6 above); a numeric variable is
still numeric where it is used outside a grouping expression (`y ~ g + (1 | g)` has a numeric column `g` in `X`).

**A grouping factor's levels** are those present in the rows kept, in level order (sorted strings by code point,
`FALSE` before `TRUE`, the `levels` option, numbers numerically). For an interaction `a:b` (and `a:b:c`, built as
`(a:b):c`), the levels are the combinations present, ordered by the level index of the first factor, then the
second, and so on; each label is the factors' labels joined by `:`.

## Order of the terms

Let `nl_k` be the number of levels of the grouping factor of term `k`, in the order of the terms after expansion. If
`nl` never increases from one term to the next, the order is kept. Otherwise the terms are sorted by `nl`
decreasing, and **terms with equal `nl` end up in the reverse of their order before sorting** (equivalently: sort
ascending by `nl` keeping ties in their order, then reverse the whole list). Examples, with `nl(a) = 3`, `nl(b) = 2`,
`nl(g) = 4`: `(1 | a) + (1 | g)` becomes `g`, `a`; `(1 | b) + (1 | a) + (x | b)` becomes `(1 | a)`, `(x | b)`,
`(1 | b)`; `(1 | g) + (1 | a) + (1 | b)` is kept.

All later quantities use this final order.

## The structure

**Grouping factors.** The distinct grouping factor names, in order of first use by the (ordered) terms, each with
its levels; each term refers to one of them (the same factor may serve several terms).

**Z.** For each term `k` in order, with `nc_k` columns in its left-hand side model matrix `M_k` (n × nc_k) and
`nl_k` levels: `nl_k × nc_k` columns, level-major: for level `l` (in level order) and then column `j` of `M_k`, the
column is `M_k[i, j]` in the rows `i` whose grouping factor is level `l`, and 0 elsewhere. `Z` is the columns of all
terms side by side; `q` is its number of columns. The fixture also gives, for each column of `Z`, the label of its
level.

**θ and Λ_θ.** Term `k` has `nc_k (nc_k + 1) / 2` parameters, the elements of a lower-triangular `nc_k × nc_k`
matrix `T_k` **in column-major order** of its lower triangle: `T[1,1], T[2,1], …, T[nc,1], T[2,2], T[3,2], …,
T[nc,nc]`. `θ` is the parameters of all terms in order. `Λ_θ` (q × q) is block diagonal: for each term, `nl_k`
copies of `T_k` along the diagonal, in the order of `Z`'s columns. The initial `θ` is 1 for the diagonal elements and
0 for the others; the lower bound is 0 for the diagonal elements and -Inf for the others; there is no upper bound.

## Checks, in this order

0. The model frame is built first, so its errors (an unknown variable: `object 'Q' not found`; no row left:
   `0 (non-NA) cases`) come before every check below, also for a formula without random-effects terms.
1. No random-effects term: error `No random effects terms specified in formula`.
2. A grouping factor (of the distinct ones) with fewer than 2 levels: error `grouping factors must have > 1 sampled
   level`.
3. Grouping factors whose number of levels is **≥ n** (the number of rows kept): error `number of levels of each
   grouping factor must be < number of observations (problems: g, h)`, listing them (in the order of the distinct
   grouping factors) separated by `, `.
4. For each term in order, if `n ≤ nl_k × nc_k`: error for the first such term, `number of observations (=8) <=
   number of random effects (=8) for term (x | g); the random-effects parameters and the residual variance (or scale
   parameter) are probably unidentifiable` (the numbers are integers, the term is its label).
5. Aliased columns of `X`: found by the pivoted QR decomposition of `lm` (tolerance 1e-7); the aliased columns are
   removed (the others keep their order), with the message `fixed-effect model matrix is rank deficient so dropping
   1 column / coefficient` (for k > 1: `dropping k columns / coefficients`).
6. Scales: among the columns of `X` (after step 5) whose values are not all 0 or 1, take each one's standard
   deviation `s_i` (denominator n − 1). If `|log s_i| > log 1000` for one of them, or `|log(s_i / s_j)| > log 1000`
   for two of them, warn `Some predictor variables are on very different scales: consider rescaling. \nYou may also
   use (g)lmerControl(autoscale = TRUE) to improve numerical stability.` (the text as given, with a newline after
   `rescaling. `).

Messages and warnings are reported separately (R distinguishes them). Rank deficiency of `Z` is not checked.

## The fixture lmerTerms (`oracle/lmerterms.R`)

The comment at the top of the oracle describes the fields. The data frames are written as in the analysis-of-variance
fixtures (`test/helpers/anova.ts` reads them: `dataFrameOf(args.data, args.dataTypes)`); `levels` and `contrasts`
are optional arguments as in `lm`. `z` and `lambda` are sparse triplets `[row, column, value]` (1-based); for
`lambda` the value is the 1-based index into `θ`.

Everything in this fixture is exact: integers, labels, and copies of the data (and products of data values in `Z`
and `X`). The comparison is equality, with no tolerance, except that error messages for formulas R cannot parse only
need to start with "invalid formula" (as in the `modelMatrix` test).

## The profiled deviance (stage 1b)

For a given `θ` (any finite values, of the length of the structure's `θ`; values below the lower bounds are
accepted, as lme4's deviance function accepts them), with `n` the number of rows kept, `p` the number of columns of
`X` (after dropping aliased columns) and `q` the number of columns of `Z`:

- `Λ_θ` is filled from `θ` by the layout of stage 1a.
- The **penalised least-squares** problem: minimise `‖y − Xβ − ZΛ_θ u‖² + ‖u‖²` over `β` and `u` (the paper's
  equations (13)–(19)). Its minimiser `(β̂, û)` is unique (the matrix `Λ_θ' Z' Z Λ_θ + I` is positive definite for
  every `θ`, and `X` has full column rank after stage 1a). The random effects are `b = Λ_θ û`.
- `rss = ‖y − Xβ̂ − ZΛ_θ û‖²`, `ussq = ‖û‖²`, `prss = rss + ussq`.
- `logDetL = log det(Λ_θ' Z' Z Λ_θ + I)` (twice the log determinant of its Cholesky factor `L_θ`).
- `logDetRX = log det(X'X − X'ZΛ_θ (Λ_θ'Z'ZΛ_θ + I)⁻¹ Λ_θ'Z'X)` (twice the log determinant of the paper's `R_X`).
- The **ML deviance** (`REML = false`): `logDetL + n (1 + log(2π prss / n))`. This is −2 times the log-likelihood
  maximised over `β` and `σ` at this `θ`.
- The **REML criterion** (`REML = true`): `logDetL + logDetRX + (n − p)(1 + log(2π prss / (n − p)))`.

The fill-reducing permutation `P` of the paper only affects sparsity; the values do not depend on it, and a dense
implementation is acceptable at this stage. **Measure and report** the time of one evaluation for a few sizes, for
example crossed random intercepts `(1 | subject) + (1 | item)` with 50 × 40 and 200 × 100 subjects × items (one row
per pair), and `(x | subject)` with 1000 subjects × 10 rows: whether a sparse Cholesky decomposition is needed will be
decided from these numbers.

Easy to get wrong here:

1. `p` is the number of columns of `X` **after** aliased columns were dropped.
2. `u` is the **spherical** random effects; `b = Λ_θ u` is what is called the random effects later (`ranef`).
3. A `θ` with zeros on the diagonal (a singular `Λ_θ`) is valid: the deviance is still finite.

### The fixture lmerDeviance (`oracle/lmerdev.R`)

The comment at the top of the oracle describes the fields: arguments `formula`, `data` (with `dataTypes`), `REML`,
`theta`; expected `deviance`, `beta`, `u`, `b`, `rss`, `ussq`, `prss`, `logDetL`, `logDetRX` from lme4, and
`reference` with the same fields computed in 200-bit arithmetic. lme4's values are within 4e-13 (relative to the
largest element of each vector) of the reference in every case.

Accuracy required: each value must be within the tolerance of **R's value or of the reference value** (either one):
`deviance`, `rss`, `ussq`, `prss`: relative 1e-12; `logDetL`, `logDetRX`: absolute `1e-12 × max(1, |value|)`;
`beta`, `u`, `b`: each element within `1e-12 ×` the largest absolute element of the reference vector. No known
differences are expected.

## The fit and its results (stage 1c)

### API

```ts
lmer(formula: string, data: DataFrame, options?: LmerOptions): LmerResult
```

`LmerOptions`: `REML` (boolean, default `true`), and `contrasts` and `levels` as in `lm` (stage 1a). `LmerResult`
(names of the fields as given here; each documented):

| Field | Meaning (R) |
|---|---|
| `formula`, `REML` | the formula; whether the REML criterion was optimised |
| `nObs`, `rows` | the number of rows used; their 0-based indices in `data` |
| `theta` | the estimate of θ (`getME(fit, "theta")`) |
| `fixefNames`, `fixef` | the columns of X and the fixed effects β̂ (`fixef(fit)`) |
| `coefTable` | `{ estimate, stdError, tValue }` (`coef(summary(fit))`; p-values come in a later stage) |
| `vcov` | the covariance matrix of β̂ (`vcov(fit)`), array of rows |
| `sigma` | the residual standard deviation (`sigma(fit)`) |
| `varCorr` | one entry per random-effects term, in the structure's order: `{ group, columns, sd, corr }` (`VarCorr(fit)`) |
| `ranef` | one entry per grouping factor, in the structure's order: `{ group, levels, columns, values }`, `values` one array per level (`ranef(fit)`) |
| `fitted`, `residuals` | `fitted(fit)`, `residuals(fit)` (one per row used) |
| `logLik`, `df`, `AIC`, `BIC` | `logLik(fit)` and its `df`, `AIC(fit)`, `BIC(fit)` |
| `deviance`, `REMLcrit` | `deviance(fit, REML = FALSE)` and `REMLcrit(fit)` (both are defined for either kind of fit) |
| `singular` | `isSingular(fit)` |
| `messages`, `warnings` | as in stage 1a, plus the message below |

### The fit

The criterion `d(θ)` is the REML criterion (`REML = true`) or the ML deviance of stage 1b. The estimate of θ
minimises it subject to the lower bounds (0 for the diagonal elements of each `T_k`, none for the others).

**The fixture's reference is the exact minimiser**, not lme4's value: lme4's optimiser stops when its own
tolerances are met, typically 1e-9 to 1e-5 (relative) from the minimiser in θ. The implementation must converge to
the minimiser to nearly full precision: at the solution the gradient of `d` with respect to the free elements of θ
must vanish to rounding error, which needs an accurate gradient (for example the analytic derivative of the profiled
criterion; finite differences of `d` in double precision only locate the minimiser to about 1e-6). **An element
whose minimiser is on its bound is exactly 0** (it is on the boundary when the derivative of `d` with respect to it
at 0 is positive). Start from the structure's initial θ; the minimiser in the fixture is the one lme4 converges to
from there. How to optimise is not prescribed (a bound-constrained quasi-Newton method followed by Newton steps on
the free elements is one way). If the optimisation fails, throw an error.

### The results at θ̂

With `n`, `p`, the penalised least-squares solution `(β̂, û)`, `b = Λ_θ̂ û`, `prss`, `R_X` of stage 1b at θ̂:

- `sigma = sqrt(prss / (n − p))` for REML fits and `sqrt(prss / n)` for ML fits.
- `vcov = sigma² (R_X'R_X)⁻¹`; `stdError` the square roots of its diagonal; `tValue = fixef / stdError`.
- `varCorr`: for term `k`, `Σ_k = sigma² T_k T_k'` (`T_k` filled from θ̂ as in stage 1a); `sd` the square roots of
  its diagonal, `corr[i][j] = Σ_k[i][j] / (sd_i sd_j)` (1 on the diagonal, also where `sd_i` is 0; a 1 × 1 term
  has `corr` `[[1]]`; off the diagonal, NaN where an `sd` is 0, as R's 0/0). `group`
  is the grouping factor's name, `columns` the term's columns. Terms are listed separately even when they share a
  grouping factor (`(1 | g) + (0 + x | g)` has two entries, both with group `g`).
- `ranef`: for each grouping factor (in the order of the structure's groups), the rows are its levels and the
  columns are the columns of all the terms that use it, in term order (`(1 | g) + (0 + x | g)` gives the columns
  `(Intercept)`, `x`); the values are the elements of `b` for that level and column.
- `fitted = Xβ̂ + Zb`, `residuals = y − fitted`.
- `deviance` = `logDetL + n (1 + log(2π prss / n))` and `REMLcrit` = `logDetL + logDetRX + (n − p)(1 + log(2π prss
  / (n − p)))`, both at θ̂ whichever criterion was optimised. `logLik = −REMLcrit / 2` for REML fits and
  `−deviance / 2` for ML fits; `df = p + (length of θ) + 1`; `AIC = −2 logLik + 2 df`; `BIC = −2 logLik + log(n) df`.
- `singular`: true if a diagonal element of some `T_k` is below 1e-4. Then the message `boundary (singular) fit: see
  help('isSingular')` is added to `messages` (after the messages of the structure).
- lme4's convergence warnings ("Model failed to converge ...") concern its optimiser stopping early and are **not**
  reproduced.

### The fixture lmer (`oracle/lmer.R`)

The comment at the top of the oracle describes the fields. `expected` holds lme4's values, `reference` the values
at the exact minimiser (with `newtonSteps`, for information). The fixture **lmerMore** (`oracle/lmermore.R`) has more
cases in the same format and is tested the same way; among them, `y ~ cond + (1 | subj/cond)` (ML) has its optimum
on the boundary although lme4 stops inside (so lme4's `singular` and `messages` differ from the reference's: the
reference is right), and `y ~ x + (1 | subj)` (REML) has its optimum just inside the boundary (θ ≈ 0.0099), where the
criterion is very flat. The fixture **lmerBoundary** (`oracle/lmerboundary.R`) has 16 more cases with small group
variances, whose optima are on the boundary or just inside it.

Accuracy required, against `reference`: `logLik`, `AIC`, `BIC`, `deviance`, `REMLcrit`: relative 1e-12 (they are
insensitive to small errors in θ̂). `theta`, `fixef`, `stdError`, `tValue`, `vcov`, `sigma`, `varCorr` (`sd`, and
`corr` absolute), `ranef` values, `fitted`, `residuals`: within 1e-9 × the largest absolute value of the reference
vector or matrix (`sigma` relative). Elements of θ that are 0 in the reference must be exactly 0. `singular`:
equal to the reference's. `messages`: lme4's messages without `boundary (singular) fit: see help('isSingular')`, then
that message if the reference is singular. `df`, the names and levels, and `warnings`: equal to lme4's.

Against `expected` (lme4): the criterion of the fit must not be worse than lme4's (`d(θ̂) ≤ d(θ_lme4) + 1e-10
|d(θ_lme4)|`, with `d(θ_lme4)` lme4's `REMLcrit` or `deviance`), and the test log should print the largest
relative difference from lme4 of each field (they show how far lme4 stops from the minimiser; they are not checked).

### Exporting: the new area `mixed`

`lmer` and its option and result types are exported from a new area, **not** from `src/index.ts` (the single-file
bundle stays as it is):

- `src/entries/mixed.ts` (first line: a comment naming the area, as in the other entry files).
- `package.json` `exports`: `"./mixed"` like the other subpaths; `scripts/bundle.mjs` `AREAS`: add `"mixed"`.
- Every export has a doc comment with `@category Mixed models` (a new, 15th category: add it to the list in
  `test/categories.test.ts` and to `categoryOrder` in `typedoc.json`, after "Generalized linear models"), an
  `@example` whose `// value` comments are checked by `test/docExamples.test.ts`, and the sentence
  `` Equivalent to `lme4::lmer()` in R. `` (see `test/rNames.test.ts` for the exact form).
- Tests and scripts that collect the exports of the areas must include `mixed`, and those that assume everything is
  in `src/index.ts` must be adapted: `test/docExamples.test.ts` (examples run with the exports in scope),
  `test/demo.test.ts` (list `lmer` in `NOT_IN_DEMO_YET`), `scripts/r-index.mjs` and the pages it generates
  (`docs/r-functions.md`, `docs/ja/r-functions.md`, with a Japanese description in `docs/ja/r-functions.json`;
  `test/rIndexDoc.test.ts` checks they are current), `scripts/size.mjs`. TypeDoc's configuration and the other
  documents are updated separately (not part of this stage).

### Measure and report

The time of the fits of the fixture's cases, and of the three sizes of stage 1b (dense implementation; the sparse
factorisation comes in a later stage).

## Sparse computation (stages S1 and S2)

The dense implementation of stages 1b and 1c takes time of order q³ and memory of order q² (a fit with 1000
subjects of `(x | s)`, q = 2000, takes about 100 s; lme4 takes 0.07 s; with 5000 subjects the q × q arrays alone need
800 MB). These stages make the computation sparse **without changing the results**: every existing fixture
(lmerDeviance, lmer, lmerMore, lmerBoundary) must still pass with its current tolerances.

**What is sparse.** `A = Λ_θ'Z'ZΛ_θ + I` is sparse: two columns of `Z` overlap only where their levels share rows.
The block of the first term is block diagonal (one `nc × nc` block per level, as the paper notes), so models with one
grouping factor, or nested factors, have no fill-in at all with a suitable ordering; crossed factors fill in only
the blocks of the later terms. The paper's method: a sparse Cholesky factorisation `L L' = P A P'` with a
fill-reducing permutation `P` (the values do not depend on `P`, only the rounding does). Nothing of size q × q or
n × q is stored densely; the memory is of the order of the nonzeros of `Z`, `A` and `L`.

**The gradient.** The analytic gradient of stage 1c needs the entries of `A⁻¹` only where `A` (or its factor) has
nonzeros: the *selected inverse*, computable from the sparse factor by Takahashi's recurrences, without forming
`A⁻¹`.

**Clean room for this part.** Do not read CHOLMOD, CSparse (LGPL), Matrix (GPL) or lme4 code. Published papers and
textbook descriptions may be used (elimination trees, supernodes, Takahashi, Erisman and Tinney (1973), the minimum
degree and AMD papers). The AMD ordering of SuiteSparse is BSD-licensed and may be ported (the project allows BSD
sources), with its licence noted in the file header as for other ported code.

**Checks of the sparse implementation.**

- The current dense implementation (`profiledDeviance` and its gradient as of commit ab36471) is moved to
  `test/helpers/` as a **reference implementation**: it agrees with the 128- and 200-bit references to about 1e-15.
  A regression test compares the sparse implementation with it on larger data than the fixtures, built in the test
  with a seeded generator (for example crossed `(1 | s) + (1 | i)` with 60 × 30, `(x | s)` with 300 subjects × 8,
  a three-level nesting `(1 | a/b/c)`, `(x | s) + (1 | i)` crossed, and a `||` model), at several θ, REML and ML:
  deviance within a relative 1e-13, `beta`, `u`, `b`, the gradient within 1e-11 × the largest absolute value of the
  dense result; and full `lmer` fits within 1e-9 (θ and the other fields, as the fixture tolerances) of a fit that
  uses the dense reference.
- Speed (one fit on the Mac mini; the data built by a script in `scripts/`, not part of the test suite):

  | Model | n | q | lme4 | Target |
  |---|---|---|---|---|
  | `y ~ x + (1 \| s) + (1 \| i)`, 200 × 100 crossed | 20000 | 300 | 0.17 s | ≤ 0.5 s |
  | the same, 500 × 200 | 100000 | 700 | 1.8 s | ≤ 6 s |
  | `y ~ x + (x \| s)`, 1000 subjects × 10 | 10000 | 2000 | 0.07 s | ≤ 0.5 s |
  | the same, 5000 subjects × 10 | 50000 | 10000 | 0.34 s | ≤ 3 s |

Stage **S1**: the profiled deviance (`profiledDeviance` without the gradient) sparse, with its regression test and the
time of one evaluation at these sizes. Stage **S2**: the gradient (selected inverse) and the fit; speeding up the
optimisation itself (for example reusing the Hessian across accepted Newton steps) is allowed if lmerMore and
lmerBoundary still pass.
