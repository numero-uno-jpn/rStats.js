# Issue #177 log: the gaussian GLM AIC leaves out rows of prior weight 0

GitHub Issue #177. Session 11, judging of the issues classified C. Verdict: not planned (a deliberate difference from R, by the user's decision in review 65). No code changed; a test added.

## Plan

- Intent: confirm that the finite AIC is the documented behaviour, and cite where it was decided.
- Method: run the issue's example and the fit without the zero-weight row in rStats.js and R 4.5.2; find the decision in HANDOFF.md, docs/differences-from-r.md and the review 65 log.
- Why: the issue cites `oracle/glm-behaviour.md`, which describes what R does (it is the specification of R's behaviour for the fixtures), not what rStats.js decided to do where R is wrong.

## Check (main `0519625`, R 4.5.2)

| | R 4.5.2 | rStats.js |
|---|---|---|
| `glm(y ~ 1, weights = c(1, 1, 0))`, y = (1, 2, 100): AIC | Inf | 6.903165410578907 |
| `glm(c(1, 2) ~ 1)`: AIC | 0x1.b9cd764b54262p+2 (6.90316541057891) | 6.903165410578909 |

The AIC with a row of weight 0 equals the AIC of the fit without that row, as decided.

## Where the decision is recorded

- HANDOFF.md, "方針" (policies decided by the user): "glm の重み 0 の行と自由度 0 (65 回目、ユーザー判断): 重み 0 の行は尤度に入れない。AIC もその行を除いて計算し、その行を除いた当てはめと同じ値にする (R の gaussian の AIC は log(0) を取って Inf)。... 67 回目にレビュアーは ... MOD-044 (重み 0 の行の Poisson の AIC) を「R の仕様どおり」として撤回したが、この判断のまま変えない (R と違うのは承知のうえ。docs の「R が不正確な場合」に記録済み)". In English: rows of weight 0 are not in the likelihood; the AIC is computed without them and equals the AIC of the fit without them (R's gaussian AIC takes log(0) and is Inf); kept even after the reviewer withdrew the related finding in review 67.
- docs/differences-from-r.md, "Where R is inaccurate and rStats.js is closer to the truth" (line 132): "`AIC` of a gaussian `glm` with rows of weight 0 | Inf: the family's `aic` takes log(0) of their weights and counts them in n | the rows left out of the likelihood (every family): the AIC of the fit without them (5.84 for weights 1, 1, 1, 0)". The same row is in docs/ja/differences-from-r.md (line 122).
- docs/review-logs/review_fix_log_20261031_65.md: "MOD-031 | 重み 0 の行がある gaussian の AIC が Inf (R も Inf)。レビュアーは R 互換かどうかを理由に撤回 | 直す (ユーザー判断)" (MOD-031, the gaussian AIC with rows of weight 0 is Inf, as in R; fixed by user decision). Commit `abe4daa` ("Review 65: AIC without rows of weight 0, ..."); the fixture of R's Inf is recorded as `knownDifference` in test/glm.test.ts.
- The source comment in `familyAic` (src/models/glmFamily.ts) says the same: "Rows of weight 0 are not in the likelihood: left out of every sum (R's gaussian AIC took their log(0) = -Inf and counted them in n, so it was Inf ...)". The issue reads this comment as documenting the behaviour to reproduce; it documents R's behaviour that was not kept.

## Fix

- None (not planned). This is the 65th review's decision.

## Tests

- `test/issue177.test.ts`: the issue's example gives 6.903165410578907, within 1e-12 of the AIC of the fit without the row (6.903165410578909; R 6.90316541057891 for that fit).

## Out of scope

- docs/differences-from-r.md, "Behaviour matched to R" > "Generalized linear models" (line 940), still says "**AIC:** the gaussian AIC sums log w over all rows, so a prior weight of 0 makes it infinite", and docs/ja/differences-from-r.md line 876 the same. This is stale since review 65 and contradicts line 132; it should be removed or changed to point to the row at line 132. Not changed here (log and test only). Corrected later in session 11 (user approval with decision 6, a docs-only commit): both bullets now say that rows of prior weight 0 are left out of the likelihood, and point to the row at line 132.

## close comment

Not planned: this is a deliberate difference from R, decided in review 65 (MOD-031). Rows of prior weight 0 are not in the likelihood, so the AIC is computed without them and equals the AIC of the fit without those rows; R's gaussian AIC takes log(0) of their weights and gives Inf. For the issue's example glm([[], [], []], [1, 2, 100], { family: "gaussian", weights: [1, 1, 0] }) the AIC is 6.903165410578907, and the fit of [1, 2] alone gives 6.903165410578909 (R: 6.90316541057891 for that fit, Inf with the zero-weight row). oracle/glm-behaviour.md describes what R does, and the comment in familyAic describes R's Inf as the behaviour that was not kept; the decision is recorded in docs/differences-from-r.md under "Where R is inaccurate and rStats.js is closer to the truth". The stale sentence under "Behaviour matched to R" that said a prior weight of 0 makes the AIC infinite has been corrected. A test was added: test/issue177.test.ts. (Not pushed yet.)
