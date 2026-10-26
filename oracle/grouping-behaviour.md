# Grouped summaries (tapply, split, aggregate): the behaviour to reproduce

What R 4.5.2's `tapply`, `split` and `aggregate` do, in words, for an implementation that must not read R's source.
Fixture `grouping` (`oracle/grouping.R`; format in its header and `oracle/_anova.R`; in the expected data frames,
numeric columns are written as number strings). Where this file and the fixture seem to disagree, report it.

## Easy to get wrong

1. **Order of groups with several factors:** the first factor varies fastest (a.u, b.u, c.u, a.v, ...), in
   `tapply`'s cells, `split`'s names and `aggregate`'s rows alike.
2. **Missing values:** a missing group label drops the row everywhere. Missing values of the summarised variable
   are passed to the function by `tapply`, `split` and the data-frame form of `aggregate` (so `mean` gives NaN), but
   the formula form of `aggregate` drops every row with a missing value in any variable of the formula, the
   left-hand side included (`. ~ g` therefore drops rows where any summarised column is missing).
3. **Empty combinations:** `tapply` keeps them as cells (NaN); `split` keeps them as empty groups unless `drop`;
   `aggregate` leaves them out.
4. Levels: the sorted distinct non-missing values (numbers as numbers: 1, 2, 10; strings by code point), as the
   library's other factors.

## API

- `tapply(x, index, fun)`: `x` an array, `index` one array of group labels or an array of such arrays (one per
  factor), `fun` a function of an array. Result `{ dim, dimnames, values }`: `dim` the number of levels of each
  factor, `dimnames` the levels, `values` the cells in R's order (column-major: the first factor fastest). When
  every non-empty cell's result is a single number, `values` are numbers and empty cells are NaN; otherwise each
  cell is the function's result (an array) and empty cells are `null`.
- `split(x, f, { drop, sep })`: `x` an array or a `DataFrame`, `f` labels or an array of label arrays. Result: a
  `Map` from group name to the values (an array) or the rows (a `DataFrame`), in R's order (a plain object would
  move integer-like keys first). One factor: the levels present. Several: every combination of their levels, named
  by joining the levels with `sep` (default `"."`), empty ones included unless `drop: true`.
- `aggregate(formula, data, fun)` and `aggregate(x, by, fun)`: the formula form with `"y ~ g"`, `"y ~ g + h"`,
  `"cbind(y, z) ~ g"` (several summarised columns) and `". ~ g"` (every column of `data` not on the right). **The
  grouping variables are all the variables of the right-hand side, in order of first appearance; its operators do
  not matter** (R takes them from the model frame): `y ~ A:B`, `y ~ A*B`, `y ~ A/B`, `y ~ (A + B)^2`, `y ~ A %in% B`
  and even `y ~ A + B - A` group by `A` and `B`; `y ~ B:A` by `B` then `A`; `y ~ 0 + A` by `A`; `y ~ .` by every
  column other than the summarised ones; `y ~ 1` has no grouping variable and gives one row (the summary of all the
  rows used, without a grouping column). The
  data-frame form with `x` a `DataFrame` of the columns to summarise and `by` an object of group-label columns
  (its keys name them). Result: a `DataFrame` with the grouping columns first (named as in the formula or `by`,
  values as in the data: strings or numbers), then one column per summarised column; one row per non-empty
  combination, in the order of rule 1. `fun` returns a number, or the same number k > 1 of values for every
  group: an object of numbers `{ m, s }` (R's named vector) gives the columns `y.m`, `y.s`, a plain array the columns
  `y.1`, `y.2`, ... (R's flattening of its matrix column). Results of different lengths: error `fun must return
  values of the same length for every group` (R would make a list column).

## Accuracy

Numbers within a relative 1e-12 of R (the summaries are the library's own `mean`, `median`, `sd`, ...), names,
orders and missing cells exactly.
