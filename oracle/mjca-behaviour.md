# Multiple and joint correspondence analysis: mjca

Reference basis: Greenacre, *Theory and Applications of Correspondence Analysis*; Benzécri (1979); Greenacre (1988); Nenadić & Greenacre (2007), *Journal of Statistical Software* 20(3); R 4.6.2 public-call results in `experiments/ca111.R`, `experiments/ca111-formula.R`, `experiments/ca111-mjca-jca.R`, and `experiments/ca111-mjca-summary.R`. No ca package source was consulted.

## Indicator matrix and Burt matrix

For (n) individuals and (Q) categorical variables, let (Z) be the complete disjunctive (indicator) matrix, with one active 1 per variable and individual, and let (J) be its number of category columns. Indicator MCA is correspondence analysis of (Z/(nQ)), with individual masses (1/n) and category masses (m_j/(nQ)). Its total inertia is

\[
I_{indicator}=\frac{J-Q}{Q}.
\]

For `wg93`, (J=20), (Q=4), and R reports 4.0000000000000009. An independent SVD of the standardized indicator matrix reproduces the nonzero eigenvalues to about (10^{-15}).

The Burt matrix is (B=Z'Z), whose blocks are pairwise category cross-tabulations. Its total inertia is not the indicator total inertia. For `wg93`, the public Burt result is 1.1276841394738111.

## Benzécri-adjusted eigenvalues and total inertia

For indicator eigenvalue (\lambda_\alpha), the axis-level Benzécri correction is

\[
\lambda^{(B)}_\alpha=
\begin{cases}
\left(\frac{Q}{Q-1}\right)^2
\left(\lambda_\alpha-\frac1Q\right)^2,
&\lambda_\alpha>1/Q,\\
0,&\text{otherwise}.
\end{cases}
\]

The adjusted total inertia is **not** the sum of the corrected axis eigenvalues. Greenacre's total-inertia correction is

\[
I_{adjusted}=\frac{Q}{Q-1}
\left(I_{Burt}-\frac{J-Q}{Q^2}\right).
\]

For `wg93`, this gives 0.17024551929841475 from the R Burt inertia 1.1276841394738111, matching R's adjusted `inertia.t` 0.17024551929841475 to floating-point rounding. The independently supplied value 0.17024551929841417 differs by (5.8\times10^{-16}), an immaterial last-bit rounding difference.

The six corrected axis inertias from the adjusted scree table are 0.076455, 0.058220, 0.009197, 0.005670, 0.001172, and 0.000007. Their rounded sum is 0.150721, below the total 0.1702455193; this is expected, not a defect. The scree percentages 44.9%, 34.2%, 5.4%, 3.3%, 0.7%, and 0.0% are each calculated relative to the corrected total `inertia.t`; cumulative percentage is 88.5%.

The returned adjusted `inertia.et` field is logical `NA`, not a per-axis percentage vector. Use the scree table's percentage column for axis percentages. In JCA mode, `inertia.et` is a scalar (about 0.85667025), while the JCA scree percentage columns are NA; do not interpret that scalar as the per-axis percentage table.

## Joint correspondence analysis (JCA)

Greenacre's JCA is an alternating least-squares procedure on the Burt matrix. At each iteration, each diagonal variable block is replaced by its rank-(nd) reconstruction from the current category configuration; the off-diagonal observed blocks are retained, and correspondence analysis is repeated on the modified Burt matrix. The process iterates toward a joint low-dimensional solution.

For `wg93`, the first reported JCA result has `JCA.iter=[1,22.7665804159]`; `maxit=0` and `maxit=1` return the same one-iteration state. This state is not numerically identical to the adjusted MCA singular values, so the returned object does not expose a direct copy of the adjusted starting configuration. An adjusted-MCA initialization followed by the first diagonal-block reconstruction is consistent with the textbook procedure, but the exact initialization cannot be proved from the returned singular values alone.

The second `JCA.iter` component is the convergence statistic compared with `epsilon`; it is not the change in `inertia.t`. With the default tolerance, R stops at 44 iterations with statistic 9.9093889233e-05 and total inertia 0.1824245985348838. With `epsilon=1e-10`, it stops at 103 iterations with statistic 8.5890405899e-11 and total inertia 0.18242477532327539. With `maxit=5`, it stops at five iterations with statistic 1.6278187953 and total inertia 0.17868115067830104. The exact norm/scale used for the diagonal-block convergence statistic is not identified by these public outputs; it should not be described as an inertia-change threshold.

## Data handling and returned quantities

The public result includes singular values, inertia summaries, category levels and masses, distances, coordinates, contributions, correlations, subinertia and the Burt matrix. Indicator mode also returns individual row masses, distances, inertias and coordinates; `reti=TRUE` returns the indicator matrix. Missing rows are omitted in the observed NA case; they are not represented as a new category. One-variable data errors; indicator and Burt modes work on the small three-variable case, while adjusted/JCA modes fail there.

## Decisions for the user

1. Input: recommend categorical data frames initially; contingency/Burt table input can be a separate feature.
2. Missing values: recommend omitting incomplete rows and exposing the omitted-row count.
3. Unused factor levels: recommend dropping unused levels.
4. Adjusted mode: recommend implementing it now that both axis correction and Greenacre total inertia are specified and numerically checked. Do not equate the sum of corrected eigenvalues with total inertia.
5. JCA: defer implementation until the exact diagonal-block update and convergence statistic are specified; maxit/epsilon observations alone are not a complete algorithm specification.
6. Expose `Burt`, category contributions/correlations and indicator rows where mathematically defined.

## rStats.js's choices

