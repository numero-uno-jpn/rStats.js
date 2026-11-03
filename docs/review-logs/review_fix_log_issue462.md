# Issue #462 log: a one-level factor in a model without intercept

GitHub Issue #462. Session 13, judging of the issues classified C. Verdict: not planned (the claim about R is wrong; rStats.js does as R). No code changed.

## Plan

- Intent: run the issue's call on the current main and in R 4.5.2.
- Why: classified C (the issue says R's `model.matrix(~ 0 + g)` gives a 3×1 matrix of ones).

## Check (main `dfe8bd6`, R 4.5.2)

- `modelMatrix("~ 0 + g", { g: ["a", "a", "a"] })` and `lm("y ~ 0 + g", { y: [1, 2, 3], g: ["a", "a", "a"] })`: "contrasts can be applied only to factors with 2 or more levels".
- R: `model.matrix(~ 0 + g, data.frame(g = c("a", "a", "a")))`, the same with `g` a factor, and `lm(y ~ 0 + g, ...)`: the same error. R's `model.matrix.default` sets the contrasts of every factor before the indicator coding, and `contrasts<-` stops for fewer than 2 levels.

## Earlier decision

- The check follows R since the model formulas were written (`3004acf`); the R fixtures (`test/fixtures/modelMatrix.json`, `y ~ A` with one level; `test/fixtures/aovOneway.json`) record R's error.

## Fix

- None.

## Tests

- `test/issue462.test.ts`: `~ 0 + g` and `lm(y ~ 0 + g)` with one level give R's error.

## Out of scope

- None.

## close comment

Not planned: rStats.js does as R here. R 4.5.2's model.matrix(~ 0 + g, data.frame(g = c("a", "a", "a"))) stops with "contrasts can be applied only to factors with 2 or more levels" (also with g a factor, and in lm(y ~ 0 + g)), since model.matrix sets the contrasts of every factor before the no-intercept indicator coding. rStats.js gives the same error. Added test/issue462.test.ts. (Not pushed yet.)
