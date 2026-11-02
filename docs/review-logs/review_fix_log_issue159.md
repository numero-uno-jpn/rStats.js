# Issue #159 log: Gamma glm on the inverse link with a mean of 1e308

GitHub Issue #159. Fixed together with #165, #166, #167 and #168 (option A1, the user's decision of 2026-11-03); the plan, the checks, the fix and the tests are in review_fix_log_issue168.md.

## Summary

- `glm([[], []], [1e308, 1e308], { family: "Gamma" })`: the inverse link's muEta = -1/eta^2 overflows for eta = 1e-308 (from a mean of 1e160 on), and the fit stopped with "the matrix contains NaN or infinite values" (R 4.5.2: "NA/NaN/Inf in 'x'").
- After the fix (muEta = -mu^2 in the working residual, sqrt(W) = sqrt(w) mu): the coefficient is 9.999999999999994e-309 (true 1e-308, subnormal), converged, null deviance 0. Gamma fits of s (1, 2, 3) ~ x with s = 1e160 and 1e200 give the fit of y/s with the coefficients divided by s.
- Test: `test/issue159.test.ts` (fails with src stashed).

## Recorded as out of scope

- The working weight itself, W = mu^2 = 1e616, is beyond the doubles: the weights are Inf, and the dispersion (sum W r^2) and the standard errors NaN. As decided (A1, not A2), recorded only; docs/differences-from-r.md says so.
- The fit's deviance is -1.7e-16 (cancellation in the Gamma deviance, #163).

## close comment

Fixed in <commit of #168, see git log --grep='#159'>: where muEta^2, V(mu) or w muEta^2 is outside the normal range, the working weight is now sqrt(w) |c| mu^((2a - p)/2) from muEta = c mu^a and V = mu^p, and the working residual (y - mu)/muEta is ((y - mu)/c)/mu^a where muEta is not finite. For the issue's Gamma fit on the inverse link (muEta = -mu^2), glm([[], []], [1e308, 1e308], { family: "Gamma" }) now converges with the coefficient 9.999999999999994e-309 (1/1e308 is subnormal) and null deviance 0; R stops with "NA/NaN/Inf in 'x'". The working weight itself, mu^2 = 1e616, is beyond the doubles, so the weights are Inf and the dispersion and standard errors NaN; that is recorded in docs/differences-from-r.md rather than changed. Elsewhere the bits are unchanged (all 154 glm fixture cases). Details in review_fix_log_issue168.md (the same change fixes #165-#168). Test: test/issue159.test.ts. (Not pushed yet.)
