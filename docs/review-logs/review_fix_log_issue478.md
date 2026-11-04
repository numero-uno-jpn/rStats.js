# Issue #478 log: the probability links without R's eps clamps

GitHub Issue #478. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2, and check the earlier decision.
- Why: classified C (the issue asks for R's eps and 1 − eps clamps of the logit, probit, cauchit and cloglog links). User decision 12 (2026-11-03): the docs paragraph on the links is corrected with #477.

## Check (main `c7fcff4`, R 4.5.2)

- `makeFamily("binomial", link)` at eta = −100 and 100 (linkinv(−100), muEta(−100), linkinv(100), muEta(100)):
  - logit: 3.72e-44, 3.72e-44, 1 − 2^-53, 3.72e-44
  - probit: 5e-324, 5e-324, 1 − 2^-53, 5e-324
  - cauchit: 0.003182992764908255, 3.18278e-5, 0.9968170072350917, 3.18278e-5
  - cloglog: 3.72e-44, 3.72e-44, 1 − 2^-53, 5e-324
- R (`binomial(link)`): logit, probit and cloglog give 2.220446e-16 for the means and derivatives at −100 and 1 − 2^-52 (0.99999999999999978) at 100; cauchit agrees with rStats.js (within R's eta range). The difference the issue describes is real.

## Earlier decision

- Reviews 62 (logit) and 63 (probit, cauchit, cloglog, power), user decisions: R's eps clamps are wrong, so the links give the exact values, kept within (0, 1) by the least double and the largest double below 1. Listed in the table of docs/differences-from-r.md ("logit link where |eta| exceeds 30", "probit, cauchit, cloglog and power links at the ends"); `test/review62.test.ts` (MOD-012) and `test/review63.test.ts` check them.

## Docs

- The GLM Links paragraph that still claimed R's clamps is corrected in the commit of #477 (review_fix_log_issue477.md).

## Fix

- None.

## Tests

- None added (`test/review62.test.ts` and `test/review63.test.ts` cover the links).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. R's make.link clamps the logit, probit, cauchit and cloglog means and derivatives at .Machine$double.eps and 1 - .Machine$double.eps (R 4.5.2: binomial()$linkinv(-100) = 2.220446e-16 for 3.7e-44, and a jump from 1 - 9.4e-14 at eta = 30 to 1 - 2.2e-16 just beyond for the logit), which an earlier review decided is wrong: rStats.js gives the exact values, kept within (0, 1) by the least double and the largest double below 1. It is listed in the table of docs/differences-from-r.md; the Links paragraph of its GLM section is corrected in <commit of #477, see git log --grep='#477'>. (Not pushed yet.)
