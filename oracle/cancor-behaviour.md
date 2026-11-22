# Canonical correlation analysis

Issue #549. Reference R 4.6.2 stats::cancor. Evidence: Hotelling (1936); Mardia, Kent & Bibby, Multivariate Analysis; public outputs in experiments/multivariate19.R and .json. No R source or fit internals were inspected.

## Definition

For centered/user-centered matrices Xc and Yc, define Sxx=Xc'Xc, Syy=Yc'Yc, Sxy=Xc'Yc. Canonical correlations are singular values of Sxx^(-1/2) Sxy Syy^(-1/2) on the nonzero column spaces; equivalently square roots of nonzero eigenvalues of Sxx^(-1)SxySyy^(-1)Syx. Coefficients a_j,b_j maximize cor(Xc a_j,Yc b_j), normalized by a_j'Sxx a_j=b_j'Syy b_j=1. Paired signs are chosen so canonical correlations are nonnegative. Exact coefficient scaling and signs are not independently reconstructed; compare all coefficient entries to R before implementation.

xcenter/ycenter TRUE subtracts column means; FALSE uses zero centers; numeric vectors specify explicit centers. Returned centers are the vectors used. Vector inputs are one-column matrices.

## R-observed contract

Returns cor, xcoef, ycoef, xcenter, ycenter. Number of correlations is at most min(rank(Xc),rank(Yc)). Collinear columns can be removed from coefficient rows while center vectors retain all original columns. One-column inputs are accepted. More x than y and n smaller than column counts are accepted in the pinned run; underdetermined samples can yield unit correlations. NA/NaN/Inf errors in the observed NA case. Scaling X by 1e100 and Y by 1e-100 leaves correlations unchanged and rescales coefficients inversely to their own data scale.

## Numeric checks

cancor_lifecycle: cor=(0.824796611247416,0.365276151485138); centers x=(35.0896,2.293), y=(9.671,1106.7584,3.7576).
cancor_lifecycle_nocenter: cor=(0.956952717613549,0.575957768085836), centers all zero.
cancor_lifecycle_given_center: cor=(0.817908520686073,0.27627874714205), centers equal supplied vectors.
cancor_vectors: scalar cor=0.867659376517228. Collinear and n-small cases are recorded. Full coefficient matrices have not yet been independently reconstructed.

## Decisions for the user

1. Centers: default both true; accept false or finite vectors of matching dimensions.
2. Rank: use rank-revealing decomposition; return only nonzero pairs while preserving original input names/centers.
3. Small samples: permit n<=p or n<=q only when decomposition is well-defined; document potentially unit sample correlations.
4. Normalization: require numerical matching of coefficient entries/signs; if not, stop for a user decision.

## rStats.js's choices

(empty — reserved for user decisions)
