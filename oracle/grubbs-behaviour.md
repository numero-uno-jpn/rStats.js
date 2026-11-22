# Grubbs outlier tests

Issue #549. Reference: R 4.6.2 / outliers 0.15. Evidence: Grubbs (1950), *Annals of Mathematical Statistics* 21, 27–58; Pearson & Sekar (1936); David, Hartley & Pearson (1954); public R outputs from \`grubbs.test\`, \`pgrubbs\`, and \`qgrubbs\`. No package/R source or source-derived table was used.

## Statistics

Let \(s\) be the sample standard deviation.

**Type 10 (one extreme).** Select the maximum when \`opposite=FALSE\`, the minimum when \`opposite=TRUE\). With selected observation \(x_{(e)}\),

\[
G_{10}=\frac{|x_{(e)}-\bar{x}|}{s},\qquad
U_{10}=\frac{(n-2)s_{(-e)}^2}{(n-1)s^2}
      =1-\frac{nG_{10}^2}{(n-1)^2}.
\]

The Pearson–Sekar approximation uses

\[
t=\frac{G_{10}\sqrt{n(n-2)}}{\sqrt{(n-1)^2-nG_{10}^2}},\qquad
F_{10}(G;n)=\max(0,\min(1,1-nP(T_{n-2}\ge t))).
\]

One-sided p is \(1-F_{10}\); two-sided p is \(2\min(F_{10},1-F_{10})\).

**Type 11 (two opposite extremes).** Let \(x_{\min},x_{\max}\) be the selected extremes:

\[
G_{11}=\frac{x_{\max}-x_{\min}}s,\qquad
U_{11}=\frac{(n-3)s_{(-\min,-\max)}^2}{(n-1)s^2}.
\]

The p-value law is the David–Hartley–Pearson standardized-range distribution. Define \(F_{11}(G;n)=pgrubbs(G,n,11)\), with quantile \(Q_{11}(p;n)=qgrubbs(p,n,11)\); the public p function numerically inverts this quantile relation. One-sided p is \(1-F_{11}\); two-sided p is \(2\min(F_{11},1-F_{11})\). \`opposite\` has no effect on type 11.

**Type 20 (two same-side extremes).** Remove the two largest values (\`opposite=FALSE\`) or the two smallest (\`opposite=TRUE\)):

\[
U_{20}=\frac{(n-3)s_{(-e_1,-e_2)}^2}{(n-1)s^2}.
\]

There is no G statistic in the returned result. The lower-tail probability is

\[
F_{20}(U;n)=pgrubbs(U,n,20)=qgrubbs(U,n,20,\mathrm{rev}=TRUE).
\]

This equality was observed exactly on the supplied grids and additional off-grid points. One-sided p is \(F_{20}\); two-sided p is \(2\min(F_{20},1-F_{20})\).

## Type-20 table and interpolation

Do not invert the default \`rev=FALSE\` qgrubbs quantile table by simple linear interpolation: that gave maximum errors about 0.018 on the supplied grids. Generate the CDF table from public \`qgrubbs(U,n,20,rev=TRUE)\) outputs at the selected U probabilities.

Sampling this reverse table on \(U=0,0.001,\ldots,1\) and interpolating linearly in U gave off-grid maximum absolute errors for \(n=4,6,8,9,11,15,16,25,29\) of \(5.05\cdot10^{-5},1.17\cdot10^{-6},7.97\cdot10^{-7},8.56\cdot10^{-7},2.061\cdot10^{-4},1.75\cdot10^{-4},2.75\cdot10^{-6},5.91\cdot10^{-6},7.90\cdot10^{-6}\). The maximum was \(2.061\cdot10^{-4}\). sqrt(U), log(U), and logit(p) transforms were also tested; no single transform improved every n. The reverse qgrubbs function itself is the exact oracle; use a denser table for tighter tolerances.

## R-observed behavior and numerical checks

- For \`grubbs_x1_*\`, \`grubbs_x2_*\`, and \`grubbs_x3_*\`: all 36 type/opposite/two-sided combinations were checked. G and U match exactly; maximum p absolute difference \(9.99\cdot10^{-16}\).
- Type-10 pgrubbs formula matches every tested q point for \(n=3,4,5,7,10,20,30,50\); maximum absolute difference \(3.89\cdot10^{-15}\).
- \`grubbs_x1_type10_opp0_two0\`: \(G=2.46876461121245,U=0.00493082357959803,p=1.50131933551734\cdot10^{-7}\). \`grubbs_x1_type11_opp0_two0\`: \(G=2.91813985536907,U=0.00337251643826531,p=0.628552325970718\). \`grubbs_x1_type20_opp0_two0\`: \(U=0.00374504032103939,p=0\).
- \`opposite\` changes the selected extreme(s), statistics, and alternative text for types 10 and 20; it does not change type 11. \`two.sided\` changes only p.
- \`pgrubbs_type11_n10\` at q=3 fails with \`f() values at end points not of opposite sign\`; \(qgrubbs(0.001,10,11)=3.00006058009131\). This is a root-bracketing failure just below the lower probability boundary.
- \`grubbs_n2\` returns \(G=0.707106781186547,U=NA,p=NaN\) with a warning; it is not an error. \`grubbs_n3\` is accepted. \`grubbs_n3_type11\` returns \(U=NA\) but finite p. Type 20 accepts \(3\le n\le30\); \`grubbs_n31_type20\` errors with \`n must be in range 3-30\`.
- \`grubbs_na\` omits NA and returns a finite result. \`grubbs_tie_extremes\`, \`grubbs_symmetric\`, \`grubbs_large_n\`, \`grubbs_scale\`, and \`grubbs_shift\` are in the oracle.
- \`grubbs_constant\` returns NaN G/U but p=0. This p-value is not mathematically defined and is treated as a reference defect, not a desired contract.

## Decisions for the user

1. Export scalar \`pgrubbs\` and \`qgrubbs\` alongside \`grubbsTest\`.
2. Generate type-20 CDF table values only from R \`qgrubbs(U,n,20,rev=TRUE)\); use a dense U grid and document interpolation error. Do not invert the default quantile table.
3. For type-11 values below the lower root bracket, return boundary probability 0 rather than propagating R's uniroot error.
4. Return NaN p for a constant sample with undefined G/U rather than R's p=0 artifact. Preserve the type-20 n=3..30 support boundary.
5. Preserve type-11 \`opposite\` as ignored and keep \`two.sided\` as a p-value-only option.

## rStats.js's choices

(empty — reserved for user decisions)
