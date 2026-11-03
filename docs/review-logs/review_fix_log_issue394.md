# Issue #394 log: the rk4 fallback overflowing for large slopes

GitHub Issue #394. Session 12, group A4 (small-number fallbacks). Follows #124.

## Plan

- Intent: the rk4 fallback of #124 forms (h 2^60 q) / 1.5 / 2^60 for |h| < 1, with q = k1/4 + k2/2 + k3/2 + k4/4. The factor 2^60 keeps a tiny h q out of the subnormal range, but for a large slope h 2^60 q overflows: `ode([0], [0, 0.5], () => [1e308], [], { method: "rk4" })` was Infinity, while the increment is 5e307. With |h| >= 1 (no scale) h q itself can overflow while h q / 1.5 is finite (h 1.5, slope 2^1023).
- Method: keep the #124 expression wherever h scale q is finite (the same bits). Only where it overflows: h q / 1.5 if h q is finite (it is then far above the normal range, so the scale changed nothing but the overflow), else 2 ((h/2) q / 1.5) (halving h is exact for |h| >= 1).
- deSolve is not installed in the local R (as for #124), so the R value is not checked; deSolve's formula h/6 (k1 + 2 k2 + 2 k3 + k4) overflows at 2 k2 here. No docs entry, as for #124.

## Check (main after #380, `31224b0`)

| call (rk4) | before | after |
|---|---|---|
| `ode([0], [0, 0.5], () => [1e308])` | Infinity | 5e307 |
| `ode([0], [0, 0.5], () => [2^1023])` | Infinity | 2^1022 |
| `ode([0], [0, 1.5], () => [2^1023])` | Infinity | 1.5 2^1023 |
| `ode([0], [0, 1e-308], () => [1e308])` (#124) | 0.9999999999999999 | the same |
| `ode([0], [0, 2], () => [1e308])` (increment 2e308) | Infinity | Infinity |

## Fix

- `src/numerics/ode.ts`: the rk4 fallback, only where the scaled product overflows.

## Tests

- `test/issue394.test.ts`: the calls above. With `src/` stashed the first test fails.
- `test/issue124.test.ts`, `issue211`, `issue239`, `issue340`, `issue360`, `jstat-replacement`, `numerics`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- q itself overflows where the slopes are close to the largest double (q is up to 1.5 times the largest slope): `ode([0], [0, 0.5], () => [1.7e308], [], { method: "rk4" })` stays Infinity although the increment 8.5e307 is finite. Not part of the issue.

## close comment

Fixed in <commit of #394, see git log --grep='#394'>: the rk4 fallback of #124 keeps its expression (h 2^60 q) / 1.5 / 2^60 wherever h 2^60 q is finite; where it overflows, the increment is now h q / 1.5 (h q is then far above the normal range and needs no scale), or 2 ((h/2) q / 1.5) where h q overflows too. `ode([0], [0, 0.5], () => [1e308], [], { method: "rk4" })` ends at 5e307 (was Infinity). The #124 values (`ode([0], [0, 1e-308], () => [1e308])` = 0.9999999999999999) and increments that do overflow are unchanged. deSolve is not installed locally, so its value was not checked. Test: test/issue394.test.ts. (Not pushed yet.)
