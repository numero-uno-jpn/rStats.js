# Issue #167 log: Poisson working weight 0 for a mean of 1e-320

GitHub Issue #167. Fixed together with #159, #165, #166 and #168 (option A1, the user's decision of 2026-11-03); the plan, the checks, the fix and the tests are in review_fix_log_issue168.md.

## Summary

- `glm([[]], [0], { family: "poisson", intercept: false, offset: [Math.log(1e-320)] })`: muEta^2 = 1e-640 underflows, so the weight W = mu was 0. R 4.5.2 clamps the mean and the weight to 2.2e-16, which is wrong.
- After the fix: W = 1e-320 (sqrt(w) mu^(1/2), squared), equal to the fitted mean to a few units of 2^-1074; also for the means 1e-170, 1e-200, 1e-300.
- Test: `test/issue167.test.ts` (fails with src stashed).

## close comment

Fixed in <commit of #168, see git log --grep='#167'>: where muEta^2, V(mu) or w muEta^2 is outside the normal range, the working weight is now sqrt(w) |c| mu^((2a - p)/2) from muEta = c mu^a and V = mu^p, so for the Poisson log link sqrt(w mu). The issue's empty model now has the working weight 1e-320, the fitted mean (was 0; R clamps both to 2.2e-16). Elsewhere the bits are unchanged (all 154 glm fixture cases). Recorded in docs/differences-from-r.md. Details in review_fix_log_issue168.md (the same change fixes #159, #165, #166, #168). Test: test/issue167.test.ts. (Not pushed yet.)
