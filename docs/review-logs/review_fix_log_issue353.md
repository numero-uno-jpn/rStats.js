# Issue #353 log: aov with missing values in an Error() variable

GitHub Issue #353. Session 12, judging of the issues classified C. Verdict: not planned (not reproduced). No code changed.

## Plan

- Intent: run the issue's example on the current main through the public API and compare with the fit on the complete rows and with R 4.5.2.
- Why: classified C (not reproduced); the verdict needs the result checked.

## Check (main `7033ff3`, R 4.5.2)

- `aov("y ~ treatment + Error(subject)", ...)` with subject missing in rows 3 and 4: rows [0, 1, 4, 5]; aovSummary: Error: subject, treatment Df 1, SS 16; Error: Within, treatment Df 1, SS 0.5, F 1, p 0.5, Residuals Df 1, SS 0.5. The same table as the fit on the four complete rows.
- The treatment design is not built from the treatment formula alone: `termsOf` collects the variables of the whole right-hand side, Error() included (formula.ts, since 3004acf), so both designs drop the same rows.
- R: `summary(aov(...))` on the same data stops ("'qr' and 'y' must have the same number of rows"); on the four complete rows it gives the table above.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: not reproduced. The treatment design's model frame already includes the variables inside Error(), so rows with a missing subject are dropped from both designs: on the issue's data aov uses rows 0, 1, 4 and 5 and gives the same strata (subject: treatment SS 16; Within: treatment SS 0.5, F 1, p 0.5) as the fit on those four rows. R's aov stops on this input ("'qr' and 'y' must have the same number of rows"). (Not pushed yet.)
