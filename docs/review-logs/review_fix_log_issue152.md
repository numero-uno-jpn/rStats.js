# Issue #152 log: dmultinom where the total of the counts overflows

GitHub Issue #152. Checked overnight; the options were left for a decision in commit `cf369c8` (then in Japanese, no code change). On the morning of 2026-11-03 the user chose option A (NaN on both the linear and the log scale). The plan was approved.

## Plan

- Intent: the issue says that the total 2e308 of `dmultinom([1e308, 1e308], [0.5, 0.5])` overflows and the result is NaN, while the true value is about 5.64e-155. In fact the linear value was 0 and the log NaN: the two scales disagreed, and neither was right.
- Method: in `dmultinom`, return NaN where the total N of the counts is infinite (each count is finite, as checked before). An impossible outcome (a positive count in a category of probability 0) is tested first and stays exactly 0 (log -Inf), since that value is exact.
- Why: user decision (option A). The same handling is used for dnbinom where size + x overflows (reviews 22 and 55, #65, #151) and for dhyper's m + n (review 55). That is the policy for the integer range beyond 2^53: NaN rather than an inexact value. Review 23's log (MULTINOM-COUNT-01) already intended NaN here, but the implementation gave 0 on the linear scale. Totals in range do not reach the new line, so their bits are unchanged. Option B (compute the value without forming N) would make dmultinom alone answer where dnbinom and dhyper give NaN.

## Check (main `b716765` overnight, `1550ed4` for the fix; R 4.5.2)

| Call | R 4.5.2 | Before (linear, log) | After (linear, log) | True |
|---|---|---|---|---|
| dmultinom([1e308, 1e308], [0.5, 0.5]) (the issue's example) | error (as.integer gives NA: "missing value where TRUE/FALSE needed", warning "NAs introduced by coercion to integer range") | 0, NaN | NaN, NaN | 5.641895835477563e-155, log -355.17046926400775 (the central binomial limit sqrt(2/(pi N)), correction O(1/N)) |
| dmultinom([1e308, 1e308], [0.3, 0.7]) | error | 0, NaN | NaN, NaN | log about -1.74e307 (the linear 0 was right) |
| dmultinom([1e308, 1e308, 1], [1, 1, 1]) | error | 0, NaN | NaN, NaN | |
| dmultinom([1e308, 1e308], [1, 0]) (impossible) | error | 0, -Inf | 0, -Inf | 0 |
| dmultinom([1e308, 7e307], [0.5, 0.5]) (total 1.7e308, in range) | error | 0, -2.6609719389104684e306 | unchanged | R's dbinom(1e308, 1.7e308, 0.5, log) = -2.6609719389104751e306 (relative 3e-15) |
| dmultinom([1e300, 1e300], [0.5, 0.5]) | error | 5.641895835477563e-151, -345.96012889203143 | unchanged | agrees |

- The linear 0 came from `dbinomRawDD(xk, nmx, ...)` (the product of successive binomials in `src/distributions/multinomial.ts`) returning 0 where the total overflows; the log was NaN. N was used only to compare with `size`.
- R's dmultinom converts x with as.integer, so every count above 2^31 - 1 is an error. R gives no value to compare at this scale, so nothing is added to docs/differences-from-r.md.
- The table of review 23's log (MULTINOM-COUNT-01) gives the true value of `dmultinom(c(1e308, 1e308), prob = c(1, 1))` as "0 (underflow)". That is wrong: 5.64e-155 is representable.

## Fix

- `src/distributions/multinomial.ts` (`dmultinom`): after the test for an impossible outcome, return NaN where N is Infinity.

## Tests

- `test/issue152.test.ts`: the three overflowing totals above (NaN on both scales), the impossible outcome (0 and -Inf), and the two in-range totals with their bits from before. With src stashed, the NaN test fails and the other two pass.
- Whole suite `npx vitest run`: 277 files, 2572 passed / 38 skipped; 1 failed, the known timing test of qtukey in test/extremeAccuracy.test.ts, which passes when the file is run alone (112 passed). `npx tsc --noEmit -p .`: no errors.

## Recorded as out of scope

- The MULTINOM-COUNT-01 table in review 23's log (`review_fix_log_20261031_23.md`) gives the true value as "0 (underflow)"; the true value is 5.64e-155. The log is a past record and is left as it is.
- R's dmultinom log loses digits for large counts: dmultinom(c(1e9, 1e9), c(0.5, 0.5), log = TRUE) is -10.934005737304688, while dbinom(1e9, 2e9, 0.5, log = TRUE) is -10.933997861522906. This is already in the docs ("Where R is inaccurate", the lgamma cancellation of dmultinom).

## close comment

Fixed in <commit of #152, see git log --grep='#152'>: dmultinom now returns NaN, on the linear scale as well as the log, where the total of the counts overflows (each count finite). Before, the issue's example dmultinom([1e308, 1e308], [0.5, 0.5]) gave 0 and its log NaN; the true value is about 5.641895835477563e-155 (log -355.17046926400775). This follows the handling of dnbinom where size + x overflows (reviews 22 and 55, #65, #151) and of dhyper's m + n: NaN rather than an inexact value in the integer range beyond 2^53. An impossible outcome (a positive count with probability 0) is still exactly 0. R 4.5.2 stops with an error for any count above 2^31 - 1 (as.integer gives NA). Totals in range are unchanged. Test: test/issue152.test.ts. (Not pushed yet.)
