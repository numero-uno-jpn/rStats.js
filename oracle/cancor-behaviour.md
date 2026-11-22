# Canonical correlation analysis

Issue #549. Reference: R 4.6.2 \`stats::cancor\`. Evidence: Hotelling (1936); Mardia, Kent & Bibby, *Multivariate Analysis*; public R outputs and independent Cholesky/SVD calculations. No R source was inspected.

## Canonical roots and coefficients

For centered or explicitly centered matrices \(X_c,Y_c\), define

\[
S_{xx}=X_c^\mathsf TX_c,\quad S_{yy}=Y_c^\mathsf TY_c,\quad
S_{xy}=X_c^\mathsf TY_c.
\]

Let \(R_x^\mathsf TR_x=S_{xx}\) and \(R_y^\mathsf TR_y=S_{yy}\). The singular values of

\[
C=R_x^{-\mathsf T}S_{xy}R_y^{-1}=UDV^\mathsf T
\]

are the canonical correlations. The coefficient matrices are

\[
xcoef=R_x^{-1}U,\qquad ycoef=R_y^{-1}V.
\]

They satisfy

\[
xcoef^\mathsf TS_{xx}xcoef=I,\quad
ycoef^\mathsf TS_{yy}ycoef=I,\quad
xcoef^\mathsf TS_{xy}ycoef=D.
\]

Normalization uses cross-products, not cross-products divided by \(n-1\). Each canonical pair's x/y coefficient signs may be flipped together; the paired sign is arbitrary while correlation remains nonnegative.

For \`xcenter=TRUE\` / \`ycenter=TRUE\`, subtract respective column means; FALSE uses zero centers; numeric vectors supply explicit centers. Vector inputs are one-column matrices.

## R-observed contract and numerical checks

- The number of canonical pairs is at most \(\min(\operatorname{rank}(X_c),\operatorname{rank}(Y_c))\). Collinear columns are reduced; center vectors retain original input dimensions.
- All 10 cases were checked: \`cancor_lifecycle\`, \`cancor_lifecycle_nocenter\`, \`cancor_lifecycle_given_center\`, \`cancor_iris\`, \`cancor_one_x\`, \`cancor_more_x\`, \`cancor_collinear\`, \`cancor_n_small\`, \`cancor_scale\`, and \`cancor_vectors\`.
- Canonical correlations agree with R to maximum absolute difference \(2.22\cdot10^{-15}\). All xcoef/ycoef entries agree after paired sign flips; maximum absolute coefficient difference \(1.53\cdot10^{-14}\) (ordinary cases at most \(3.3\cdot10^{-15}\)). For the \(10^{100}/10^{-100}\) scale case, relative coefficient errors are \(3.6\cdot10^{-15}\) and \(3.4\cdot10^{-15}\).
- \(xcoef^\mathsf TS_{xx}xcoef\) and \(ycoef^\mathsf TS_{yy}ycoef\) are identity. The user-provided local check independently confirms LifeCycleSavings roots \(0.824796611247416,0.365276151485138\).
- In \`cancor_n_small\`, two roots are 1 because the sample is underdetermined; a near-zero coefficient makes relative error uninformative, but absolute coefficient error is \(1.53\cdot10^{-14}\). Collinear and vector cases are included.

## Decisions for the user

1. Default both center options to TRUE; accept FALSE or finite vectors of matching dimension.
2. Use rank-revealing decomposition and return only nonzero canonical pairs; preserve original variable names and full center vectors.
3. Normalize with unscaled cross-products so each coefficient vector has unit cross-product norm.
4. Preserve SVD signs as deterministic convention; document that paired x/y sign flips are mathematically equivalent.

## rStats.js's choices

(empty — reserved for user decisions)
