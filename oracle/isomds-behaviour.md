# Non-metric multidimensional scaling: isoMDS

Reference: MASS 7.3.66 isoMDS, its public help, Kruskal (1964, both Psychometrika papers), Venables & Ripley, Modern Applied Statistics with S. No MASS source or Fortran was consulted.

## Configuration distances and stress

For a configuration Y=(y1,...,yn) in k dimensions, fitted metric distances are:
r_ij = (sum over q of |y_iq-y_jq|^p)^(1/p),
where p=2 by default.

Let δ_ij be input dissimilarities. A monotone regression of fitted distances on δ produces disparities rhat_ij that are nondecreasing in δ. Equal input dissimilarities share one fitted disparity (Kruskal's primary approach to ties); the isotonic fit is a least-squares monotone fit, equivalently pooled-adjacent-violators regression over ordered dissimilarity groups.

Kruskal Stress-1, reported as a percentage, is:
Stress = 100 * sqrt( sum_{i<j}(r_ij-rhat_ij)^2 / sum_{i<j} r_ij^2 ).

The denominator uses squared configuration distances. Direct calculation of pair distances and isotonic fit for isomds_small_k1 gives 0.004759614736755%, matching R's 0.00475961473676101%. isomds_small has stress 2.13462043281511e-14, and isomds_grid_ties_default is effectively zero. The perturbed-grid initial configuration isomds_grid_ties and gives 0.00383293528945063, verifying that tied dissimilarities are handled as tied blocks rather than assigned independent disparities.

## Initialization, iteration, and return values

The default starting configuration is classical MDS (cmdscale(d,k)). An explicit y supplies starting coordinates; it must have n rows and k columns. The returned points and stress are the final configuration and stress. Since the default start is cmdscale, coordinate columns may differ from R by sign under rStats.js's deterministic largest-absolute-entry-positive convention; stress is invariant. Tests must align each column's sign before comparing all coordinates. R's default trace prints an initial stress, progress every five iterations, and a final status. With maxit=0, the initial configuration is returned unchanged and only the initial stress is printed (isomds_swiss_maxit0); maxit=5 stops after five iterations (isomds_swiss_maxit5).

The mathematical objective and primary-tie isotonic disparities are established. The exact numerical search direction, step-length/line-search schedule, and all stopping-test details have not yet been independently reconstructed from the permitted literature and public outputs. In particular, R's tol behavior is recorded in isomds_swiss_tol but the exact stopping inequality is not confirmed. Do not claim an exact reproduction of MASS's optimizer until these details are checked.

## R-observed constraints

- A zero or negative dissimilarity errors (isomds_zero_distance, isomds_negative).
- Missing/infinite dissimilarities require an explicit initial configuration (isomds_na).
- An initial configuration with the wrong number of rows errors (isomds_swiss_y_wrong).
- k must be between 1 and n-1 (isomds_k_too_big).
- p=1 and p=3 produce results distinct from default p=2: isomds_swiss_p1, isomds_swiss_p3.
- Multiplying all dissimilarities by 1e150 causes R to stop at initial stress 5.46380043178661, with no coordinate optimization (isomds_scale). Scaling supplied initial configuration by 1e100 has the same reported initial stress (isomds_scale_y). This is a scale-dependent stopping artifact, not a property of Kruskal stress.

## Numerical checks and unresolved items

The stress formula and primary tie grouping were checked independently for isomds_small_k1 and isomds_grid_ties*. Public output cases include Swiss, eurodist, USArrests, small Euclidean and non-Euclidean examples, k=1, k=3, explicit starts, and iteration limits. The optimizer's exact step sequence remains unverified; no claim is made that final Swiss coordinates can be reproduced from the current formula alone.

## Decisions for the user

1. Use Kruskal Stress-1 in percent with primary tie handling. Recommended: match this definition; it is numerically verified.
2. Use classical MDS as the default start, accept explicit y, and use Minkowski p. Recommended: match R's public interface.
3. Reproduce MASS's exact optimizer and stop rule, or implement a well-defined scale-invariant gradient/majorization optimizer that minimizes the same stress. Recommended: choose a scale-invariant optimizer and document that final coordinates may differ from MASS; the 1e150 behavior in R should not be copied.
4. Expose captured trace lines or return only points and stress. Recommended: return only the numerical result; tracing belongs in an optional callback/log facility, not in the statistical result object.
5. Decide whether to reject nonpositive dissimilarities and require y for missing inputs. Recommended: match observed R errors.

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
