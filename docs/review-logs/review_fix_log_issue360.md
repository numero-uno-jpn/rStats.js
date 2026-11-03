# Issue #360 log: non-finite times in ode

GitHub Issue #360. Session 12, group A1 (input checks). Fixed: a time that is not finite is a RangeError "'times' must be finite values".

## Plan

- Intent: an infinite or NaN time makes the step infinite or NaN, and the state NaN even with a zero derivative (Infinity * 0).
- Choice: reject before any call of `func`, under the policy "meaningless input is an error". deSolve is not installed locally, so its behaviour is not checked (not recorded as a difference from R).

## Check (main `c7e8f7c`)

`ode([0], times, () => [0], [], { method: "euler" })`:

| times | before |
|---|---|
| [0, Infinity] (the issue) | [[0, 0], [Infinity, NaN]] |
| [0, NaN] | [[0, 0], [NaN, NaN]] |
| [-Infinity, 0] | [[-Infinity, 0], [0, NaN]] |
| [NaN] | [[NaN, 0]] |
| [0, 1, Infinity] | last row [Infinity, NaN] |

## Fix

- `src/numerics/ode.ts`: `times` with a value that is not finite throws `RangeError("'times' must be finite values")`, before `func` is called. Finite times are unchanged (the overflowing step between two finite times, #211, keeps its halved step).

## Tests

- `test/issue360.test.ts`: the five cases above for euler, rk2, rk4; a finite euler run unchanged. With `src/` stashed, the error block fails.
- `test/issue124.test.ts`, `test/issue211.test.ts`, `test/numerics.test.ts`, `test/jstat-replacement.test.ts` pass; tsc no errors.

## close comment

Fixed in <commit of #360, see git log --grep='#360'>. ode now rejects a time that is not finite with RangeError "'times' must be finite values", before func is called; the issue's ode([0], [0, Infinity], () => [0], [], { method: "euler" }) gave the row [Infinity, NaN]. Finite times are unchanged, including the overflowing step between two finite times (#211). (deSolve is not installed here, so its message was not compared.) A test was added: test/issue360.test.ts. (Not pushed yet.)
