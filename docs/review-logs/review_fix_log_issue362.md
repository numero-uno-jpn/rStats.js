# Issue #362 log: L-BFGS-B accepts a fractional lmm

GitHub Issue #362. Session 12, group A1 (input checks to R's errors). Fixed: `control.lmm` is taken as R's `as.integer`, as `maxit` (#76).

## Plan

- Intent: lmm is a workspace dimension; a fraction indexes the typed arrays with fractions. R 4.5.2 truncates it (as.integer), and lbfgsb rejects m <= 0 with "ERROR: M .LE. 0" (convergence 52).
- Choice: R's semantics exactly (trunc; NaN and beyond the integer range are NA, the latter with R's coercion warning, then M .LE. 0), as #76 did for maxit. No new error type: R returns code 52, not an error.

## Check (main `b18a7dc`, R 4.5.2)

| lmm | R | rStats.js before |
|---|---|---|
| 1.5, f = (x - 2)^2 from 0 | par 2, counts 4, 4, convergence 0 | error "non-finite value supplied by optim" (after #354; the issue's triage saw "L-BFGS-B needs finite values of 'fn'") |
| 2.7, 5.9 (Rosenbrock) | as lmm 2, 5 | the same error |
| 0.5 | M .LE. 0, code 52 | ran with m = 0.5 (Rosenbrock: code 1 after 198 evaluations) |
| -1, -1.5 | M .LE. 0, code 52 | "Invalid typed array length" |
| NaN | M .LE. 0, code 52 (no warning) | ran with m = NaN |
| 3e9, -3e9, Inf | warning "NAs introduced by coercion to integer range", M .LE. 0, code 52 | "Invalid typed array length" |

## Fix

- `src/optim/optim.ts`, the L-BFGS-B branch: lmm = trunc(lmm) when abs(lmm) <= 2147483647, else NA (warning pushed to `warnings` when beyond the range); NA and m <= 0 are passed to `lbfgsb` as 0, which returns "ERROR: M .LE. 0" (a negative m gave negative workspace lengths). Integer lmm unchanged.
- No docs: R's behaviour.

## Tests

- `test/issue362.test.ts`: lmm 1.5 on (x - 2)^2 (R's par, counts, code); 2.7 as 2 and 1.5 as 1 on Rosenbrock; 0.5, -1, -1.5, NaN, +-3e9, Inf give code 52 with R's warning only beyond the range. With `src/` stashed, both blocks fail.
- `test/optim*`, issue354/355, omega and factanal tests pass; tsc no errors.

## Out of scope (recorded)

- A large in-range lmm (e.g. 1e9) allocates n m and (2m)^2 workspaces; R 4.5.2 crashed (segfault) at lmm 2147483647.5. A resource limit belongs to B1 (allocation limits).
- Rosenbrock from (-1.2, 1) with L-BFGS-B: rStats.js and R agree in counts but not to the bit (lmm 2: par[0] 0.9998563110248253 vs R 0x1.ffed2b4290a23p-1 = 0.9998563307529519; lmm 5: ...827 vs ...858). Pre-existing, unrelated to lmm's coercion.

## close comment

Fixed in <commit of #362, see git log --grep='#362'>. optim's L-BFGS-B now takes control.lmm as R's as.integer, as maxit (#76): a fraction is truncated (lmm 1.5 on the issue's example gives par 2, counts 4, 4, convergence 0, as R 4.5.2), and NaN or a value beyond the integer range is NA, which lbfgsb rejects as "ERROR: M .LE. 0" with convergence 52 (beyond the range with R's warning "NAs introduced by coercion to integer range"); lmm below 1 gives the same code 52 instead of a negative workspace length. Integer lmm is unchanged. A test was added: test/issue362.test.ts. (Not pushed yet.)
