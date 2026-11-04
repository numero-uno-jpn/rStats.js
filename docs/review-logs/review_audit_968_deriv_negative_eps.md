# Audit #968: Richardson derivatives with negative eps

- Repository: `numero-uno-jpn/rStats.js`
- Branch: `main`
- Repository HEAD before this audit's documentation commit: `86bcea46d1c5923071fac9eae7a7f5f2f6d8ef07`
- Source: `src/numerics/deriv.ts`
- Source blob SHA: `df9a324746a0f194c3fb60461b14535bf16b58b2`
- Result: deterministic input-validation inconsistency; GitHub Issue [#499](https://github.com/numero-uno-jpn/rStats.js/issues/499)

## Reproduction

```ts
grad((x) => x[0]! * x[0]!, [0], { eps: -1e-4 });
// throws: the step for x[0] is -0.0001: not a positive finite number
```

Equivalent failures occur in `jacobian()` and `hessian()` with the same near-zero coordinate and `eps`.

## Cause and expected behavior

`checkEps()` accepts negative finite nonzero values. The step-builder comment also
states that negative steps are taken in the opposite direction, as in numDeriv.
But `steps()` later requires `h > 0`, rejecting the negative initial step.

Central differences remain valid for a negative step: both the numerator and
denominator reverse sign. The Hessian formulas use squared steps / paired step
products and are also valid with a negative step.

Expected for `x = [0]`, `eps = -1e-4`:
- `grad(x => x[0] ** 2, x)` → `[0]`
- `jacobian(x => [x[0] ** 2], x)` → `[[0]]`
- `hessian(x => x[0] ** 2, x)` → `[[2]]`

## Duplicate check

Searched existing issues for negative `eps` and Richardson derivative handling.
No matching negative-step issue was found. Existing derivative issues concern
`zeroTol: 0` and overflowing positive steps, which have distinct conditions.

## Verification scope

- Read the complete `src/numerics/deriv.ts` and `test/numerics.test.ts`.
- Read `oracle/numerics.R` and confirmed the project uses numDeriv as the
  derivative reference, but the fixture does not currently exercise negative
  `eps`.
- Source-level control-flow and finite-difference arithmetic verified.
- Runtime, Vitest and R/numDeriv execution were not performed.
- No source code changed.
