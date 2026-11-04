# Audit #983 — aovEz scales responses using subjects later excluded as incomplete

- Target: `src/models/aovEz.ts`
- Audit HEAD: `41138101928a6b68ec026fcb8c3906fdf8f6974e`
- Source blob SHA: `14f22254dde32c0295d86e4bb0cd4ec24e238d6f`
- Verdict: confirmed numerical defect by source/control-flow and IEEE-754 range analysis
- Issue: [#508](https://github.com/numero-uno-jpn/rStats.js/issues/508)

## Deterministic reproduction

```ts
const data = {
  id: [
    "s1", "s1", "s2", "s2", "s3", "s3",
    "incomplete", "incomplete",
  ],
  W: ["a", "b", "a", "b", "a", "b", "a", "b"],
  y: [1, 2, 2, 4, 3, 5, 1e308, null],
};

aovEz(data, { id: "id", dv: "y", within: "W" });
```

The three complete subjects have ordinary, non-constant responses. The final subject has an extreme finite response in cell `a` and a missing response in cell `b`, so step 6 excludes that subject.

## Source path and numerical consequence

1. The response values are converted to `dvUsed`; a missing response is represented as `NaN`.
2. Before subjects are identified as incomplete, the implementation calls `scaleToUnit([dvUsed])`.
3. `scaleToUnit` chooses its exponent from all finite values. The excluded subject's `1e308` therefore sets the scale exponent near 1023.
4. Only after aggregation does step 6 identify the incomplete subject and exclude it from `subjects`.
5. The complete subjects' values 1–5 have already been scaled to roughly 1e-308. The repeated-measures cross-products square values at that magnitude; these products underflow to zero in binary64, erasing the variation and error SSP matrix.

The correct invariant is that observations excluded from the analysis must not determine the scale of the retained observations. The result should agree with running the same analysis after removing the incomplete subject before calling `aovEz()`.

## Duplicate check

Searched existing issues for `aovEz` plus incomplete-subject, missing-response, and response-scaling terms. Existing #350 concerns zero-weight rows in sequential/car ANOVA and does not cover this `aovEz` complete-case subject-removal path. No duplicate for this exact cause was found.

## Verification status

- Read `src/models/aovEz.ts`, `test/aovEz.test.ts`, and `src/internal/summary.ts` (`scaleToUnit` / `unitExponent`).
- Deterministic input and binary64 magnitude analysis; no random values.
- Static analysis only: Vitest, Node runtime, and R were not executed.
- No source code changed.
