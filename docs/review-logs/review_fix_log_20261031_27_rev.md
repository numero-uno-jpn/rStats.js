# Revision of review 27: lmerContest with NaN in L or rhs

## Plan
- Intent: `lmerContest` rejected an infinite L or rhs but returned NaN rows for NaN, against criterion K1 and the
  "non-finite values are errors" approved in review 27.
- Decision: D15 (session 14, `prep/errors.md` question 1, recommended option (a)).
- Form: the two existing checks (L in `contrastRows`, rhs in `lmerContest`) test `Number.isFinite`. The NaN paths of
  `tTestOf` and `lmerFTest` are left as they are (internal; no public NaN reaches them from lmerContest now).

## Original decision
- Review 27 (`review_fix_log_20261031_27.md`): the user approved "non-finite values are errors", but only ±Inf was
  made an error, to keep a test of `test/lmerTest.test.ts` that matched lmerTest's NA for a NaN contrast.

## Gap with the current criteria
- K1: NaN arguments of a model test are errors (the exception for NaN rows is only the new data of predictions).
- With a NaN rhs, lmerTest keeps the estimate, SE, df and interval and gives t and p NA; rStats.js made the whole row
  NaN, another difference that now goes away.

## Reproduction (sleepstudy, `Reaction ~ Days + (1 | Subject)`, lmerTest with R 4.5.2, from `prep/errors.md`)
| call | lmerTest | rStats.js before | now |
|---|---|---|---|
| `contest(L = c(NaN, 1), joint = FALSE)` | a row of NA | a row of NaN | RangeError "L must not contain NaN or infinite values" |
| `contest(L = matrix(c(NaN, 1), 1))` | a row of NA | F NaN | RangeError |
| `contest(c(0, 1), joint = FALSE, rhs = NaN)` | estimate 10.47, SE 0.804, df 161, t and p NA | a row of NaN | RangeError "rhs must not contain NaN or infinite values" |
| `contest(matrix(c(0, 1), 1), rhs = NaN)` | NumDF 1, DenDF 161, the rest NA | NaN | RangeError |

## Fix
- `src/models/lmerTest.ts`: the L and rhs checks; messages "L/rhs must not contain NaN or infinite values".
- Docs (en, ja): the lmerContest item now says NaN or infinite L or rhs is an error, with lmerTest's values.

## Tests
- `test/rev27.test.ts`: NaN in L (joint, several rows, per row) and NaN rhs (scalar, per row) throw; a finite contrast
  is unchanged. Fails with src stashed.
- `test/review27.test.ts`: the messages of the infinite cases updated. `test/lmerTest.test.ts`: the NaN contrast test
  now expects the error. lmer test files pass; the lmerTest fixture has no NaN contrast.

## Out of scope (recorded)
- None.
