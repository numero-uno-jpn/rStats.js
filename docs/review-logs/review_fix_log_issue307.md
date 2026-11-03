# Issue #307 log: ksTest exact: true allocates an enormous Kolmogorov matrix

GitHub Issue #307. Session 12, group B4 (resource limits, part R3: exact computations; with #308, #316, #321 and #391).

## Plan

- User decision (2026-11-03, items 1 and 2): one array at most 2^24 entries and about 10 s on this PC per call, a limit per function; beyond it a RangeError with the hint "use exact: false" (as `mantelhaenTest` in #232).
- Intent: `exact: true` bypasses the default n < 100; the two-sided exact p-value for D < 1/2 builds an m x m matrix, m = 2 floor(n D) + 1, and raises it to the n-th power (floor(log2 n) squarings and popcount(n) - 1 products, m^3 multiply-adds each).
- Choice: limit the work m^3 x (number of products) to 2^33, checked in ksTest before `pkolmogorovExact` (the matrix is at most 2048 x 2048 = 32 MB under that limit). D >= 1/2 and the one-sided tests use the Birnbaum-Tingey sum (O(n)) and are not limited. The helper `checkKolmogorovExactSize` sits next to `pkolmogorovExact` in `src/htest/core/kolmogorov.ts` and mirrors its branches that need no matrix.

## Check (main `b5876fc`, R 4.5.2)

- The issue's example (x = 1..1e4, F = 0.5) has D = 0.5 and takes the Birnbaum-Tingey branch: not reproduced as written. With D just below 1/2 (or D = 0.4: x = 0.6 i / n against punif, n 1e4) the matrix is 8001 x 8001 (512 MB) raised to the 1e4-th power: hours (code reading and the prep timings; not run). R's C code builds the same matrix (not run).
- Timing at the limit (once, on this PC): `pkolmogorovExact(1023, 390.5 / 1023)`, m 781, 18 products, 8.57e9 multiply-adds: 3.60 s.

## Fix

- `src/htest/core/kolmogorov.ts`: `MAX_EXACT_WORK = 2^33`, `checkKolmogorovExactSize(n, d)`: RangeError "the exact distribution of D for n = N needs powers of a M x M matrix, too much work: use exact: false".
- `src/htest/ksTest.ts`: the check for an exact two-sided one-sample test with D < 1/2; the `exact` option's JSDoc.
- Docs (en, ja): one item for the exact limits of ksTest, ansariTest, corTest (Kendall), jonckheereTest and Hommel (the other functions are added with their issues).

## Tests

- `test/issue307.test.ts`: the boundary m 781 / 783 at n 1023 (fails with src stashed); the n 1e4, D 0.4 call is the RangeError (excluded from the stash run); D >= 1/2, one-sided and `exact: false` still compute.
- `test/htest-core/kolmogorov.test.ts`, `test/htest-basic.test.ts` pass; tsc no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #307, see git log --grep='#307'>: the exact two-sided one-sample ksTest (D < 1/2) now checks the work of the matrix power before building the matrix: m^3 times the number of matrix products (m = 2 floor(n D) + 1) may be at most 2^33 (m 781 at n 1023, 3.6 s on the development machine); above it, a RangeError "... too much work: use exact: false". The issue's example has D = 0.5 exactly, which takes the Birnbaum-Tingey sum (no matrix); with D just below 1/2 (for example D = 0.4 at n = 1e4, an 8001 x 8001 matrix) the call now fails at once. D >= 1/2, the one-sided tests and p-values below the limit are unchanged. R computes these however long it takes; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue307.test.ts. (Not pushed yet.)
