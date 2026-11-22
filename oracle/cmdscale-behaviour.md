# Classical multidimensional scaling: `cmdscale`

Reference: R 4.6.2 `stats::cmdscale`, public help, Torgerson (1952), Gower (1966), and Cailliez (1983). No R source was consulted.

## Double centering and coordinates

For a symmetric hollow dissimilarity matrix (D=(d_{ij})) of size (n), define (J=I-\mathbf1\mathbf1'/n) and
[
B=-\frac12 JD^{\circ2}J,
]
where (D^{\circ2}) is the elementwise square. This is the double-centered Gram matrix. With the symmetric eigendecomposition (B=V\Lambda V'), order eigenvalues decreasingly and retain positive eigenvalues. The (k)-dimensional coordinates are
[
X_k=V_k\Lambda_k^{1/2}.
]
The sign of each coordinate column is not mathematically identified. rStats.js will use the user-specified deterministic convention: the entry with largest absolute value in each column is positive (first entry wins an absolute-value tie). This can differ from R's LAPACK-dependent sign; compare after sign alignment.

Verified by independent double-centering/eigenvalue calculations on `cmdscale_small_k1` through `cmdscale_small_k4`, `cmdscale_non_euclidean`, `cmdscale_line_k1`, `cmdscale_zero_distances`, and `cmdscale_simplex`. For `cmdscale_small_k2`, the eigenvalues are (41.6405172120904,13.6381582990179,5.12132448889153), followed by values numerically near zero; the first two positive eigenvalues yield the reported two-dimensional solution. `cmdscale_non_euclidean` has eigenvalues (4.5,0.5,\approx0,-1.5), confirming that negative eigenvalues are returned but not used as coordinate dimensions.

## Returned values

- `points`: (n\times k') coordinates, where (k'le k) is the number of retained positive eigenvalues.
- `eig`: all (n) eigenvalues, including zero and negative values, when requested.
- `x` (R's `x.ret`): the double-centered matrix (B), when requested.
- `ac`: the additive Cailliez constant (0 when `add=FALSE`).
- `GOF`: two proportions for the retained positive eigenvalues:
  [
  GOF_1=\frac{\sum_{i=1}^{k'}\lambda_i}{\sum_{i=1}^{n}|\lambda_i|},\qquad
  GOF_2=\frac{\sum_{i=1}^{k'}\lambda_i}{\sum_{i:\lambda_i>0}\lambda_i}.
  ]
  Verified by `cmdscale_small_k2` (both 0.915209859455438) and `cmdscale_non_euclidean` (0.769230769230769 and 1).

If fewer than (k) eigenvalues are positive, R warns and returns fewer coordinate columns: `cmdscale_non_euclidean_k3`. R's default non-list call returns coordinates only; `eig=TRUE` returns the structured result. `list.=TRUE` is a separate list-return switch in R.

## Cailliez additive constant

For off-diagonal entries, let (D_c=D+c(\mathbf1\mathbf1'-I)). The corresponding centered matrix is
[
B(c)=-\frac12 J D_c^{\circ2}J
=A+cC+\frac{c^2}{2}J,
\quad A=-\frac12 JD^{\circ2}J,\quad C=-JDJ.
]
On the centered subspace, (J) is the identity. The smallest (c\ge0) for which (B(c)) is positive semidefinite is the Cailliez constant. Equivalently, it is the largest nonnegative real root of
[
\det(c^2 I+2cC+2A)=0
]
restricted to the centered subspace. For the non-Euclidean four-point case, independent eigenvalue/root calculation gives (c=\sqrt3=1.732050807568877), matching `cmdscale_non_euclidean_add`. This confirms the non-Euclidean root, not the last-bit numerical details of R's polynomial solver.

For Euclidean examples R reports tiny positive constants from roundoff: (4.76671737192258\times10^{-8}) for `cmdscale_small_add`, (2.54626601163189\times10^{-12}) for `cmdscale_usarrests_add`, and (1.61142910676944\times10^{-8}) for `cmdscale_line_add`. A mathematically stable implementation should treat these as zero within a scale-aware tolerance; exact agreement with R's tiny positive artifacts is not a mathematical requirement.

## Inputs and unresolved matrix asymmetry

The number of dimensions must be in (1,\ldots,n-1); NA dissimilarities error. Two observations return one coordinate; one observation is invalid. Matrix inputs are accepted. The asymmetric-matrix case `cmdscale_asymmetric` is not yet explained by lower-triangle extraction or simple arithmetic symmetrization; an additional public R probe is in progress. The final rule for asymmetric matrices is therefore **unconfirmed**.

## Numerical checks

The double-centering formula and eigenvalue ordering were independently checked on the small Euclidean, non-Euclidean, line, simplex, zero-distance and asymmetric-matrix cases. The Cailliez equation was independently checked on `cmdscale_non_euclidean_add`. `cmdscale_vs_pca` provides a further check: for Euclidean distances, the coordinates agree with principal-component scores up to orthogonal sign conventions.

## Decisions for the user

1. Return the full structured result on every call, or mirror R's matrix-only default and structured return only when requested. **Recommended:** always return `points`, `eig`, `x`, `ac`, and `GOF`; absent optional outputs can be empty/null. This makes the API stable.
2. Use the deterministic column-sign convention already decided by the user; document the difference from R and sign-align tests.
3. For `add=TRUE), set a numerically negligible Cailliez constant to zero using a scale-aware threshold. **Recommended:** stable PSD/root calculation, not R's roundoff-sized positive artifacts.
4. For asymmetric matrix input, either reproduce R's lower-triangle eigensolver convention after double-centering, or reject asymmetric matrices as mathematically ambiguous. **Recommended:** reproduce the observed R convention for compatibility, while documenting that the returned `x` is asymmetric and the eigensolver uses its lower triangle.
5. For non-Euclidean inputs, retain all eigenvalues in `eig`, but construct points only from positive eigenvalues and warn when fewer than (k) are available.

## rStats.js's choices

