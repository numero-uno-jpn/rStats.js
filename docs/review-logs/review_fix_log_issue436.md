# Issue #436 log: pivotLonger's namesTransform and inherited properties

GitHub Issue #436. Session 13, group A1 (inherited properties, as #39).

## Plan

- Intent: `pivotLonger` read the transform of a `namesTo` column as `options.namesTransform?.[to]`, so a column named `valueOf`, `toString` or `constructor` took the method inherited from Object.prototype as its transform.
- Method: read the transform only when it is an own property (`Object.hasOwn`), as `perColumn` of pivotWider does since #39.

## Check (main `f1cf502`, R 4.5.2, tidyr 1.3.2)

| call (`{ id: [1], score: [2] }`, `cols: ["score"]`, `namesTransform: {}`) | before | after | tidyr (`names_transform = list()`) |
|---|---|---|---|
| `namesTo: "valueOf"` | TypeError | `valueOf: ["score"]` | `score` |
| `namesTo: "toString"` | `["[object Undefined]"]` | `["score"]` | `score` |
| `namesTo: "constructor"`, `namesTransform: { constructor: toUpperCase }` | `["SCORE"]` | `["SCORE"]` | `SCORE` |

## Fix

- `src/descriptive/pivot.ts`, `pivotLonger`: the transform from own properties only; the option's doc comment says so.

## Tests

- `test/issue436.test.ts`: the three inherited names with `namesTransform: {}`, and an own transform for `constructor`. With `src/` stashed, the first fails.
- `test/pivot.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope

- None.

## close comment

Fixed in <commit of #436, see git log --grep='#436'>. pivotLonger now reads namesTransform from own properties only (Object.hasOwn), as pivotWider's per-column options since issue 39: with `namesTransform: {}`, `namesTo: "valueOf"` gives `["score"]` instead of a TypeError, and `"toString"` gives `["score"]` instead of "[object Undefined]", as tidyr 1.3.2 with `names_transform = list()`. Own transforms are used as before. A test has been added. (Not pushed yet.)
