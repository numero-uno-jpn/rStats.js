# Issue #163 log: cancellation in the Gamma deviance near y = mu

GitHub Issue #163. Fixed together with #161 and #162 (option B2, the user's decision of 2026-11-03); the plan, the checks, the fix, the tests and the points recorded for later (the step-halving rule's reaction to rounding noise, point E) are in review_fix_log_issue161.md.

## Summary

- -2 w (log(y/mu) - (y - mu)/mu) cancels near y = mu: `Gamma()$dev.resids(1, 1 + 2^-52, 1)` was 1.9721522630525295e-31, four times the true 4.9303806576313223e-32 (R 4.5.2: 9.86e-32, twice), and (1000, 1001) 9.986681650006428e-7, 6.8e-11 relative off (R the same; true 9.9866816506833162e-7).
- After the fix (-2 w log1pmx(t), t = (y - mu)/mu, where abs(t) < 0.1; also quasi "mu^2"): 4.930380657631322e-32 and 9.986681650683315e-7. Beyond 10% R's form and bits.
- Test: `test/issue163.test.ts` (the near-the-mean test fails with src stashed).

## close comment

Fixed in <commit of #161, see git log --grep='#163'>: the Gamma deviance contribution -2 w (log(y/mu) - (y - mu)/mu) is now -2 w log1pmx(t), t = (y - mu)/mu, where abs(t) < 0.1; also for quasi with variance "mu^2". The issue's example (1, 1 + 2^-52) gives 4.930380657631322e-32 (Rmpfr 4.9303806576313223e-32; was 1.97e-31, R 9.86e-32), and (1000, 1001) gives 9.986681650683315e-7 (was 6.8e-11 off, as R). Beyond 10% R's form and bits are kept. In the glm fixture the deviances and deviance residuals of 69 cases change in their last digits (all within the tolerance against R). Recorded in docs/differences-from-r.md. Details in review_fix_log_issue161.md (the same change fixes #161 and #162). Test: test/issue163.test.ts. (Not pushed yet.)
