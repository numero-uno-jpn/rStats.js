# Simple correspondence analysis: ca

Reference basis: Greenacre, *Correspondence Analysis in Practice* and *Theory and Applications of Correspondence Analysis*; R 4.6.2 public help and public-call results in `experiments/ca111.R` and `experiments/ca111-formula.R`. No ca package source was consulted.

## Active table, masses and decomposition

For a nonnegative contingency table \(N=(n_{ij})\), let \(n=\sum_{ij}n_{ij}\), \(P=N/n\), row masses \(r=P\mathbf1\), and column masses \(c=P'\mathbf1\). The standardized residual matrix is

\[
S=D_r^{-1/2}(P-rc')D_c^{-1/2}=U\,D_s\,V'.
\]

The singular values are \(s_\alpha\), principal inertias are \(\lambda_\alpha=s_\alpha^2\), and total inertia is \(\sum_\alpha\lambda_\alpha=\chi^2/n\). The row and column **standard** coordinates are \(\Phi=D_r^{-1/2}U\) and \(\Gamma=D_c^{-1/2}V\); the principal coordinates are \(F=\Phi D_s\) and \(G=\Gamma D_s\).

The public `ca(smoke)` result has singular values 0.27342111455729917, 0.10008586569655460, 0.02033652083951986 and total inertia 0.085189860477840704. Independent base-R SVD reproduces all three singular values and the returned `rowcoord` and `colcoord` to about \(10^{-15}\). In this interface, `rowcoord` and `colcoord` are standard coordinates, not principal coordinates; multiplying each axis by its singular value gives principal coordinates. Cases: `ca_smoke`, `ca_fraction`, `ca_scale_big`, `ca_scale_small`, `ca_t`.

The row chi-square distance from the average profile is

\[
d_i^2=\sum_j\frac{(p_{j|i}-c_j)^2}{c_j},
\]

with the analogous column distance weighted by row masses. The row inertia is \(r_i d_i^2\); total inertia is the sum of row inertias.

## Summary quantities and coordinate maps

For the first \(m\) displayed axes, the row quality is \(qlt_i=\sum_{\alpha=1}^m F_{i\alpha}^2/d_i^2\). Axis-specific squared correlation is \(cor_{i\alpha}=F_{i\alpha}^2/d_i^2\), contribution is \(ctr_{i\alpha}=r_iF_{i\alpha}^2/\lambda_\alpha\), and relative row inertia is \(inr_i=r_id_i^2/\sum_\alpha\lambda_\alpha\). The summary prints these as per-thousand values. Independent calculations for `ca_smoke` reproduce row and column `qlt`, `inr`, `cor`, and `ctr` (within display rounding); default summary uses two displayed dimensions. The scree table reports each inertia, its percentage and cumulative percentage.

Coordinate map identities directly checked are:
- `standard`: \((\Phi,\Gamma)\)
- `principal`: \((\Phi D_s,\Gamma D_s)\)
- `symmetric`: \((\Phi D_s^{1/2},\Gamma D_s^{1/2})\)
- `rowprincipal`: \((\Phi D_s,\Gamma)\)
- `colprincipal`: \((\Phi,\Gamma D_s)\)

Public outputs for `ca_cacoord_standard`, `ca_cacoord_principal`, `ca_cacoord_symmetric`, `ca_cacoord_rowprincipal`, `ca_cacoord_colgreen`, and `ca_cacoord_rowgab` are recorded. Exact scaling for the Greenacre and Gabriel variants is not yet independently derived.

## Supplementary rows and columns

A supplementary row profile \(q\) does not contribute to active masses or the SVD. Its principal coordinate is the barycentric projection \(q\Gamma\); its standard coordinate is obtained by dividing each axis by \(s_\alpha\). For `ca(smoke, suprow=5)`, the independent projection from the active table's column standard coordinates reproduces the returned supplementary row coordinates to approximately \(10^{-14}\). Supplementary columns follow the transposed barycentric projection by symmetry; the returned supplementary-column scaling has not yet been independently checked numerically. Cases: `ca_smoke_suprow`, `ca_smoke_supcol`, `ca_smoke_sup_both`.

## Input and rank boundaries

A zero row or column gives a zero mass and makes the inverse-mass geometry undefined; negative cells invalidate the chi-square model; missing cells are not imputed. R-observed errors are `ca_zero_row`, `ca_zero_col`, `ca_negative`, `ca_na`, `ca_suprow_only_one_left`, and `ca_suprow_names`. Common positive scaling leaves the geometry unchanged. Low-rank and degenerate public cases include `ca_smoke_nd1`, `ca_author_nd3`, `ca_2x2`, `ca_no_names`, `ca_one_row`, `ca_independent`, and `ca_identity`. The fit may exist where the package summary fails; a mathematical summary should return defined quantities for the available rank rather than copy such summary failures.

## Decisions for the user

1. Input: (a) numeric matrix only; (b) also data-frame/table forms. **Recommend (a)** initially, with optional labels.
2. Supplementary points: (a) integer indices only; (b) also names. **Recommend (a)**; the public name-input case errors.
3. Summary: (a) fit only; (b) add `caSummary` with scree, qlt, inr, cor and ctr. **Recommend (b)**; the derived quantities are independently checked.
4. Coordinate maps: (a) standard/principal only; (b) expose documented `caCoord` maps. **Recommend (b)** after the Greenacre/Gabriel scaling is verified.
5. Rank-zero/rank-one: (a) return mathematically defined lower-rank results; (b) mirror package errors. **Recommend (a)**, except zero-mass margins and invalid cells should error.
6. Use one common sign per axis for row and column coordinates. **Recommend orienting by the largest absolute row standard coordinate, first tie wins, then reflecting both sides together.**

## rStats.js's choices

