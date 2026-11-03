# Issue #211 log: ode over finite times whose difference overflows

GitHub Issue #211. Session 11, group A5 (overflowing differences in the numerical methods).

## Plan

- Intent: `ode` forms each step as `h = times[j] - times[j - 1]`. For finite times such as -1e308 and 1e308 the difference overflows to Infinity, and the update `y + h k` is `1 + Inf * 0 = NaN` even for a zero slope (Euler, rk2 and rk4).
- Method: only where h is not finite while both times are finite, take the step from its half `hh = times[j]/2 - times[j - 1]/2` (finite; the halvings are exact at this size), with the same formulas: `y + h k` becomes `(y + hh k) + hh k`, the stage times are `t + hh` (midpoint) and `(t + hh) + hh` (end), and the rk4 increment `h/6 (k1 + 2 k2 + 2 k3 + k4)` becomes `(hh / 1.5)` times the quarter-weighted sum `k1/4 + k2/2 + k3/2 + k4/4` (the form #124 already uses), added twice.
- Why not an error: the issue allows either; the step can be computed, and a zero or small slope then gives the right state. Steps that do not overflow go through the old code, so their bits do not change.

## Check (main `347830e`)

deSolve is not installed with the local R 4.5.2. Its fixed-step solvers form `dt = times[i+1] - times[i]` and `y + dt * f` in C the same way, so they also give NaN here (by the code, not run).

| call | Before | After | Exact |
|---|---|---|---|
| `ode([1], [-1e308, 1e308], () => [0], [], { method })`, each method | `[1e308, NaN]` | `[1e308, 1]` | 1 |
| slope 1e-300, each method | NaN | 1 + 2e8 | 1 + 2e8 |
| rk4, slope `t * 1e-300` | NaN | 1 | 1 (rk4 is exact for a slope linear in t) |

## Fix

- `src/numerics/ode.ts`: `halvedStep`, used where h overflows between finite times.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: a row next to the `integrate`/`optimize`/`uniroot` row for overflowing intervals.

## Tests

- `test/issue211.test.ts`: zero slope (each method), constant slope, rk4 with a linear slope, the stage times (start, midpoint twice, end), and a normal step. With src stashed the four overflow tests fail.
- The test files that call `ode`: 329 passed. Full run and tsc: see the session's last log entry (#216).

## close comment

Fixed in <commit of #211, see git log --grep='#211'>: where the step between two finite times overflows (`ode([1], [-1e308, 1e308], () => [0], [], { method: "euler" })`), `ode` now forms it from its half: `y + h k` is computed as `(y + (h/2) k) + (h/2) k`, the stage times are the midpoint and the end, and the rk4 increment is `(h/2)/1.5` times the quarter-weighted sum, added twice. The example gives 1 for every method (it was NaN); a constant slope 1e-300 gives 1 + 2e8. Steps that do not overflow are unchanged. deSolve (by its code) gives NaN here too, so this is documented in docs/differences-from-r.md.

Test: test/issue211.test.ts. (Not pushed yet.)
