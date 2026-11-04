# Issue #507 log: ansariTest's x / s tied distinct observations

GitHub Issue #507. Session 15, group A2. Fixed: the interval and estimate of `ansariTest` rank x / s against y (`scaledStatistic` in `src/htest/ansariTest.ts`); for a finite trial ratio s, x / s can overflow to Infinity or fall to 0, and `rank` then ties distinct observations, which changes AB(s).

## Plan

- Intent: AB(s) should use the true order of x / s against y.
- Method: when s is finite and positive and some finite x gives x / s not finite, or below the normal range with x not 0, rank by keys (sign, binary exponent, significand in [1, 2)) of x / s and y, which compare as x / s would with an unbounded exponent range (the significand quotient rounds as x / s does in range). Average ranks for equal keys. Otherwise `rankNaNLast` as before (K3, same bits).
- Why: the order is all AB(s) needs. Falling to 0 is the same root (a quotient out of range): it changes AB(s) when the collapsed values straddle the middle of the ranks (signs on both sides of 0), so the same fallback covers it. R 4.5.2 is wrong in the same way (K2), documented.
- The reviewer's claim that the interval changes is not right for the issue's data: R and rStats.js give NaN limits ("samples differ in location"); the estimate is what changes.

## Reproduction (main `53ee5d7`, R 4.5.2)

| data (exact, confInt) | R | before | after | same order, no overflow |
|---|---|---|---|---|
| x = 1e-308, 1.2e308, 1.3e308, 1.4e308, 1.5e308; y = 1.1e308 | estimate 0.6363636, CI NA | 0.6363636363636364, NaN | 1.3181818181818183, NaN | (1e-308, 1.2, ..., 1.5; 1.1): 1.318181818181818, NaN (R 1.318182) |
| x = -2e-160, -1e-160, 1e-160, 2e-160, 1e140; y = 5e-150, -5e-150 | CI [2e-11, 4e-11], estimate 3e-11 | [2e-11, 4e-11], 3e-11 | NaN, 3e-11 | (1e-140 for 1e140; also -2, -1, 1, 2, 1e20 against ±5e10): NaN, 3e-11 (R NA) |

In the second case x / s for s near 1e289 is ±0 for the four small x, tied at ranks 2 to 5 (scores 3.5 each, AB 15 instead of 13).

## Fix

- `src/htest/ansariTest.ts`: `key`, `split`, `compareKeys`, `orderedRanks`, used by `scaledStatistic` only in the case above. docs (en, ja): a row after #506's.

## Tests

- `test/issue507.test.ts`: both cases against the data of the same order without overflow. With `src/` stashed both fail.
- All test files that use `ansariTest` (9 files) pass.

## Out of scope (recorded)

- The candidate ratios x_i / y_j themselves can overflow or underflow (two distinct ratios both 0 give the trial s = 0; the largest times 1.01 can be Infinity). Then s is not finite and positive, and the old path is kept. Not changed here.

## close comment

Fixed in <commit of #507, see git log --grep='#507'>. ansariTest now ranks x / s against y with a comparison that keeps the order when x / s overflows or falls below the normal range for a finite s. For the issue's data what changed is the estimate, not the interval (both R and rStats.js give NA/NaN limits, "samples differ in location"): it is now 1.3182 (before 0.6364, as R 4.5.2), the same as for c(1e-308, 1.2, 1.3, 1.4, 1.5) against 1.1. Falling to 0 is the same root: x = (-2e-160, -1e-160, 1e-160, 2e-160, 1e140), y = (5e-150, -5e-150) gave the interval [2e-11, 4e-11] (as R) and now NaN, as data of the same order without underflow. The difference from R is documented in differences-from-r. Other data keep their values. A test was added: test/issue507.test.ts. (Not pushed yet.)
