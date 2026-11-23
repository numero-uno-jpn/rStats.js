# Sammon nonlinear mapping: sammon

Reference basis: Sammon (1969), “A Nonlinear Mapping for Data Structure Analysis”, *IEEE Transactions on Computers* C-18; Kruskal (1964); Cox & Cox, *Multidimensional Scaling*; Borg & Groenen, *Modern Multidimensional Scaling*; MASS 7.3.66 public-call results in `experiments/sammon111.R` and `experiments/sammon111-formula.R`. No MASS source or C/Fortran code was consulted.

## Objective and gradient

For positive dissimilarities \(\delta_{ij}\) and configuration distances \(d_{ij}(Y)=\lVert y_i-y_j\rVert_2\), Sammon's normalized stress is

\[
E(Y)=
\frac{\displaystyle\sum_{i<j}
 (\delta_{ij}-d_{ij}(Y))^2/\delta_{ij}}
 {\displaystyle\sum_{i<j}\delta_{ij}}.
\]

It is a proportion, not a percentage, and is invariant to a common positive scaling of the dissimilarities and configuration. The gradient with respect to point \(y_i\) is

\[
\nabla_{y_i}E=
\frac{2}{\sum_{a<b}\delta_{ab}}
\sum_{j\ne i}
\frac{d_{ij}-\delta_{ij}}{\delta_{ij}d_{ij}}
(y_i-y_j),
\]

for nonzero configuration distances. The direct objective agrees with R for `sammon_small`: returned stress 0.0031425560111843593 versus direct 0.0031425560111843598. The initial stress is 0.00898 and the public trace reports 0.00314 after 10 iterations, unchanged after 20. Cases: `sammon_small`, `sammon_small_k1`, `sammon_grid`, `sammon_grid_default`.

## Initialization, controls and convergence observations

The default initial configuration is classical MDS; an explicit `y` may be supplied. `k`, `niter`, `magic`, and `tol` control dimension and iteration. R's `swiss` case is a notable boundary: the initial stress is 0.019592931432643287, and both the default call and `niter=0` return 0.019592931432643283 with the trace “stress after 0 iters”. The independent analytic gradient norm at the initial configuration is 0.0005582441927090762; small steps along the negative gradient lower the objective slightly (from 0.019592931432643287 to 0.019592928316277784 at step 0.01). Thus there are local descent directions, but the public optimizer does not accept an iteration from this start.

The exact diagonal Hessian approximation, proposed Newton step, `magic` backtracking schedule, and stopping inequality have not yet been independently reconstructed. It is therefore not established whether the Swiss zero-iteration result is caused by a rejected Newton step, a scale/conditioning issue, or another stopping condition. Do not claim optimizer compatibility based only on the objective and gradient.

R errors for zero/negative dissimilarities, duplicate initial coordinates, malformed initial configuration, missing distances without explicit `y`, and infinite distances are recorded in `sammon_zero_distance`, `sammon_negative`, `sammon_na`, `sammon_inf`, and the y-shape cases. The dimension must be in 1 through n-1 (`sammon_k_too_big`). Common dissimilarity scaling by 2^300 and 2^-300 preserves stress (`sammon_scale_big`, `sammon_scale_small`); scaling only the initial configuration by 2^100 is a poor numerical start (`sammon_scale_y`). Swiss zero-iteration behavior is also captured in `sammon_swiss` and `tight_swiss`.

## Decisions for the user

1. Return value: (a) points and stress only; (b) also structured numeric progress and convergence. **Recommend (b)** if progress can be returned as numeric records rather than console text.
2. Initialization: (a) default cmdscale plus optional `y`; (b) require `y`. **Recommend (a)**.
3. Invalid dissimilarities and duplicate `y`: (a) reject; (b) regularize. **Recommend (a)**; zero/negative dissimilarities make the objective undefined.
4. Optimizer: (a) reproduce MASS's update exactly; (b) use another documented stable optimizer for the same objective. **Recommend (a) only after the diagonal Hessian, line search and stop rule are independently reconstructed. Otherwise defer `sammon` from 1.11.0.**
5. Swiss zero-iteration behavior: (a) reproduce it; (b) continue whenever a descent direction exists. **Recommend (b)** if the Newton step is shown to be a false rejection; do not copy the early stop without understanding it.

## rStats.js's choices

