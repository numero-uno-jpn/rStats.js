# Audit #982 — Mauchly's test: contrast-space, rank and degenerate covariance recheck

- Target: `src/models/mauchly.ts`
- Audit HEAD: `29415c4e5e4584a65068b1838f0968df91e795f6`
- Source blob SHA: `eeca9936cefa62a52e8a60a83ba042127c9ccd70`
- Verdict: no new reproducible defect found in the checked paths
- Related existing issue: [#342](https://github.com/numero-uno-jpn/rStats.js/issues/342) (one-dimensional contrast space; current source now rejects `pp === 1`)
- Prior false positive: #59 was closed after the QR pivot-order assumption was corrected; do not reopen.

## Scope and checks

1. **Input filtering and residual degrees of freedom**
   - Checked matrix rectangularity, zero-column input, group length, missing rows, finite-value rejection for retained rows, empty complete-case sets, and `n = nsub - numberOfGroups`.
   - The one-group/no-group paths and `n <= 0` guard are consistent with the implementation's stated residual-DF requirement.
2. **Group residual construction**
   - Checked grouping by `levelText`, group-mean accumulation with double-double addition/division, and residual cross-products.
   - Missing group labels are removed with the corresponding response row; the group means are computed only from retained rows.
3. **Contrast-space construction**
   - Traced `contrastCrossprod()`: the QR rank of X and M, the containment test `rank([X,M]) <= rank(M)`, the selected basis, and the orthogonal complement dimension `q.rank - rx`.
   - The implementation's QR ordering relies on the established pivoting behavior; this is the same issue examined in the earlier #263/#59 review. No contrary code path was found in this pass.
4. **Sphericity statistic and p-value**
   - Checked `W = det(U / mean(diag(U)))`, the zero/one-dimensional guards, `n >= pp`, the correction factor `rho`, and chi-square degrees of freedom `pp(pp+1)/2 - 1`.
   - For `pp >= 2` and `n >= pp`, the correction's `rho` remains positive; no division-by-zero path was identified in the correction.
5. **Existing findings**
   - #342 is reflected in the current source by the explicit `pp === 1` rejection.
   - The older #59 suspicion was not reproduced and remains closed; no duplicate issue was created.

## Reproduction / verification status

This was a source-level audit only. No Vitest, Node runtime, or R process was executed. No new issue was opened and no source code was changed. The checked source is pinned by the blob SHA above.
