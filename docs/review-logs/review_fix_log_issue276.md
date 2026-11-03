# Issue #276 log: pearsonTest counts an observation whose pnorm rounds to 1 in the last class

GitHub Issue #276. Session 12, judging of the issues classified C. Verdict: not planned (the user's decision in #46, recorded in docs). No code changed.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `pearsonTest([...Array(99).fill(0), 1e6])`: P 1174.26, p 5.132990738321748e-246.
- R (nortest `pearson.test`): P 1176.13, p 2.03e-246. The outlier falls in class k + 1, which `tabulate(..., nbins = k)` drops, so R's counts sum to n - 1 while the expected counts are for n.
- The behaviour is the user's decision in #46 and is recorded in docs/differences-from-r.md (the `pearson.test` row: "counted in the last class: 1174.26"). The source comment at the clamp says the same.

## Fix

- None (not planned).

## Tests

- None (#46's tests cover it).

## Out of scope

- None.

## close comment

Not planned: counting an observation whose fitted pnorm rounds to 1 in the last class is deliberate (decided in #46). nortest's pearson.test drops it (tabulate ignores class k + 1), so its class counts sum to n - 1 against expected counts for n: for 99 zeros and 1e6, R gives P 1176.13 (p 2.03e-246), rStats.js 1174.26 (p 5.13e-246). The difference is listed in docs/differences-from-r.md, and the comment at the clamp states it. (Not pushed yet.)
