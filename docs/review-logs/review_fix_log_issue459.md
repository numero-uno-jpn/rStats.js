# Issue #459 log: lmer's check of observations against random effects

GitHub Issue #459. Session 13, judging of the issues classified C. Verdict: not planned (the claim about lme4 is wrong; rStats.js does as lme4). No code changed.

## Plan

- Intent: run the issue's call on the current main and in lme4 2.0.6, and read lme4's check.
- Why: classified C (the issue says lme4 compares n with the total number of random effects).

## Check (main `dfe8bd6`, R 4.5.2, lme4 2.0.6)

- `lmer("y ~ 1 + (1 | g1) + (1 | g2)", { y: [1..6], g1: [a,a,b,b,c,c], g2: [u,v,w,u,v,w] })` (q = 3 + 3 = 6 = n): fits; fixef 3.5, sigma 0.7071067811865482, logLik -9.030293171477311.
- lme4: the same model fits with only the message "boundary (singular) fit"; fixef 3.5, sigma 0.7071068, logLik -9.0302932.
- With 8 rows, `y ~ x + (x | g1) + (1 | g2)` (q = 2·2 + 4 = 8 = n): lme4 fits (singular), fixef 0.3786128, 0.9427846; rStats.js fits, 0.37861157, 0.94278462 (a singular fit, the optimiser stops slightly elsewhere).
- lme4's `checkZdims` (`check.nobs.vs.nRE`) loops over `Ztlist` and compares n with the rows of each term's Z ("... for term (%s)"); it never sums them. rStats.js (`src/models/mixedStructure.ts`) checks each term the same way, with lme4's message (fixture `test/fixtures/lmerTerms.json`, "number of observations (=8) <= number of random effects (=8) for term (x | g)").

## Earlier decision

- The per-term check is lme4's, since the structure of lmer was written (`ea58955`, tested against the lmerTerms fixtures); `test/issue298.test.ts` keeps it for one term.

## Fix

- None.

## Tests

- `test/issue459.test.ts`: the issue's model fits (fixef 3.5, sigma 0.7071068, as lme4).

## Out of scope

- None.

## close comment

Not planned: the report does not match lme4. lme4's check.nobs.vs.nRE (checkZdims) compares the number of observations with the number of random effects of each term separately ("... for term (x | g)"); it does not sum them over the terms. lme4 2.0.6 fits the issue's model y ~ 1 + (1 | g1) + (1 | g2) with 6 observations and q = 3 + 3 = 6 (only a singular-fit message; fixed effect 3.5, sigma 0.7071068), and rStats.js gives the same fit. rStats.js applies the same per-term check with lme4's message. Added test/issue459.test.ts for the issue's model. (Not pushed yet.)
