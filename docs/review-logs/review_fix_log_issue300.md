# Issue #300 log: lmerHypotheses' absolute cutoff after rescaling the predictors

GitHub Issue #300. Session 12, judging of the issues classified C. Verdict: not planned (internal; the public API gives the same table at any scale). No code changed; a test added.

## Plan

- Intent: re-check on the current main, through the public API (src/index.ts and the subpath entries), whether the report still holds after the fixes of session 12, and compare with R 4.5.2.
- Why: the issue was classified C (not reproduced, already fixed, or an existing policy); a C verdict needs the behaviour confirmed by running it, not only by reading the source.

## Check (main `06a043c`, R 4.5.2)

- `lmerHypotheses` and `fixedEffectsDescription` are not exported (neither from src/index.ts nor from the mixed entry). Their only caller is `lmerAnova`.
- The matrix the cutoff is applied to is ginv(X_t) times the full-dummy matrix, and both contain the same predictor columns, so it is a projection whose entries do not depend on the units of the predictors (the issue's estimate, ginv(X'X) X' of size 1e-10, leaves out the second factor).
- `lmerAnova(lmer("y ~ 0 + x + z + (1 | g)", data), { type: "III" })` with the issue's data: F 23.220346506107635 and 1.482246088398062; with x and z multiplied by 1e10: 23.22034650610831 and 1.4822460883981003, both terms kept.
- R (lmerTest): F 23.2203 and 1.4822, DenDF 1.17784 and 0.98209, p 0.1024 and 0.4406, at both scales.

## Fix

- None (not planned).

## Tests

- test/issue300.test.ts: the helpers are not public; the type III table with the predictors times 1e10 keeps both terms and agrees with the unscaled one to 1e-12 (F, denDF, p) and with lmerTest's F.

## Out of scope

- None.

## close comment

Not planned: lmerHypotheses and fixedEffectsDescription are internal (not exported); lmerAnova is the public function that uses them, and it gives the same type III table at any scale. The matrix the 1e-8 cutoff is applied to is ginv(X_t) times the full-dummy matrix, which contains the same predictor columns, so its entries do not depend on the units of the predictors. With the issue's data and x, z multiplied by 1e10, lmerAnova(..., { type: "III" }) keeps both terms with F 23.2203 and 1.4822, the same as unscaled and as lmerTest. A test was added: test/issue300.test.ts. (Not pushed yet.)
