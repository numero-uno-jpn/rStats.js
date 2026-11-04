# Audit #995 — survdiff singular variance fallback

- Target: `src/models/survival.ts`, `src/models/tiedTimes.ts`
- HEAD: `53ee5d75c9ded25c1ab80dcd261470c84aacf290`
- Source blob: `547d09443843317a6d36c5771d507904969f50a5`, `5c5d3e66d870434c9a66952f521e66b5f131907c`
- Finding: possible divergence from oracle; Issue [#510](https://github.com/numero-uno-jpn/rStats.js/issues/510), awaiting R confirmation.

## Finding

`survdiff()` first calls `solve(Vr, u)`. On a singular matrix it catches the error and calls `pseudoQuadratic()`, which computes a generalized-inverse quadratic form and sets df to the numerical rank. The oracle explicitly describes a direct solve and says not to use a generalized inverse. Thus this fallback changes the documented behavior.

## Reproduction

```ts
const time = [1, 1];
const status = [1, 1];
const group = ["a", "b"];
survdiff(time, status, group);
```

Both subjects experience the event at the only time. Observed and expected counts are both [1, 1]. After dropping the first group, the variance submatrix is [[0]] and the contrast is [0]. The current fallback returns chisq=0, df=0, pvalue=NaN.

## Verification and limitations

The oracle `oracle/survival-behaviour.md` specifies direct solving of the reduced variance matrix. The existing R fixture test does not explicitly establish this all-fail singular case. The exact R behavior for this input remains unverified because R and Vitest were not run. The issue records this uncertainty rather than asserting a confirmed R output.

Also reviewed KM risk sets, tied events/censoring, Greenwood variance, log/plain/log-log intervals, median flat stretches, rho weights, and time merging. Static source inspection only; no code changes.
