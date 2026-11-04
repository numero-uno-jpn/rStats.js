# Issue #476 log: ansariTest's normal approximation with ties

GitHub Issue #476. Session 13, judging of the issues classified C. Verdict: not planned (rStats.js does as R 4.5.2; the issue cites R trunk). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2, and read R 4.5.2's `ansari.test.default`.
- Why: classified C (the issue says R centres the tied statistic on m mean(a) with variance m n var(a) / N).

## Check (main `c7fcff4`, R 4.5.2)

- `ansariTest([1, 1], [1, 2], { exact: false })`: AB 4, p 0.3864762307712327 (greater 0.8067618846143836).
- R: `ansari.test(c(1, 1), c(1, 2), exact = FALSE)`: AB 4, p 0x1.8bc06ccf600b8p-2 (0.38647623077123283; greater 0.80676188461438354). A second tied case, `(c(1, 2, 2, 3, 5), c(2, 3, 3, 4, 6, 7))`: AB 16, p 0.92009506498368818 in both (to the last bit or one ulp).
- R 4.5.2's `normalize()` centres on m (N + 2) / 4 (m (N + 1)^2 / (4 N) for odd N) with or without ties, and uses the tie-corrected variance from the rle of the scores; rStats.js does the same. The m mean(a), var(a) form of the issue is R trunk's. HANDOFF's policy lists ansari among the future R changes that are recorded only.

## Fix

- None.

## Tests

- `test/issue476.test.ts`: the two tied cases to R 4.5.2's p-values (relative 1e-15).

## Out of scope (recorded)

- When a released R uses the m mean(a) centre, the normal approximation and `normalInterval()` may follow it.

## close comment

Not planned: rStats.js does as R 4.5.2 here. R 4.5.2's ansari.test centres the normal approximation on m (N + 2) / 4 also with ties and corrects only the variance: ansari.test(c(1, 1), c(1, 2), exact = FALSE) gives AB = 4, p = 0.3864762 (greater 0.8067619), the values rStats.js gives. The m * mean(a), var(a) form quoted in the issue is in R trunk; following it is left until a released R has it. Added test/issue476.test.ts. (Not pushed yet.)
