# Issue #262 log: tabulate with an inferred nbins of 2^31 (already fixed by #225)

GitHub Issue #262. Session 11, group A1 (input checks). No code change.

## Verdict

Not reproducible on the current main: fixed by #225 (commit `02721ef`, "tabulate: bins as R's as.integer").

The issue was written against an older `tabulate`, where `tabulate([2 ** 31])` set the default `nbins` to 2147483648 and asked for an array of that length (the guard `nbins >= 2^31` applied to an explicit `nbins` only). Since #225, the bins are converted as R's `as.integer`: a value outside [-2147483647, 2147483647] is NaN, so it is not counted and does not set the default `nbins`. The inferred `nbins` is therefore at most 2147483647 < 2^31, the same bound as the explicit `nbins`.

## Check (main `72cbc5c`; R 4.5.2)

| call | R 4.5.2 (with the warning "NAs introduced by coercion to integer range") | rStats.js now |
|---|---|---|
| `tabulate(2^31)` | 0 | [0] |
| `tabulate(c(1, 2^31))` | 1 | [1] |
| `tabulate(c(2^31, 2))` | 0 1 | [0, 1] |

These calls do not allocate a large array (run with `npx tsx`). The cases beyond the integer range, including 3e9 that used to run out of memory, are tested in `test/issue225.test.ts`.

## Out of scope

- A bin of exactly 2147483647 (or an explicit `nbins` of 2147483647) still asks for an array of 2^31 − 1 counts, as R does (R allocates an integer vector of that length, 8 GB). It is a valid request with the same bound as R, not the guard the issue describes, and was not run.

## close comment

Thanks. This was fixed by <commit of #225, see git log --grep='#225'> (#225): `tabulate` now converts the bins as R's `as.integer`, so a value beyond the integer range, such as the issue's 2^31, is not counted and does not set the default `nbins`. `tabulate([2 ** 31])` is now `[0]` without a large allocation, as R 4.5.2's `tabulate(2^31)` (which also warns "NAs introduced by coercion to integer range"). The inferred `nbins` is at most 2147483647, the same bound as an explicit `nbins`. No further change. (Not pushed yet.)
