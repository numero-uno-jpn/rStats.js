# Issue #166 log: "0s in V(mu)" for an inverse.gaussian mean of 1e-200

GitHub Issue #166. Fixed together with #159, #165, #167 and #168 (option A1, the user's decision of 2026-11-03); the plan, the checks, the fix and the tests are in review_fix_log_issue168.md.

## Summary

- `glm([[0], [1]], [1e-200, 1e-200], { family: "inverse.gaussian", link: "log" })`: V = mu^3 underflows to 0 and the fit stopped with "0s in V(mu)". R 4.5.2 reports convergence at the clamped mean 2.2e-16 with deviance 2e200, which is wrong.
- After the fix ("0s in V(mu)" is not raised where V = mu^p underflowed for a positive mean; the weight is sqrt(w) mu^(-1/2)): fitted 9.99999999999978e-201 (exp(eta) with eta = -460.5, good to an ulp of eta), W = 1/mu, converged, with the warning "step size truncated due to increasing deviance" (a step from the starting values; see point E in review_fix_log_issue161.md).
- Test: `test/issue166.test.ts` (fails with src stashed).

## Recorded as out of scope

- inverse.gaussian y = (1e-110, 2e-110) ~ x ends unconverged ("inner loop 3; cannot correct step size"): the halving rule reacts to rounding noise in a perfect fit (point E, recorded in review_fix_log_issue161.md). Before the fix it stopped with "0s in V(mu)"; R reports convergence at the clamped mean 2.2e-16.

## close comment

Fixed in <commit of #168, see git log --grep='#166'>: V(mu) = mu^p underflowing to 0 for a positive mean no longer stops the fit with "0s in V(mu)", and where muEta^2, V or w muEta^2 is outside the normal range the working weight is sqrt(w) |c| mu^((2a - p)/2) from muEta = c mu^a (sqrt(w) mu^(-1/2) for the log link and mu^3). The issue's model now converges with fitted means 9.99999999999978e-201 (exp of eta = -460.5, to an ulp of eta) and weights 1/mu = 1e200; R 4.5.2 reports convergence at the clamped mean 2.2e-16 with deviance 2e200. Elsewhere the bits are unchanged (all 154 glm fixture cases). Recorded in docs/differences-from-r.md. Details in review_fix_log_issue168.md (the same change fixes #159, #165, #167, #168). Test: test/issue166.test.ts. (Not pushed yet.)
