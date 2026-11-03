# Issue #434 log: pivotLonger with a character and a numeric source column

GitHub Issue #434. Session 13, judging of the issues classified C. Verdict: not planned (not reproduced against tidyr: tidyr gives the same error). No code changed.

## Plan

- Intent: run the issue's call on the current main and with tidyr in R 4.5.2.
- Why: classified C (the report says tidyr combines them; it was not run).

## Check (main `cf2ee38`, R 4.5.2, tidyr built under 4.5.3)

- `pivotLonger({ id: [1, 2], score: [1.5, 2.5], label: ["low", "high"] }, { cols: ["score", "label"] })`: TypeError "Can't combine `score` <double> and `label` <character>."
- tidyr: `pivot_longer(data.frame(id = 1:2, score = c(1.5, 2.5), label = c("low", "high")), c(score, label))`: error "Can't combine `score` <double> and `label` <character>." The same message.
- Logical with character (`ok = c(TRUE, FALSE)`): tidyr "Can't combine `ok` <logical> and `label` <character>.", rStats.js the same.
- vctrs has no common type of double (or logical) and character, so `vec_ptype_common()` fails; the report's premise does not hold.

## Fix

- None.

## Tests

- None (test/fixtures/pivot.json has tidyr's error for double and character).

## Out of scope

- None.

## close comment

Not planned: not reproduced against tidyr. tidyr's pivot_longer gives the same error for these columns: pivot_longer(data.frame(id = 1:2, score = c(1.5, 2.5), label = c("low", "high")), c(score, label)) stops with "Can't combine `score` <double> and `label` <character>." (and likewise for logical and character), because vctrs has no common type of a number and a string. pivotLonger reproduces that error message. (Not pushed yet.)
