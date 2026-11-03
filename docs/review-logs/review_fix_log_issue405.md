# Issue #405 log: setSeed(-2147483648)

GitHub Issue #405. Session 13, judging of the issues classified C. Verdict: not planned (not reproduced against R: R rejects it as well). No code changed.

## Plan

- Intent: run the call on the current main and in R 4.5.2.
- Why: classified C (the report says R accepts it; it was not run).

## Check (main `cf2ee38`, R 4.5.2)

- `setSeed(-2147483648)`: RangeError "seed must be a 32-bit integer".
- R: `set.seed(-2147483648)`: warning "NAs introduced by coercion to integer range", then error "supplied seed is not a valid integer". -2147483648 is NA_integer_ in R, so R's integer seeds are -2147483647 to 2147483647, which is what setSeed accepts.
- `set.seed(-2147483647); runif(2)` in R and `setSeed(-2147483647); runif(2)` here: the same values (0x1.1fc0a66ep-1, 0x1.26b7601ap-1).

## Fix

- None.

## Tests

- `test/issue405.test.ts`: -2147483648 is rejected; -2147483647 gives R's stream. They pass on the current main.

## Out of scope

- None.

## close comment

Not planned: not reproduced against R. In R, -2147483648 is NA_integer_, and set.seed(-2147483648) fails with "supplied seed is not a valid integer" (R 4.5.2), so R's seeds run from -2147483647 to 2147483647. setSeed accepts the same range and rejects -2147483648, as R; setSeed(-2147483647) gives R's stream. A test has been added. (Not pushed yet.)
