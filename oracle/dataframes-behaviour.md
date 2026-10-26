# Data frame operations (merge, subset, rbind, cbind): the behaviour to reproduce

What R 4.5.2's `merge` (`merge.data.frame`), `subset` (`subset.data.frame`), `rbind` and `cbind` of data frames do,
in words, for an implementation that must not read R's source. Fixture `dataFrames` (`oracle/dataframes.R`; format
in its header and `oracle/_anova.R`; numeric columns are written as number strings, a missing value as `"NA"` or
`null`). Where this file and the fixture seem to disagree, report it.

## Easy to get wrong

1. `merge` with `sort` (the default) orders the result by the key, but with **several key columns and neither
   `all.x` nor `all.y`** by the keys **joined as text** (case 11: 10 before 2 before 9); with `all.x` or `all.y` it
   orders by the key columns as values (numbers as numbers).
2. Missing keys match each other (NA with NA), and sort last.
3. The order of rows that share a key (and the order without `sort`) comes from R sorting row indices with a
   **Shell sort that is not stable** (below); reproduce it exactly, it shows with 9 or more rows.
4. Columns other than the keys that occur in both inputs get the suffixes (`.x`, `.y` by default).

## API

- `merge(x, y, { by, byX, byY, all, allX, allY, sort, suffixes })` (R's defaults: `by` the column names common to
  both, in x's order; `byX = byY = by`; `all` false; `allX = allY = all`; `sort` true; `suffixes` `[".x", ".y"]`).
  Returns a `DataFrame`. A `by` naming no column: error `'by' must specify a uniquely valid column`; `byX` and
  `byY` of different lengths: `'by.x' and 'by.y' specify different numbers of columns`. (No common columns, `by`
  empty: the cross join, every x row with every y row, x varying fastest.)
- `subset(data, keep, { select })`: `keep` a boolean per row, or a function of the row object returning a boolean;
  a `null`, `NaN` or missing result counts as false (R's `subset` drops NA conditions). `select`: the column names to
  keep, in the order given. Columns otherwise unchanged.
- `rbind(...frames)`: data frames with the same column names, matched by name (the result has the first frame's
  order); otherwise error `names do not match previous names`. `cbind(...frames)`: the columns side by side, all
  frames with the same number of rows (error `arguments imply differing number of rows: <n1>, <n2>` otherwise); a
  name that occurs twice is an error here (`duplicate column name '<name>'`), since an object cannot hold two
  columns of the same name (R allows it).

## merge, step by step

1. Key of a row: with one key column, its value; with several, the values joined with `"\r"` as text (numbers as R's
   `as.character`: up to 15 significant digits, `"NA"` for a missing value).
2. `common` = the x keys (in x's row order, duplicates kept) that occur among the y keys. For each x row, `ix` = the
   position (1-based) of the first element of `common` equal to its key, 0 if none; the same for each y row (`iy`,
   positions in the same `common`).
3. Sort `ix` together with the row numbers 1..nx by the following Shell sort (Knuth's increments), and likewise `iy`:
   `h = 1`; while `h ≤ n/9` (integer division): `h = 3h + 1`; then for `h` = that value, then `h = h/3` (integer
   division) down to 1: for i = h ... n − 1 (0-based): take value v and row r at i; j = i; while j ≥ h and value[j −
   h] > v: move position j − h to j, j −= h; put v, r at j.
4. In the sorted order, the rows with value 0 come first: they are the unmatched rows (`x.alone`, `y.alone`, in that
   sorted order). Then for each distinct value, every pair (x row, y row) of the x rows and y rows with that value,
   x rows in the outer loop, both in the sorted order: the matched pairs.
5. Result rows: the matched pairs; then, with `allX`, the unmatched x rows (y columns missing); then, with `allY`,
   the unmatched y rows (x columns missing, the key columns from y). Columns: the keys (named as in x), x's other
   columns, y's other columns; a non-key name present in both gets `suffixes[0]` on the x side and `suffixes[1]` on
   the y side; a y column named like a key gets `suffixes[1]`.
6. With `sort`: reorder the rows stably by the key (rule 1; missing keys last); text compared by code point, as the
   library's other string orders.

## Accuracy

Values, names and order exactly.
