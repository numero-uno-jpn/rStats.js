# Page's ordered aligned rank-sum test

Issue #549. Reference: R 4.6.2 / PMCMRplus 1.9.12. Evidence: Page (1963), *JASA* 58, 216–230, public R outputs, and independent rank/statistic calculations. No package or R source was read.

## Formula

For \(n\) blocks and \(k\) treatments in hypothesised order, rank the \(k\) values within each block using average ranks for ties. Let \(R_j\) be the sum of ranks for treatment \(j\). Then

\[
L=\sum_{j=1}^k jR_j,\quad
E_0(L)=\frac{nk(k+1)^2}{4},\quad
V_0(L)=\frac{nk^2(k-1)(k+1)^2}{144}.
\]

The R statistic uses a continuity correction of minus 0.5 regardless of the sign of \(L-E_0(L)\):

\[
z=\frac{L-E_0(L)-0.5}{\sqrt{V_0(L)}}.
\]

The p-value is the standard-normal tail: greater \(=1-\Phi(z)\), less \(=\Phi(z)\), two-sided \(=2\Phi(-|z|)\).

## R-observed contract and numerical checks

- Matrix rows are blocks and columns are treatments in hypothesised order. Vector input accepts \`groups\` and \`blocks\`; factor level order controls treatment order.
- Ties use average ranks. A missing value is assigned the last rank in its block (equivalent to \`rank(..., na.last=TRUE)\`); the block remains in \(n\). Do not use complete-case deletion.
- The size grid \`page_size_k3_n2\` through \`page_size_k8_n20\` (42 cases) agrees in L, z and p with maximum absolute difference 0.
- \`page_m1_two.sided\`: \(L=148,z=3.48568501158668,p=0.000490878644840285\). \`page_m1_greater\`: same L/z, p \(=0.000245439322420142\). \`page_m1_less\`: p \(=0.99975456067758\).
- \`page_size_k3_n2\`: \(L=27,z=1.25,p=0.21129954733371\). \`page_ties\`: \(L=171.5,z=2.9698484809835,p=0.00297946665633299\).
- \`page_one_block\` is accepted: \(z=1.55884572681199\). \`page_na\`: \(L=147,z=3.33076567773838,p=0.000866074730533341\). \`page_m1_reversed\`: \(L=102,z=-3.64060434543497,p=0.00027199884555094\).
- Two treatments are accepted. The oracle includes vector and factor-order cases.

## Decisions for the user

1. Use average ranks for ties and assign NA the last rank within its block, matching R.
2. Use the fixed \(-0.5\) continuity correction, not a sign-dependent correction.
3. Preserve explicit factor level order; for non-factor labels, preserve first appearance and document it.
4. Do not silently remove incomplete blocks; match the observed NA-last-rank rule.

## rStats.js's choices

(empty — reserved for user decisions)
