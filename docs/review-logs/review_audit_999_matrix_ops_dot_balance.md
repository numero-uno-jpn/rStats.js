# Audit #999 — Matrix products / dot products / triangular solves / balancing

- Target: src/linalg/basic.ts, src/linalg/dot.ts, src/linalg/ops.ts, src/linalg/balance.ts
- HEAD: 9622e1a59bcb054f8b0fa89055f322f1bef5d95f
- Source blobs: 6c30eb2896b4cfc700fb423a701e1d0db0e38897, 8370f33d767aaa5b0e21838a73de077a5c737128, 4d3916883105f9db6bf1f74addb0d493947111da, b0796b3365f4f23a7a02efdb05628380f85cf284
- Result: no new independently reproducible defect established.

## Scope

- crossprod/tcrossprod: vector/matrix coercion, conformability, symmetric triangle reuse, row/column minima for underflow detection, overflow/cancellation fallback.
- backsolve/forwardsolve: k boundaries, rectangular leading block, upper/lower and transpose combinations, vector/matrix RHS shapes, exact-zero diagonal, zero RHS skipping in overflow paths.
- dot product: IEEE-754 split into integer mantissa/exponent, BigInt exact product accumulation, ties-to-even rounding, subnormal/overflow output, underflow detector and exact product comparison at the normal boundary.
- matrix operations: %*% vector orientation, zero inner dimension, recycling in column-major order, outer/t/diag/cbind/rbind/matrix/kronecker/seq edge conditions.
- balancing: permutation isolation loops, index bookkeeping, power-of-two scaling, safeguards against scale overflow/underflow, eigenvector back-transform and reverse swaps.

## Candidate rejection

- Vector orientation in %*% follows the R convention of choosing a row or column to make the product conformable; no counterexample established.
- The exact-dot fallback deliberately preserves ordinary summation for cancellation in the normal range and only retries nonfinite or possible-underflow sums; this matches the documented behavior and existing tests around #395/#465.
- Zero-inner-dimension product is explicitly handled as a zero-valued product with the expected output shape.
- No new Issue filed.

## Verification limits

Static source and existing matrix-ops test harness review only. Vitest/Node/R not executed. No source changes.
