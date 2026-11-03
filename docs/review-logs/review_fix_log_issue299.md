# Issue #299 log: aov with Error() and an infinite response

GitHub Issue #299. Session 12, group 7 (non-finite model inputs).

## Plan

- Intent: the multistratum path (`aovStrataFit`) sent the response straight to the scaling and the double-double projection. The model frame drops NaN but keeps Infinity, so an infinite response gave strata tables of NaN instead of an error.
- Method: check the response for finite values right after the design, with the message of R and of the fit without Error() ("NA/NaN/Inf in 'y'").
- Why: R stops here (`aov(y ~ A + Error(id))` with an Inf: "NA/NaN/Inf in 'y'"), so this matches R; finite responses do not reach the new check's throw (the same bits).

## Check (main `8a7eeba`)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `aov("y ~ A + Error(id)", ...)`, y = 1..8 with an Infinity in row 7 (the issue's data) | "NA/NaN/Inf in 'y'" | stratum id: Sum Sq NaN; Within: NaN | "NA/NaN/Inf in 'y'" |
| `aov("y ~ A", ...)` (no Error()) | the same | "NA/NaN/Inf in 'y'" | unchanged |

## Fix

- `src/models/aovStrata.ts`, `aovStrataFit`: the finite check of the response.

## Tests

- `test/issue299.test.ts`: Infinity and -Infinity throw; a finite response still fits. With `src/` stashed, the first test fails.
- `test/aovStrata.test.ts`, `test/aovEz.test.ts`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- A non-finite treatment covariate in the same path is not checked either: `aov("z ~ x + Error(id)", ...)` with x = (1, ..., 7, Infinity) returns tables (stratum id Sum Sq 40, F and p NaN, Within with NaN), where R stops ("NA/NaN/Inf in 'y'", from its projection of the columns). An infinite column inside Error() already throws ("the matrix contains NaN or infinite values"; R "NA/NaN/Inf in 'x'"). Left as a note (not part of this issue).

## close comment

Fixed in <commit of #299, see git log --grep='#299'>: `aov` with an `Error()` term now throws "NA/NaN/Inf in 'y'" for a non-finite response, as R and the fit without `Error()` do. The issue's call (`aov("y ~ A + Error(id)", ...)` with an Infinity in y) returned strata tables with NaN sums of squares. Finite responses are unchanged.

Test: test/issue299.test.ts. (Not pushed yet.)
