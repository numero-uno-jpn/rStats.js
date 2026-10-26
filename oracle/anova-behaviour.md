# Analysis of variance with model formulas: the behaviour to reproduce

This file describes, in words, what R 4.5.2 (stats), car 3.1-5 and afex 1.5-1 compute, for an implementation that
must give the same results without reading their source. It was written by reading that source and checking it
against R's output. The fixtures are made by `oracle/modelmatrix.R`, `anovalm.R`, `caranova.R`, `aovstrata.R`,
`aovez.R` and `mauchly.R`; the comments at the top of each describe the fixture format. Where this file and a
fixture seem to disagree, report it instead of working around it: the fixture may be wrong.

## Easy to get wrong

1. **Terms are reordered by degree** after expansion (all main effects first, then two-way interactions, ...),
   keeping their relative order otherwise. `y ~ A:B + A` has the terms `A`, `A:B`.
2. **The variables of a term are listed in the order the variables first appear in the formula**, not in the
   order written in the term: in `y ~ B + A + A:B` the interaction is labelled `B:A`.
3. **Whether a factor in an interaction gets contrasts or indicators** depends on the terms before it (the rule in
   "Coding"). `y ~ A + A:B` codes `A` by contrasts in the main effect but `B` by contrasts and `A` by indicators in
   `A:B`; `y ~ A:B` alone codes both by indicators, so the model is rank deficient.
4. **Without an intercept** the first factor found (first term containing a factor, first such factor in it) is
   coded by indicators, and only that one.
5. **Columns of an interaction**: the first variable of the term varies fastest.
6. Sequential sums of squares come from the **pivoted** QR decomposition: aliased columns are moved to the end and
   contribute nothing; a term all of whose columns are aliased does not appear in the table.
7. `anova(fit)` and `aovSummary(fit)` differ: `anova` always has a `Residuals` row (with `NaN` mean square when
   the residual df is 0); `aovSummary` has no `Residuals` row and no `F value`/`Pr(>F)` columns when the residual
   df is 0. Neither shows the intercept row when the model has an intercept.
8. Type III tests depend on the contrasts (they test the model's own columns); type II do not.
9. Type II tests of a model with aliased columns are still computed (by model comparison); type III raise an error.
10. In an `Error()` model, the treatment columns projected onto a stratum are kept only if their **squared length
    is greater than 1e-5** (an absolute threshold).
11. afex orders the levels of **within-subject factors by first appearance in the data**, and those of between-subject
    factors sorted. Between-subject factors use sum-to-zero contrasts (`contr.sum`).
12. afex's `MSE` is the error sum of squares divided by the **corrected** denominator degrees of freedom.
13. afex's generalized eta squared sums each **distinct error term once** (see "aovEz").
14. The Huynh-Feldt epsilon is reported as computed (it can exceed 1), but **capped at 1** where it corrects the
    degrees of freedom and the p-value.
15. In Mauchly's p-value, one term of the asymptotic expansion uses the **number of measurements per subject** (the
    columns of the response), not the dimension of the contrasts tested.

## The functions

All take and return plain data, as the rest of the library. A data frame is an object of columns:

```ts
type DataFrame = Record<string, readonly (number | string | boolean | null)[] | Float64Array>;
```

| Function | R |
|---|---|
| `modelMatrix(formula, data, options?)` | `model.matrix(formula, data)` with `terms()`'s attributes |
| `lm(formula, data, options?)` | `lm(formula, data)` with `summary()`; the existing `lm(x, y, options?)` stays |
| `aov(formula, data, options?)` | `aov(formula, data)`, with or without `Error()`; the existing `aov(x, g?)` stays |
| `aovSummary(fit)` | `summary(aov(...))` |
| `anova(fit, ...fits)` | `anova(fit)` and `anova(fit1, fit2, ...)` for `lm` fits |
| `Anova(fit, { type })` | `car::Anova(fit, type = 2 or 3)` for `lm` fits |
| `aovEz(data, options)` | `afex::aov_ez(...)` and its `anova_table` |
| `mauchlyTest(y, options?)` | `mauchly.test(lm(y ~ 1 or y ~ group), X, M, idata)` |

The two existing signatures are told apart by the first argument: a string is a formula. `anova` and `Anova` are
different functions (the second is car's); macOS file systems do not distinguish case, so they must live in files
whose names differ by more than case.

Options shared by `modelMatrix`, `lm` and `aov`:

- `contrasts`: a contrast per factor, `"contr.treatment"` (default), `"contr.sum"` or `"contr.helmert"`. A name that
  is not a variable of the formula (response included; for `aov` with `Error()`, of the formula without the
  `Error()` term, so a variable that appears only inside `Error()` is absent; for `lmer`, of the fixed-effects part)
  gives the warning
  `variable 'B' is absent, its contrast will be ignored`, one per such name in the order of the `contrasts` object
  (also in `lm`, `aov` and `lmer`). A name of a numeric variable (the response too) is an error: `contrasts apply only
  to factors`. A boolean variable takes the contrast given (`contr.sum` gives the column `L1`).
- `levels`: the order of the levels of a factor (`{ A: ["c", "a", "b"] }`), as `factor(x, levels = ...)` in R
- `weights` (`lm` and `aov` only): an array parallel to the rows of `data`, or the name of a numeric column

Tables (results of `anova`, `Anova`, `aovSummary` and the tables of `aovEz`) have the form of the existing
`glmAnova` result: `colNames` (R's column names), `rowNames` (without R's padding), `table` (one array per row, `NaN`
where R prints nothing or `NA`). Every result that R can accompany by warnings has `warnings: string[]` (R's
messages, each once, in order of first appearance). Errors are thrown with R's message (except syntax errors in a
formula, which may have any message; see "Formulas").

Results must be plain objects (no classes, no functions) so that they serialise with `JSON.stringify`.

## Data and missing values

- Missing values: `null`, and `NaN` in a numeric column. A row with a missing value in any variable of the formula
  (response included) or in the weights is dropped before anything else. The results report which rows were used
  (`rows`, 0-based indices into `data`; the fixtures hold R's 1-based row numbers).
- A column of strings is a factor **formed from the rows kept** (R converts character columns with `factor()` after
  the rows with missing values are dropped): its levels are the distinct values of the rows kept, **sorted by code
  point** (this library already sorts factor levels this way; R sorts by the locale's collation, and the difference
  is documented in `docs/differences-from-r.md`). A value that occurs only in dropped rows is not a level, in
  `modelMatrix` as in `lm` and `aov`.
- A column with `levels` given is a factor with those levels (R: `factor(x, levels = ...)` before the call). `lm`
  and `aov` drop the levels that have no row left (R's `drop.unused.levels = TRUE`); `modelMatrix` keeps them (their
  indicator or contrast columns are then all zero).
- A column of booleans is coded, in a model matrix, as a factor with **always the two levels** `FALSE` and `TRUE`
  (in that order; the column names use `FALSE`/`TRUE`, e.g. `LTRUE`), even when only one of the values occurs in the
  rows kept: R keeps logical columns logical (`drop.unused.levels` does not apply to them) and `model.matrix` codes a
  logical as these two levels. A boolean column with one value is therefore not an error in `lm` or `aov`: its
  contrast column is constant, so it is aliased (coefficient `NaN`, as R's `NA`), or with indicators one column is
  all zero. (This rule is about model matrices; where a function groups the rows by a boolean column, such as the
  formula versions of the tests, the groups are the values present.)
- A column of numbers is numeric (a number that should be a factor has to be given as strings).
- A factor (strings, or `levels` given) used in a term with fewer than two levels is an error: `contrasts can be
  applied only to factors with 2 or more levels`.
- A variable that is not a column of `data` is an error: `object 'Q' not found`.
- Columns of different lengths are an error: `variable lengths differ (found for 'x')` with the name of the first
  variable whose length differs from the first variable's.

## Formulas

A formula is `response ~ right-hand side` or `~ right-hand side`. Supported:

- variable names (letters, digits, `.` and `_`, not starting with a digit or with `.` followed by a digit), and `.`
  alone, meaning every column of `data` that is not the response, in the order of the columns of `data`;
- `+`, `-`, `*`, `/`, `:`, `%in%`, `^` with a number, parentheses, and `0` and `1`;
- in `aov` only, one `Error(...)` term, whose argument is itself a right-hand side.

Anything else (function calls such as `log(x)` or `I(x^2)`, backquoted names, `offset()`) is an error. A formula
that cannot be parsed is an error whose message starts with `invalid formula` (R reports a parse error; the
fixture's case `y ~` only checks that an error is thrown).

Operator precedence and associativity are R's: `^` binds tightest, then unary `-` and `+`, then `:`, then `%in%`,
then `*` and `/` (left to right), then binary `+` and `-` (left to right).

A right-hand side expands to an ordered list of **terms**, each a set of variables, and an **intercept** flag
(initially present). Writing `L(e)` for the list of `e`:

- a variable: one term with that variable;
- `a + b`: `L(a)` followed by `L(b)`, then duplicates removed (the first occurrence stays);
- `a : b`: for each term `s` of `L(a)` in order, for each term `t` of `L(b)` in order, the union `s ∪ t`; duplicates
  removed;
- `a * b`: `L(a)`, then `L(b)`, then the terms of `a : b`; duplicates removed;
- `a ^ n`: the unions of `n` terms of `L(a)`: start from `L(a)` and `n - 1` times replace the current list by the
  unions `s ∪ t` for `s` in `L(a)` (outer loop) and `t` in the current list (inner loop), removing duplicates each
  time. `n` is truncated towards zero first (R's `asInteger`: `^2.5` is `^2`); a truncated `n` below 2 (`^1`, `^1.5`)
  is an error: `invalid power in formula`. If `L(a)` is empty, the result is empty;
- `a / b`: `L(a)`, then for each term `t` of `L(b)` the union of `t` with all the variables of `L(a)`; duplicates
  removed. So `(A + B)/C` is `A + B + A:B:C`;
- `b %in% a`: each term of `L(b)` united with all the variables of `L(a)` (and nothing else); duplicates removed.
  So `A + B %in% A` is `A + A:B`;
- `a - b`: `L(a)` without the terms that are equal (as sets) to a term of `L(b)`; `- 1` and `- 0` act on the
  intercept, see below; unary `-b` is `nothing - b`;
- `( e )`: `L(e)`;
- **An operand that expands to no terms** (`1`, `0`, `-1`, `(A - A)`, ...) in `*`, `/` and `%in%`: R builds these
  lists by appending to the list of the left operand, so **when `L(a)` is empty, `a * b`, `a / b` and `a %in% b`
  are empty** whatever `b` is (`y ~ 1 * B` and `y ~ 1/B` have only the intercept; `y ~ 0 * B` has nothing). The
  right operand is still expanded for its effect on the intercept (`y ~ 1 * 0 * B` has no intercept). When `L(b)`
  is empty and `L(a)` is not, the rules above apply unchanged: `B * 1` is `B`, `B / 1` is `B`, `B %in% 1` is `B`.
  `a : b` is empty when either list is empty, as the rule above gives.
- `1`: no term; sets the intercept, `0`: no term; removes it. Inside the right operand of a `-`, the meaning of
  `0` and `1` is reversed (so `- 1` removes the intercept and `- 0` keeps it); `y ~ -1` has no intercept and no
  terms, `y ~ 1 - 1` likewise.

Then:

1. A term consisting of the response alone stays in the list of terms (in `termLabels`, `order` and `factors`) but
   gets no columns in the model matrix, with the warnings `the response appeared on the right-hand
   side and was dropped` and `problem with term 1 in model.matrix: no columns are assigned` (with the term's 1-based
   position among the sorted terms). Interactions with the response are kept.
2. The terms are sorted by degree (number of variables), stably.
3. The **variables** of the formula are numbered in order of first appearance (response first, then left to right
   through the right-hand side as written, before expansion); within a term they are listed in that order. A
   term's label is its variables' names joined by `:`. `order` is each term's degree.

## Coding

For each term and each variable in it, a code: **contrasts** or **indicators**. For a variable `v` in term `T`,
take `T` without `v`:

- if that is empty, `v` is coded by contrasts;
- otherwise, if some term before `T` in the sorted list contains all the variables of `T` without `v`, `v` is coded
  by contrasts;
- otherwise by indicators.

(These codes are R's "factors" attribute: 1 for contrasts, 2 for indicators, 0 for a variable not in the term. They
are computed for numeric variables too, and reported, but a numeric variable always enters as its values.)

**Without an intercept**: go through the terms in order and, within each, through the variables in order; the
first factor with at least two levels found in a term is switched to indicators in that term. Only one switch is
made. (Boolean variables count as factors with two levels.)

Contrast matrices for a factor with levels `l1 ... lk` (one row per level):

- `contr.treatment`: the indicator columns of `l2 ... lk`; column names are the level names;
- `contr.sum`: `k - 1` columns; column `j` is 1 at level `j`, -1 at level `k`, 0 elsewhere; names `1 ... k-1`;
- `contr.helmert`: `k - 1` columns; column `j` is -1 at levels `1 ... j`, `j` at level `j + 1`, 0 after; names
  `1 ... k-1`;
- indicators: the `k` indicator columns; names are the level names.

The model matrix: first the intercept column of ones (`(Intercept)`) if there is one, then for each term in order
its columns: the products of one column of each of its variables (a numeric variable's only column is its values;
a factor's columns are its contrast or indicator columns), **the first variable of the term varying fastest**. A
column name joins the parts with `:`; a factor's part is its name followed by the column name of its matrix (so
`Ab`, `A1`), a numeric variable's part is its name. `assign` gives each column its term number (0 for the
intercept, 1 for the first term).

`modelMatrix` returns `colNames`, `assign`, `x` (array of rows), `rows`, `termLabels`, `order`, `intercept`,
`variables` (the variable names, response first), `factors` (one array per variable, one entry per term, the codes
0, 1, 2) and `warnings`. For a formula without terms and without intercept the matrix has no columns.

## lm and aov from a formula

The fit is the existing matrix `lm` applied to the model matrix (`src/models/lm.ts`, with its pivoting QR and its
tolerance), so `coefficients` (NaN for aliased columns), `sigma`, `rSquared` and the rest are the same quantities.
The formula form also returns `coefNames` (the model matrix's column names), `assign`, `termLabels`, `rows` and
`warnings`, and whatever `anova`, `Anova` and `aovSummary` need. A formula without intercept gives the same
`rSquared` as the matrix form without intercept.

Warning (from R's `summary()`, so `lm` from a formula gives it): `essentially perfect fit: summary may be unreliable`
when the residual variance (weighted residual sum of squares / residual df) is finite and less than 1e-30 times
(mean(f)² + var(f)), `f` the fitted values (unweighted mean and sample variance).

`aov(formula, data)` without `Error()` is the same fit; with `Error()` see "Error strata".

## anova(fit): the sequential table

Let the QR decomposition's columns, in pivoted order, be `c1 ... cr` (the `r` = rank columns that are not aliased),
and `e = Q'y` (the "effects"; with weights, of the weighted problem). The sum of squares of a term is the sum of
`e_i^2` over the columns `c_i` that belong to it; the terms appear in order of their first column among
`c1 ... cr` (which is their order in the model, aliased ones left out). The residual sum of squares is the weighted
sum of squared residuals, with `n - r` degrees of freedom (`n` counts rows of non-zero weight).

Columns `Df`, `Sum Sq`, `Mean Sq`, `F value`, `Pr(>F)`; rows: the terms, then `Residuals`. `Mean Sq` is `Sum Sq /
Df` (for `Residuals` with 0 df that is `NaN`). `F value` is a term's mean square over the residual mean square, and
`Pr(>F)` the upper tail of the F distribution on (`Df`, residual df); both empty on the `Residuals` row. When the
model has an intercept, its row is left out; without an intercept every term is shown.

Warning `ANOVA F-tests on an essentially perfect fit are unreliable` when the residual sum of squares is less than
1e-10 times the (weighted) sum of the squared fitted values.

## anova(fit1, fit2, ...): comparing models

Columns `Res.Df`, `RSS`, `Df`, `Sum of Sq`, `F`, `Pr(>F)`, rows `1, 2, ...` in the order given. `Df` and `Sum of
Sq` are the decreases of the residual df and of the RSS from the previous row (empty on the first row; they can be
negative). The scale is the residual mean square of the model with the smallest residual df (the first such if
several). `F` is `(Sum of Sq / Df) / scale`, empty when `Df` is 0 and also when it would be negative; `Pr(>F)` is
the upper tail on (`|Df|`, the residual df of that model).

- Models that were not fitted to the same number of rows: error `models were not all fitted to the same size of
  dataset`.
- Models whose response differs from the first model's (compare the response's name) are left out with the warning
  `models with response "z" removed because response differs from model 1` (R quotes with sQuote; use the curly
  quotes R uses in a UTF-8 locale: ‘z’). If only one model remains, the result is the sequential table of that
  model.

## aovSummary(fit)

For a fit without `Error()`: the table of `summary(aov(...))[[1]]`. The same rows and values as `anova(fit)`,
except that when the residual df is 0 there is no `Residuals` row and no `F value` and `Pr(>F)` columns. The
intercept row is left out.

## Anova(fit, { type }): type II and type III tests (car)

`type` is 2 or 3 (also accept `"II"` and `"III"`); the default is 2, as in car. The table has columns `Sum Sq`, `Df`, `F value`, `Pr(>F)`; rows the terms (type III: with
`(Intercept)` first when the model has one), then `Residuals` (the residual sum of squares and df). `F value` is
`(Sum Sq / Df) / (RSS / residual df)`, `Pr(>F)` the upper tail on (`Df`, residual df); both empty on `Residuals`.

Write `RSS(without S)` for the residual sum of squares of the least squares fit on the columns of the model's own
model matrix that do not belong to the terms in `S` (same weights):

- **Type II**, term `t`: let `R` be the terms that contain all the variables of `t` (other than `t`). Then
  `Sum Sq = RSS(without R ∪ {t}) - RSS(without R)` and `Df` = the rank of the second fit minus the rank of the
  first. The intercept has no row. (This is car's "marginality": each term after all others except the terms
  containing it. It does not depend on the contrasts.)
- **Type III**, term `t` (the intercept included): `Sum Sq = RSS(without {t}) - RSS(model)` and `Df` = the number
  of columns of `t`. It depends on the contrasts, which is why afex and most users set `contr.sum`.

Errors and warnings, in the order checked:

1. residual df 0: error `residual df = 0`;
2. residual sum of squares less than `sqrt(2.220446049250313e-16)` (an absolute threshold): error `residual sum of
   squares is 0 (within rounding error)`;
3. type II for a model with only the intercept: warning `the model contains only an intercept: Type III test
   substituted`, and the type III table;
4. aliased columns: type III: error `there are aliased coefficients in the model`; type II: computed as above (car
   prints a note, not a warning).

## Error strata: aov(formula, data) with Error()

`y ~ treatment + Error(e)`: the **error model** is the model `y ~ e` (with the formula's intercept or without it),
coded with `contr.helmert` for every factor (the coding does not change the result but determines which columns are
aliased); the **treatment model** is the formula without the `Error()` term, coded as usual (`contrasts` option
applies to it only).

- More than one `Error()` term: error `there are 2 Error terms: only 1 is allowed` (with the count).
- Weights: error `weights are not supported in a multistratum aov() fit`.
- If the error model's matrix is rank deficient: warning `Error() model is singular`.

Strata: take the error model's columns in their pivoted order (aliased columns left out, as in a QR decomposition
with pivoting). The first stratum is the span of the columns of the error model's first term (the intercept when
there is one), each following stratum is the span of the next term's columns orthogonal to all earlier ones, and
if the error model does not span all `n` dimensions, a last stratum `Within` is the rest. A term all of whose
columns are aliased gives no stratum. Strata are named by the error model's term labels (`(Intercept)`, `id`,
`id:W`, ... as the formula expansion labels them; `id/W` gives `id` and `id:W`) and `Within`.

In each stratum, project the response and every treatment column onto the stratum (orthogonally). Keep the
projected treatment columns whose squared length is **greater than 1e-5**, and fit the projected response on them in
order, with the same pivoting QR (tolerance 1e-7) as `lm`. The stratum's table is then the `aovSummary` table of
that fit: the terms that have columns in it (in order of their first column), and `Residuals` with the stratum's
dimension minus the fit's rank as df when that is positive (otherwise no `Residuals` row and no `F value`/`Pr(>F)`
columns). A stratum where no column is kept has only the `Residuals` row.

`aovSummary` of such a fit returns `{ strata: [{ stratum: "Error: id", colNames, rowNames, table }, ...] }` in the
order of the strata, without the intercept stratum, and `warnings`.

## aovEz(data, options): afex's repeated-measures ANOVA

Options: `id`, `dv` (column names), `between`, `within` (arrays of column names, either may be absent but not both:
error `Either between or within need to be non-NULL!`), `type` (3 default, or 2), `correction` (`"GG"` default,
`"HF"`, `"none"`), `es` (`"ges"` default, `"pes"`, or both as an array), `observed` (names of observed, not
manipulated, factors).

Data preparation, in order:

1. Between-subject columns are factors with sorted levels (strings by code point; a numeric column is converted,
   its levels its distinct values sorted as numbers). **Within-subject columns: levels in order of first appearance
   in the data** (numbers as their string form). `id`: any column, as a factor. Levels without rows are dropped.
2. A between-subject factor with one level: error `Factor "G" consists of one level only. Remove factor from
   model?` (with the name). A within-subject column of strings with one level is **not** an error (afex checks only
   columns that are already factors, and these are converted later): the design then has a single within cell, the
   rows of each id are aggregated as in step 5, and the analysis is the one "without within-subject factors" below,
   with an empty `anova` table when there are no between factors either (fixture case with `W` all `"w1"`).
3. An id that appears in more than one cell of the between-subject factors: error `Following ids are in more than
   one between subjects condition:\n` followed by those ids joined by `, `.
4. A combination of within-subject levels with no row at all: error starting `Empty cells in within-subjects design
   (i.e., bad data structure).` (R continues with a printed table; compare only this first line).
5. More than one row for an id and a combination of within levels: warning `More than one observation per design
   cell, aggregating data using `fun_aggregate = mean`.\nTo turn off this warning, pass `fun_aggregate = mean`
   explicitly.` and the cell's value is the mean of its rows.
6. Ids missing a combination of within levels (after the above) are removed, with a warning `Missing values for k
   ID(s), which were removed before analysis:\n` followed by the removed ids joined by `, ` (if there are 10 or
   more, the first 10 followed by `, ... [showing first 10 only]`), then `\nBelow the first few rows` and a printout
   of the data (compare only up to and excluding `\nBelow the first few rows`). The ids are listed sorted (the
   id's levels, code point order).

The **wide** data has one row per id (the order of the rows does not affect the results) and one column per
combination of within levels, **the first within factor varying slowest**.

**Without within-subject factors**: `lm(dv ~ B1 * B2 * ...)` on one row per id (between factors with `contr.sum`),
and `Anova(fit, { type })` as above gives `univariate` (that table, intercept row included for type III). The
`anova` table's rows are the terms: `num Df` = `Df`, `den Df` = residual df, `MSE` = residual sum of squares / `den
Df`, `F` = `F value`, then the effect sizes, then `Pr(>F)`.

**With within-subject factors**: let `Y` be the wide matrix (subjects × cells), `X` the between-subjects model
matrix of `~ B1 * B2 * ...` (intercept and `contr.sum` columns; just the intercept without between factors). A
rank-deficient `X` (an empty between cell) is an error whose first line is `Rank deficient model matrix;
insufficient data to estimate full model.` (afex continues with the aliased coefficients and a table; compare the
first line only). The same applies without within-subject factors.
Let `d` = number of subjects − rank of `X`, and `E` = `Y'(I − H)Y` with `H` the projection onto the columns of `X`.

The within design: the full factorial model of the within factors over the cells, `~ W1 * W2 * ...`, coded with
`contr.sum`, intercept included (one row per cell, in the order of the columns of `Y`). For each of its terms `w`
(intercept first, then its terms in order), let `P` be its columns (cells × `p`).

For each between term `b` (intercept first, then the terms of `X` in order), the hypothesis matrix `S_b` (a
cells × cells matrix):

- type III: `S_b = Y'(H − H_{−b})Y`, `H_{−b}` the projection onto the columns of `X` outside `b`;
- type II: for the intercept, `S = Y'H_0 Y` with `H_0` the projection onto the intercept column; for a term `b`,
  with `R` the between terms that contain all variables of `b`: `S_b = Y'(H_{−R} − H_{−R∪{b}})Y`.

Each pair (`w`, `b`) is one row of `univariate`, the outer loop over `w`, the inner over `b`. Its name is `b` when
`w` is the intercept, `w` when `b` is the intercept, else `b:w` (between label first). With `M = (P'P)^-1`:

- `Sum Sq` = trace(`P' S_b P M`), `Error SS` = trace(`P' E P M`)
- `num Df` = (number of columns of `b`, 1 for the intercept) × `p`, `den Df` = `d × p`
- `F value` = (`Sum Sq` / `num Df`) / (`Error SS` / `den Df`), `Pr(>F)` its upper tail.

`univariate` has columns `Sum Sq`, `num Df`, `Error SS`, `den Df`, `F value`, `Pr(>F)` and every row, intercept
included.

For the rows with `p ≥ 2` (within terms with more than one df), with `A = P'EP M` and `U = M P'EP`:

- `GG eps` = trace(A)^2 / (p · trace(A^2));
- `HF eps` = ((d + 1) p GG − 2) / (p (d − p GG)) (reported as is, can exceed 1);
- `Pr(>F[GG])`, `Pr(>F[HF])`: the upper tail of `F value` with both df multiplied by `GG eps`, resp. by
  min(1, `HF eps`);
- Mauchly's `Test statistic` W = det(U) / (trace(U)/p)^p and its `p-value` (as in "mauchlyTest" with `n = d`, `pp =
  p`, and the number of cells in place of the number of measurements).

`corrections` (columns `GG eps`, `Pr(>F[GG])`, `HF eps`, `Pr(>F[HF])`) and `sphericity` (columns `Test statistic`,
`p-value`) list these rows; they are absent when no row has `p ≥ 2`. If the error matrix `P'EP` of a row is of
deficient rank (fewer eigenvalues ≥ `sqrt(2.220446049250313e-16)` than `p`), the row has no corrections and no
sphericity test.

The **`anova` table** (afex's `anova_table`, without the intercept row): columns `num Df`, `den Df`, `MSE`, `F`,
the effect sizes, `Pr(>F)`.

- correction `GG`: for rows with corrections, `num Df` and `den Df` are multiplied by `GG eps` and `Pr(>F)` is
  `Pr(>F[GG])`; `HF`: multiplied by min(1, `HF eps`) and `Pr(>F)` is `Pr(>F[HF])`, with the warning `HF eps > 1
  treated as 1` if any row's `HF eps` exceeds 1 (only with this correction); `none`: unchanged.
- `MSE` = `Error SS` / `den Df` **after** the correction.
- `pes` = `Sum Sq` / (`Sum Sq` + `Error SS`).
- `ges` = `Sum Sq` / (`Sum Sq` + the sum of the distinct error sums of squares + `O` − `o`), where the distinct
  error sums of squares are one per within term `w` (the `Error SS` shared by its rows) — afex sums the distinct
  values among the rows' `Error SS`, intercept row included. With `observed` factors: `O` is the sum of `Sum Sq` over
  the rows whose name contains an observed factor's name as a whole word, and `o` is the row's own `Sum Sq` if it is
  such a row, else 0 (without `observed`, both 0). An `observed` name that is in no row's name: error `Observed
  variable not in data: G`.
- The effect-size columns come in the order `pes`, `ges` (whatever the order asked).
- Without within-subject factors, `Error SS` is the residual sum of squares for every row.

`aovEz` returns `{ anova, univariate, corrections?, sphericity?, warnings }`, the first four in the table form.

## mauchlyTest(y, options)

`y`: matrix (array of rows), one row per subject, one column per measurement (`k` columns). Options: `group`
(between-subjects labels, parallel to the rows), `idata` (a data frame with one row per column of `y`; default a
single column `index` = 1 ... k), `M` and `X` (formula strings over `idata`; defaults: `M` the identity, i.e. all
`k` dimensions, and `X` = `"~0"`, nothing).

1. `SSD` = the cross-product of the residuals from the group means (from the overall mean without `group`), with
   `n` = number of subjects − number of groups as its df.
2. The contrasts tested: a basis `T` (rows) of the part of the column space of `M`'s model matrix (over `idata`)
   orthogonal to the column space of `X`'s. If the space of `X` is not contained in that of `M`: error `X does not
   define a subspace of M`. Let `pp` be its dimension.
3. `U` = (T T')^-1 (T SSD T'); W = det(U) / (trace(U)/pp)^pp (does not depend on the choice of basis).
4. With `rho = 1 − (2pp² + pp + 2)/(6 pp n)`, `w2 = (pp+2)(pp−1)(pp−2)(2pp³ + 6pp² + 3k + 2) / (288 (n pp rho)²)`
   (note `3k`, `k` the number of columns of `y`), `z = −n rho log W`, `f = pp(pp+1)/2 − 1`:
   p-value = P1 + w2 (P2 − P1) with P1, P2 the upper tails of the chi-squared distribution with `f` and `f + 4` df
   at `z`.

Result: `{ statistic: W, statisticName: "W", pValue, method: "Mauchly's test of sphericity" }`.

## Accuracy required, and how to test

The fixtures hold R's values and, for most cases, exact references (`reference`; see the top of `oracle/_anova.R`).
A numeric cell passes if it is within a **relative 1e-12** of R's value. A cell that is not may be listed as a
known difference only if it is within a relative 1e-12 of the reference (R is the less accurate one there).

Three exceptions, and no others:

- In the columns of sums of squares, mean squares and F values (`Sum Sq`, `Mean Sq`, `RSS`, `Sum of Sq`, `Error
  SS`, `MSE`, `F value`, `F`), a cell also passes if it is within 1e-12 times the largest absolute value of that
  column of the same table (R's value, or the reference's when comparing to the reference). A sum of squares that
  is nearly 0 (an effect absent by design) is known only to the rounding of the larger ones.
- When R warns `ANOVA F-tests on an essentially perfect fit are unreliable` (the residual sum of squares is rounding
  residue), the `F value` and `Pr(>F)` cells of that table are not compared; the other cells are.
- A coefficient whose exact reference is 0 passes if its absolute value is at most 1e-12 times the largest absolute
  reference coefficient of the case; `sigma` whose exact reference is 0 passes if it is at most 1e-12 times the
  root mean square of the response (the rows used). Both happen only for exact fits.

Relative errors are taken cell by cell; tolerances relative to the largest value of a whole case are not allowed,
and the tolerance must not be loosened. Strings (names, warnings, errors) must be equal, except where this file
says to compare a prefix. NaN must match NaN (R's NA and NaN are both NaN).

Reaching 1e-12 may need more than a plain double QR where a sum of squares is a small difference of large numbers
(the fixtures include data with a mean of 1e6); the existing one-way `aov` accumulates its sums in double-double
(`src/special/dd.ts`) for this reason.
