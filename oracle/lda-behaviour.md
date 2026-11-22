# Linear discriminant analysis

Issue #549. Reference: R 4.6.2 / MASS 7.3-66 public help and public-function outputs. Evidence: Fisher (1936); Rao (1948); Venables & Ripley, *Modern Applied Statistics with S*; independent weighted-moment/SVD calculations. No MASS/R source or fit internals were inspected.

## Moment method and scaling

For \(g\) classes, counts \(n_j\), means \(\mu_j\), and \(N\) observations, define

\[
W=\sum_j\sum_{i\in j}(x_i-\mu_j)(x_i-\mu_j)^\mathsf T,\qquad
S_W=W/(N-g).
\]

For prior weights \(\pi_j\) summing to one, let \(\mu_\pi=\sum_j\pi_j\mu_j\) and

\[
B_\pi=\sum_j\pi_j(\mu_j-\mu_\pi)(\mu_j-\mu_\pi)^\mathsf T.
\]

Choose \(R\) with \(R^\mathsf TR=S_W\), and form

\[
M=\operatorname{diag}(\sqrt{\pi_j})(\mu-\mu_\pi)R^{-1}=UDV^\mathsf T.
\]

Then

\[
\text{scaling}=R^{-1}V,\qquad
\text{svd}=\sqrt{\frac{N}{g-1}}\,\operatorname{diag}(D),
\]

with \(\text{scaling}^\mathsf T S_W\text{scaling}=I\). For empirical priors this is equivalent to \(\text{svd}_i^2=\lambda_i(N-g)/(g-1)\), where \(\lambda_i\) are the nonzero eigenvalues of \(W^{-1}B\).

The SVD orientation supplies the reproducible sign convention. “Largest class centroid positive” does not reproduce R across all priors and class configurations.

## Prediction and cross-validation

For prediction prior \(\pi\), the class log score (up to a common constant) is

\[
\delta_j(x)=\log\pi_j-\frac12(x-\mu_j)^\mathsf T S_W^{-1}(x-\mu_j).
\]

Normalize \(\exp(\delta_j)\) across classes for posterior probabilities. The returned discriminant score vector is

\[
x_{\mathrm{disc}}=(x-\mu_\pi)\,\text{scaling}.
\]

Thus \`predict(prior=...)\` changes posterior weights and the center \(\mu_\pi\) used for x, but does not refit model scaling. \`CV=TRUE\` performs leave-one-out classification; explicit refits with the full-fit prior fixed in each fold match the returned CV.

## R-observed contract and numerical checks

- \`method="moment"\` and prediction \`method="plug-in"\` are confirmed scope. Default prior is empirical class proportions; supplied positive priors change \(B_\pi\), scaling, and svd.
- Cases checked: \`lda_iris\`, \`lda_iris_prior\`, \`lda_two_classes\`, \`lda_three_cyl\`, \`lda_class_of_one\`, \`lda_single_variable\`, \`lda_collinear\`, \`lda_na\`, and \`lda_scale\`. The full oracle also contains formula, newdata, prior override, dimen, CV, empty-level, constant-within-class, and tol cases.
- Full-rank scaling after SVD sign convention agrees to maximum absolute difference \(3.25\cdot10^{-14}\); discriminant scores to \(3.15\cdot10^{-14}\); svd to \(4.27\cdot10^{-14}\). \`scaling' S_W scaling\` is identity.
- Predictions have zero class mismatches; posterior maximum absolute difference at most \(9.5\cdot10^{-15}\), x maximum difference at most \(3.0\cdot10^{-14}\). Prior override also matches.
- Explicit leave-one-out refits match \`CV=TRUE\`: zero class mismatches and posterior maximum absolute difference at most \(7.2\cdot10^{-15}\).
- Single predictor: scaling \(1.94254180516358\), svd \(10.9208288231482\); independent scalar formula differences \(2.3\cdot10^{-16}\) and \(1.8\cdot10^{-15}\).
- Collinear predictors: individual scaling coefficients are not unique (maximum coefficient difference 0.0722), but discriminant scores agree to \(1.7\cdot10^{-14}\). Use score-space equivalence, not coefficient equality, for rank-deficient designs.

## Decisions for the user

1. Implement \`method="moment"\` and prediction \`method="plug-in"\`; defer predictive/debiased methods.
2. Use empirical priors by default; accept positive prior weights normalized to one and apply prediction prior to posterior and x centering.
3. Expose \`tol\`; warn and rank-reduce collinear predictors, but reject a variable with zero within-class variance.
4. Use the SVD orientation of the whitened weighted class-mean matrix for signs. For rank-deficient designs, compare scores/subspaces rather than non-unique coefficients.

## rStats.js's choices

(empty — reserved for user decisions)
