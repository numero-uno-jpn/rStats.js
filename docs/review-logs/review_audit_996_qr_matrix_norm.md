# Audit #996 — QR / matrix shape / matrix norms

- Target: src/linalg/qr.ts, src/linalg/matrix.ts, src/linalg/norm.ts
- HEAD: 16eba3c8ec90e36e1e7725438a6336a6b4c6e36c
- Source blobs: edc520bfb86c909e556f77f9707ef748fd464eec, bc7cd5f43583c8b91bfc8713b0e674f60c4ca43d, 3ee6876b551eab0d51a0abf8b2c3a57680d54457
- Result: no new independently reproducible defect established in this pass.

## Scope and checks

1. LINPACK limited pivoting: original vs updated column norms, zero columns, cancellation recomputation threshold, exact/near rank deficiency, zero tolerance, rank cap for tall/wide matrices, pivot restoration.
2. LAPACK pivoted QR: norm updates, tie selection, Householder generation and application order, scaling retry after overflow, rank semantics (min(m,n)), qraux length.
3. QR consumers: qrQty/qrQy transformation order; qrCoef back substitution and NaN padding; qrResid/qrFitted handling of k=0, one-row matrices and LAPACK restriction; qrQ complete/thin and dvec; qrR; qrX pivot restoration and complete dimensions; qrSolve rank and LAPACK diagonal checks.
4. Matrix conversion: row length validation, zero-row convention (0x0), Float64Array rows, vector-vs-matrix shape detection, transpose and column extraction.
5. Norms: one/infinity/Frobenius/max/spectral; NaN/Inf; empty dimensions; overflow/underflow scaling for Frobenius and SVD-based spectral norm.

## Candidate rejection / duplicate checks

- LAPACK QR has no numerical rank detection by contract; qrSolve performs its own diagonal tolerance check. No issue filed for this documented distinction.
- qrCoef exact-singularity throw and qrResid/qrFitted LAPACK rejection are explicitly represented in implementation comments/API behavior; without an R oracle counterexample, no issue filed.
- Matrix arrays cannot represent a 0-row matrix's column count; documented convention treats it as 0x0.
- Existing QR large-column Householder overflow issue was found in the issue search and is not duplicated.

## Verification limits

Static source inspection and existing test/oracle harness review only. Vitest/Node/R not executed. No source changes.
