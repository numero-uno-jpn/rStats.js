# optim: the behaviour to reproduce

What R 4.5.2's `optim` computes, in words, for an implementation that must not read R's source. Fixtures `optim`
(`oracle/optim.R`) and `optimSANN` (`oracle/optimsann.R`, x86_64); the test functions are in `oracle/_optimfns.R`
(write their TypeScript equivalents in the test). The methods are published algorithms: Nelder-Mead, BFGS and CG are
J. C. Nash's Algorithms 19, 21 and 22 (Compact Numerical Methods for Computers, 2nd ed., 1990); L-BFGS-B is the
Fortran code of Zhu, Byrd, Lu and Nocedal on Netlib (`opt/lbfgs_bcm.shar`, version 2.1; no copyright notice, so it
may be ported); SANN is Bélisle's (1992) simulated annealing. R's versions differ from the books in the details
listed here, and the results must follow R's (the same iterations, so the same counts).

## Easy to get wrong

1. Everything runs on **scaled parameters** `p = par / parscale` and the **scaled objective** `fn(p × parscale) /
   fnscale`; gradients `gr × parscale / fnscale`; the final value is multiplied back by `fnscale`.
2. Numerical gradients (no `gr`): central differences with step `ndeps` (default 1e-3) **in the scaled
   parameters**; for L-BFGS-B the steps are cut at the bounds (then divided by the actual width).
3. Several tests compare `10 + x == 10 + y` (in double precision) to decide that a step changed nothing.
4. In CG, after an accepted step the "previous" function value is overwritten before the quadratic interpolation, so
   the interpolation denominator is `−2 g·t s` (see CG). Reproduce it.
5. R's own constants: SANN's `e − 1` is the 8-digit `1.7182818`; the line-search constants are 1e-4 (acceptance),
   0.2 (step reduction) and 10 (rule 3); CG's step growth 1.7.
6. Defaults: maxit 500 (Nelder-Mead), 10000 (SANN), 100 otherwise; reltol sqrt(eps); abstol −Inf; L-BFGS-B factr 1e7,
   pgtol 0, lmm 5; SANN temp 10, tmax 10; CG type 1.

## API

`optim(par, fn, options?)` with options `{ gr, method, lower, upper, hessian, control }`, `control` with R's names
in camelCase (`maxit`, `reltol`, `abstol`, `parscale`, `fnscale`, `ndeps`, `alpha`, `beta`, `gamma`, `type`, `lmm`,
`factr`, `pgtol`, `temp`, `tmax`). Result `{ par, value, counts: [function, gradient], convergence, message,
hessian? }`: counts are NaN where R has NA (gradient count of Nelder-Mead and SANN; both for Brent); `message` null
except for L-BFGS-B. `optimHess(par, fn, gr?, control?)` as R's. R's warnings: `bounds can only be used with method
L-BFGS-B (or Brent)` (then L-BFGS-B is used), `one-dimensional optimization by Nelder-Mead is
unreliable:\nuse "Brent" or optimize() directly`, `method L-BFGS-B uses 'factr' (and 'pgtol') instead of 'reltol' and
'abstol'`; errors as R (`method = "Brent" is only available for one-dimensional optimization`, `'lower' and 'upper'
must be finite values`, `L-BFGS-B needs finite values of 'fn'`, `initial value in 'vmmin' is not finite`, `function
cannot be evaluated at initial parameters`, `non-finite finite-difference value [i]`).

SANN uses the library's random numbers (`setSeed`): a test calls `setSeed(seed)` first, as the fixture's R did.

## Nelder-Mead (Nash's Algorithm 19 as R has it)

Simplex of n + 1 points. Start point first; `step` = max over i of 0.1 |p_i| (0.1 if all are 0); vertex j (j = 1..n)
is the start point with coordinate j increased by `step`, multiplied by 10 again while that leaves the coordinate
unchanged; `size` = sum of the steps used. `convtol = reltol (|f0| + reltol)`. Function values that are not finite
count as 1e35. The function count includes the start.

Loop (while the count ≤ maxit): evaluate the vertices whose values are unknown; then scan the vertices in order,
skipping the current lowest L (initially the start point), with H starting as L: a value strictly below f_L makes
that vertex the new L, a value strictly above f_H the new H; stop if `f_H ≤ f_L + convtol` or `f_L ≤ abstol`. Centroid C of all
vertices but H. Reflection `R = (1 + α)C − α H`. If `f_R < f_L`: expansion `E = γ R + (1 − γ) C`; H becomes E if `f_E <
f_R`, else R. Otherwise: if `f_R < f_H`, H becomes R; then contraction `K = (1 − β) H + β C` (with the current H); if `f_K
< f_H`, H becomes K; else if `f_R ≥ f_H` (the reflection did not help): shrink every vertex but L towards L, `v = β(v −
L) + L`, mark them for re-evaluation, and compute the new size (sum of |v_i − L_i|): if it is not smaller than the
previous size, stop with convergence code 10. Result: the vertex L; convergence 1 if the count exceeded maxit.

## BFGS (Nash's Algorithm 21, variable metric)

Inverse Hessian approximation B (identity at a reset). At each step, direction `t = −B g`, `gradproj = t·g`. If
gradproj < 0: steplength 1; try `x + s t`; if no coordinate changes (rule 3) stop the search; else accept when f is
finite and `f ≤ f_min + gradproj s × 1e-4`, otherwise `s ×= 0.2`. Then "enough" = `f > abstol` and `|f − f_min| >
reltol (|f_min| + reltol)`; if not enough, set f_min to f and treat as no change. On progress: new gradient, `t ← s t`, `c ← g_new −
g_old`, `D1 = t·c`; if D1 > 0, update `B ← B + ((1 + c'Bc/D1) t t' − (Bc) t' − t (Bc)') / D1`, else reset at the next
step. No progress: reset unless just reset (then stop). Uphill direction: reset unless just reset (then stop). Reset
also when more than 2n gradients since the last reset. Iterations count the gradient evaluations (the first
included); stop with convergence 1 at maxit. Counts: function and gradient evaluations.

Order of the arithmetic (the iterations depend on the last bits): B is kept as its lower triangle. The direction:
for each i in order, `t_i = −(Σ_{j ≤ i} B_ij g_j + Σ_{j > i} B_ji g_j)`, the sums taken j = 0, 1, ... in that order
(subtracting each term from 0), and `gradproj += t_i g_i` in the same loop. The trial point `x_i + s t_i`; acceptance
`f ≤ f_min + ((gradproj × s) × 1e-4)`. After a step, in one loop over i: `t_i ← s t_i`, `c_i ← g_i − c_i`, `D1 += t_i c_i`;
then for each i: `(Bc)_i = Σ_{j ≤ i} B_ij c_j + Σ_{j > i} B_ji c_j` (same order), `D2 += (Bc)_i c_i`; `D2 = 1 + D2/D1`; then
for each i and j ≤ i: `B_ij += (D2 t_i t_j − (Bc)_i t_j − t_i (Bc)_j) / D1` (the numerator evaluated left to right).

## CG (Nash's Algorithm 22)

`tol = reltol × n × sqrt(reltol)`; `setstep = 1.7`. Outer loop: clear t and c, cycle = 0, oldstep = 1. Inner loop
(cycles up to n): count the gradient (stop with convergence 1 if the count exceeds maxit), compute g; with the
previous gradient c and direction t: type 1 (Fletcher-Reeves) `G1 = Σ g²`, `G2 = Σ c²`; type 2 (Polak-Ribière) `G1 = Σ
g(g − c)`, `G2 = Σ c²`; type 3 (Beale-Sorenson) `G1 = Σ g(g − c)`, `G2 = Σ t(g − c)`; then c ← g. If G1 > tol: `G3 =
G1/G2` (1 if G2 ≤ 0), `t ← G3 t − g`, `gradproj = t·g`; line search from `s = oldstep` as in BFGS (acceptance updates
f_min to the accepted f); then if some coordinate changed: `newstep = 2 (f − f_min − gradproj s)` (rule 4: f_min
already equals f, so this is `−2 gradproj s`), and if it is positive, `newstep = −gradproj s² / newstep`, try `x +
newstep t`: keep it if lower, else go back to `x + s t`. `oldstep = min(1, 1.7 s)` (s the last step tried; when G1 ≤ tol there was no line search and s is the previous
one). There is no check that t is a descent direction. In the gradient loop, for each i in order, the type's terms
use the previous `c_i` (and `t_i`) before `c_i ← g_i`, and `x_i` is set to the current point in the same loop. The
result of CG is the point of the last gradient evaluation (x) with the last f_min. The inner loop continues while some
coordinate changed, G1 > tol and cycle < n; the outer loop repeats unless (cycle = 1 and (nothing changed or G1 ≤ tol
or f_min ≤ abstol)).

## L-BFGS-B

The Netlib code driven by its reverse-communication task strings: `FG...` → evaluate f and g (an error if f is not
finite), `NEW_X` → one more iteration (stop with convergence 1 when the iterations exceed maxit), `WARN...` →
convergence 51, `CONV...` → 0, `ERROR...` → 52. Machine epsilon is 2^-52. `nbd` from the finite bounds (0 none, 1
lower, 2 both, 3 upper), bounds scaled by parscale. Counts: both the number of function evaluations (the code's own
count). The message is the final task string (e.g. `CONVERGENCE: REL_REDUCTION_OF_F <= FACTR*EPSMCH`,
`CONVERGENCE: NORM OF PROJECTED GRADIENT <= PGTOL`). With no parameters: message `NOTHING TO DO`.

## SANN

`scale = 1/temp`. Repeat until maxit evaluations: temperature `t = temp / log(its + e − 1)` (its from 1), `tmax`
candidates per temperature: `p_try = p + scale × t × z` with z standard normal draws (one `rnorm` per coordinate), f
non-finite counted as 1e35; accept if `Δ ≤ 0` or `runif() < exp(−Δ/t)`; keep the best point. Counts `[maxit, NaN]`,
convergence 0.

## Brent

`optimize(fn/fnscale, lower, upper, tol = reltol)`; par and value; counts NaN; convergence 0; message null.

## optimHess / hessian

For each i: with `e = ndeps_i / parscale_i`, gradients (analytic or numerical as above) at `p ± e` along i; `H_ij =
fnscale (g⁺_j − g⁻_j) / (2 e parscale_i parscale_j)`; then symmetrize `(H + H')/2`.

## Accuracy

par, value and hessian within a relative 1e-12 of R (or 1e-12 absolute where R's value is 0 or the value is a
minimum of 0); counts, convergence and message exactly. One exception: R's L-BFGS-B takes its inner products with the
BLAS (`ddot`, here OpenBLAS, whose summation order depends on the CPU kernel), so when an L-BFGS-B case has R's
counts and message but par or value differ in the last bits, they may be listed as known differences up to a relative
1e-10, with that reason. Known differences only within 1e-12 of an exact reference
(none here), listed with reasons; no loosening. If an L-BFGS-B case does not follow R's iterations, report it with the
case rather than adjusting.
