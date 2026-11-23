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

## 1.11.0 investigation: strict R endpoint comparison and the 1.10.0 gap

The current implementation is tested with `tol=10^{-10}` and `maxit=5000` against the tight R results. The actual PR #561 CI run (commit `541a14`, test job `test (22)`) reports the following relative stress errors. Values marked approximately zero are at floating-point roundoff; their relative error is not a useful absolute measure.

| Case | Current rStats stress | R tight stress | Signed relative difference |
|---|---:|---:|---:|
| Swiss, p=2 | 4.22022539475 | 4.21928575212 | +2.227018e-4 |
| Swiss, k=3, p=2 | 1.00185475670 | 1.00184218637 | +1.254722e-5 |
| Swiss, p=1 | 5.47585387022 | 5.48052561711 | −8.524268e-4 |
| Swiss, p=3 | 4.23954701071 | 4.23855106583 | +2.349730e-4 |
| Eurodist, p=2 | 5.93250683352 | 5.88354761293 | +8.321377e-3 |
| USArrests, p=2 | 0.940098796807 | 0.939167715149 | +9.913902e-4 |
| small, p=2 | approximately 2.7e-14 | 1.94253391535e-14 | absolute difference approximately 8e-15 |
| small, k=1, p=2 | approximately 1.1e-14 | 0.00475961473645 | current lower |
| non-Euclidean, p=2 | approximately 9.8e-15 | 8.09391458903e-14 | both near zero |
| grid ties, p=2 | approximately 1.4e-14 | 0.00383293527945 | current lower |

The six nonzero Swiss/Eurodist/USArrests comparisons miss the required relative stress tolerance of \(10^{-6}\). The current stress is higher in Swiss p=2, Swiss k=3, Swiss p=3, Eurodist and USArrests (case a); it is lower for Swiss p=1 (case c). In `small` and `non-Euclidean`, both stresses are near zero but the strict relative comparison is numerically ill-conditioned (case b when coordinates are considered). For `small_k1` and `grid_ties`, the current stress is near zero while the R endpoint has nonzero stress (case c).

The same CI run reports Procrustes-Gram coordinate mismatches for all eight tight cases `isomds_tight_swiss`, `isomds_tight_swiss_k3`, `isomds_tight_eurodist`, `isomds_tight_usarrests`, `isomds_tight_small`, `isomds_tight_small_k1`, `isomds_tight_non_euclidean`, and `isomds_tight_grid_ties`. Thus even where the stresses are both near zero, the configurations are not the same after removing orthogonal freedom. The strict coordinate criterion is not met.

### Tie-rule discrepancy

The current implementation explicitly uses primary-tie blocks: equal input dissimilarities are constrained to share one fitted disparity. A direct evaluation of that primary-tie Stress-1 objective at the R tight coordinates gives:
- `small`: 1.21910651902, whereas R reports \(1.94\times10^{-14}\).
- `grid_ties`: 2.41370337405, whereas R reports 0.00383293527945.
- `small_k1`: 0.00475961473779, agreeing with R's 0.00475961473645.

The public R endpoints for `small` and `grid_ties` are therefore incompatible with the current primary-tie constraint. This is evidence that R permits a different ordering/treatment of equal dissimilarities; it does **not** yet identify the exact tie-order algorithm. `small_k1` alone is a misleading tie oracle because the primary-tie calculation happens to agree there.

### Why 1.10.0 did not meet choice 7

There are two independent obstacles:
1. The primary-tie restriction does not reproduce the R tight endpoint on tied cases.
2. Even apart from tied cases, the current p=2 Guttman/majorization endpoint differs from R for Swiss, Eurodist and USArrests. The current p≠2 gradient path also misses the p=1 and p=3 Swiss stress gates. The CI comparison uses 5000 iterations and a tight tolerance, so simply increasing the default `maxit=50` is not an adequate explanation. The CI output does not include the final trace for each case, so it does not distinguish a no-descent early stop from a different local minimum.

The default Swiss result in `isomds_swiss` (stress 4.4926687589981045) is not the endpoint oracle. The tight comparison is against 4.2192857521199683. Matching a default, early-stopped call is not evidence of passing choice 7.

### Decisions for the user

1. **Tie rule:** (a) retain primary ties (the existing choice); (b) replace them with the R-compatible tie treatment once its exact rule is established. **Recommend (b) if choice 7 remains a hard release gate.** This reverses the current primary-tie choice and needs explicit approval; do not silently change it.
2. **Optimizer for p=2:** (a) keep Guttman/majorization; (b) use the Kruskal gradient method. **Recommend (b) for strict R endpoint compatibility**, while keeping Guttman only as an explicitly different optimization option if desired. The untied cases show that changing tie handling alone is insufficient.
3. **Optimizer for p≠2:** continue the Kruskal gradient family, but derive and test its exact step and stopping rule against the tight R endpoints; the current gradient implementation misses both Swiss p=1 and p=3 stress gates.
4. **Release gate:** (a) keep choice 7 (tight stress and coordinates); (b) relax to stress-only or a mathematical local optimum. **Recommend (a)**. Do not claim `isoMDS` passes 1.11.0 until both the tie rule and optimizer meet the strict tolerance.

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
