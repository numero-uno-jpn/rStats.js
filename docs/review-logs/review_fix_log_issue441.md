# Issue #441 log: pivotLonger, namesSep and zero-width matches

GitHub Issue #441. Session 13, group B (user decision).

## Plan

- User decision (2026-11-03): reproduce tidyr with the same loop as R's `gregexpr` (option b of the prep).
- Intent: `separated` skipped every zero-width match, so `namesSep: "(?=[A-Z])"` did not split `fooBar` and filled the second part with null (tidyr: `foo, Bar`).
- Why this option: tidyr 1.3.2's `names_sep` is `str_split_n`, i.e. `gregexpr(sep, x, perl = TRUE)` and `regmatches(invert = TRUE)` (not stringi/ICU). Its rule is simple: after a zero-width match the search resumes one character later; it stops once the start reaches the end of the name; the pieces are the strings between the matches. Copying that loop matches tidyr in all 24 prep cases, values and warnings. The JS `split` rule (option a) differed in 14 of them (e.g. `FooBar`). The regular expression dialect stays JavaScript's (already in the docs).

## Check (main `8a55dd4`, tidyr 1.3.2 on R 4.5.2)

| name | namesSep | pieces before | after = tidyr |
|---|---|---|---|
| fooBar | `(?=[A-Z])` | fooBar, null | foo, Bar |
| FooBar | `(?=[A-Z])` (3 parts) | FooBar, null, null | "", Foo, Bar |
| abc | `""` (4 parts) | abc, null, ... | "", a, b, c |
| ab | `$` | ab, null | ab, "" |
| ab | `x*` (3 parts) | ab, null, null | "", a, b |
| a_b | `_?` (2 parts) | a, b | "", a (warning "Additional pieces discarded") |
| a b | `\b` (4 parts) | a b, null, ... | "", a, " ", b |
| score_preX | `_\|(?=[A-Z])` | score, preX, null | score, pre, X |

Edge cases (R `tidyr:::str_split_n`): `""` split by `""` gives `"", ""`, by `_` gives `""`; `a` by `""` gives `"", a`; `a` by `$` gives `a, ""`. The loop gives the same.

## Fix

- `src/descriptive/pivot.ts`, `separated`: the loop of R's gregexpr (sticky start via `lastIndex`, step one after a zero-width match, stop at the end). Separators with a width give the same pieces as before.
- `oracle/pivot-behaviour.md`: the rule in the `namesSep` item. No entry in `docs/differences-from-r.md` (the result is tidyr's).

## Tests

- `test/issue441.test.ts`: 17 tidyr cases with their warnings, and the separators with a width. With `src/` stashed, the first test fails.
- `test/pivot.test.ts` (fixtures: namesSep cases use `_` and `.`), `issue39`, `issue256`, `issue442`, `issue444`, `issue446`, `guide`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The issue comment's expectation that `""` splits `abc` into `a, b, c` is wrong; tidyr gives `"", a, b, c`.
- JS strings are UTF-16: after a zero-width match the loop steps one code unit, so `""` splits a name with an astral character (a surrogate pair) between its halves. R on Windows splits UTF-8 by bytes there, so there is no reference to match. Left as is.

## close comment

Fixed in <commit of #441, see git log --grep='#441'>. `namesSep` now splits at zero-width matches the way tidyr does (tidyr uses R's `gregexpr(perl = TRUE)`; the same loop is used here): `(?=[A-Z])` splits `fooBar` into `foo, Bar` and `FooBar` into `"", Foo, Bar`, and `""` splits `abc` into `"", a, b, c` (tidyr 1.3.2: the same, also the piece-count warnings). Note that `""` does not give `a, b, c` in tidyr. Separators with a width are unchanged. A test has been added. (Not pushed yet.)
