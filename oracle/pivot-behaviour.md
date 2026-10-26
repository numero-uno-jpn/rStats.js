# Wide and long formats (tidyr's pivot_longer and pivot_wider): the behaviour to reproduce

What tidyr 1.3.2's `pivot_longer` and `pivot_wider` do on data frames, in words, for an implementation that must not
read tidyr's source. Fixture `pivot` (`oracle/pivot.R`; format in its header and `oracle/_anova.R`; numeric columns
are written as number strings). Where this file and the fixture seem to disagree, report it.

## Easy to get wrong

1. `cols` are taken **in the order given**, not the data's order (`["t3", "t1"]` gives t3 first).
2. `".value"` in `namesTo` turns that part of the column names into **value column names**: `score_pre`,
   `score_post`, `weight_pre`, `weight_post` with `[".value", "time"]` give columns `time`, `score`, `weight`.
3. `pivotLonger` combines the selected columns into one value column: numbers with booleans give numbers (true is 1),
   numbers or booleans with strings are an error. A column with only missing values goes with anything.
4. `pivotWider` orders the new columns by **first appearance** of the names (unless `namesSort`), and its rows by
   first appearance of the id combination.
5. A cell that two rows fill: tidyr warns and makes a list column; a data frame here cannot hold one, so it is an
   error (below) unless `valuesFn` summarises the values.

## pivotLonger(data, options)

Options (tidyr's names in camelCase): `cols` (required: column names, or a function of the name returning a
boolean, which selects in the data's order), `namesTo` (`"name"`; a string or an array, which may contain
`".value"`), `namesPrefix`, `namesSep`, `namesPattern` (strings, as JavaScript regular expressions), `namesTransform`
(an object: names column → function of the string), `valuesTo` (`"value"`), `valuesDropNa` (false), `colsVary`
(`"fastest"` or `"slowest"`).

1. The selected columns, in order; none: error `` `cols` must select at least one column. ``. Their names, with a
   match of `^namesPrefix` removed.
2. The parts of each name, one per element of `namesTo`:
   - one element: the name itself, or with `namesPattern` its first capture group (no match: missing); `namesSep`
     with one element: error `` `names_sep` can't be used with a length 1 `names_to`. ``;
   - several: exactly one of `namesSep` and `namesPattern` (else error `If you supply multiple names in `names_to`
     you must also supply one of `names_sep` or `names_pattern`.`, the backticks as in the fixture's style).
     `namesSep`: split at each match of the separator into that many pieces; more pieces: the extra ones are
     dropped, with the warning `Expected <n> pieces. Additional pieces discarded in <k> rows [<i>, <j>].`; fewer: the
     missing ones are missing values (filled at the end), warning `Expected <n> pieces. Missing pieces filled with
     `NA` in <k> rows [<i>].` (i, j: 1-based positions among the selected columns; the fixture has the exact texts).
     `namesPattern`: the capture groups, as many as `namesTo` (else error `` `regex` should define <n> groups; <m>
     found. ``); no match: all missing.
   - `namesTransform` applied to its columns.
3. Without `".value"`: one value column named `valuesTo`; the keys are the name parts of each selected column. With
   `".value"`: the part at that position names the value column (columns in order of first appearance), the other
   parts are the key; the keys are the distinct key combinations in order of first appearance; a value column with
   no source for some key is missing there.
4. The type of each value column, rule 3 (error ``Can't combine `x` <double> and `y` <character>.`` with the two
   first conflicting columns; types `<double>` for numbers, `<character>` for strings, `<logical>` for booleans).
5. Result: the columns not selected (in the data's order), the name-part columns (in `namesTo` order, without
   `".value"`), the value columns. Rows: `"fastest"`: for each input row, one row per key, keys in order;
   `"slowest"`: for each key, all input rows. `valuesDropNa`: drop the rows where **every** value column is missing (with one value column: where it is
   missing).

## pivotWider(data, options)

Options: `namesFrom` (`"name"`; a column name or an array), `valuesFrom` (`"value"`; a name or an array), `idCols`
(default: every column not in `namesFrom` or `valuesFrom`, in the data's order; when given, the columns that are in
none of the three are dropped), `namesPrefix` (`""`), `namesSep` (`"_"`), `namesSort` (false), `namesVary`
(`"fastest"` or `"slowest"`), `valuesFill` (a value, or an object: value column → value), `valuesFn` (a function of the
array of values, or an object: value column → function).

1. Rows: the distinct combinations of the id columns, in order of first appearance (missing equals missing).
2. Names: the distinct combinations of the `namesFrom` columns, in order of first appearance; with `namesSort`,
   sorted by the first column, then the next (numbers as numbers, strings by code point, missing last). Each name:
   `namesPrefix` + the values joined with `namesSep` (numbers as R's `as.character`, 15 significant digits; a missing
   value as `"NA"`).
3. Several `valuesFrom`: the column names are `<value column><namesSep><name>`; `"fastest"`: all names for the first
   value column, then for the second, ...; `"slowest"`: for each name, each value column in turn.
4. Cells: the value of the row whose id combination and names combination they are; none: `valuesFill` (for that
   value column) or missing. Several rows for one cell: without `valuesFn`, error `values from '<value column>' are
   not uniquely identified; use valuesFn to summarise them` (tidyr: a warning and a list column, its text in the
   fixture); with `valuesFn`, every filled cell holds the function's result for the values of its rows (in data
   order), single ones included.
5. Result: the id columns, then the value columns in the order of step 3.

## Accuracy

Values, names and orders exactly; warnings with tidyr's texts (as the fixture).
