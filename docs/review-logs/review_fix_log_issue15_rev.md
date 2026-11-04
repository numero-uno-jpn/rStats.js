# Revision of issue 15: optim's CG with Nash's parabola kept (an exception to K3)

## Plan
- Intent: record that the issue 15 fix changes CG's values for every input, against criterion K3 (ordinary-range
  bits unchanged), and why it stays.
- Decision: D12 (session 14, user decision of 2026-11-04, `prep/misc.md` question 3, recommended option: add to the
  list of exceptions; no code change).

## Original decision
- Issue 15 (2026-11-01, 8331905): cgmin overwrote the start's value with the accepted one before fitting the
  parabola, so its trial point was always the midpoint of the accepted step (R does the same). The value at the start
  of the line search is now kept, and the trial point is the parabola's minimum, as Nash intended. Owner's decision at
  the time: fix it, knowing that the path departs from R.

## Gap with the current criteria
- K3: R's error is on every CG path, so every CG value and evaluation count differs from R, not only a broken range
  (quadratic of 3 variables: R 46 evaluations, value 5.6e-14; now 8, 1.8e-25).

## Decision (2026-11-04)
- Kept as an exception to K3 (with triang, stdres and contr.poly, issues 243, 382 and 351). R's bits could only be
  had by reproducing R's error; the fix is already in the docs ("where R is inaccurate": optim CG).

## Changes
- None in src, tests or docs. R fixtures affected: 0 (the CG fixture cases have been compared by convergence and
  value, not bits, since issue 15).

## Out of scope (recorded)
- None.
