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

The work is done in stages; each stage has its own section and fixture. **Stage 1a** (this version of the file):
the structure of the model (formula, `X`, `Z`, `Λ_θ`, the initial `θ` and its bounds), with nothing fitted and
nothing exported yet. Later stages (the profiled deviance at a given `θ`; the fit and its results) will be added to
this file.

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
formed as in `lm` (strings and booleans become factors; the `levels` option sets the order; levels without a row left
are dropped). A grouping variable that is numeric is also turned into a factor (rule 6 above); a numeric variable is
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

## Planned API (stage 1c; not to be implemented in stage 1a)

For orientation only:

```ts
lmer(formula: string, data: DataFrame, options?: { REML?: boolean; contrasts?: ...; levels?: ... }): LmerResult
```

with the fixed effects, their covariance matrix, the variance components, the log-likelihood and the random
effects in the result. It will be exported from a new subpath `@numero-uno-jpn/rstats/mixed`, not from the main
entry. In stage 1a nothing new is exported: the structure is an internal function, tested directly.
