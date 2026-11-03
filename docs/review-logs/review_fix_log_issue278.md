# Issue #278 log: fisherTest's simulation with a fractional B

GitHub Issue #278. Session 12.

## Plan

- Intent: `fisherTest(simulatePValue: true)` accepted a fractional `B`, simulated trunc(B) tables, divided by trunc(B) + 1 and reported "based on B replicates". `chisqTest` rejects a fractional `B` since review 58 (policy "Input that has no meaning is an error").
- Method: the same check and message as `chisqTest`'s `replicates()`: "'B' must be a non-negative integer". Integer `B` takes the old code (the same bits and random stream). R accepts B = 2.5, so `fisherTest` is added to the docs list next to `chisqTest`. The old table row "fractional `B` ... divides by the number simulated plus 1" described the behaviour before review 58 and is removed (both functions now reject it).

## Check (main `e713654`, R 4.5.2)

`t = [[8, 2, 1], [1, 7, 3], [2, 1, 9]]`, `set.seed(1)`:

| B | R's `fisher.test` | before |
|---|---|---|
| 2.5 | p 0x1.2492492492492p-2 (2/7: 2 tables, divided by 3.5), "based on 2.5 replicates" | p 1/3 (divided by 3), "based on 2.5 replicates" |
| 2 | p 0x1.5555555555555p-2 (1/3) | 1/3 (unchanged) |

No fixture has a fractional `B`. The fixture with `B = NaN` (R: "negative length vectors are not allowed") expects an error and still passes.

## Fix

- `src/htest/fisherTest.ts`: the check of `B`.
- `docs/differences-from-r.md`, `docs/ja/`: the list entry; the stale table row removed.

## Tests

- `test/issue278.test.ts`: the error for 2.5 and NaN; B = 2 gives R's 1/3. With `src/` stashed, the error test fails.
- `test/fisher.test.ts` (with `fisherTestSim.json`), `test/errors.test.ts`, `test/issue232.test.ts`, `test/review58.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #278, see git log --grep='#278'>. `fisherTest(simulatePValue: true)` now throws "'B' must be a non-negative integer" for a fractional `B`, as `chisqTest` does. It simulated trunc(B) tables but reported B replicates (R's `fisher.test` also simulates trunc(B) and divides by B + 1). Integer `B` gives the same values and random stream as before; recorded in docs/differences-from-r.md. (Not pushed yet.)
