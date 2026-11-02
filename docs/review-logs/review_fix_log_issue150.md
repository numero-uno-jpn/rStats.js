# Issue #150 log: pchisq's lower Poisson-mixture sum with an index beyond 2^53

GitHub Issue #150. Prepared overnight (decisions_linalg_misc.md, Q3); on the morning of 2026-11-03 the user chose option A: not planned, with only a test that the issue's example ends (as #22). No limit on the number of terms is added. The plan was approved.

## Plan

- Intent: the issue says that `pchisq(2^-1030, 2, ncp = 1e308)` can loop without end in `sumLower`, because for j near 5e307 `j - 1 === j` and the loop has no MAX_TERMS guard.
- Method: check first, in a copy of src with a count of evaluations that throws beyond 3e6 (scratchpad `src150/`, `i150.ts`), so that a hang cannot occur. Then add a test of the issue's example to the suite.
- Why: user decision (option A), as for #64. The claim does not reproduce, and option B (MAX_TERMS and a `j - 1 === j` stop in sumLower) would add branches that are not reached.

## Check (main `d243b76`, R 4.5.2)

| Call | R 4.5.2 | rStats.js |
|---|---|---|
| `pchisq(2^-1030, 2, ncp = 1e308)` | 0 | 0 (51 ms in the counting copy, 4251 counted steps in all) |
| same, `log.p = TRUE` | -Inf | -5.000000000000001e307 |
| same, `lower.tail = FALSE` | 1 | 1 |

- Why it ends: `argmax` and `farEdge` move the start to the peak of the weighted terms (j near 4.9e288 here, not near mu), and `negligible` stops the sum after two terms. Where `j - 1 === j`, the sum still ends once the terms stop growing.
- Sweep in the counting copy: q in 9 values (2^-1074 to 1) x ncp in 8 values (1e16 to 1e308) x df in 5 values x the 4 combinations of tail and log, 1440 calls. None stopped, threw or gave NaN.
- The log value is better than R's -Inf. The correctly rounded value is -5e307 (log P = -ncp/2 + log(q/2) + ...); the 1 ulp difference was recorded in #64.

## Fix

- None (not planned).

## Tests

- `test/issue150.test.ts`: the issue's example in the three forms above. It runs in milliseconds. It passes before and after, since no source changed.
- Whole suite `npx vitest run`: 275 files, 2568 passed / 38 skipped, 0 failed. `npx tsc --noEmit -p .`: no errors.

## close comment

Not planned: this does not reproduce, as for #64. pchisq(2^-1030, 2, ncp = 1e308) ends in milliseconds and gives 0 (log -5.000000000000001e307, upper tail 1; R gives 0, -Inf and 1). The lower mixture sum does not start near mu: argmax and farEdge move the start to the peak of the weighted terms (j near 4.9e288 for this input), and the negligibility test stops the sum after two terms. Where j - 1 === j the sum still ends once the terms no longer grow. A copy of the source that counts its steps and throws beyond 3 million ran this input and a sweep of 1440 calls (q from 2^-1074 to 1, ncp from 1e16 to 1e308, five df, both tails, linear and log); none stopped, threw or gave NaN. Since no input reaches the loop condition the issue describes, no guard was added. A test of the issue's example was added: test/issue150.test.ts. (Not pushed yet.)
