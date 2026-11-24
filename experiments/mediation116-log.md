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
