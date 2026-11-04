# Issue #475 log: rweibull with shape 0 and a positive scale

GitHub Issue #475. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R 4.5.2 is wrong; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2.
- Why: classified C (the issue cites a `shape == 0` branch of R trunk's rweibull.c that draws one uniform and returns 0 or Inf).

## Check (main `c7fcff4`, R 4.5.2)

- `setSeed(1); rweibull(1, 0, { scale: 1 })`: NaN; the next `runif(1)`: 0.2655086631421 (the first uniform, so no draw).
- R: `set.seed(1); rweibull(1, 0, 1)`: NaN with the warning "NAs produced"; the next `runif(1)`: 0x1.0fe180c4p-2 (0.2655086631421). The same value and the same stream.
- The `shape == 0` branch the issue quotes is in R trunk, not in R 4.5.2. HANDOFF's policy: following future R changes is recorded only.

## Earlier decision

- Shape 0 as NaN agrees with review 19 and issues #91 and #451 (scale 0).

## Fix

- None.

## Tests

- `test/issue475.test.ts`: NaN and the next uniform as R 4.5.2.

## Out of scope (recorded)

- If a released R adopts trunk's `shape == 0` branch (0 or Inf from one uniform), rweibull may follow it then.

## close comment

Not planned: rStats.js does as R 4.5.2 here. In R 4.5.2, set.seed(1); rweibull(1, 0, 1) is NaN with the warning "NAs produced" and draws no uniform (the next runif(1) is the first uniform 0.2655087); rStats.js gives NaN and the same next uniform. The shape == 0 branch quoted in the issue is in R trunk's rweibull.c, not in R 4.5.2; following it is left until a released R has it. Added test/issue475.test.ts. (Not pushed yet.)
