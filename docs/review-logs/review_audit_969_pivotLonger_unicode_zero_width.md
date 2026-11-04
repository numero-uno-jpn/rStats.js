# Audit #969: pivotLonger zero-width separators and astral Unicode

- Repository: `numero-uno-jpn/rStats.js`
- Branch: `main`
- Repository HEAD before this audit's documentation commits: `c82481b17ee7095af372d00dca3fb766e748bf6e`
- Source: `src/descriptive/pivot.ts`
- Source blob SHA: `350ef5eef8e463ef35deba603d19cf89ed511cb1`
- Test reviewed: `test/pivot.test.ts` (blob `00295573929e0cff248b1e9d389a16a53cfb3681`)
- Result: Unicode edge-case defect; GitHub Issue [#500](https://github.com/numero-uno-jpn/rStats.js/issues/500)

## Reproduction

```ts
pivotLonger(
  { "A😀B": [1] },
  {
    cols: ["A😀B"],
    namesTo: ["p1", "p2", "p3", "p4", "p5"],
    namesSep: "(?=.)",
  },
);
```

## Cause

`separated()` uses `new RegExp(sep, "g")`. For a zero-width match it advances with `start = m.index + 1`, and it extracts pieces with `String.prototype.slice()`. Both indices are UTF-16 code-unit offsets. Without the `u` flag, `(?=.)` can match between the high and low surrogate of `😀`; the algorithm consequently splits one Unicode character into two pieces and shifts subsequent name parts. The corresponding R/PCRE character-based operation should preserve the emoji as one character.

For the example, the JavaScript path can produce the parts `""`, `"A"`, high-surrogate, low-surrogate, `"B"`; the five `namesTo` slots receive the first five parts. The character-based result should be `""`, `"A"`, `"😀"`, `"B"`, and a missing fifth part.

## Duplicate check

Searched for Unicode/emoji/surrogate handling in `pivotLonger` and zero-width `namesSep`. Closed Issue #441 concerns zero-width separators being skipped entirely; this finding concerns incorrect advancement within a surrogate pair after zero-width matches and is distinct.

## Verification scope

- Read `src/descriptive/pivot.ts` and `test/pivot.test.ts`.
- Confirmed the UTF-16 code-unit advancement and slicing from source.
- Source-level analysis only; no Vitest or R/tidyr runtime execution was performed.
- No source code changed.
