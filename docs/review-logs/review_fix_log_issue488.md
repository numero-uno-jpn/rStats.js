# Issue #488 log: fisherTest's simulation with B = 0

GitHub Issue #488. Session 14, group B1. Fixed: `B` must be a positive integer in `fisherTest`'s simulation.

## Plan

- User decision (2026-11-04): E1 #488 and #489: B = 0 in the simulation is a RangeError "'B' must be a positive integer" (K1). The fixture cases are substituted and the docs sentence (en, ja) is rewritten.
- Intent: with `B: 0` no table is simulated and the p-value (1 + 0) / (0 + 1) = 1 is computed from no data. K1: input without a meaningful result is an error, even where R returns a value.
- Method: the lower bound of the check of #278 goes from 0 to 1, with the message "'B' must be a positive integer". `B >= 1` takes the old code, so its values and random stream are unchanged. 2 x 2 tables ignore the simulation (as R) and are not checked, as before.
- Why: B < 0 is already an error (R: "negative length vectors are not allowed"); only the boundary moves from between -1 and 0 to between 0 and 1. The exception D16 (two-sample wilcox with every value tied, p = 1) is a statistic computed from the data; B = 0 computes nothing.

## Reproduction (main `dd1a023`, R 4.5.2)

| Call | R | rStats.js before |
|---|---|---|
| `fisherTest([[2,1,1],[1,2,1]], {simulatePValue: true, B: 0})` | p = 1, "… (based on 0 replicates)" | the same |
| the same with `B: -1` | error "negative length vectors are not allowed" | RangeError "'B' must be a non-negative integer" |

The issue says R errors for B = 0; it does not (R 4.5.2 returns p = 1).

## Fix

- `src/htest/fisherTest.ts`: `B >= 1` in the check; message "'B' must be a positive integer".
- `test/fisher.test.ts`: the fixture case of `fisherTestSim.json` with B = 0 (3 x 2 table, seed 9) is a substitute with the error. `test/issue278.test.ts`: the message.
- `oracle/fishersim.R`: the comment "(allowed)" on that case is corrected (the fixture is not regenerated; R's value is unchanged).
- `docs/differences-from-r.md`, `docs/ja/`: "`B: 0` gives p = 1" is replaced by the rule and R's behaviour.

## Tests

- `test/issue488.test.ts`: B = 0 and B = -1 are errors; B = 1 gives R's p = 1 and the next uniform (0x1.254d093ap-1); a 2 x 2 table with B = 0 still gives the exact p-value. With `src/` stashed, the error test fails.
- `test/fisher.test.ts`, `issue278.test.ts`, `errors.test.ts`, `review58.test.ts` pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- `chisqTest` has the same check (issue #489, the next commit).

## close comment

Fixed in <commit of #488, see git log --grep='#488'>. R 4.5.2 does not error for `fisher.test(..., simulate.p.value = TRUE, B = 0)`: it returns p = (1 + 0) / (0 + 1) = 1 from no simulated table. As a p-value computed from nothing, rStats.js now rejects it: `B` must be a positive integer ("'B' must be a positive integer"). B >= 1 gives the same values and random stream as before, and 2 x 2 tables still ignore the simulation. The difference from R is recorded in docs/differences-from-r.md. A test was added: test/issue488.test.ts. (Not pushed yet.)
