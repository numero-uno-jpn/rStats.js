# Revision of issue 11: lmer's scaled theta optimisation kept (an exception to K3)

## Plan
- Intent: record that the issue 11 fix changes the optimisation path for ordinary data, against criterion K3 (a
  fallback path only where the original result breaks), and why it stays.
- Decision: D12 (session 14, user decision of 2026-11-04, `prep/misc.md` question 3, recommended option: add to the
  list of exceptions; no code change).

## Original decision
- Issue 11 (2026-11-01, 2151595): theta is always optimised in coordinates where each column of Z is divided by the
  power of 2 of its largest absolute value, so random slopes converge at any units of x. Owner's decision at the time:
  fix issues 9 to 11 in turn. The log noted that every fit with a non-zero exponent (largest absolute value outside
  [1, 2), ordinary units included) takes a different optimisation path.

## Gap with the current criteria
- K3: the scaling is applied to every fit, not only where the scale is far out, so ordinary data take a different
  path than before.

## Decision (2026-11-04)
- Kept as an exception to K3 (with triang, stdres and contr.poly, issues 243, 382 and 351). The preparation tried the
  K3 form (scale only where the exponents exceed 20 in absolute value) on a copy of src against all fixtures: of 37
  lmer cases, theta changed in 12; the errors against the exact minimum (128-bit references) were 1e-16 to 3e-14 in
  both forms, closer in main for 7, in the K3 form for 4, equal for 1; fixef differed by about 1e-16. Neither form
  gives lme4's bits, so going back would only restore the old path, with no gain in accuracy.

## Changes
- None in src, tests or docs. R fixtures affected: 0.

## Out of scope (recorded)
- None.
