# Issue #321 log: jonckheereTest exact override performs an unbounded quadratic convolution

GitHub Issue #321. Session 12, group B4 (resource limits, part R3: exact computations; with #307, #308, #316 and #391).

## Plan

- User decision (2026-11-03, items 1 and 2): one array at most 2^24 entries and about 10 s on this PC, a limit per function; beyond it a RangeError with the hint "use exact: false" (as `mantelhaenTest` in #232).
- Intent: `exact: true` (DescTools variant) bypasses the default of at most 100 observations; the exact distribution convolves the Mann-Whitney distribution of each group against the later ones, sum len(dist) len(mw) multiply-adds, ending with sum n_i m_i + 1 values.
- Choice (the prep's limits): length <= 2^24 and multiply-adds <= 2^32, both computed from the group sizes before any Mann-Whitney table or convolution array is built.

## Check (main `95a8e1d`, R 4.5.2)

- The issue's three groups of 200: 3.2e9 multiply-adds, under 2^32, so it is still computed (about 7 s by the per-step time below). Larger calls ran without bound (code reading; not run). DescTools' `JonckheereTerpstraTest(exact = TRUE)` in R has no limit either (not run).
- Timing at the limit (once, on this PC): three groups of 215 (4.27e9 multiply-adds): 8.47 s.

## Fix

- `src/htest/trendTests.ts`: `MAX_EXACT_LENGTH = 2^24`, `MAX_EXACT_WORK = 2^32`; RangeError "the exact distribution of JT has L values and needs W steps, too many: use exact: false"; the `exact` option's JSDoc.
- Docs (en, ja): added to the item of #307.

## Tests

- `test/issue321.test.ts`: three groups of 216 are the RangeError (fails with src stashed: it computes); two groups of 4096 and 4097 exceed the length (excluded from the stash run) and `exact: false` still computes; three small groups keep the exact p-value 1 / 27720.
- `test/issue142.test.ts`, `test/issue322.test.ts`, `test/moreTests.test.ts`, `test/review59.test.ts` pass; tsc no errors.

## Out of scope (recorded)

- The Mann-Whitney tables come from `dwilcox1`, whose table build takes about min(m, n) m n / 2 double-double steps and is limited only by its length (2^25 entries): two groups of a few thousand stay under both limits here but the table alone would take minutes by its step count (code reading; not run; and beyond about m = n = 510 its center is unavailable, a RangeError at the end). The same applies to `wilcoxTest(exact: true)` and the public `dwilcox`/`pwilcox`/`qwilcox`; a time limit there would be a separate decision.

## close comment

Fixed in <commit of #321, see git log --grep='#321'>: the exact jonckheereTest now computes the length of the convolution of the Mann-Whitney distributions (sum n_i m_i + 1) and its multiply-adds from the group sizes before building anything; above 2^24 values or 2^32 multiply-adds (three groups of 215 take 8.5 s on the development machine), a RangeError "the exact distribution of JT has ... values and needs ... steps, too many: use exact: false". The issue's three groups of 200 (3.2e9 multiply-adds) are within the limit and still computed (about 7 s); larger calls fail at once. Results within the limit are unchanged. R (DescTools) computes these however long it takes; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue321.test.ts. (Not pushed yet.)
