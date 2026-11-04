# Issue #512 log: pbeta left of the support with zero shape parameters

GitHub Issue #512. Session 15. Classification C (existing policy). No code change.

## Plan

- Intent: the issue reports that `pbeta(-1, 0, 2)` is 0 where R gives 1 (and 0.5 for `pbeta(-1, 0, 0)`), because `pbeta1` checks q < 0 before the point masses, the reverse of R's `pbeta_raw`.
- Method: check main and R 4.5.2, then the earlier decision. The difference is intentional: a distribution function is 0 left of its support. It was fixed by user decision in review round 17 (commit 2514938, review_fix_log_20261031_17.md) and is listed in docs/differences-from-r.md (pbeta row) and in the source comment (beta.ts, pbeta1). Close as not planned.

## Check (main `32b0bc1`)

| call | rStats.js | R 4.5.2 |
|---|---|---|
| `pbeta(-1, 0, 2)` | 0 | 1 |
| `pbeta(-1, 0, 0)` | 0 | 0.5 |
| `pbeta(-1, 0, 2, { lowerTail: false })` | 1 | 0 |
| `pbeta(0, 0, 2)`, `pbeta(0, 0, 0)` | 1, 0.5 | 1, 0.5 |

The report of R's values is right; rStats.js differs on purpose. At q = 0 the point masses at 0 count, as in R.

## Tests

- None added: `test/review17.test.ts` ("pbeta is 0 left of the support, point masses at 0 included") already checks `pbeta(-1, 0, 2)`, `pbeta(-1, 0, 0)`, `pbeta(0, 0, 2)` and `pbeta(0, 0, 0)`.

## close comment

Not planned: this is an intentional difference from R. A distribution function cannot be positive left of the support, so `pbeta(q, 0, b)` and `pbeta(q, 0, 0)` are 0 for q < 0 (R 4.5.2 gives 1 and 0.5 because it checks the point masses first); at q = 0 the point masses at 0 count, as in R (1 and 0.5). This was decided earlier (commit 2514938) and is listed in `docs/differences-from-r.md` (the `pbeta(-1, 0, 2)` row) and covered by `test/review17.test.ts`. Log: `docs/review-logs/review_fix_log_issue512.md` (<commit of #512, see git log --grep='#512'>). (Not pushed yet.)
