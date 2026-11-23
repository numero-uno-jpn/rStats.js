# Non-metric multidimensional scaling: isoMDS

Reference: Kruskal (1964, both Psychometrika papers), Venables & Ripley, *Modern Applied Statistics with S*; R 4.6.2 public-call results and independent calculations in the `isomds111-*.R` experiments. No MASS source or Fortran was consulted.

## Configuration distances and Stress-1

For a configuration (Y=\(y_1,\ldots,y_n\)) in (k) dimensions, fitted metric distances are

\[
r_{ij}=\left\(\sum_q|y_{iq}-y_{jq}|^p\right\)^{1/p},
\]

with (p=2) by default. Let \(\delta_{ij}\) be input dissimilarities. The isotonic fit is performed on the configuration-distance vector after sorting pairs by increasing dissimilarity. In R notation, the fixed-pair-order evaluation is `isoreg(r[order(delta)])$yf`; the pair vector from `dist` is in lower-triangle column order. Passing `delta` as the `x` argument to `isoreg` instead, or pooling all equal dissimilarities into one block, does not reproduce R's public stress.

Kruskal Stress-1 is

\[
Stress_1=100\sqrt{\frac{\sum_{i<j}\(r_{ij}-\hat r_{ij}\)^2}
 {\sum_{i<j}r_{ij}^2}},
\]

where `isoreg` fitted disparities are used without an additional post-regression norm rescaling. 

## Tie ordering

R's public results use a fixed pair order. Sort all pairs by increasing dissimilarity and preserve the original lower-triangle column order within equal dissimilarities. Apply isotonic regression to individual pair distances in that order; do not pool tied dissimilarities into one block and do not reorder pairs within a tie by their configuration distances.

The fixture suite includes tied grid, eurodist and USArrests data, as well as tie-free swiss data. These cases distinguish the fixed-order convention from free ordering within tied groups.

## Stress-1 scaling

Use the disparities returned by isotonic regression directly. Do not rescale the fitted disparities to match the norm of the configuration-distance vector. The denominator of Stress-1 is the sum of squared configuration distances.

## Optimizer endpoint check

The endpoint comparison must be performed after applying the fixed tie order and unscaled Stress-1 objective above. The earlier endpoint table in the stage-1 investigation was produced by the pre-correction objective and tie-block implementation; it is historical diagnostic data only and is not evidence about the corrected implementation. The stage-2 gate is the tight R fixture comparison specified in the choices below.

## R-observed constraints

A zero or negative dissimilarity errors. Missing/infinite dissimilarities require an explicit initial configuration. An initial configuration must have (n) rows and (k) columns. (k) is between 1 and (n-1). (p=1) and (p=3) produce results distinct from default (p=2). R's \(10^{150}\) scale behavior (stopping at the start) is a scale-dependent stopping artifact and should not be copied.

## Stage-2 implementation notes

The user's current decisions are recorded in the `rStats.js's choices` section below and supersede the historical stage-1 investigation. In particular, the fixed pair order and unscaled Stress-1 definition above are authoritative; the older primary-tie recommendation and pre-correction endpoint figures are not current requirements.

## rStats.js's choices

The user's decisions of 2026-11-22 (Issue #556), written by Claude. They take precedence over every other section.

1. Kruskal Stress-1 in percent, primary approach to ties, Minkowski `p`, default start = rStats.js's `cmdscale`, explicit
   `y` accepted; R's errors (nonpositive dissimilarity, NA without `y`, wrong `y`, k out of range)
2. **Optimizer (user's decision): Kruskal's numerical method, matched to R's progress.** Build the steps from Kruskal
   (1964b) "Nonmetric multidimensional scaling: a numerical method" (gradient, step size, stopping) and aim to reproduce
   R's printed stress every 5 iterations (`printed` in the fixtures) and R's final points and stress. If that cannot be
   reached, the pass condition becomes agreement with R run to tight convergence (add cases with `tol = 1e-10`,
   `maxit = 1000`), and the default-setting difference is documented; report the evidence before switching
3. Return `{ points, stress }` plus the progress as numbers (`trace`: the stress at each reported iteration and whether
   it converged), so that the progress can be tested; no printing
4. Signs: the default start is rStats.js's `cmdscale` (choice 2 there), so columns may be reflected relative to R; tests
   align column signs, stress is compared directly
5. The 1e150 behaviour of R (`isomds_scale`: stops at the start) is not copied: rStats.js's stopping is scale invariant;
   a documented difference, tested by equivariance
7. **Switch of the pass condition (2026-11-23, under choice 2):** ChatGPT reported that Kruskal's method did not reach R's
   printed progress. The pass condition is now agreement with R run to tight convergence (`isomds_tight_*`: `tol = 1e-10`,
   `maxit = 5000`, all converged): stress within 1e-6 relative, points within 1e-5 of R's largest absolute coordinate after
   an orthogonal Procrustes alignment (p = 2) or column reflections and permutations (other p). At the default settings
   the points are a documented difference; rStats.js's default stress must be at most 1.01 times R's
8. **Ties (user's decision of 2026-11-23, Issue #560; replaces "primary approach to ties" in choice 1):** R's fixed
   order. Sort the pairs by dissimilarity with a stable sort, keeping the lower-triangle (column-wise) pair order within
   equal dissimilarities, and fit the isotonic regression in that order. R's reported stress is this evaluation in
   every case (grid ties 0.00383293527945, eurodist 5.88354761298), while the free-order primary fit is lower there, so
   the primary approach cannot reach choice 7. Documented as R's convention
9. Stress-1 without any rescaling after the isotonic fit: `100 sqrt(sum((r - fitted)^2) / sum(r^2))` (swiss at R's tight
   endpoint: 4.21928575212). Fix the objective and the tie rule first, then repeat the R-endpoint start test
10. The optimizer is free under choice 7 (the path does not have to be R's): Kruskal's gradient for every p, or another
    method that converges to R's tight endpoints from rStats.js's `cmdscale` start. Report the endpoint test and the
    tight comparison per case. **If choice 7 is not reached, isoMDS leaves 1.11.0** (user's decision of 2026-11-23)

11. **The optimizer (Claude's experiments of 2026-11-24, user's decision to bring isoMDS back into 1.11.0; replaces the
    freedom of choice 10):** R's iterates are those of a textbook BFGS on the stress in percent, found from public outputs
    only (`experiments/isomds111-iterates.{R,txt}`, `experiments/isomds111-bfgs.{R,txt}`; the reasoning is in
    `briefs/isomds-1.11-bfgs.ja.md`). The inverse-Hessian BFGS update (Nocedal & Wright, ch. 6) from the identity, a unit
    first trial step along `-H g`, Armijo backtracking, a reset to the identity when the curvature `s'y` is not positive,
    the gradient of the fixed-order Stress-1 (choices 8, 9) with the isotonic fit held fixed. R's `maxit = 1` and `2`
    give the same point and `maxit = k + 1` gives the k-th BFGS iterate (swiss within 1.6e-14, eurodist within 2.2e-11
    of R's largest coordinate over 11 iterates). Still open (ChatGPT, from R's outputs): the backtracking factor and the
    Armijo constant (no backtracking occurred in those 11 iterates), the reset rule after a failed line search, the
    iteration count, the stopping rule (`tol`), the gradient for p != 2 and the k = 1 and k = 3 cases
12. **Pass condition (replaces choice 7's switch):** at the default settings, R's printed progress (the stress every 5
    iterations), the final stress within 1e-9 relative and the points within 1e-7 of R's largest absolute coordinate
    after column-sign alignment (BFGS from the identity is equivariant under the column reflections of the start), in
    every fixture case; the tight cases (`isomds_tight_*`) within choice 7's tolerances. A case that cannot reach this is
    reported with the iterate where it departs from R. Choice 5 (scale-invariant stopping) stays
13. **Scale (user's decision of 2026-11-24; replaces choice 5 and any scale equivariance of the path):** R's BFGS starts
    from the identity in the original coordinates (the first step is exactly `-g`, step 1; `experiments/isomds111-bfgs`),
    so the path depends on the scale of the start, as R. rStats.js does the same: no normalization of the coordinates or
    of the initial inverse Hessian. The stopping rule is R's (choice 11, from R's outputs). The extreme-scale cases
    (`isomds_scale`, `isomds_scale_y`) are compared with R where R's result is determined; otherwise they are a
    documented difference ("the answer depends on the scale of the configuration, as in R"). No equivariance test of
    the path
