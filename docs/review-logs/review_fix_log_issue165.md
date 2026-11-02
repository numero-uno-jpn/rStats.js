# Issue #165 log: inverse.gaussian working weight NaN for a mean of 1e200

GitHub Issue #165. Fixed together with #159, #166, #167 and #168 (option A1, the user's decision of 2026-11-03); the plan, the checks, the fix and the tests are in review_fix_log_issue168.md.

## Summary

- The issue's one-row model (inverse.gaussian, log link, offset log(1e200)): muEta^2 = 1e400 and V = mu^3 = 1e600 overflow, so the weight was Inf/Inf = NaN (R 4.5.2 too, with the deviance and null deviance NaN). With a predictor (y = (1e200, 2e200) ~ x) the fit stopped.
- After the fix: W = 9.99999999999978e-201 = 1/mu (mu = exp(log(1e200)) = 1.000000000000022e200), deviance 4.88e-228 (the ratio form of #164), Pearson residual ((y - mu)/mu)/sqrt(mu) = -2.2e-114. The fit with a predictor gives (460.51701859880916, 0.6931471805599251) = (log 1e200, log 2), converged.
- Test: `test/issue165.test.ts` (fails with src stashed).

## close comment

Fixed in <commit of #168, see git log --grep='#165'>: where muEta^2, V(mu) or w muEta^2 is outside the normal range, the working weight is now sqrt(w) |c| mu^((2a - p)/2) from muEta = c mu^a and V = mu^p, and the Pearson residual is formed with mu^(p/4) twice. For the issue's inverse.gaussian model on the log link the weight is now 9.99999999999978e-201, that is 1/mu for the fitted mean 1.000000000000022e200 (was NaN, as in R), and the deviance 4.88e-228; with a predictor, y = (1e200, 2e200) ~ x now fits to (log 1e200, log 2). Elsewhere the bits are unchanged (all 154 glm fixture cases). Recorded in docs/differences-from-r.md. Details in review_fix_log_issue168.md (the same change fixes #159, #166-#168). Test: test/issue165.test.ts. (Not pushed yet.)
