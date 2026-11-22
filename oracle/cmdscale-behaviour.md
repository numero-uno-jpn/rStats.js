# Classical multidimensional scaling: cmdscale

Reference: R 4.6.2 stats::cmdscale, public help, Torgerson (1952), Gower (1966), and Cailliez (1983). No R source was consulted.

## Double centering and coordinates

For a dissimilarity matrix D of size n, define J=I-11'/n and X=J D² J, where D² is the elementwise square. The double-centered Gram matrix used for the eigendecomposition is B=-X/2. With symmetric eigendecomposition B=VΛV', order eigenvalues decreasingly and retain positive eigenvalues. The k-dimensional coordinates are Xk=Vk sqrt(Λk).

The sign of each coordinate column is not mathematically identified. rStats.js will use the user-specified deterministic convention: the entry with largest absolute value in each column is positive (first entry wins an absolute-value tie). This can differ from R's LAPACK-dependent sign; compare after sign alignment.

Verified by independent double-centering/eigenvalue calculations on cmdscale_small_k1 through cmdscale_small_k4, cmdscale_non_euclidean, cmdscale_line_k1, cmdscale_zero_distances, and cmdscale_simplex. For cmdscale_small_k2, eigenvalues are 41.6405172120904, 13.6381582990179, 5.12132448889153, followed by values numerically near zero. cmdscale_non_euclidean has eigenvalues 4.5, 0.5, approximately 0, and -1.5; negative eigenvalues are returned but not used as coordinate dimensions.

## Returned values

- points: n × k' coordinates, where k'≤k is the number of retained positive eigenvalues.
- eig: all n eigenvalues, including zero and negative values, when requested.
- x (R's x.ret): X=J D² J, the double-centered squared-distance matrix before multiplication by -1/2. Verified from cmdscale_* and the asymmetric-matrix probe.
- ac: the additive Cailliez constant (0 when add=FALSE).
- GOF: two proportions for the retained positive eigenvalues:
  GOF1 = sum(first k' eigenvalues) / sum(abs(all eigenvalues)).
  GOF2 = sum(first k' eigenvalues) / sum(positive eigenvalues).
  Verified by cmdscale_small_k2 (both 0.915209859455438) and cmdscale_non_euclidean (0.769230769230769 and 1).

If fewer than k eigenvalues are positive, R warns and returns fewer coordinate columns: cmdscale_non_euclidean_k3. R's default non-list call returns coordinates only; eig=TRUE returns the structured result. list.=TRUE is a separate list-return switch in R.

## Cailliez additive constant

For off-diagonal entries, let Dc=D+c(11'-I). The corresponding centered matrix is:
B(c) = -1/2 J Dc² J = A+cC+(c²/2)J,
where A=-1/2 J D² J and C=-JDJ.

On the centered subspace, J is the identity. The smallest c≥0 for which B(c) is positive semidefinite is the Cailliez constant. Equivalently, it is the largest nonnegative real root of det(c²I+2cC+2A)=0 restricted to the centered subspace. For the non-Euclidean four-point case, independent eigenvalue/root calculation gives c=sqrt(3)=1.732050807568877, matching cmdscale_non_euclidean_add.

For Euclidean examples R reports tiny positive constants from roundoff: 4.76671737192258e-8 for cmdscale_small_add, 2.54626601163189e-12 for cmdscale_usarrests_add, and 1.61142910676944e-8 for cmdscale_line_add. A mathematically stable implementation should treat these as zero within a scale-aware tolerance; exact agreement with R's tiny positive artifacts is not a mathematical requirement.

## Matrix inputs, including asymmetry

The number of dimensions must be in 1,...,n-1; NA dissimilarities error. Two observations return one coordinate; one observation is invalid. Matrix inputs are accepted.

For an asymmetric matrix, R first forms X=J D² J, which remains asymmetric, and returns that unsymmetrized X as x. The symmetric eigensolver then uses the lower triangle of B=-X/2 as the symmetric matrix (mirroring it across the diagonal). It does not take the lower triangle of D, nor arithmetically or RMS-symmetrize D first. This is confirmed by cmdscale_asymmetric and mds110-asym-probe: returned X matches direct double centering, and mirroring the lower triangle of -X/2 gives eigenvalues 13.4780572345979, 1.46028558686513, and 0.228323845203593, exactly the reported values.

## Numerical checks

The double-centering formula and eigenvalue ordering were independently checked on small Euclidean, non-Euclidean, line, simplex, zero-distance and asymmetric-matrix cases. The Cailliez equation was independently checked on cmdscale_non_euclidean_add. cmdscale_vs_pca provides a further check: for Euclidean distances, coordinates agree with principal-component scores up to orthogonal sign conventions.

## Decisions for the user

1. Return the full structured result on every call, or mirror R's matrix-only default and structured return only when requested. Recommended: always return points, eig, x, ac, and GOF; absent optional outputs can be empty/null. This makes the API stable.
2. Use the deterministic column-sign convention already decided by the user; document the difference from R and sign-align tests.
3. For add=TRUE, set a numerically negligible Cailliez constant to zero using a scale-aware threshold. Recommended: stable PSD/root calculation, not R's roundoff-sized positive artifacts.
4. For asymmetric matrix input, either reproduce R's lower-triangle eigensolver convention after double-centering, or reject asymmetric matrices as mathematically ambiguous. Recommended: reproduce the observed R convention for compatibility, while documenting that returned x is asymmetric and the eigensolver uses its lower triangle.
5. For non-Euclidean inputs, retain all eigenvalues in eig, but construct points only from positive eigenvalues and warn when fewer than k are available.

## rStats.js's choices

