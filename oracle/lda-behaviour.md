# Linear discriminant analysis

Issue #549. Reference R 4.6.2 / MASS 7.3-66 public help and public-function outputs. Evidence: Fisher (1936); Rao (1948); Venables & Ripley, Modern Applied Statistics with S; experiments/multivariate19.R and .json. No MASS/R source, fit internals or closures were inspected.

## Moment model

For g classes, means mu_j and counts n_j, within-class SSP is W=sum_j sum_{i in j}(x_i-mu_j)(x_i-mu_j)'. Pooled within covariance is S_W=W/(N-g). Between-class SSP is B=sum_j n_j(mu_j-xbar)(mu_j-xbar)'. Discriminant directions solve Bv=lambda Wv, equivalently the nonzero singular directions after whitening by within-class covariance.

The fit returns scaling, svd, class means, counts, prior, N and levels. Scaling columns are normalized relative to within-class variation. Exact normalization and deterministic sign orientation have not been independently reconstructed. Eigenvector signs are not identifiable; compatibility requires a reproducible sign rule checked against R.

For a new x, plug-in class scores are proportional to log(pi_j)-0.5(x-mu_j)' S_W^-1 (x-mu_j). Normalize prior-weighted Gaussian densities to obtain posterior probabilities; predicted class is the largest posterior. dimen truncates discriminant coordinates. Predictive/debiased methods are out of required scope.

## Leave-one-out CV

CV=TRUE returns one leave-one-out class and posterior row per observation. Prior handling and numerical equivalence to explicit refits have not been independently verified.

## R-observed contract

method="moment" is in scope. Default prior is empirical class proportions; supplied prior changes scaling and posterior. Formula input omits rows with missing model variables; direct matrix NA is not silently repaired. Empty factor levels are dropped with warning "group none is empty"; collinear variables warn and are rank-reduced. A variable constant within classes errors; a singleton class is accepted. tol changes rank threshold. Prediction exposes class, posterior and discriminant scores x.

## Numeric checks

lda_iris and lda_iris_formula agree. lda_iris_newdata records classes setosa, versicolor, virginica, virginica and complete posterior and score matrices. lda_iris_prior records prior (0.6,0.3,0.1). lda_iris_cv and lda_iris_cv_prior record all leave-one-out classes and posterior values. Boundary fixtures include empty level, collinearity, constant variable, singleton class, NA, scale and tol. Gaussian score and exact scaling/sign calculations are not independently reconstructed.

## Decisions for the user

1. Scope: implement method="moment" and predict method="plug-in"; defer predictive/debiased.
2. Priors: empirical default; accept positive prior weights normalized to one and apply consistently to prediction/CV.
3. Rank: drop dependent columns with warning; reject zero within-class variance; expose tol.
4. Sign: use deterministic orientation only if it reproduces R scaling; otherwise report sign-equivalent compatibility difference.

## rStats.js's choices

(empty — reserved for user decisions)
