# Issue #361 log: periodic spline with one knot

GitHub Issue #361. Session 12, judging of the issues classified C. Verdict: not planned (not reproduced). No code changed.

## Plan

- Intent: run the issue's call on the current main through the public API and compare with R 4.5.2.
- Why: classified C (not reproduced); the verdict needs the value.

## Check (main `7033ff3`, R 4.5.2)

- `spline([0], [5], { method: "periodic", xout: [0] })`: { x: [0], y: [5] }. With xout [0, 1]: y [5, 5].
- R: `spline(0, 5, method = "periodic", xout = 0)`: x 0, y 5. The same.
- No NaN from a remainder by a zero period: the knot's value is returned.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: not reproduced. spline([0], [5], { method: "periodic", xout: [0] }) returns y = 5 on the current main (and 5, 5 for xout [0, 1]), the same as R's spline(0, 5, method = "periodic", xout = 0). (Not pushed yet.)
