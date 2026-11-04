# Audit #967: optimHess analytic-gradient scaling

- Repository: `numero-uno-jpn/rStats.js`
- Branch: `main`
- Repository HEAD at audit: `32299e93aeaae96131c8c4468931c08d9e84bfde`
- Source file: `src/optim/optim.ts`
- Source blob SHA: `7c20bfe97c0f0012d8da759fbbef2176bbb7b049`
- Public API: `optimHess()`
- Result: confirmed numerical-stability defect; GitHub Issue [#498](https://github.com/numero-uno-jpn/rStats.js/issues/498)

## Reproduction

```ts
optimHess(
  [0],
  (x) => 1e200 * x[0]!,
  () => [1e200],
  { parscale: 1e200, fnscale: 1e300 },
);
// source-derived result: [[NaN]]
// exact Hessian: [[0]]
```

The supplied gradient is constant. Its scaled value is mathematically
`(1e200 / 1e300) * 1e200 = 1e100`, but `Scaled.g()` currently evaluates
`(1e200 * 1e200) / 1e300`. The first multiplication overflows to Infinity.
The two finite-difference gradients therefore become Infinity, and their
subtraction produces NaN.

## Duplicate and contract checks

- Searched existing issues for `optimHess` and overflow; no matching issue was found.
- Searched `docs/review-logs/` for optim / L-BFGS-B / Hessian review logs; none were present.
- Read `oracle/optim-behaviour.md`: it defines the scaled gradient as
  `gr * parscale / fnscale` and the public `optimHess()` API.
- The finding is not a claim of an R compatibility difference. It is an
  avoidable binary64 overflow for finite positive scaling controls and a
  constant gradient whose Hessian is exactly zero.
- No package runtime, Vitest, or R execution was performed.
- No source code was changed.

## Likely fix impact

Use an overflow-safe product/quotient evaluation for analytic gradients, with
regression coverage for large finite `gr`, `parscale`, and `fnscale`.
