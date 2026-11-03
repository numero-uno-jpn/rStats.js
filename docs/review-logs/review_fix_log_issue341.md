# Issue #341 log: varimax row norms for loadings near 1e308

GitHub Issue #341. Session 12, judging of the issues classified C. Verdict: not planned (internal helper; such loadings cannot reach it). No code changed.

## Plan

- Intent: check whether the reported input can reach varimax() through the public API.
- Why: classified C (varimax is not exported); the verdict needs the call paths confirmed.

## Check (main `7033ff3`)

- `varimax` is exported from src/descriptive/factanal.ts but not from src/index.ts or any entry in package.json's exports. Its callers are factanal (exported from the tests entry) and omega.
- factanal rotates the loadings of the scaled correlation matrix and omega those of a minres solution of a correlation matrix; both are bounded by 1 in absolute value, so rows of 1e308 cannot arise from the public API.

## Fix

- None.

## Tests

- None.

## Out of scope

- None.

## close comment

Not planned: varimax is an internal helper and is not part of the public API (it is not exported from the package's entry points). Its only callers, factanal and omega, rotate loadings of a correlation matrix, which are at most 1 in absolute value, so loadings near 1e308 cannot reach it. (Not pushed yet.)
