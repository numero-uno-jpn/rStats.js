# Multivariate analysis of variance

Issue #549. Reference R 4.6.2 stats::manova and summary.manova. Evidence: Pillai (1955); Wilks (1932); Hotelling (1951); Roy (1953); Rao (1951); public outputs in experiments/multivariate19.R and .json. No R source or fit internals were inspected.

## SSP matrices and roots

For response matrix Y and sequential formula terms, each term has hypothesis SSP H and residual SSP E. Generalized roots solve H v = lambda E v. For nonzero roots lambda_1..lambda_s:

Pillai V = sum lambda_i/(1+lambda_i)
Wilks Lambda = product 1/(1+lambda_i)
Hotelling-Lawley U = sum lambda_i
Roy Theta = max lambda_i.

R reports an approximate F, numerator/denominator df and p for each statistic. Pillai's common transformation uses s=min(p,q), m=(abs(p-q)-1)/2, n0=(v-p-1)/2, df1=s(2m+s+1), df2=s(2n0+s+1), F=[(2n0+s+1)/(2m+s+1)] V/(s-V). This formula is theory-backed but not independently recomputed against the fixture. The other three F approximations and Roy's upper-bound df are unconfirmed; do not substitute guessed formulas.

## R-observed contract

One response errors "need multiple responses". Terms are Type I sequential in formula order; reversing cyl+am changes term results. intercept=TRUE adds an (Intercept) row; default omits it. tol controls numerical rank. Summary returns SSP list SS, Eigenvalues, and per-term test tables. The supplied JSON records all four tests, all SSP matrices, eigenvalue table and coef(fit). Residual SSP must have full rank p; otherwise errors such as "residuals have rank 5 < 6". Collinear responses trigger the rank condition. Missing rows are handled by model-frame behavior.

## Coverage and checks

Experiments include iris, intercept, two factors in both orders, interaction, covariate, unequal response/term dimensions, one response, insufficient residual df, collinear responses, NA, tol, scale and npk. Formula definitions above are theory-backed; no independent matrix/eigenvalue reconstruction has yet been recorded, so numerical validation is incomplete.

## Decisions for the user

1. API: recommendation is fit object with term order, residual df, response/term names, coefficients, SSP matrices and eigenvalues; separate manovaSummary returns all four tests.
2. Formula semantics: Type I sequential only, in formula order.
3. Rank: expose tol and reject residual SSP rank below response dimension.
4. F approximations: implement only after all four statistic-specific df/F formulas are independently checked against R tables.

## rStats.js's choices

(empty — reserved for user decisions)
