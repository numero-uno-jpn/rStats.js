# Issue #477 log: the log link without R's eps clamp

GitHub Issue #477. Session 13, judging of the issues classified C. Verdict: not planned (an intentional, documented difference). No code changed; the docs paragraph on the GLM links is corrected.

## Plan

- Intent: run the issue's calls on the current main and in R 4.5.2, check the earlier decision, and fix the docs paragraph that contradicted it.
- Why: classified C (the issue asks for R's `pmax(exp(eta), .Machine$double.eps)`). User decision 12 (2026-11-03): rewrite the Links paragraph of the GLM section to match reviews 62 and 63, in this commit.

## Check (main `c7fcff4`, R 4.5.2)

- `makeFamily` log link: `linkinv(-100)` = `muEta(-100)` = 3.720075976020836e-44, `linkinv(-1000)` = 5e-324.
- R: `poisson()$linkinv(-100)`, `poisson()$mu.eta(-100)`, `poisson()$linkinv(-1000)`: 2.220446e-16. The difference the issue describes is real.

## Earlier decision

- Reviews 62 and 63 (user decision): R's eps clamps in `make.link` (logit, log, probit, cauchit, cloglog, power) are wrong (a mean of e^-100 becomes 2.2e-16), so rStats.js gives the exact values, bounded by the least double. Listed in the table of docs/differences-from-r.md ("`glm` with the log link where eta < −36"); `test/review62.test.ts` (MOD-013) checks it.

## Docs

- docs/differences-from-r.md, GLM section, **Links:** said "The inverse links and their derivatives have R's clamps (eps = 2^-52 ...)", which contradicted the table rows of reviews 62 and 63. Now: they do not have R's eps clamps and give the exact values, kept within the doubles by the least double and, for probabilities, the largest double below 1, with a pointer to the table rows. The same in docs/ja/differences-from-r.md. This also covers #478.

## Fix

- None.

## Tests

- None added (`test/review62.test.ts` covers the log link).

## Out of scope

- None.

## close comment

Not planned: this is an intentional, documented difference. R's make.link("log") clamps exp(eta) and its derivative at .Machine$double.eps (R 4.5.2: poisson()$linkinv(-100) = 2.220446e-16), which replaces a mean of 3.7e-44 by a value 28 orders of magnitude larger; rStats.js decided in an earlier review to give the exact value, bounded only by the least double. It is listed in the table of docs/differences-from-r.md; the Links paragraph of its GLM section, which still said the links had R's clamps, is corrected in <commit of #477, see git log --grep='#477'>. (Not pushed yet.)
