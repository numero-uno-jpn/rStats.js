# Issue #452 log: the model frame's levels and inherited properties

GitHub Issue #452. Session 13, group A1 (inherited properties, as #39).

## Plan

- Intent: `modelFrame` read the given levels of a column as `options.levels?.[v]`, so with `levels: {}` a column named `toString`, `constructor` or `valueOf` took the inherited function as its levels: no level, every row missing.
- Method: read the levels only when they are an own property (`Object.hasOwn`), as `perColumn` of pivotWider since #39.

## Check (main `b2f7b7a`, R 4.5.2)

modelFrame is not public; checked through `modelMatrix` (and `lm`) with `levels: {}`.

| call | before | after | R |
|---|---|---|---|
| `modelMatrix("~ toString + constructor", { toString: ["b","a","b"], constructor: ["x","y","y"] }, { levels: {} })` | "contrasts can be applied only to factors with 2 or more levels" | columns `(Intercept)`, `toStringb`, `constructory`, rows (1,1,0), (1,0,1), (1,1,1) | the same (`model.matrix`) |
| `lm("y ~ toString", { …, y: [1,2,4] }, { levels: {} })` | the same error | coefficients (2, 0.5) | (2, 0.5) |
| `modelFrame(JSON.parse('{"__proto__":["b","a"]}'), ["__proto__"], { levels: {} })` | Object.prototype as levels | rows [0, 1], levels ["a","b"], codes [1, 0] | (not a name in a formula) |

## Fix

- `src/models/modelFrame.ts`, `modelFrame`: the given levels from own properties only.

## Tests

- `test/issue452.test.ts`: the model matrix above, the `__proto__` frame, and own levels used as before. With `src/` stashed, the first fails.
- `test/modelMatrix.test.ts`, `test/lm.test.ts`, `test/anova.test.ts` and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- `src/models/lmerHypotheses.ts` line 123 reads `options.contrasts?.[name]` in the same way (a factor named `toString` with `contrasts: {}` would take the inherited function as its contrast). Not part of this issue; #454 covers modelMatrix only.

## close comment

Fixed in <commit of #452, see git log --grep='#452'>. The model frame now reads `levels` from own properties only (Object.hasOwn), as pivotWider since issue 39: with `levels: {}`, a column named toString or constructor gets the levels of its values, so `modelMatrix("~ toString + constructor", …, { levels: {} })` gives R's model.matrix (columns (Intercept), toStringb, constructory) instead of the "2 or more levels" error, and `lm` gives R's coefficients. Given levels are used as before. A test has been added. (Not pushed yet.)
