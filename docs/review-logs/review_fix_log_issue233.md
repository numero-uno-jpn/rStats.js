# Issue #233 log: Walker's alias table after the small queue is exhausted

GitHub Issue #233. Session 11, judging of the issues classified C. Verdict: not planned (the claim is wrong: the table is right, and it is R's). No code changed; a test added.

## Plan

- Intent: check the issue's claim that the alias table of `walkerSample` (src/random/sample.ts) gives the wrong probabilities for 199 weights 0.5 / 201 and two of 50.75 / 201.
- Method: copy the table construction into a script (scratchpad `judge_233.mts`) and compute the probability each candidate is drawn with, (min(q_t, 1) + sum over t aliased to it of (1 - q_t)) / n; sweep 20000 random weight vectors (n from 2 to 301, a tenth of the weights up to 100 times the others). Compare the draws with R 4.5.2's `sample.int` and the next `runif`.
- Why: the issue traced the loop statically and did not run it.

## Check (main `f821152`, R 4.5.2)

The issue's example: after the 199 small entries are paired, the loop runs once more (t = 199 < n - 1 = 200). By then the large entry of candidate 201 (index 200) has dropped to q = 0.75 and has moved, by `L++`, into the region that t sweeps: this is how the construction (R's walker_ProbSampleReplace) handles a large entry that becomes small. Its alias is candidate 200 (index 199), which has 1.0 left over: q = 0.75 with alias 200 for candidate 201, q = 1 for candidate 200.

| | expected | from the table |
|---|---|---|
| candidate 200 | 50.75 | 50.74999999999991 (in units of 1/201) |
| candidate 201 | 50.75 | 50.74999999999991 |
| any candidate, worst relative error | | 1.8e-15 |

The issue reads the final state as "0.75 and 1.0 rather than 1.0 and 1.0" and concludes that one candidate is short, but q is the share a slot keeps, not what a candidate receives: slot 201 keeps 0.75 and passes 0.25 to candidate 200, and the small slots pass their 0.5 to 200 or 201 as the running q decided; summed, each of the two candidates gets 50.75 slots. In the sweep of 20000 random tables, the largest error of an implied probability is 4.8e-13 / n (rounding of the running q).

Draws: `set.seed(1); sample.int(201, 20, TRUE, prob)` in R gives 201 129 201 187 201 200 201 73 37 110 165 200 89 201 200 201 200 200 20 201 and then `runif(1)` 0x1.62adb5e8p-1; `sampleInt` (0-based) gives the same values minus 1 and the same next uniform. With set.seed(2) and 1e6 draws R gives the shares 0.253504 and 0.252747 for 200 and 201 (expected 0.252488).

## Fix

- None (not planned). Changing the loop would also change the draws from R's (policy: the same random numbers as R).

## Tests

- `test/issue233.test.ts`: the 20 draws and the next uniform are R's; with 200000 draws candidates 200 and 201 each have a share within 0.005 of 50.75 / 201.

## close comment

Not planned: the alias table is right for this example, and it is R's construction (walker_ProbSampleReplace). After the 199 small entries are paired, the entry of candidate 201 has dropped to q = 0.75 and has moved into the part of the queue the loop sweeps (that is how a large entry that becomes small is handled); the extra iteration aliases it to candidate 200, which has exactly 1 left. The implied probability of each candidate, (min(q_t, 1) + sum over slots aliased to it of (1 - q_t)) / n, is 50.74999999999991 / 201 for candidates 200 and 201 and right to 1.8e-15 relative for all; in 20000 random tables the largest error is 4.8e-13 / n. R 4.5.2's set.seed(1); sample.int(201, 20, TRUE, prob) gives 201 129 201 187 201 200 ..., and sampleInt gives the same draws (0-based) and leaves the same next uniform. A test was added: test/issue233.test.ts. (Not pushed yet.)
