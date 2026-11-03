# Issue #267 log: gebal's scaling test when the row-plus-column sums overflow

GitHub Issue #267. Session 11, judging of the issues classified C. Verdict: not planned (an internal function; where the public API reaches it with overflowing sums, the skipped scaling does not change a result). No code changed; a test added.

## Plan

- Intent: check whether `gebal` (src/linalg/balance.ts) is reached with c + r overflowing through the public API, and whether a skipped scaling then matters.
- Method: `gebal` is not exported. Its callers are `eigen` (job "B", nonsymmetric matrices) and `expm` (job "P" then "S" for "Higham08.b"; job "S" for "Higham08" where a nonzero entry would be lost in the scaling, #207). Run eigen and expm on the issue's matrix [[0, 1.6e308], [6e307, 0]], and expm on a 4x4 nilpotent matrix with entries 1.6e308 whose square cancels (so that the sums overflow while the exponential I + A is finite).
- Why: a C verdict needs the public API not to reach the defect, or the defect not to change any result.

## Check (main `2f07958`, R 4.5.2)

- **eigen:** before balancing, eigen divides the matrix by a power of 2 so that its largest entry is at most 2^459, as dgeev does (src/linalg/eigen.ts, `decompositionExponent(a.data, 459)`). c + r is then at most 2 n 2^459 and cannot overflow. The issue's matrix gives eigenvalues 9.797958971132713e307 and -9.797958971132711e307, exactly the values of the matrix divided by 2^100 scaled back (+-sqrt(1.6e308 x 6e307) = +-9.797958971132712e307; R 9.797959e+307 and -9.797959e+307).
- **expm:** it calls gebal on the matrix as given, so c + r can overflow. But c + r > Number.MAX_VALUE at an index i means an entry into i and an entry out of i whose product exceeds about 1e308^2 / 4, so A^2 has that product in it:
  - the issue's matrix: the exponential is truly infinite (cosh of 9.8e307); expm gives Infinity throughout.
  - N = [[0, a, 0, a], [0, 0, a, 0], [0, 0, 0, 0], [0, 0, -a, 0]] (A^2 = 0 by cancellation, exp(N) = I + N) with a = 1.6e308: NaN with "Higham08.b" and also with "Higham08", which does not balance; with a = 1e200, where c + r = 2e200 does not overflow and gebal works as intended, it is NaN as well (the products overflow inside the Padé approximant). R's expm stops with "result would be too long a vector" for a = 1.6e308.

So the overflowing comparison is reached only for matrices whose exponential is infinite, or for which the result is already lost elsewhere, independently of the balancing. A correct comparison (for example on sums halved) would not change any result.

## Fix

- None (not planned). LAPACK's dgebal has the same comparison.

## Tests

- `test/issue267.test.ts`: gebal is not in the public API; eigen of the issue's matrix equals that of the matrix divided by 2^100 (scaled back), within 1e-15 of +-sqrt(9.6e615).

## Out of scope

- expm of N above with a = 1e200 is NaN for the finite I + N (a = 1e150 gives I + N to 1 ulp): the Padé approximant forms products that overflow and cancel in exact arithmetic. Not investigated (no balancing involved).

## close comment

Not planned: gebal is an internal helper, and where its sums c + r overflow the skipped scaling does not change any result. eigen divides the matrix so that its largest entry is at most 2^459 before balancing (as dgeev), so the sums cannot overflow there: for the issue's matrix [[0, 1.6e308], [6e307, 0]] it gives +-9.797958971132712e307 (to 1 ulp), the eigenvalues of the matrix divided by 2^100 scaled back. expm balances the matrix as given, but c + r > Number.MAX_VALUE needs an entry into and out of the same index whose product overflows, so the exponential is infinite (the issue's matrix: Infinity, as cosh(9.8e307)) or the Padé approximant already overflows without balancing (a nilpotent example with cancelling squares gives NaN also with "Higham08", which does not balance, and also at 1e200 where the sums do not overflow). LAPACK's dgebal makes the same comparison. A test was added: test/issue267.test.ts. (Not pushed yet.)
