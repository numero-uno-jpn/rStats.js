# Issue #335 log: phyper's upper tail where x + 1 rounds back to x

GitHub Issue #335. Session 12, judging of the issues classified C. Verdict: not planned (the policy for integers beyond 2^53, 5ea5add for #118). No code changed.

## Plan

- Intent: re-check the report on the current main through the public API and compare with R 4.5.2.
- Why: classified C (an existing policy); the verdict needs the behaviour confirmed by running it.

## Check (main `7033ff3`, R 4.5.2)

- `phyper(2^53, 2^54, 2^54, 2^54, { lowerTail: false })`: NaN, not P[X >= x]. The lower tail and `qhyper(0.5, 2^54, 2^54, 2^54)` are NaN as well.
- The support [0, 2^54] has integers that doubles cannot hold, so the policy recorded in HANDOFF (integers beyond 2^53: NaN instead of a wrong value; dhyper, phyper and qhyper since 5ea5add, #118) applies before directTail() is reached.
- R: `phyper(2^53, 2^54, 2^54, 2^54, lower.tail = FALSE)` gives 0.5, which is not the true value either (0.5 minus half the point mass, about 4e-9).

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: the call does not return P[X >= x]. phyper(2^53, 2^54, 2^54, 2^54, { lowerTail: false }) is NaN on the current main, as are the lower tail and qhyper for these parameters: by the library's policy (5ea5add, for #118), a hypergeometric distribution whose support goes beyond 2^53 returns NaN instead of a value computed from rounded integers. R's phyper gives 0.5 here, which also misses the point mass at the mean. (Not pushed yet.)
