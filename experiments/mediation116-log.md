# 1.16.0 (mediation): the record of the trial and error

The clean-room evidence for how R's behaviour was found: every attempt in order, the failed ones too, with what each
showed. Nobody read the source of R or of the GPL packages; each finding comes from the output of exported functions
compared with candidate formulas written for these experiments. All runs: R 4.6.2 x86_64 (`rstats-oracle-amd64:4.6.2`),
mediation 4.5.1, MASS 7.3.66, scripts checked with `scripts/r-experiment-check.mjs`. Issue #566 has the summaries.

Some scripts were edited in place between runs (marked "replaced"); the attempt is described here and the final
script keeps the search that succeeded.

## mvrnorm (2026-11-25)

1. `mediation116.R`: candidate `mu + V diag(sqrt(pmax(lambda, 0))) Z'` with `eigen(Sigma, symmetric = TRUE)` and Z an
   n x p matrix of `rnorm(n * p)` filled by column, and the same filled by row. By column: difference 0 for p = 2, 3, 5,
   diagonal, singular, n = 1. By row: differences 4-12 (wrong). **Settled.**

## mediate, boot = FALSE, lm / lm (2026-11-25)

2. `mediation116.R`: candidate "mediator model `mvrnorm(sims, coef, vcov)` then outcome model's", ACME = a b (t1 - t0),
   ADE = c' (t1 - t0); also the reverse order. **Failed** (differences 0.9-1.6). The generator's state after mediate
   was not that after the two mvrnorm calls; counting further draws one at a time from that state reached mediate's
   state after exactly sims * n = 3000 normals (6000 uniforms).
3. `mediation116-order.R` (first version, replaced): the two mvrnorm calls (A, B) and sims * n normals (E) in all six
   orders. **Failed** (all differences 0.86-1.58).
4. (second version, replaced): offset scan, 0 to 4200 normals skipped, for where B's `mvrnorm` starts so that its X
   column equals ADE / (t1 - t0); then the same for A. **Not found** (NA). The ADE draws were near c' = 0.295, so the
   form ADE = c' (t1 - t0) was plausible and the draw itself differed.
5. (third version, replaced): regression of the ADE draws on 4 consecutive blocks of sims normals of the stream at each
   offset (any covariance factor, by column). **No exact fit** (best R^2 = 0.43).
6. (fourth version, replaced): the same with 10 blocks (the two models drawn jointly with a block diagonal covariance).
   **No exact fit** (best R^2 = 0.60).
7. (fifth version, replaced): interleaved layouts, draw j using the normals at k + (j - 1) * stride + 0..stride-1 for
   stride 1-12. **Exact fit (R^2 = 1) at k = 150 (= 3 x 50, after the mediator model's 3 coefficients x 50 draws),
   stride 4**; the weights were not a row of V diag(sqrt(lambda)) but equal to a row of the symmetric square root
   V diag(sqrt(lambda)) V'.
8. (final version): candidate "rows of normals times the symmetric square root, mediator model first, then outcome
   model, then sims * n normals": ACME, ADE and total effect to 9e-16; the mediator model's a from the ACME fits at
   k = 0 with stride 3. **Settled.**

## Eigenvector signs (2026-11-25), because mvrnorm depends on them

9. `mediation116-eigensign.R`: 1500 random covariance matrices (p = 2, 3, 4, 6; three generators) and R's eigenvectors.
   Simple rules in `mediation116-eigensign.mjs`: last component positive, first positive, largest |component|
   positive, sum positive. p = 2: column 2's largest component was always negative, no rule held for both columns.
   p >= 3: no rule held (all below 30% for whole matrices).
10. p = 2: LAPACK's dlaev2 closed form (LAPACK is modified BSD; already ported in parts for rStats.js) on
    (S11, S21, S22), columns (cs, sn) and (-sn, cs) in decreasing order. **600 of 600 identical (difference 0).
    Settled.**
11. p >= 3: LAPACK's dsytd2 (uplo = "L"), then "the largest component in the tridiagonal basis is positive": 96%
    (1156-1158 of 1200 vectors per size). The misses had the second largest component positive, often not near ties.
    With uplo = "U": 54-76% (worse). **Not settled**: matching every sign needs dsyevr's MRRR path (dstemr), whose twist
    index is chosen from an early eigenvalue estimate.

## mediate's summaries (2026-11-25)

12. `mediation116-summary.R`: point estimates against mean and median of the draws, intervals against quantile types
    1, 6 and 7, p-values against three tie variants. Estimates = mean (proportions mediated = median), intervals =
    type 7 (also at conf.level 0.9), p = 2 min(mean(v > 0), mean(v < 0)) (the tie variants agreed on these draws),
    n = d / tau per draw, tau = d0 + z1 = d1 + z0, averages per draw. **Settled** (ties to be checked).
13. Same script, binomial models: after the parameter draws, sims * n normals' worth (2 sims n uniforms) of the
    generator for every combination of lm / logit / probit models.

## Mediator predictions (2026-11-25)

14. `mediation116-binomial.R`: lm mediator, logit outcome: errors by simulation or by observation, sd = sigma(model.m)
    or the ML estimate. **By observation (a sims x n matrix filled by column) with sigma(model.m): 6e-17**; the other
    three 0.003-0.05. Logit mediator, lm outcome, eight layouts of rbinom / runif draws: **`rbinom(sims n, 1, P(1))`
    then `rbinom(sims n, 1, P(0))`, both by column: 1e-16**; the others 0.25-0.33. **Settled.**

## mediate, boot = TRUE (2026-11-25)

15. `mediation116-boot.R` (first version): per replicate `sample(n, n, TRUE)` with or without n normals after it, and all
    index vectors first. **Failed** (0.70-0.83). Point estimates = the original data's a b and c' exactly; intervals =
    quantile type 7 (6e-17); boot.ci.type "bca" keeps the same draws.
16. (second version, replaced): 0-180 normals skipped first, then per replicate sample with n normals before or after,
    or one `sample(n, n * sims, TRUE)` laid out n x sims (replicate = column). **Not found.**
17. `mediation116-boot-count.R`: the generator's use. A first run gave 0 for everything: the state was passed to the
    counting function unevaluated (R's lazy arguments) and read after its own set.seed; fixed by assigning it first.
    Then: about 184 uniforms per replicate (sample of 60 about 64, plus 60 normals = 120) and about 242 more (sims = 2,
    3, 4, 30). sims = 1 is an error ("dim(X) must have a positive length").
18. (third version, replaced): uniform offsets 0-1200, `sample(n, n, TRUE)` for each of the first three replicates,
    against the ACME and then the ADE (which has no mediator errors in it). **Not found** for either: the resample is
    not one sample call per replicate. The closest of 20000 resamples from a running stream: 5e-6 (none exact).
19. (fourth version): one `sample(n, n * sims, TRUE)` laid out as a **sims x n matrix by column, replicate j = row j**,
    after 0-600 uniforms. **Found at offset 0: ADE and ACME of all 30 replicates to 1e-16. Settled.** With the count
    (17): index matrix (about n sims uniforms) + (sims + 1) x n normals of mediator errors (the original data and each
    replicate), order not yet known.
20. Logit mediator with the bootstrap: after the index matrix, the original data's rbinom draws first or last, then per
    replicate rbinom for M(1) then M(0). **Failed** (0.24 for both).
21. Brute force for the first replicate only: 0-400 uniforms after the index matrix, either order of M(1) and M(0).
    31 hits: the target mean(M(1) - M(0)) is a multiple of 1/60, so one replicate cannot decide. Next: match all
    replicates at once.
22. `mediation116-boot-binomial.R`: all 30 replicates at once over 12 structures (order of M(1) / M(0), the original
    data's draws first / last / absent, mediator probabilities and effects on the resample or on the original data).
    **Only "M(1) first, original data's draws first, each replicate refitted on its resample but evaluated on the
    original data" matched all 30** (the others 0-4 of 30). The generator's state still differed.
23. Same script, added: the point estimate against one more original-data draw after the replicates, the mean and the
    median of the replicates, and the first original draw. **One more original-data draw after the replicates = d0
    exactly, and the generator's state then equals mediate's. Settled:** index matrix, an original-data draw (value
    unused), the replicates, the original-data draw that gives the point estimate. ADE point = c' of the original fit.

## BCa intervals (2026-11-25)

24. `mediation116-bca.R` (lm / lm, sims 400 and 999): 30 candidates per effect: z0 = qnorm(mean(v < est)) or with <=;
    acceleration 0, jackknife of the original data (either sign), the replicates' skewness (either sign); levels read
    with quantile types 7, 6 or normal-scale interpolation of the order statistics. **Only the ADE at sims = 400
    matched** (5e-17, "v < est, replicates' skewness, type 7"); the others 0.01-3.3 off.
25. Same script, added: the details of that candidate for every effect: R's intervals narrower than it, and at
    sims = 999 R's point estimate differs from the original fit in the last digit (it comes from the extra
    original-data draw).
26. Same script, added: R's interval ends inverted to type-7 levels, then the BCa equation solved for z0 and a from the
    two ends. **a = the replicates' skewness sum(u^3) / (6 sum(u^2)^1.5), u = mean(v) - v, in all 8 cases**; Phi(z0)
    = a count / sims, but not mean(v < est) except for the ADE.
27. Same script, added: the proportion below each effect's point estimate, mean(v) and median(v). **Only mean(v)
    matched in all 8 cases** (for the ADE at 400 the point estimate happened to give the same count).
28. Same script, added: the whole formula for all ten effects, sims 400 and 999, conf.level 0.95 and 0.9: **40 of 40
    identical (difference 0). Settled:** z0 = qnorm(mean(v < mean(v))), a as above, levels
    pnorm(z0 + (z0 + zq) / (1 - a (z0 + zq))), quantile type 7.

## sim_slopes and Johnson-Neyman (2026-11-25)

29. `mediation116-slopes.R` (first run): textbook candidates (slope b1 + b3 w, Var = V11 + 2 w V13 + w^2 V33, t or z,
    JN = roots of (b1 + b3 w)^2 = crit^2 Var(w)). **Error:** "subscript out of bounds" at ss$jn[[1]] (ss$jn is an empty
    list).
30. `mediation116-slopes-probe.R`: names and attributes of the result: `mods`, `jn` (empty), `slopes`, `ints`; the
    Johnson-Neyman results are in `attr(ss, "jns")`.
31. `mediation116-slopes.R` with jns: estimates, SEs, p-values and JN bounds of lm matched (<= 3e-12); the interval and
    statistic columns showed large differences because the script read them one column too early (column 1 is the
    moderator's value). glm: slopes and p-values with z matched, but the JN bounds were 0.16 off with z and **matched
    with t on df.residual (1e-14)**.
32. Columns corrected: **every lm case (mean-plus-minus, conf 0.9 / jnalpha 0.1, given values, HC3), glm (z for slopes,
    t for JN), glm with HC3 (the same) and the binary moderator matched to <= 3e-12.** "mean-plus-minus" = mean(W) +-
    sd(W) of the model's data; HC3 = sandwich::vcovHC(type = "HC3"). **Settled.**
33. Same script, added: the JN flags. inside = (leading coefficient b3^2 - crit^2 V33 < 0); no real root: bounds
    (-Inf, Inf), failed = TRUE, printed "could not be found"; all_sig = TRUE when no bound lies within the observed
    range of W (also in the failed case, where nothing is significant). **Settled.**

## The whole of mediate against a candidate reimplementation (2026-11-25)

34. `mediation116-reimpl.R` (first run): a reimplementation in R from findings 2-28 (robustSE as vcovHC HC3 or HC0,
    the bootstrap's mediator error sd from each refit, glm outcomes on the response scale), compared with mediate for
    7 model pairs (lm, logit, probit mediators and outcomes, covariates, X:M interactions) x 6 settings (quasi-Bayes at
    0.95 and 0.9, robustSE HC3 / HC0, bootstrap percentile / BCa) and a continuous treatment (mean +- SD, the defaults
    1 and 0, reversed). Draws, intervals and p-values matched everywhere (<= 2.5e-12) except robustSE with HC0 (0.23;
    **robustSE = HC3**). The quasi-Bayesian point estimates differed by up to 0.019 where d0 != d1.
35. Same script, added: per-effect point estimates against the mean and the median of the draws: all are the mean
    except n0 and n1 (the median) and **n.avg = (n0 + n1) / 2 of those medians** (neither the mean nor the median of the
    n.avg draws).
36. Candidate corrected: **38 of 38 settings match to <= 1e-11** (HC0 the control that should differ). **mediate
    settled.**

## Decisions

37. The user (2026-11-25): mvrnorm in 3 or more dimensions agrees with R statistically only (no port of dstemr); 2 dimensions and mediate match exactly.

## mediate's covariates argument (2026-11-25)

38. `mediation116-covariates.R` (the first run stopped at the checker: the helper's name `fix` is a forbidden name,
    renamed): the reimplementation of 34-36 with the candidate "the given covariates are set to their values in every
    observation's prediction of the mediator and the outcome", for a moderator W in both models with X:W and M:W
    interactions (lm / lm, lm / logit, logit / lm), quasi-Bayes and bootstrap, W at mean +- SD. **12 of 12 match
    (<= 3e-11); without the fixing they are far off (0.3-580). Settled.**

## Implementation stage (2026-11-25)

39. `test/mediate.test.ts` against `oracle/mediation.R` (52 cases): 48 matched at once. Two p-values differed by 0.01
    (a binary mediator, a linear outcome): R's draws were +-3.2e-18 multiples (2.2e-16 / 70), residues of an exact 0
    with a sign of their own; rStats.js's residues had other signs. The residues come from R's predictions (BLAS
    products), which cannot be reproduced bit for bit. rStats.js now takes a linear outcome's differences as
    (row difference) x b, which gives exactly 0 there; R's p-value counts its residues, so p may differ by 2 / sims
    per residue (a recorded difference from R).
40. The other two (probit mediator, bootstrap) differed in replicates 37 and 46 by 0.004-0.009.
    `mediation116-probit-separation.R`: no separation; the resamples have 15 vs 15 at Xb = 0, so the probit intercept is
    0 in theory: R +2.7e-16, rStats.js -3.8e-16. The mediator's probability is then 0.5 +- 1e-16, and rbinom turns its
    computation around at p = 0.5, so the draws differ. Rounding only; the test leaves those two replicates out.
41. `test/simSlopes.test.ts` against the fixture: 9 of 10 at once; the case without a real root had inside = FALSE in R although the leading coefficient is negative: inside is FALSE whenever the interval is not found. Then 10 of 10.
