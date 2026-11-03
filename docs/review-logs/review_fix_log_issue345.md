# Issue #345 log: coxph's Efron ties with case weights

GitHub Issue #345. Session 12, judging of the issues classified C. Verdict: not planned (the same as survival::coxph). No code changed.

## Plan

- Intent: run the issue's two fits on the current main through the public API and the same fits with survival::coxph in R 4.5.2.
- Why: classified C (the issue says survival treats weights as replication; the triage found it does not); the verdict needs both checked.

## Check (main `7033ff3`, R 4.5.2, survival)

| fit | rStats.js coef / loglik | survival::coxph |
|---|---|---|
| weighted, weights 2, 1, 1 | -0x1.d32e3ddfb5275p-1 (-0.91246217); -0x1.ba18a998fffa0p1, -0x1.64cd7372c2d58p1 | -0x1.d32e3ddfb5274p-1; -0x1.ba18a998fffap+1, -0x1.64cd7372c2d56p+1 |
| expanded rows | -0x1.f82e63788486dp-1 (-0.98472892); -0x1.96ca77c922cf8p1, -0x1.305d8a97df29ap1 | the same in all bits |

- rStats.js matches survival in both fits (to 1 and 2 ulps in the weighted one). survival's Efron counts tied event rows, not the sum of their weights, so the weighted fit is not the expanded one in survival either; the issue's premise does not hold.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: rStats.js gives the same values as survival::coxph. For the weighted fit (weights 2, 1, 1) both give the coefficient -0.9124622 and loglik -3.4538776, -2.7875199 (to 1 or 2 ulps); for the expanded data both give -0.9847289. survival's Efron approximation also uses the number of tied event rows rather than the sum of their weights, so in survival too the weighted fit is not the same as the replicated data; coxph follows survival here. (Not pushed yet.)
