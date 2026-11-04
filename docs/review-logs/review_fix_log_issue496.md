# Issue #496 log: dwilcox's one-entry endpoint table takes m passes

GitHub Issue #496. Session 14, judging of the issues classified C. Verdict: not planned (the work is within the limit of session 14 and the value is correct). No code changed.

## Plan

- Intent: time the issue's call on the current main and compare its value with R 4.5.2 and Rmpfr.
- Why: classified C (`buildTable` limits the work, the table length times the m passes, to 2^29 (`313a73e`); 9e7 passes are inside it, and the issue itself does not claim a wrong value).

## Check (main `10323ab`, R 4.5.2)

- `dwilcox(0, 9e7, 9e7)`: 0 in about 1.9 s (table built once and cached); `{log: true}` −124766482.7707651. R: `-lchoose(1.8e8, 9e7)` = −0x1.dbf244b154371p+26 (−124766482.770765081), Rmpfr −124766482.77076509723; its exp underflows to 0. Correct.
- `dwilcox(8.1e15, 9e7, 9e7)` (the upper endpoint): 0, at once (the same cached table). `dwilcox(0, 1, 9e7)`: 1.1111110987654323e-8, at once.
- Bound of the work: `m * (J + 1) <= 2^29` holds with J = 0 for any m below 2^29, and `wilcoxParams` requires m·n < 2^53, so a one-entry table takes at most about m = n = 9.5e7 passes, about 2 s. This is within K4 (10 s). m·n >= 2^53 is NaN (K7).

## Fix

- None. A direct formula for the endpoint (`-lchoose(m + n, m)`) would only be a speed-up.

## Tests

- `test/issue496.test.ts`: `dwilcox(0, 9e7, 9e7)` is 0, its log −lchoose(1.8e8, 9e7) to 6 decimals, and the upper endpoint 0 (about 2 s).

## Out of scope

- None.

## close comment

Not planned: the endpoint table of dwilcox(0, 9e7, 9e7) takes 9e7 passes, but this is within the work limit of the table construction (table length times passes at most 2^29, added in session 14), and since m·n must stay below 2^53 a one-entry table never takes more than about 9.5e7 passes, about 2 s on the development machine. The value is correct: 0, and with log = TRUE −124766482.7707651, which is −lchoose(1.8e8, 9e7) in R 4.5.2 and Rmpfr. Added test/issue496.test.ts. (Not pushed yet.)
