# Issue #417 log: rkumar and the reflected uniform

GitHub Issue #417. Session 13, judging of the issues classified C. Verdict: not planned (not reproduced). No code changed.

## Plan

- Intent: run the issue's call on the current main and with extraDistr in R 4.5.2.
- Why: classified C (the code already inverts at 1 - u).

## Check (main `cf2ee38`, R 4.5.2, extraDistr 1.10.0.5)

- `setSeed(1); rkumar(1, 2, 3)`: 0.597723566757975; the next uniform is the 2nd of seed 1 (0.3721).
- extraDistr: `set.seed(1); rkumar(1, 2, 3)`: 0.597723566757975 (`%a` 0x1.3208d2c68c468p-1); the next uniform is the same.
- `src/random/extra.ts` computes `qkumar1(1 - u, a, b, ...)`, i.e. Q(1 - u), since it was written (618606c); the reported 0.3126 (Q(u)) is not what the code returns.

## Fix

- None.

## Tests

- None (test/fixtures/rextradist.json has extraDistr's rkumar(10, 2, 3) for seeds 1, 42 and 20261024, run by test/random.test.ts).

## Out of scope

- None.

## close comment

Not planned: not reproduced. rkumar already inverts the distribution function at 1 - u, as extraDistr's rng_kumar: setSeed(1); rkumar(1, 2, 3) gives 0.597723566757975, the same as extraDistr's set.seed(1); rkumar(1, 2, 3) (R 4.5.2), with one uniform drawn. The seeded values are checked against extraDistr in the test fixtures. (Not pushed yet.)
