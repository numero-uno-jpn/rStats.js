# Issue #234 log: weighted sampling gives no interval to a weight lost in the cumulative sums

GitHub Issue #234. Session 11, judging of the issues classified C. Verdict: not planned (R's algorithm and draws; the weight is below the resolution of a uniform). No code changed; a test added.

## Plan

- Intent: check the issue's example `prob = [0.5, 0.5, 1e-16]` with and without replacement against R, and whether another order of summation could give the third category its probability.
- Method: draws and the next `runif(1)` in R 4.5.2 and rStats.js with the same seeds; 1e6 draws in R.
- Why: the policy on random numbers is to draw R's variates and leave R's stream; a change of the cumulative order would change the draws for every weighted sample.

## Check (main `7ac5ca5`, R 4.5.2)

| Call (seed 1) | R 4.5.2 | rStats.js (0-based + 1) |
|---|---|---|
| `sample.int(3, 20, TRUE, prob)`, then `runif(1)` | 2 2 1 1 2 1 1 1 1 2 2 2 1 2 1 2 1 1 2 1; 0.93470523110590875 | the same; 0.9347052311059088 |
| `sample.int(3, 1, FALSE, prob)`, then `runif(1)` | 2; 0.37212389963679016 | the same |
| `sample.int(3, 3, FALSE, prob)`, then `runif(1)` | 2 1 3; 0.90820778999477625 | the same |
| R, seed 3, 1e6 draws with replacement | 499962, 500038, 0 | |

- The issue's analysis is right about the arithmetic: the descending cumulative sums are [0.5, 1, 1], so with replacement category 3 is never drawn; without replacement it can be drawn only after the others are removed (the third draw above). R's ProbSampleReplace and ProbSampleNoReplace do exactly this, and rStats.js reproduces them (same draws, same stream).
- No order of the sums would give the category its probability 1e-16. The uniforms of the Mersenne-Twister have a resolution of 2^-32 = 2.3e-10, so an interval of width 1e-16 either contains no possible uniform (probability 0) or one (probability about 2.3e-10, two million times too large). Accumulating from the small end would only move the error, and would change every weighted draw from R's.

## Fix

- None (not planned): R's algorithm, and the policy of drawing R's random numbers.

## Tests

- `test/issue234.test.ts`: the draws and the next uniform above, with and without replacement.

## close comment

Not planned: this is R's algorithm, and the weight is below what a uniform can resolve. R's ProbSampleReplace and ProbSampleNoReplace also sort the weights in decreasing order and use their cumulative sums, so in R 4.5.2 sample.int(3, n, TRUE, c(0.5, 0.5, 1e-16)) never draws 3 either (1e6 draws: 499962, 500038, 0). rStats.js draws the same values as R and leaves the same next uniform (set.seed(1): 2 2 1 1 2 1 1 1 1 2 ..., then 0.9347052311059088; without replacement 2 1 3, then 0.9082077899947762), as the random-number policy requires. Another order of summation would not give the third category its probability: the Mersenne-Twister uniforms have a resolution of 2^-32 = 2.3e-10, so an interval of width 1e-16 holds either no possible uniform or one, giving probability 0 or about 2.3e-10, and it would change every weighted draw from R's. A test was added: test/issue234.test.ts. (Not pushed yet.)
