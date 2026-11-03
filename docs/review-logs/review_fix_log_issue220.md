# Issue #220 log: localMin with tol NaN (no end) or Infinity (immediate return)

GitHub Issue #220. Session 11, judging of the issues classified C. Verdict: not planned (an internal function; the public API checks tol first). No code changed; a test added.

## Plan

- Intent: check that no public call reaches `localMin` (src/optim/localmin.ts) with a tol that is NaN, infinite, zero or negative.
- Method: `localMin` is not exported (src/index.ts, src/entries/*.ts). Its only caller is `optimize` (src/numerics/integrate.ts), which passes the user's tol or tol / 2. Run `optimize` with each invalid tol, counting the objective's evaluations; compare with R 4.5.2's `optimize` (with a counter that stops it beyond 100000 evaluations, in case it does not end).
- Why: a C verdict needs the public API not to reach the defect.

## Check (main `1a8f7b0`, R 4.5.2)

| tol | R 4.5.2 `optimize(f, c(-1, 1), tol = ...)` | rStats.js `optimize(f, -1, 1, { tol })` |
|---|---|---|
| NaN | error "invalid 'tol' value" | RangeError "'tol' must be a positive finite number", f not called |
| Inf | error "invalid 'tol' value" | same RangeError, f not called |
| 0 | error "invalid 'tol' value" | same RangeError, f not called |
| -1 | error "invalid 'tol' value" | same RangeError, f not called |

The check `!(tol > 0 && tol < Infinity)` in `optimize` (added by #74, commit `eb90fe6` "optimize: positive tol, and stop where a step no longer moves (#74)") runs before the ends are checked and before `localMin`. The other path, over x / 2, passes `tol * 0.5`, positive and finite when tol is. So `localMin` is never called with the issue's tolerances.

## Fix

- None (not planned). Adding the same check inside `localMin` would be unreachable.

## Tests

- `test/issue220.test.ts`: `localMin` is not in the public API; `optimize` rejects NaN, Infinity, 0 and -1 without calling the objective. The NaN case is safe to run because the check comes first.

## close comment

Not planned: localMin is an internal helper, and its only caller, optimize, rejects a tol that is not positive and finite before the search (since #74, commit eb90fe6), as R's optimize does ("invalid 'tol' value"). optimize(f, -1, 1, { tol }) with tol NaN, Infinity, 0 or -1 throws "'tol' must be a positive finite number" without calling f; the path that searches over x / 2 passes tol / 2, which is positive and finite whenever tol is. A test was added: test/issue220.test.ts. (Not pushed yet.)
