# Sammon nonlinear mapping: sammon

Reference basis: Sammon (1969), “A Nonlinear Mapping for Data Structure Analysis”, *IEEE Transactions on Computers* C-18; Kruskal (1964); Cox & Cox, *Multidimensional Scaling*; Borg & Groenen, *Modern Multidimensional Scaling*; MASS 7.3.66 public-call results in `experiments/sammon111.R`, `experiments/sammon111-formula.R`, `experiments/sammon111-newton.R`, `experiments/sammon111-step2.R`, and `experiments/sammon111-step3.R`. No MASS source or C/Fortran code was consulted.

## Objective and pseudo-Newton update

For positive dissimilarities (\delta_{ij}) and configuration distances (r_{ij}=\lVert y_i-y_j\rVert_2), Sammon's normalized stress is

\[
E(Y)=
\frac{\displaystyle\sum_{i<j}(\delta_{ij}-r_{ij})^2/\delta_{ij}}
 {\displaystyle\sum_{i<j}\delta_{ij}}.
\]

For (r_{ij}>0), the gradient component is

\[
g_{i\alpha}=\frac{2}{\sum_{a<b}\delta_{ab}}
\sum_{j\ne i}\left(\frac1{\delta_{ij}}-\frac1{r_{ij}}\right)
(y_{i\alpha}-y_{j\alpha}),
\]

and the diagonal second derivative is

\[
h_{i\alpha}=\frac{2}{\sum_{a<b}\delta_{ab}}
\sum_{j\ne i}\left[
\frac1{\delta_{ij}}-\frac1{r_{ij}}+
\frac{(y_{i\alpha}-y_{j\alpha})^2}{r_{ij}^3}
\right].
\]

The pseudo-Newton coordinate update is

\[
y_{i\alpha}\leftarrow y_{i\alpha}
- magic\,\frac{g_{i\alpha}}{|h_{i\alpha}|}.
\]

The one-step experiments indicate that the candidate configuration is updated simultaneously from the current configuration before the full stress is evaluated. A sequential coordinatewise sweep is not equivalent and can accept a step that the simultaneous update rejects.

## Magic adaptation and Swiss zero-iteration case

The printed `magic` values identify the adaptation factors. A rejected step shrinks `magic` by 0.2; an accepted step increases it by 1.5; the upper cap is 0.5. In the three-point case, the printed 0.150 is exactly (0.5\times0.2\times1.5). The repeated 0.500 output in `sammon_small` is consistent with the upper cap.

For `swiss`, the cmdscale initial stress is 0.019592931432643287. A simultaneous one-sweep calculation with (magic=0.5\times0.2^j) gives:

| j | magic | stress after one simultaneous sweep |
|---:|---:|---:|
| 0 | 0.5 | 1094.6186075388 |
| 1 | 0.1 | 42.4569898342 |
| 2 | 0.02 | 1.4991909698 |
| 3 | 0.004 | 0.0582920375 |
| 4 | 0.0008 | 0.0194026417 |

The first four trials increase stress; the fifth would decrease it. R nevertheless returns zero iterations. This is consistent with a four-trial backtracking limit that stops after (j=0,1,2,3), before trying (j=4). It is a line-search cutoff, not evidence that the initial configuration has no descent direction.

## Stopping tolerance and progress output

The optimizer prints progress every ten iterations, but the stopping check is performed after each iteration. For `small`, `tol=1e-14` stops at iteration 80: requesting 81 or 89 iterations returns the same stress as 80. With `tol=1e-30`, iteration 81 continues and lowers stress from 0.0031425094422446722 to 0.0031425094422446636. The relative decrease from iteration 79 to 80 is about (4.3\times10^{-15}), below (10^{-14}). Thus the stop condition is a per-iteration relative stress reduction below `tol`, not a comparison only every ten iterations.

Tight public runs stop at 80 iterations for `small`, 140 for `eurodist`, and 370 for `USArrests` at `tol=1e-14`. The returned stress agrees with the direct Sammon objective.

## Decisions for the user

1. Return points and stress plus structured numeric progress; do not require console text.
2. Use cmdscale by default and accept explicit `y`.
3. Reject zero/negative dissimilarities and malformed initial configurations.
4. Implement the pseudo-Newton update with the absolute diagonal Hessian, simultaneous candidate update, and the observed magic factors. The four-trial cutoff should be a deliberate compatibility choice, not mistaken for convergence.
5. Check relative stress reduction after each iteration; print/logging cadence is separate and may remain every ten iterations.

## rStats.js's choices

