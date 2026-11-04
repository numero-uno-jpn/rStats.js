# Audit #998 — Cholesky / matrix exponential / condition number / LU-PCA

- Target: src/linalg/chol.ts, src/linalg/expm.ts, src/linalg/kappa.ts, src/linalg/lu.ts
- HEAD: 042e4846cc08413101d5f6e7055bfc345eceb920
- Source blobs: 5444cb2c0f790e8a231c515dead77c069d822e3a, a40ad3373b8852e17d3e204120a121581822f758, 77ed102f0b5e6065f6fc7c7b343a2c6428bfc74b, dbd3fde861e83a2928d64543fc35f812542f21c8
- Result: no new independently reproducible defect established in this pass.

## Scope

- Cholesky: upper-triangle-only contract, nonpivoted positive-definiteness checks, pivoted permutation/rank/tolerance, first pivot and later stopping rule, zero-lower output, chol2inv size validation and triangular inverse.
- Matrix exponential: six methods, method/order validation, 0x0 and 1x1 special cases, nonfinite handling, scaling/squaring, balancing/unbalancing, Padé solve, Taylor/Padé order cap and squaring.
- Kappa: exact 2-norm via scaled SVD, exact other norms via solve, estimated QR/direct methods, wide transpose, triangular upper/lower and norm mapping, extreme scale handling.
- LU/prcomp: rectangular LU dimensions and row permutation, zero pivots, finite input validation, tiny-pivot multipliers, PCA centering/scaling, rank/tol truncation, standard deviation denominator, score/loadings dimensions and large-scale fallback.
- Reviewed available Cholesky and expm oracle test harnesses.

## Candidate rejection / existing issues

- Pivoted Cholesky's first-pivot tolerance behavior is already tracked by an existing issue; not duplicated.
- Matrix exponential's 1x1 path intentionally delegates to Math.exp, including NaN/Inf, matching the documented R special case.
- PCA's singular-vector signs/bases are non-unique; no mismatch in invariant quantities was established statically.
- No additional issue filed.

## Verification limits

Static source review and available test-harness review only. Vitest/Node/R not executed. No code changes.
