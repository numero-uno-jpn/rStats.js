# Issue #489 log: chisqTest's simulation with B = 0

GitHub Issue #489. Session 14, group B1. Fixed: `B` must be a positive integer in `chisqTest`'s simulation, for goodness of fit and for tables.

## Plan

- User decision (2026-11-04): E1 #488 and #489: B = 0 in the simulation is a RangeError "'B' must be a positive integer" (K1). The fixture cases are substituted and the docs sentence (en, ja) is rewritten.
- Intent: as #488 (`86e6209`): with `B: 0` nothing is simulated and p = (1 + 0) / (0 + 1) = 1 is computed from no data.
- Method: `replicates()`, used by both simulation paths, checks `B >= 1` with the message of #488. A table with a zero margin does not simulate (R: the ordinary test with a warning), so `B` is not checked there, as before.
- Why: one check covers both paths; `B >= 1` takes the old code, so values and the random stream are unchanged.

## Reproduction (main `86e6209`, R 4.5.2)

| Call (`simulatePValue: true, B: 0`) | R | rStats.js before |
|---|---|---|
| `chisqTest([10, 20])` | p = 1 | p = 1 |
| `chisqTest([[10, 20], [20, 10]])` | p = 1 | p = 1 |

The issue says R requires a positive `B`; R 4.5.2 returns p = 1 for both (B = -1 is an error in R: "invalid 'size' argument").

## Fix

- `src/htest/chisqTest.ts`, `replicates()`: `B >= 1`; message "'B' must be a positive integer".
- `test/chisq.test.ts`: the case of `chisqTestSim.json` with B = 0 (2 x 2 table, seed 13) is a substitute with the error.
- `oracle/chisqsim.R`: the comment "(allowed)" corrected (fixture not regenerated).
- `docs/differences-from-r.md`, `docs/ja/`: the sentence of #488 now names both functions.

## Tests

- `test/issue489.test.ts`: B = 0 and -1 are errors for goodness of fit and tables; B = 1 gives R's p = 0.5 and the next uniform for both; a zero-margin table with B = 0 runs the ordinary test (p NaN, as R). With `src/` stashed, the error test fails.
- `test/chisq.test.ts`, `review58.test.ts`, `errors.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #489, see git log --grep='#489'>. R 4.5.2's `chisq.test(..., simulate.p.value = TRUE, B = 0)` does not error: it returns p = (1 + 0) / (0 + 1) = 1 from no simulation, for goodness of fit and for tables. As a p-value computed from nothing, rStats.js now rejects it in both paths: `B` must be a positive integer ("'B' must be a positive integer", the same as `fisherTest` for #488). B >= 1 gives the same values and random stream as before; a table with a zero margin still runs the ordinary test as R. The difference from R is recorded in docs/differences-from-r.md. A test was added: test/issue489.test.ts. (Not pushed yet.)
