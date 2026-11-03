# Issue #322 log: jonckheereTest with one nonempty group

GitHub Issue #322. Session 12.

## Plan

- Intent: `jonckheereTest` did not check that 2 nonempty groups remain after dropping missing pairs. With one group there is no pair of groups, JT is 0, and the exact distribution is the point mass at 0, so the p-value was 1 (with `exact: false` the variance is 0 and z NaN).
- Method: after forming the ordered groups, throw a RangeError when fewer than 2 are nonempty, with the message of the package the variant follows. Two or more nonempty groups take the old code (the same bits).

## Check (main `2323b3c`, R 4.5.2, DescTools and clinfun)

| call | R | before |
|---|---|---|
| `jonckheereTest([1, 2, 3], ["a", "a", "a"])` (the issue's example) | DescTools: error "all observations are in the same group" | statistic 0, p 1 |
| the same with `levels: ["a", "b"]`, or `[1, 2, 3, NaN]` with `["a", "a", "a", "b"]` | the same error | p 1 |
| `variant: "clinfun"`, `[1, 2, 3]` with `[1, 1, 1]`, or `[1, 2, 3, Infinity]` with `[1, 1, 1, 2]` | clinfun: error "only one group has non-missing data" | p 1 |
| `[1.1, 2.0, 2.4, 3.5]` with `[1, 1, 2, 2]`, increasing | DescTools: 4, 0x1.5555555555558p-3 | 4, 1/6 (unchanged) |

## Fix

- `src/htest/trendTests.ts`, `jonckheereTest`: the check of 2 nonempty groups. No docs entry (both packages stop with an error).

## Tests

- `test/issue322.test.ts`: the errors for both variants (one label, a level without data, a group emptied by a NaN or an Infinity, `exact: false`) and the values for two groups. With `src/` stashed, the two error tests fail.
- `test/moreTests.test.ts`, `test/issue142.test.ts`, `test/numberLevels.test.ts`, `test/review59.test.ts`, `test/scaleInvariance.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- The exact p-value of the two-group check is 1/6 here and 1/6 + 3 ulps in DescTools (unchanged by this fix).

## close comment

Fixed in <commit of #322, see git log --grep='#322'>. `jonckheereTest` now throws a RangeError when fewer than 2 nonempty groups remain after dropping missing pairs: "all observations are in the same group" (DescTools' message) or, with `variant: "clinfun"`, "only one group has non-missing data" (clinfun's). Before, JT was 0 and the exact p-value 1. Both packages stop with these errors. Two or more nonempty groups give the same values as before. (Not pushed yet.)
