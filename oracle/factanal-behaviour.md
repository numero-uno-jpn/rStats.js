# Factor analysis (factanal): the behaviour to reproduce

What R 4.5.2's `factanal` (maximum likelihood) computes, in words. Fixture `factanal` (`oracle/optim.R`; format in its
header). It needs this library's `optim` (L-BFGS-B, `oracle/optim-behaviour.md`), `eigen` (symmetric), `svd`, `solve`
and least squares. Where this file and the fixture seem to disagree, report it.

## API

`factanal(x, factors, options?)` with `x` a data matrix (rows observations) or, via `options.covmat` and
`options.nObs`, a covariance matrix; `rotation` `"varimax"` (default), `"promax"` or `"none"`; `control` `{ lower
(0.005), start? }`. Result `{ uniquenesses, loadings, rotmat?, STATISTIC, dof, PVAL, converged, objective, counts }`
(STATISTIC and PVAL NaN when there is no n.obs or dof ≤ 0).

## Steps

1. Covariance: the unbiased covariance matrix of x (n.obs = rows), or covmat. p variables; at least 3 (error `factor
   analysis requires at least three variables`). `dof = ((p − q)² − p − q)/2` for q factors; dof < 0: error `q
   factors are too many for p variables` (singular `factor is` for q = 1). Scale to the correlation matrix S.
2. Start: `start_i = (1 − q/(2p)) / (S^-1)_ii`.
3. Minimise over the uniquenesses ψ (`lower ≤ ψ_i ≤ 1`) with `optim` L-BFGS-B, `parscale` 0.01 for each, `fnscale` 1,
   the objective and gradient:
   - with `S* = D S D`, `D = diag(1/sqrt(ψ))`, and the eigenvalues `e_1 ≥ ... ≥ e_p` of S*: objective `−(Σ_{i>q} (log
     e_i − e_i) − q + p)`;
   - gradient: with the first q eigenvectors `V` of S* and `Λ = diag(sqrt(ψ)) V diag(sqrt(max(e_i − 1, 0)))`, `G = Λ Λ' +
     diag(ψ) − S`, gradient `diag(G)/ψ²`.
   `converged` = (optim's convergence = 0); else error `unable to optimize from this starting value`.
4. Loadings `Λ` from the optimum as in the gradient; then sort the columns by decreasing column sum of squares, and
   change the sign of each column whose sum is negative.
5. Rotation: `varimax` (normalised): divide each row by its length, `T = I`, iterate up to 1000 times: `Z = X T`, `B =
   X' (Z³ − Z diag(colSums(Z²))/p)` (cubes elementwise), `T = U V'` from the SVD `B = U D V'`, stop when `Σ D <
   previous Σ D × (1 + 1e-5)`; loadings `X T` times the row lengths, `rotmat = T`. `promax` (m = 4): varimax first, then
   `Q = L ∘ |L|³`, `U` the least squares coefficients of Q on L, scaled by `sqrt(diag((U'U)^-1))` column-wise, loadings
   `L U`, rotmat `T_varimax U`. Then sort and sign-fix again as in step 4 (by column sums of squares; stats' promax
   gives no factor covariance), permuting and signing the columns of rotmat alike.
6. `STATISTIC = (n.obs − 1 − (2p + 5)/6 − 2q/3) × objective`, `PVAL` its upper chi-squared tail on dof (only for dof > 0
   and a known n.obs).

The fixture writes the loadings with each column signed so that its sum is positive (as step 4 does).

## Accuracy

Within a relative 1e-12 of R value by value (the iterations of L-BFGS-B must be R's); loadings compared after the sign
convention. A loading may instead be within 1e-12 times the largest absolute loading of its column: R's symmetric
eigensolver (LAPACK dsyevr) and this library's (EISPACK tql2) agree only to rounding, so loadings near 0 carry an
absolute error of a few units of that scale. No loosening; report a case where the iterations differ instead of adjusting.
