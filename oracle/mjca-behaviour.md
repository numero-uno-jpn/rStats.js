# Multiple and joint correspondence analysis: mjca

Reference basis: Greenacre, *Theory and Applications of Correspondence Analysis*; Benzécri (1979); Nenadić & Greenacre (2007), *Journal of Statistical Software* 20(3); R 4.6.2 public help and results in `experiments/ca111.R` and `experiments/ca111-formula.R`. No ca package source was consulted.

## Indicator matrix and Burt matrix

For \(n\) individuals and \(Q\) categorical variables, let \(Z\) be the complete disjunctive (indicator) matrix, with one active 1 per variable and individual, and let \(J\) be its number of category columns. Indicator MCA is correspondence analysis of \(Z/(nQ)\), with individual masses \(1/n\) and category masses \(m_j/(nQ)\). Its total inertia is

\[
I_{indicator}=\frac{J-Q}{Q}.
\]

For the public four-variable `wg93` data, \(J=20\), \(Q=4\), and R reports 4.0000000000000009. An independent SVD of the standardized indicator matrix reproduces all 16 nonzero eigenvalues to about \(10^{-15}\). Cases: `mjca_wg93_indicator`, `mjca_w60_indicator`, `mjca_small_indicator`.

The Burt matrix is \(B=Z'Z\), whose blocks are the pairwise category cross-tabulations. Correspondence analysis of the Burt matrix is not spectrally identical to indicator MCA. R reports total inertia 1.1276841394738106 for `mjca_wg93_Burt`; `mjca_w60_Burt` and `mjca_small_Burt` provide additional checks.

## Benzécri-adjusted eigenvalues

For indicator eigenvalue \(\lambda_\alpha\), the axis-level Benzécri correction checked against the adjusted public singular values is

\[
\lambda^{(B)}_\alpha=
\begin{cases}
\left(\frac{Q}{Q-1}\right)^2
\left(\lambda_\alpha-\frac1Q\right)^2,
&\lambda_\alpha>1/Q,\\
0,&\text{otherwise}.
\end{cases}
\]

For `mjca_wg93_adjusted`, the six positive corrected axis eigenvalues calculated independently are 0.07645531291307629, 0.05821976550023029, 0.00919699644549440, 0.00566972963742938, 0.001171895507527996, and 0.000006608179457079305; they agree with the squares of the returned adjusted singular values. The normalized `inertia.e` entries are these corrected eigenvalues divided by the reported `inertia.t`.

An unresolved normalization remains: the sum of those six corrected eigenvalues is 0.15072030818321544, whereas R reports `inertia.t=0.17024551929841417`. The difference, 0.01952521111519873, is not explained by the checked axis-level correction. Do not infer the adjusted total-inertia formula from the axis correction alone.

## Joint correspondence analysis

JCA adjusts the category configuration to reduce residual association in off-diagonal Burt blocks. R reports `inertia.t=0.18242459853488374` and `inertia.et=0.85667024970952566` for `mjca_wg93_JCA`. The JCA objective in full matrix notation, the update equations, and the precise `epsilon`/`maxit` stopping rule have not yet been independently reconstructed. Public controls are checked by `mjca_wg93_jca_maxit` and `mjca_wg93_jca_eps`; these are result observations, not a verified optimizer specification.

## Data handling and returned quantities

The public result includes singular values, inertia summaries, category levels and masses, distances, coordinates, contributions, correlations, subinertia and the Burt matrix. Indicator mode also returns individual row masses, distances, inertias and coordinates; `reti=TRUE` returns the indicator matrix (`mjca_wg93_reti`, `mjca_w60_reti`). `supcol`, `subsetcat`, and `ps` are covered by `mjca_wg93_supcol`, `mjca_wg93_subsetcat`, and `mjca_wg93_ps`.

Missing rows are omitted in the observed `mjca_na` case (four complete individuals remain); they are not represented as a new explicit category. Unused levels and low-rank inputs have mode-dependent outcomes: `mjca_unused_level`, `mjca_one_var`, `mjca_two_vars`, `mjca_small_adjusted`, and `mjca_small_JCA`. One-variable data errors; indicator and Burt modes work on the small three-variable case, while adjusted/JCA modes fail there. Numeric columns and contingency-table input are `mjca_numeric_cols` and `mjca_wg93_crosstab`.

## Decisions for the user

1. Input: (a) categorical data frame; (b) also accept contingency/Burt tables. **Recommend (a)** initially.
2. Missing values: (a) omit incomplete rows; (b) treat NA as a category; (c) reject. **Recommend (a)** to match the observed public result, with the omitted-row count exposed.
3. Unused factor levels: (a) drop; (b) retain and error on zero mass. **Recommend (a)** for a practical data-frame API.
4. Adjusted mode: (a) implement only the checked axis correction and expose the unresolved total; (b) defer adjusted mode until total inertia is derived. **Recommend (b)** for a release-quality result.
5. JCA: (a) defer; (b) implement after objective and stopping rule are independently specified. **Recommend (a)** for 1.11.0.
6. Expose `Burt`, category contributions/correlations and indicator rows where mathematically defined. **Recommend yes** for completeness.

## rStats.js's choices

