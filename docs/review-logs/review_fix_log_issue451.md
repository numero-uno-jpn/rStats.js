# Issue #451 log: rweibull with scale 0 and an invalid shape

GitHub Issue #451. Session 13, judging of the issues classified C. Verdict: not planned (an intentional difference decided in review 19, documented; the same report as #91). No code changed.

## Plan

- Intent: run the issue's calls on the current main through the public API and in R 4.5.2, and compare with the earlier decision.
- Why: classified C (reproduced, but the behaviour is the decision of review 19).

## Check (main `dfe8bd6`, R 4.5.2)

| call | rStats.js | R | next `runif(1)` after `setSeed(1)` |
|---|---|---|---|
| `rweibull(2, 0, { scale: 0 })` | NaN, NaN | 0, 0 | 0.2655086631421 in both (0x1.0fe180c4p-2, the first uniform: no draw) |
| `rweibull(2, -1, { scale: 0 })` | NaN, NaN | 0, 0 | same |
| `rweibull(2, NaN, { scale: 0 })` | NaN, NaN | 0, 0 | same |

- The report reproduces; neither draws a uniform, so the stream is R's.

## Earlier decision

- Review 19 (user decision; `docs/review-logs/review_fix_log_20261031_19.md`): `rgamma` and `rweibull` with a shape that defines no distribution are NaN also with scale 0 (R's own d, p and q functions are NaN there).
- Issue #91 (`docs/review-logs/review_fix_log_issue91.md`): the same report, closed as not planned; it notes that shape 0 is NaN too (`shape > 0`).
- `docs/differences-from-r.md`, Random numbers: "Random generators with parameters that define no distribution give NaN where R draws or returns 0: `rgamma` and `rweibull` with a negative (or NaN) shape and scale 0 ...".
- Tests: `test/review19.test.ts`.

## Fix

- None.

## Tests

- None (test/review19.test.ts).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference (the same report as #91). A shape of 0, a negative shape or NaN defines no Weibull distribution, so rweibull returns NaN for it also with scale 0, where R returns 0; R's own dweibull, pweibull and qweibull give NaN for these parameters. As in R no uniform is drawn, so the random stream after the call is R's. This was decided in an earlier review and is listed in docs/differences-from-r.md ("Random generators with parameters that define no distribution"). (Not pushed yet.)
