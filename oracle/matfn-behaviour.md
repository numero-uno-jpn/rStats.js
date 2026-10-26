# Schur decomposition and the matrix exponential: the behaviour to reproduce

Fixtures `schur` and `expm` (`oracle/matfn.R`; format in its header). Where this file and a fixture seem to disagree,
report it.

## schur(x)

R: `Matrix::Schur(x)` (LAPACK `dgees`, no sorting). Result `{ T, Q, valuesRe, valuesIm }`: `x = Q T Q'`, Q
orthogonal, T upper quasi-triangular (1 × 1 blocks for real eigenvalues, 2 × 2 blocks `[[a, b], [c, a]]` with `b c <
0` for complex pairs, as LAPACK standardises them), the eigenvalues read off T's diagonal blocks in order (a complex
pair as `a ± sqrt(−bc) i`, positive imaginary part first).

The decomposition is not unique (order of the blocks, signs of Q's columns), and this library may compute it
differently from LAPACK (the existing nonsymmetric `eigen` reaches the real Schur form by Hessenberg reduction and
Francis's double-shift QR, EISPACK's `orthes`/`hqr2`, public domain; reuse it). So the tests check, for each case:

- `‖Q'Q − I‖_max ≤ 1e-13 n` and `‖Q T Q' − x‖_max ≤ 1e-13 n ‖x‖_max`;
- T is quasi-triangular with standardised 2 × 2 blocks (entries below the block diagonal exactly 0);
- the eigenvalues, as a multiset, agree with R's `EValues` by the rules the existing `eigen` tests use for
  eigenvalues (`test/eigen.test.ts`);
- where T's diagonal blocks come out in R's order and Q's columns have R's signs, T and Q match R's within 1e-12
  relative (otherwise not compared).

## expm(x, { method })

R: `expm::expm(x, method)`. Methods `"Higham08.b"` (default) and `"Higham08"` now; the fixture's other methods
(`Pade`, `Taylor`, `PadeO`, `TaylorO`) come later (skip them in the test, saying so).

Higham's scaling and squaring with Padé approximants (N. J. Higham, SIAM J. Matrix Anal. Appl. 26 (2005) 1179–1193),
as expm 1.0-1 implements it:

1. n ≤ 1: `exp` of the entry.
2. `"Higham08.b"` balances first: LAPACK 3.12.0's `dgebal` with job `"P"` (permutation) on x, then `dgebal` with job
   `"S"` (scaling) on the result, as two separate calls (LAPACK is BSD; port its `dgebal`).
3. With `ν = ‖A‖_1` (maximum column sum): if `ν ≤ 2.1`, the Padé degree m = 3, 5, 7 or 9 for the first of the bounds
   0.015, 0.25, 0.95, 2.1 that ν does not exceed, with the coefficients of Higham's Table 10.4 (`b_0 ... b_m`):
   m = 3: 120, 60, 12, 1; m = 5: 30240, 15120, 3360, 420, 30, 1; m = 7: 17297280, 8648640, 1995840, 277200, 25200,
   1512, 56, 1; m = 9: 17643225600, 8821612800, 2075673600, 302702400, 30270240, 2162160, 110880, 3960, 90, 1.
   With `A2 = A A` and `P_k = A2^k`: `U = A (b_1 I + b_3 P_1 + ... + b_m P_{(m−1)/2})`, `V = b_0 I + b_2 P_1 + ... +
   b_{m−1} P_{(m−1)/2}` (powers formed by repeated multiplication P ← P A2, sums accumulated in increasing order).
   Otherwise m = 13: `s = ceil(log2(ν/5.4))` if positive (else 0), `B = A/2^s`, `B2 = B B`, `B4 = B2 B2`, `B6 = B2 B4`,
   coefficients c_1..c_14 = 64764752532480000, 32382376266240000, 7771770303897600, 1187353796428800, 129060195264000,
   10559470521600, 670442572800, 33522128640, 1323241920, 40840800, 960960, 16380, 182, 1; `U = B (B6 (c14 B6 + c12 B4 +
   c10 B2) + c8 B6 + c6 B4 + c4 B2 + c2 I)`, `V = B6 (c13 B6 + c11 B4 + c9 B2) + c7 B6 + c5 B4 + c3 B2 + c1 I`.
4. `X = (V − U)^-1 (V + U)` (an LU solve, as `solve`), then squared s times.
5. Undo the balancing: `X_ij ← X_ij d_i / d_j` with the scaling factors d of the `"S"` call; then the permutations of
   the `"P"` call: for i from ilo − 1 down to 1, swap columns i and p_i and rows i and p_i; for i from ihi + 1 up to n,
   the same (p the permutation record, ilo and ihi as `dgebal` returns them, 1-based).

Accuracy: entries within a relative 1e-12 of R, or within 1e-12 × the largest absolute entry of the result where R's
entry is (near) 0 by cancellation; the symmetric cases also have exact references (`reference`, Rmpfr), which may
settle a known difference (within 1e-12, listed with the reason).
