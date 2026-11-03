# Issue #348 log: lm with a positive infinite weight (duplicate of #302)

GitHub Issue #348. Session 12, group 7.

## Verdict

The same report as #302 (`lm([[], [], []], [1, 2, 3], { intercept: false, weights: [Infinity, 1, 1] })` gave residuals [NaN, 2, 3]; R's `lm.wfit` gives residuals 1 2 3). Fixed by #302: see `review_fix_log_issue302.md`.

## close comment

Duplicate of #302, fixed in <commit of #302, see git log --grep='#302'>: `lm` now throws "non-finite weights not allowed" (as `glm`) for an infinite weight, in the matrix and formula interfaces, with or without columns. Test: test/issue302.test.ts. (Not pushed yet.)
