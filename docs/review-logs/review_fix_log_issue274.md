# Issue #274 log: seq with an infinite by

GitHub Issue #274. Session 12.

## Plan

- Intent: the issue asks `seq(from, to, { by })` to reject a non-finite `by` with a RangeError (now `seq(1, 10, { by: Infinity })` is `[1]`).
- `[1]` for an infinite `by` is a recorded decision: `docs/differences-from-r.md` lists `seq(1, 2, by = Inf)`: R NaN, rStats.js 1 (commit 440b953). The issue's error would overturn it, so it was put to the user.
- User decision (2026-11-03): only an infinite `by` pointing away from `to` becomes "wrong sign in 'by' argument"; an infinite `by` in the direction of `to` keeps `[from]`. The `length.out` branches are unchanged.

## Check (main `e5330dc`, R 4.5.2)

| call | R | before | after |
|---|---|---|---|
| `seq(1, 10, by = Inf)`, `seq(10, 1, by = -Inf)` | NaN | `[1]`, `[10]` | the same |
| `seq(1, 10, by = -Inf)`, `seq(10, 1, by = Inf)` (wrong direction) | NaN | `[1]`, `[10]` | error "wrong sign in 'by' argument" |
| `seq(1, 1, by = -Inf)`, `seq(0, 0, by = Inf)` | 1, 0 | 1, 0 | the same |
| `seq(1, 10, by = NaN)` | error "invalid '(to - from)/by'" | the same | the same |

R's NaN is 0 x Inf in from + (0:n) x by: n = (to - from) / by is a signed zero, which passes R's `n < 0` check.

## Cause

n = del / by is -0 for an infinite `by` of the wrong sign, and `n < 0` is false for -0, so the direction check never fired.

## Fix

- `src/linalg/ops.ts`, `seq`: for an infinite `by` with to != from, the sign of `by` is compared with that of to - from. Finite steps take the old path (the same results).
- Docs (en, ja): the `seq(1, 2, by = Inf)` row also lists `by = -Inf` (error).

## Tests

- `test/issue274.test.ts`: the wrong-direction calls throw (they fail with `src/` stashed), the same-direction and to == from calls keep `[from]`, finite steps unchanged.
- `issue70`, `issue98`, `matrix-ops`, `jstat-replacement` tests pass.

## Out of scope (recorded)

- `seq(0, 1e-300, by = -1e300)` (a finite wrong-direction step whose n underflows to -0): R 1e-300 (pmax of 0 and `to`), rStats.js `[0]` (the first value is kept as `from`). Both accept the wrong sign; not changed.

## close comment

Fixed in <commit of #274, see git log --grep='#274'>. Following an earlier recorded decision (docs/differences-from-r.md), `seq(from, to, { by: ±Infinity })` in the direction of `to` still returns `[from]` (R gives NaN). An infinite `by` pointing away from `to` (for example `seq(1, 10, { by: -Infinity })`) now throws "wrong sign in 'by' argument" instead of returning `[1]`; the signed zero n = (to - from) / by had passed the sign check. Finite steps are unchanged. (Not pushed yet.)
