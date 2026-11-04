# Revision of issue 10: lmerTest's Satterthwaite scaling kept (an exception to K3)

## Plan
- Intent: record that the issue 10 fix changes the rounding for ordinary data, against criterion K3 (a fallback path
  only where the original result breaks), and why it stays.
- Decision: D12 (session 14, user decision of 2026-11-04, `prep/misc.md` question 3, recommended option: add to the
  list of exceptions; no code change).

## Original decision
- Issue 10 (2026-11-01, fc39dc5): `satterthwaiteAt` always works on D H D, D the powers of 2 of the theta columns
  (issue 11's exponents) and one near sigma-hat, so the df do not depend on the units. Owner's decision at the time:
  fix issues 9 to 11 in turn. The log noted that with sigma-hat outside [0.71, 1.41) D is not the identity and the
  rounding of the eigendecomposition changes for ordinary data too.

## Gap with the current criteria
- K3: the scaling is applied to every fit, not only where the scale is far out, so ordinary data take a different
  rounding than before.

## Decision (2026-11-04)
- Kept as an exception to K3 (with triang, stdres and contr.poly, issues 243, 382 and 351). The preparation tried the
  K3 form (scale only where the exponents exceed 20 in absolute value) on a copy of src against all fixtures: of 41
  lmerTest cases, 27 Satterthwaite df changed, by at most 3e-14 relative, three or more orders of magnitude (mostly
  eight) below the difference from lmerTest (2e-11 to 2.4e-1, lmerTest's numerical derivatives). Neither form gives
  lmerTest's bits, so going back would only restore the old rounding, with no gain in accuracy.

## Changes
- None in src, tests or docs. R fixtures affected: 0.

## Out of scope (recorded)
- None.
