# Simple correspondence analysis: ca

Reference basis: Greenacre, *Correspondence Analysis in Practice* and *Theory and Applications of Correspondence Analysis*; Nenadić & Greenacre (2007); R 4.6.2 public-call results in `experiments/ca111.R`, `experiments/ca111-formula.R`, and `experiments/ca111-supp-cacoord.R`. No ca package source was consulted.

## Active table, masses and decomposition

For a nonnegative contingency table (N=\(n_{ij}\)), let \(n=\sum_{ij}n_{ij}\), (P=N/n), row masses \(r=P\mathbf1\), and column masses \(c=P'\mathbf1\). The standardized residual matrix is

\[
S=D_r^{-1/2}(P-rc')D_c^{-1/2}=U D_s V'.
\]

The singular values are \(s_\alpha\), principal inertias are \(\lambda_\alpha=s_\alpha^2\), and total inertia is \(\sum_\alpha\lambda_\alpha=\chi^2/n\). The row and column standard coordinates are \(\Phi=D_r^{-1/2}U\) and \(\Gamma=D_c^{-1/2}V\); principal coordinates are \(F=\Phi D_s\) and \(G=\Gamma D_s\).

For `ca(smoke)`, the singular values are 0.27342111455729917, 0.10008586569655460, and 0.02033652083951986; total inertia is 0.085189860477840704. Independent base-R SVD reproduces the singular values and returned `rowcoord` and `colcoord` to about \(10^{-15}\). In this interface, `rowcoord` and `colcoord` are standard coordinates; multiplying each axis by its singular value gives principal coordinates.

## Summary quantities and coordinate maps

For the first (m) displayed axes, row quality is \(qlt_i=\sum_{\alpha=1}^m F_{i\alpha}^2/d_i^2\). Axis-specific squared correlation is \(cor_{i\alpha}=F_{i\alpha}^2/d_i^2\), contribution is \(ctr_{i\alpha}=r_iF_{i\alpha}^2/\lambda_\alpha\), and relative row inertia is \(inr_i=r_id_i^2/\sum_\alpha\lambda_\alpha\). The summary prints these as per-thousand values; the scree table reports inertia, percentage and cumulative percentage.

All ten public `cacoord` map types now agree exactly with independently calculated coordinate transformations (maximum absolute difference 0 in the returned double matrices):

- `standard`: rows \(\Phi\), columns \(\Gamma\).
- `principal` and `symmetric`: rows (F), columns (G).
- `rowprincipal`: rows (F), columns \(\Gamma\).
- `colprincipal`: rows \(\Phi\), columns (G).
- `symbiplot`: both standard-coordinate matrices multiplied axiswise by \(\sqrt{s_\alpha}\).
- `rowgab`: rows (F), columns \(\Gamma D_c\) (standard column coordinates multiplied by column masses).
- `rowgreen`: rows (F), columns \(\Gamma D_c^{1/2}\).
- `colgab`: rows \(\Phi D_r\), columns (G).
- `colgreen`: rows \(\Phi D_r^{1/2}\), columns (G).

In particular, `symmetric` is not the same map as `symbiplot`; the latter uses standard coordinates times square-root singular values.

## Supplementary rows and columns

A supplementary row profile (q) does not contribute to active masses or the SVD. Its principal coordinate is the barycentric projection \(q\Gamma\); its standard coordinate is obtained by dividing each axis by \(s_\alpha\).

A supplementary column is the transposed case. For a supplementary column profile (q) over the active rows, its returned standard coordinate is

\[
\frac{q'\Phi}{s_\alpha},
\]

where \(\Phi\) is the active row standard-coordinate matrix. For `ca(smoke, supcol=1)`, the direct projection agrees with the first returned supplementary-column coordinate to a maximum absolute difference of \(1.78\times10^{-14}\). Thus the returned `colcoord` uses standard-coordinate scaling, not principal-coordinate scaling.

## Input and rank boundaries

A zero row or column gives zero mass and makes inverse-mass geometry undefined; negative cells invalidate the chi-square model; missing cells are not imputed. Low-rank and degenerate public cases remain in the oracle. The fit may exist where a package summary fails; a mathematical summary should return defined quantities for the available rank rather than copy such summary failures.

## Decisions for the user

1. Input: recommend numeric matrix initially, with optional labels.
2. Supplementary points: recommend integer indices; name input can be considered separately.
3. Summary: recommend `caSummary` with scree, qlt, inr, cor and ctr; the derived quantities are independently checked.
4. Coordinate maps: recommend exposing the documented `caCoord` maps; all ten transformations are now independently verified.
5. Rank-zero/rank-one: return mathematically defined lower-rank results; zero-mass margins and invalid cells should error.
6. Use one common sign per axis for row and column coordinates. Recommend orienting by the largest absolute row standard coordinate, first tie wins, then reflecting both sides together.

## rStats.js's choices

