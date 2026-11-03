# Issue #296 log: aovEz with repeated factor names

GitHub Issue #296. Session 12.

## Plan

- Intent: `aovEz` did not check `between` and `within` for repeated names. `between: ["A", "A"]` was fitted as the one-factor model; `within: ["W", "W"]` failed with a wrong message.
- afex drops repeats silently, so an error differs from it; put to the user (prep: r_accepts.md).
- User decision (2026-11-03): a repeated name within `between` or within `within`, and a name in both, is an error. The difference from afex goes in the docs.

## Check (main `5d41a1a`, R 4.5.2 with afex; 6 subjects, A = a,a,b,b,c,c; within W = w1..w3, 18 rows)

| call | afex::aov_ez | before | after |
|---|---|---|---|
| between `["A", "A"]` | the one-factor table (A: F 16.00, p .025) | the same table | error "duplicated factor names in 'between': A" |
| within `["W", "W"]` | the one-factor table (W: F 7.71, GG) | error "Empty cells in within-subjects design (i.e., bad data structure)" | error "duplicated factor names in 'within': W" |
| between `["A"]`, within `["W", "W"]` | the two-factor table | the same wrong error | error "duplicated factor names in 'within': W" |
| between `["A"]`, within `["A"]` | error "No observations remain after removing missing values" | error "Rank deficient model matrix; ..." | error "factors in both 'between' and 'within': A" |

## Fix

- `src/models/aovEz.ts`: the two checks right after the between/within presence check. Calls with distinct names are unchanged (aovEz.json has no repeats).
- Docs (en, ja): a bullet after "aovEz and missing values".

## Tests

- `test/issue296.test.ts`: the four calls in the table and an unchanged one-factor fit (F 16). With `src/` stashed the two error blocks fail.
- `aovEz`, `issue295`, `review34`, `review42` tests pass.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #296, see git log --grep='#296'>. `aovEz` now rejects a factor name repeated in `between` or in `within` ("duplicated factor names in 'between': A") and a name given in both ("factors in both 'between' and 'within': A") before building the design. Before, `between: ["A", "A"]` was fitted as the one-factor model and a repeated within-subject name failed with a misleading "Empty cells" message. afex's `aov_ez` drops repeats silently; the difference is recorded in docs/differences-from-r.md. Calls with distinct names are unchanged. (Not pushed yet.)
