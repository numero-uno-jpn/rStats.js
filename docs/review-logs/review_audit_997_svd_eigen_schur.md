# Audit #997 — SVD / eigen / Schur

- Target: src/linalg/svd.ts, src/linalg/eigen.ts, src/linalg/schur.ts
- HEAD: 203356623d253a5d1a50f75cf3bd35b840605420
- Source blobs: e230fff3a0c1408bec999dc300dbe72456e84005, d22d45d376ba2100506e52a142689af360db296d, d4e6bdb06fad03a68460547432efb908de94a696
- Result: no new independently reproducible defect established.

## Scope

- SVD: tall/wide transpose and U/V swap, nu/nv truncation/clamping, zero dimensions, zero/rank-deficient matrices, bidiagonalisation, left/right Householder application order, implicit QR split/cancellation, Wilkinson shift, convergence cap, singular-value sign and sorting, vector permutation, extreme-scale power-of-two scaling.
- Eigen: square/empty/nonfinite validation, automatic symmetry detection and lower-triangle convention, scaling and normalization, symmetric QL and nonsymmetric Hessenberg/Francis QR, balancing/unbalancing, real/complex pair ordering, eigenvector back-substitution and normalization.
- Schur: empty/nonfinite validation, Hessenberg reduction, hqr2 Schur-only path, complex-pair block detection, 2x2 standardization (lanv2), Q/T rotation consistency and scale restoration.
- Existing SVD and Schur test harnesses reviewed for oracle comparison.

## Edge-case conclusions

- Wide SVD correctly swaps requested vector counts when transposing; the output dimensions remain bounded by original row/column counts.
- Zero singular values are handled without dividing by them in the bidiagonal QR split/deflation path; no contrary failure established by static tracing.
- Complex Schur block traversal intentionally skips the second index of each conjugate pair both when marking blocks and when emitting values.
- Eigen's normalization used only for automatic symmetry classification preserves the intended absolute fallback for subnormal-scale inputs; it is not used to scale the actual eigensystem.
- No new Issue filed. Existing limitations documented in source (different vector bases/signs vs LAPACK, nonunique Schur factors) are not defects.

## Verification limits

Static inspection of implementation and test harnesses only. No Vitest/Node/R execution; no code changes.
