# Page's ordered aligned rank-sum test

Issue #549. Reference R 4.6.2 / PMCMRplus 1.9.12. Evidence: Page (1963), JASA 58, 216–230; public outputs and independent calculations in `experiments/multivariate19-stage1-tamhane-page.R`; complete public-call coverage in `experiments/tests19-small.R`. No GPL source was used.

## Formula

For n blocks and k ordered treatments, rank the observations within each block, using average ranks for ties. Let R_j be the column sum of ranks and
`L = Σ(j R_j), j=1,…,k`.
The null moments are
`E₀(L)=n k (k+1)²/4`
and
`Var₀(L)=n k² (k−1)(k+1)²/144`.
The standardized statistic uses a directional 0.5 continuity correction:
`z=[L−E₀(L)−0.5]/sqrt(Var₀(L))`. The correction is always −0.5, including when L is below its null mean.
For the alternatives, p is respectively `2Φ(−|z|)`, `1−Φ(z)`, and `Φ(z)` (two.sided, greater, less). The returned estimate is L; statistic is z; no df parameter is returned.

## Numerical verification

The independent implementation was compared with R over every generated size `k=3…8`, `n∈{2,3,4,5,8,12,20}`, for both default two-sided and greater alternatives: all 84 cases. The special cases `page_m1_two.sided`, `page_m1_greater`, `page_m1_less`, `page_m1_reversed`, `page_ties`, `page_ties_greater` were also recorded. In `page_m1_two.sided`, L=148, E=125, Var=125, z=3.48568501158668 and p=0.000490878644840285; the independent calculation agrees at the displayed 15 significant digits. `page_size_k3_n2` gives z=1.25 and p=0.21129954733371. `page_ties` gives L=171.5 and z=2.9698484809835; average ranks and the same null variance are used, with no tie-specific variance correction indicated by the tested pattern.

## Missing and small inputs

`page_one_block` is not an error: one block with four treatments returns L=30, z=1.55884572681199, p=0.119032898457008. Two treatments are accepted (`page_two_treatments`: L=19, z=0.5, p=0.617075077451974). A missing cell is not dropped as a whole block: it is assigned the last within-block rank. `page_na` returns L=147, z=3.33076567773838, p=0.000866074730533341. This is a compatibility rule; the rank total and null moments continue to use the block count in the tested case. Vector input, explicit blocks, and factor treatment order are covered by `page_vectors` and `page_factor_order`.

## Decisions for the user

1. Use the formula and average within-block ranks above. Recommendation: preserve the directional continuity correction exactly.
2. For missing cells, reject incomplete blocks with a clear error rather than reproduce the reference's non-obvious partial-rank behavior.
3. For vector input, use factor level order; for non-factor labels use first appearance order.

## rStats.js's choices

(empty — reserved for user decisions)
