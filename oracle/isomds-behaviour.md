# Non-metric multidimensional scaling: `isoMDS`

Reference: MASS 7.3.66 `isoMDS`, its public help, Kruskal (1964, both Psychometrika papers), Venables & Ripley, *Modern Applied Statistics with S*. No MASS source or Fortran was consulted.

## Configuration distances and stress

For a configuration (Y=(y_1,\ldots,y_n)) in (k) dimensions, the fitted metric distances are
[
r_{ij}=\left(\sum_{q=1}^{k}|y_{iq}-y_{jq}|^p\right)^{1/p},
]
where (p=2) by default. Let (δ_{ij}) be the input dissimilarities. A monotone regression of the fitted distances on (δ) produces disparities (\hat r_{ij}) that are nondecreasing in (δ_{ij}). Equal input dissimilarities share one fitted disparity (Kruskal's primary approach to ties); the isotonic fit is a least-squares monotone fit, equivalently pooled-adjacent-violators regression over ordered dissimilarity groups.

Kruskal Stress-1, reported as a percentage, is
[
Stress=100\sqrt{\frac{\sum_{i<j}(r_{ij}-\hat r_{ij})^2}{\sum_{i<j}r_{ij}^2}}.
]
The denominator uses the squared configuration distances. Direct calculation of the pair distances and isotonic fit for `isomds_small_k1` gives 0.004759614736755%, matching R's 0.00475961473676101%. The small two-dimensional solution `isomds_small` has stress (2.13462043281511\times10^{-14}), and `isomds_grid_ties_default` is effectively zero. The perturbed-grid initial configuration `isomds_grid_ties` yields 0.00383293528945063, verifying that tied dissimilarities are handled as tied blocks rather than assigned independent disparities.

## Initialization, iteration, and return values

The default starting configuration is classical MDS (`cmdscale(d,k)`). An explicit `y` supplies the starting coordinates; it must have (n) rows and (k) columns. The returned points and stress are the final configuration and stress. R's default trace prints an initial stress, progress every five iterations, and a final status. With `maxit=0`, the initial configuration is returned unchanged and only the initial stress is printed (`isomds_swiss_maxit0)); `maxit=5` stops after five iterations (`isomds_swiss_maxit5`).

The mathematical objective and the primary-tie isotonic disparities are established. The exact numerical search direction, step-length/line-search schedule, and all stopping-test details have not yet been independently reconstructed from the permitted literature and public outputs. In particular, R's `tol` behavior is recorded in `isomds_swiss_tol` but the exact stopping inequality is not confirmed. Do not claim an exact reproduction of MASS's optimizer until these details are checked.

## R-observed constraints

- A zero or negative dissimilarity errors (`isomds_zero_distance`, `isomds_negative`).
- Missing/infinite dissimilarities require an explicit initial configuration (`isomds_na`).
- An initial configuration with the wrong number of rows errors (`isomds_swiss_y_wrong`).
- (k) must be between 1 and (n-1) (`isomds_k_too_big`).
- (p=1) and (p=3) produce distinct results from the default (p=2): `isomds_swiss_p1`, `isomds_swiss_p3`.
- Multiplying all dissimilarities by (10^{150}) causes R to stop at the initial stress (5.46380043178661), with no coordinate optimization (`isomds_scale`). Scaling the supplied initial configuration by (10^{100}) has the same reported initial stress (`isomds_scale_y`). This is a scale-dependent stopping artifact, not a property of Kruskal stress.

## Numerical checks and unresolved items

The stress formula and primary tie grouping were checked independently for `isomds_small_k1` and `isomds_grid_ties*`. Public output cases include Swiss, eurodist, USArrests, small Euclidean and non-Euclidean examples, (k=1), (k=3), explicit starts, and iteration limits. The optimizer's exact step sequence remains unverified; in particular, no claim is made that the final coordinates for the Swiss examples can be reproduced from the current formula alone.

## Decisions for the user

1. Use Kruskal Stress-1 in percent with primary tie handling. **Recommended:** match this definition; it is numerically verified.
2. Use classical MDS as the default start, accept explicit (y), and use Minkowski (p). **Recommended:** match R's public interface.
3. Reproduce MASS's exact optimizer and stop rule, or implement a well-defined scale-invariant gradient/majorization optimizer that minimizes the same stress. **Recommended:** choose a scale-invariant optimizer and document that final coordinates may differ from MASS; the (10^{150}) behavior in R should not be copied.
4. Expose captured trace lines or return only `points` and `stress`. **Recommended:** return only the numerical result; tracing belongs in an optional callback/log facility, not in the statistical result object.
5. Decide whether to reject nonpositive dissimilarities and require (y) for missing inputs. **Recommended:** match the observed R errors.

## rStats.js's choices

