# Issue #469 log: ode rk4 where the quarter-weighted slope sum overflows

GitHub Issue #469. Session 13, group A3 (recorded as out of scope in the #394 log).

## Plan

- Intent: the rk4 fallback of #124 / #394 forms q = k1/4 + k2/2 + k3/2 + k4/4, whose weights sum to 1.5, so q overflows for finite slopes above MAX / 1.5 although the increment h q / 1.5 can be finite.
- Method: inside the fallback, only where q is not finite and the four slopes are finite, the sum divided by 8 instead (at most 0.75 MAX, so finite), and the increment 2 ((h eighth) / 1.5). Since abs(eighth) > MAX / 2 there, h eighth is normal for any positive h and needs no 2^60 scale; where it overflows (h > 2 or so), the true increment overflows too. Every other path is unchanged, so the same bits.
- deSolve is not installed in the local R (as for #124 and #394); its h/6 (k1 + 2 k2 + 2 k3 + k4) overflows at 2 k2. No docs entry, as for #124 and #394.

## Reproduction (main `c2a195a`)

| call (method "rk4", constant slope) | before | after | exact |
|---|---|---|---|
| `ode([0], [0, 0.5], () => [1.7e308])` (issue) | Infinity | 8.500000000000001e307 | 8.5e307 (one ulp) |
| `ode([0], [0, 0.5], () => [MAX])` | Infinity | 8.988465674311579e307 | MAX / 2 |
| `ode([0], [0, 1e-300], () => [1.7e308])` | Infinity | 170000000.00000003 | 1.7e8 (one ulp) |
| `ode([-1e308], [0, 1], () => [1.7e308])` | Infinity | 7.000000000000001e307 | 7e307 (one ulp) |
| `ode([0], [0, 2], () => [1.7e308])` | Infinity | Infinity | 3.4e308 (overflows) |
| `ode([0], [0, 0.5], () => [1e308])` (#394) | 5e307 | the same | |

## Cause

`src/numerics/ode.ts`: `if (Number.isFinite(scaled) || !Number.isFinite(quarter)) return v + scaled / 1.5 / scale;` returned the overflowed q.

## Fix

- `src/numerics/ode.ts` (rk4 step): the branch above, before that line.

## Tests

- `test/issue469.test.ts`: the cases above (within one ulp of the exact value; the overflowing one Infinity), the #394 case and the `@example` unchanged. With `src/` stashed the first test fails.
- `numerics`, `jstat-replacement`, `issue124`, `issue211`, `issue239`, `issue340`, `issue360`, `issue394` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- `halvedStep` (h itself overflows) forms the same quarter-weighted sum, which can overflow for slopes above MAX / 1.5 too; there the increment hh q / 1.5 with hh near 1e308 overflows anyway unless the slopes are tiny, so it is not changed.

## close comment

Fixed in <commit of #469, see git log --grep='#469'>: where the quarter-weighted slope sum of the rk4 fallback overflows for finite slopes (its weights sum to 1.5), the sum is divided by 8 instead and the increment is 2 (h eighth / 1.5), so `ode([0], [0, 0.5], () => [1.7e308], [], { method: "rk4" })` ends at 8.5e307 (one ulp; was Infinity). Other inputs, including #394's 1e308 case, are unchanged. deSolve is not installed locally, so its value was not checked. Test: test/issue469.test.ts. (Not pushed yet.)
