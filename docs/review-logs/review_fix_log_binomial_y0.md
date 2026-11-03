# Binomial deviance at y = 0 with a small mean (follow-up to #161)

## Plan

- Problem (recorded in review_fix_log_issue161.md): the binomial deviance contribution of y = 0 is -2 w log(1 - mu). The direct form `(1 - y) * Math.log((1 - y) / (1 - mu))` rounds 1 - mu first, which is a relative error of about eps/(2 mu): 1e-13 at mu = 1e-3, and 0 instead of 2 w mu for mu below 1.1e-16 (1 - mu rounds to 1). R 4.5.2 gives the same (`binomial()$dev.resids(0, 1e-20, 1)` is 0). The y = 1 side, -2 w log(mu), takes the exact mu and is accurate.
- Fix (user decision, 2026-11-03): for y = 0 and mu < 0.1, the contribution is -2 w log1p(-mu). From mu = 0.1 on, the direct form is within a few ulp, so R's form and bits are kept (the same line as the 10% of #161-#163).
- `src/models/glmFamily.ts`, `binomialDev` (also used by quasibinomial and quasi with variance "mu(1-mu)").

## Check

- `binomial()$dev.resids(0, 1e-20, 1)`: was 0 (R 0), now 2e-20. mu = 1e-12 to 0.01: within 4e-16 of the series m + m^2/2 + ....
- glm fixture (154 cases, dumped before and after): 31 cases change, all in the deviance residuals; the deviance changes in 7. Five of those (cases 12, 22, 25, 26, 102, ordinary fits) change by 1 to 2 ulp. Two separated fits (cases 119 and 121, deviance about 2e-10, fitted values down to 5e-52) change by 6e-7 relative (2.2150103972604204e-10 to 2.2150091079842816e-10), because their deviance is made of the contributions of rows with tiny means, which were the inaccurate ones. Coefficients, fitted values, weights, iterations and standard errors do not change. The glm tests pass (against R within their tolerance).
- Test: `test/binomialDevZero.test.ts` (2 of 3 fail before the fix). Whole suite and tsc: see the commit.
- Docs: a row after the #161-#163 row in `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`.
