# Issue #162 log: cancellation in the poisson deviance near y = mu

GitHub Issue #162. Fixed together with #161 and #163 (option B2, the user's decision of 2026-11-03); the plan, the checks, the fix, the tests and the points recorded for later (the step-halving rule's reaction to rounding noise, point E) are in review_fix_log_issue161.md.

## Summary

- 2 w (y log(y/mu) - (y - mu)) cancels near y = mu: `poisson()$dev.resids(1, 1 + 2^-52, 1)` was -9.860761315262648e-32 (R 4.5.2: 0; true 4.9303806576313231e-32), and (1000, 1001) 0.0009993338330014367, 6.8e-11 relative off (R the same; true 0.00099933383293366638).
- After the fix (2 w bd0(y, mu) where abs(y - mu) < 0.1 mu; also quasipoisson and quasi "mu"): 4.930380657631323e-32 and 0.0009993338329336663. Beyond 10% R's form and bits.
- Test: `test/issue162.test.ts` (the near-the-mean test fails with src stashed).

## close comment

Fixed in <commit of #161, see git log --grep='#162'>: the Poisson deviance contribution 2 w (y log(y/mu) - (y - mu)) is now 2 w bd0(y, mu) where abs(y - mu) < 0.1 mu, as R's dpois_raw switches to bd0 on the same kind of test; also for quasipoisson and quasi with variance "mu". The issue's example (1, 1 + 2^-52) gives 4.930380657631323e-32 (Rmpfr 4.9303806576313231e-32; was -9.86e-32, R 0), and (1000, 1001) gives 0.0009993338329336663 (was 6.8e-11 off, as R). Beyond 10% R's form and bits are kept. In the glm fixture the deviances and deviance residuals of 69 cases change in their last digits (all within the tolerance against R). Recorded in docs/differences-from-r.md. Details in review_fix_log_issue161.md (the same change fixes #161 and #163). Test: test/issue162.test.ts. (Not pushed yet.)
