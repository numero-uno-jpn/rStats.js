# Formula interfaces of the tests, and missing values: the behaviour to reproduce

What R 4.5.2's formula methods of the hypothesis tests and `complete.cases` / `na.omit` do, in words, for an
implementation that must not read R's source. Fixture `formulaTests` (`oracle/formulatests.R`; format in its header
and `oracle/_anova.R`). Where this file and the fixture seem to disagree, report it.

## Easy to get wrong

1. Only the **variables of the formula** count: a row is dropped when one of them is missing, whatever the other
   columns hold (`cor.test(~ x + z)` keeps a row whose `y` is NA).
2. The group is a **factor of the remaining values**: levels sorted (numbers as numbers, strings by code point, as the
   library's other factors), unused levels gone. The first level is the test's `x`, the second its `y`.
3. `t.test`'s two-sample result renames its estimates and null value after the levels (below); no other test renames
   anything.
4. `friedman.test(y ~ w | b)` drops a row with a missing `y` **before** checking the design, so one missing value
   makes it fail with `not an unreplicated complete block design` (the matrix form drops the whole block instead).
5. `oneway.test` takes several factors and uses their interaction (combinations as groups); `kruskal.test`,
   `fligner.test` and `bartlett.test` accept one only.

## API

The existing tests gain a formula form: the first argument a formula string, the second a data frame (the library's
`DataFrame`: an object of equal-length columns, `null` or `NaN` for a missing value), the third the options of the
default form. `tTest("y ~ g", d, { varEqual: true })`, `kruskalTest("y ~ g", d)`, `friedmanTest("y ~ w | b", d)`,
`corTest("~ x + z", d, { method: "kendall" })`. The result is the default form's result for the data the formula
selects (with rule 3). A string first argument always means a formula. Unknown variables: error `object '<name>' not
found` (R's message).

Plus `completeCases(...args)` and `naOmit(x)`:

- `completeCases`: arguments are data frames or arrays, all with the same number of rows (else error `not all
  arguments have the same length`); returns one boolean per row, true when no column of any argument is missing
  there (`null`, or `NaN` in a numeric column).
- `naOmit`: for an array, the values that are not missing; for a data frame, the data frame of the complete rows
  (same columns, in order). The fixture gives R's remaining data and the 1-based row numbers it dropped (`omitted`);
  `completeCases` gives those rows.

## Formulas

- **Two samples** (`tTest`, `wilcoxTest`, `varTest`, `ansariTest`, `moodTest`, `ksTest`): `"y ~ g"`, one variable on
  each side. The group must have exactly 2 levels after the rows with a missing `y` or `g` are dropped (error
  `grouping factor must have exactly 2 levels`); the values of the first level are `x`, of the second `y`.
  `tTest` and `wilcoxTest` also take `"y ~ 1"` (one sample) and `"Pair(a, b) ~ 1"` (paired: `x = a`, `y = b`, the
  default form with `paired: true`, rows with a missing a or b dropped). An option `paired` with a formula: error
  `cannot use 'paired' in formula method`. Any other right-hand side: `'formula' missing or incorrect`.
  `tTest`, two samples: `estimateNames` `["mean in group <l1>", "mean in group <l2>"]`, `nullValueName` `"difference
  in means between group <l1> and group <l2>"` (l1, l2 the two levels).
- **k samples** (`kruskalTest`, `flignerTest`, `bartlettTest`): `"y ~ g"`; more than one variable on the right: error
  `'formula' should be of the form response ~ group`. Rows with a missing `y` or `g` dropped; then the default form
  with the values and group labels.
- **`onewayTest`** `"y ~ A"` or `"y ~ A + B + ..."`: with several factors the groups are the combinations present in
  the data, ordered with the first factor varying fastest (R's `interaction`: for levels p, q of A and u, v, w of B:
  p.u, q.u, p.v, q.v, p.w, q.w), unused combinations dropped. Rows with a missing variable dropped first.
- **Blocked designs** (`friedmanTest`, `quadeTest`): `"y ~ w | b"` with one variable on each side of `|`; anything
  else: error `incorrect specification for 'formula'`. Drop the rows where `y`, `w` or `b` is missing; then every
  (w, b) combination must occur exactly once (error `not an unreplicated complete block design`); build the matrix
  with one row per block (block levels in order) and one column per group (group levels in order) and call the
  matrix form.
- **`corTest`** `"~ x + z"`: a one-sided formula with exactly two variables (a two-sided formula: error `'formula'
  missing or invalid`; another number of variables: `invalid formula`). Rows with a missing `x` or `z` dropped.

## Accuracy

The same as the default forms (their own fixtures' rules): numbers within a relative 1e-12 of R, strings exactly,
errors with R's message. `completeCases` and `naOmit` exactly.
