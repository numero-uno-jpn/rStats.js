# Issue #160 log: a two-column binomial response whose total overflows

GitHub Issue #160. Checked overnight (scratchpad notes); on the morning of 2026-11-03 the user chose option P1 (an error that names the cause). The plan was approved.

## Plan

- Intent: `prepareResponse` forms size = s + f. For finite counts whose total overflows (1e308 + 1e308), the proportion became s/Inf = 0, the prior weight Infinity and the starting mean NaN, and the fit stopped with "cannot find valid starting values: please specify some", which does not say why.
- Method: in `prepareResponse`, where both counts of a row are finite and their total is not, throw a RangeError naming the row and the counts: "the total of successes and failures overflows in row 1 (1e+308 + 1e+308): the binomial size must be a finite double".
- Why: user decision (P1). The proportion could be formed as (s/2)/(s/2 + f/2), but the binomial size is the prior weight that the deviance, the AIC and the covariance are proportional to, and it is not a double; R stops as well. Option P2 (fit with the weights divided by 2^k and scale every result back) needs the scale threaded through glmSummary, glmPredict, glmConfint and glmAnova, and the scaled-back deviance can overflow anyway.

## Check (main `b8c56cf`; R 4.5.2)

| Call | R 4.5.2 | Before | After |
|---|---|---|---|
| `glm([0, 1], [[1e308, 1e308], [1e308, 1e308]], { family: "binomial" })` (the issue's example) | "cannot find valid starting values: please specify some" | the same | "the total of successes and failures overflows in row 1 (1e+308 + 1e+308): the binomial size must be a finite double" |
| rows (1, 2), (1.5e308, 5e307), binomial or quasibinomial | | the same as R | the error for row 2 |
| rows (1e300, 1e300), (1e300, 2e300) (totals in range) | coefficients (1.68e-16, -0.6931471805599456), deviance 0 | (1.6724474962166484e-16, -0.6931471805599456) | unchanged (same bits) |

- Both R and rStats.js stop; only the message differs, so nothing is added to docs/differences-from-r.md.

## Fix

- `src/models/glmFamily.ts` (`prepareResponse`, two-column response): the check after the sizes are formed.

## Tests

- `test/issue160.test.ts`: the error for the issue's example (row 1) and for a second row that overflows (quasibinomial), and the coefficients of a fit with totals in range, with their bits from before. With src stashed, the error test fails and the other passes.
- Whole suite `npx vitest run`: 284 files, 2614 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## Recorded as out of scope

- The fit with totals near 1e300 (in range) gives the deviance -1.48e269 and the warning "step size truncated due to increasing deviance" (R: 0). That is the cancellation in the binomial deviance (#161), handled there.
- Prior weights times sizes can overflow too: rows (1e300, 1e300), (1e300, 2e300) with weights 1e10 stop with "the matrix contains NaN or infinite values" (the prior weight w s is Infinity). Not part of this issue.

## close comment

Fixed in <commit of #160, see git log --grep='#160'>: where the two counts of a row of a two-column binomial response are finite but their total overflows, glm now stops with "the total of successes and failures overflows in row 1 (1e+308 + 1e+308): the binomial size must be a finite double", instead of forming the proportion 0, the prior weight Infinity and the starting mean NaN and stopping with "cannot find valid starting values: please specify some" (R 4.5.2 gives that message too). The proportion itself could be formed, but the binomial size is the prior weight that the deviance, the AIC and the covariance are proportional to, and it is not a double, so the fit is not attempted. Totals in range are unchanged. Test: test/issue160.test.ts. (Not pushed yet.)
