# Audit #970: merge allY-only key type

- Repository: `numero-uno-jpn/rStats.js`
- Branch: `main`
- Audit HEAD: `35cfc32dab1fa9bf1e6ddc9e7b067c0eb26e83e4`
- Source: `src/descriptive/dataFrames.ts`
- Source blob SHA: `55fe65c67d8a8a71077af562a24ad7d41f2bc3d5`
- Tests reviewed: `test/dataFrames.test.ts` (blob `b90d2751b73caeb0dc933cbf645e2066d4227b43`)
- Behavioral specification: `oracle/dataframes-behaviour.md`
- Result: common-key-type defect; GitHub Issue [#501](https://github.com/numero-uno-jpn/rStats.js/issues/501)

## Reproduction

```ts
merge(
  { id: ["unmatched-x"] },
  { id: [1], value: ["from-y"] },
  { by: "id", allY: true },
);
```

The key values do not match, so the result consists only of the y-only row. In `merge()`, `yOnly` is true and `fromX` is false. The key column is gathered from `[cy]` only, then passed to `commonType()`. As the gathered values contain only the numeric y key, `commonType()` leaves the column numeric.

## Expected

`oracle/dataframes-behaviour.md`, merge step 1, specifies that the result key column for y-only rows uses the common type of x and y keys. If x's key is character and y's key is numeric, the common type is character (numeric values rendered as R `as.character`). Expected result key: `id: ["1"]`; current source path yields `id: [1]`.

## Duplicate check

Searched existing issues for `merge allY/all.y` and common key-type handling; no matching issue was returned.

## Verification scope

- Read `src/descriptive/dataFrames.ts`, `test/dataFrames.test.ts`, and `oracle/dataframes-behaviour.md`.
- Traced the `yOnly && !fromX` branch and `commonType()` directly from source.
- Existing fixture has no exact case for x character / y numeric with only y-side unmatched rows.
- Source-level analysis only; Vitest and R runtime comparison were not executed.
- No source code changed.
