# Page's ordered aligned rank-sum test

Issue #549. Reference R 4.6.2 / PMCMRplus 1.9.12. Evidence: Page (1963), JASA 58, 216–230, and public outputs in experiments/tests19-small.R and .json. No package or R source was read, recalled, or copied.

## Statistic

For n complete blocks and k ordered treatments, rank observations within each block (average ranks for ties). Let R_j be the sum of ranks for treatment j. Then

L = sum(j R_j), j=1..k
E0(L) = n k (k+1)^2 / 4
Var0(L) = n k^2 (k-1)(k+1)^2 / 144.

The reference z uses a 0.5 continuity correction in the direction of the deviation:
z = [L-E0(L)-0.5 sign(L-E0(L))] / sqrt(Var0(L)).
Two-sided p=2 Phi(-abs(z)); greater p=1-Phi(z); less p=Phi(z).

Independent numeric checks:
- page_m1_two.sided: L=148, E=125, Var=125; z=3.48568501158668, p=0.000490878644840285.
- page_size_k3_n2: L=27, E=24, Var=4; z=1.25, p=0.21129954733371.
- page_ties: L=171.5, z=2.9698484809835. Same variance expression fits the observed ties output; no separate tie variance correction is indicated by this fixture.

## R-observed contract

Matrix rows are blocks and columns are treatments in hypothesised order. Vector form accepts groups and blocks. alternative defaults to two.sided and accepts greater/less. Result method is "Page's ordered aligned rank sum test", statistic name z, estimate L, no df parameter. In the tested grid k=3..8 and n=2,3,4,5,8,12,20, only z was returned. One block and a missing matrix value error; two treatments are accepted. Average ranks are used for ties. Factor levels define vector-form treatment order.

## Decisions for the user

1. Ties: recommendation is average ranks and the same variance expression; add further tie-pattern tests before implementation.
2. Missing data: reject incomplete blocks rather than silently dropping a cell.
3. Vector order: use explicit factor order; preserve first appearance for non-factor labels.

## rStats.js's choices

(empty — reserved for user decisions)
