# Issue #454 log: modelMatrix's contrasts and inherited properties

GitHub Issue #454. Session 13, group A1 (inherited properties, as #39).

## Plan

- Intent: the design matrix read the contrast of a factor as `options.contrasts?.[name]`, so with `contrasts: {}` a factor named `toString` or `constructor` took the inherited function as its contrast ("unknown contrast 'function toString() …'").
- Method: read the contrast only when it is an own property (`Object.hasOwn`), as `perColumn` of pivotWider since #39 and the levels of #452.

## Check (main `20f525e`, R 4.5.2)

| call (`{ toString: ["a","b","a"], constructor: ["x","y","y"] }`) | before | after | R (`model.matrix`) |
|---|---|---|---|
| `modelMatrix("~ toString + constructor", d, { contrasts: {} })` | "unknown contrast 'function toString() …'" | `(Intercept)`, `toStringb`, `constructory`; rows (1,0,0), (1,1,1), (1,0,1) | the same (default contrasts) |
| `modelMatrix("~ toString", d, { contrasts: { toString: "contr.sum" } })` | `toString1` = (1, −1, 1) | the same | the same |

R's `contrasts.arg = list()` is the error "'contrasts.arg' must be named"; that is R's check of an unnamed list and has no counterpart in an empty JS object, so `{}` means no contrast given.

## Fix

- `src/models/modelMatrix.ts`, `design` (`partsOf`): the contrast from own properties only.

## Tests

- `test/issue454.test.ts`: the matrix above with `contrasts: {}`, and an own contrast used as before. With `src/` stashed, the first fails.
- `test/modelMatrix.test.ts`, `test/lm.test.ts`, `test/anova.test.ts`, `test/issue452.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- `src/models/lmerHypotheses.ts` line 123 reads `options.contrasts?.[name]` in the same way (noted in the #452 log).

## close comment

Fixed in <commit of #454, see git log --grep='#454'>. modelMatrix now reads `contrasts` from own properties only (Object.hasOwn), as pivotWider since issue 39: with `contrasts: {}`, factors named toString or constructor get the default contr.treatment, and `modelMatrix("~ toString + constructor", …)` gives R's model.matrix (columns (Intercept), toStringb, constructory) instead of "unknown contrast 'function toString() …'". Given contrasts are used as before. A test has been added. (Not pushed yet.)
