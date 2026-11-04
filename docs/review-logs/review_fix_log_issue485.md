# Issue #485 log: rgeom with prob 1 and the random stream

GitHub Issue #485. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R is wrong; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2.
- Why: classified C (the issue says R's `rgeom(1, 1)` draws no uniform, so the next `runif(1)` is 0.2655087).

## Check (main `c7fcff4`, R 4.5.2)

- `setSeed(1); rgeom(1, 1); runif(1)`: 0, then 0.37212389963679016.
- R: `set.seed(1); rgeom(1, 1); runif(1)`: 0, then 0x1.7d0e0c2cp-2 (0.37212389963679016). R's rgeom computes rpois(exp_rand() ((1 − p) / p)) for p = 1 too, so it draws; the stream is the same as in rStats.js.

## Fix

- None.

## Tests

- `test/issue485.test.ts`: 0 and R's next uniform.

## Out of scope

- None.

## close comment

Not planned: rStats.js does as R here. In R 4.5.2, set.seed(1); rgeom(1, 1); runif(1) gives 0 and then 0.3721239, not 0.2655087: R's rgeom draws exp_rand() also for prob = 1 (rpois of mean 0 then gives 0), so the stream advances. rStats.js gives 0 and the same next uniform (0.37212389963679016), as the shared R stream requires. Added test/issue485.test.ts. (Not pushed yet.)
