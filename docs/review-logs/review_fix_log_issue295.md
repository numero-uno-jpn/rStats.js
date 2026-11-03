# Issue #295 log: aovEz with between factors named y and y_

GitHub Issue #295. Session 12.

## Plan

- Intent: without within factors, `aovEz` fits `lm` on one value per subject under an internal response name, "y", or "y_" when a between factor is named y. With factors y and y_, the response replaced the factor y_.
- Method: start from "y" and append "_" until the name is none of the between factors. Other names are unchanged, so every other model is the same fit.

## Check (main `869e1f2`, R 4.5.2, afex)

Data of the issue with score 1, 2, 3, 4, 5, 6, 7, 9 (the issue's 1..8 fits exactly, F is infinite).

| call | afex | before | after |
|---|---|---|---|
| `aovEz(d, { id, dv: "score", between: ["y", "y_"], es: ["ges"] })` | rows y, y_, y:y_; F 41.29, 11.57, 0.1429 | error "contrasts can be applied only to factors with 2 or more levels" | afex's table within 1e-12; the same table as with factors named A and B |

## Fix

- `src/models/aovEz.ts`, `betweenOnly`: the response name avoids every between factor.

## Tests

- `test/issue295.test.ts`: afex's values for y and y_, and the same tables as with other names for y, y_ and y__. Both fail with `src/` stashed (the error above).
- `test/aovEz.test.ts`: passes.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #295, see git log --grep='#295'>. Without within factors, `aovEz` now picks an internal response name that is none of the between factors (y, then y_, y__, ...). With factors `y` and `y_` it gave the error "contrasts can be applied only to factors with 2 or more levels"; it now gives afex's table. Other models are unchanged. (Not pushed yet.)
