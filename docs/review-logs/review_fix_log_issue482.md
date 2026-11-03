# Issue #482 log: poissonTest rate-ratio interval with T2 / T1 overflowing

GitHub Issue #482. Session 13, group A1.

## Plan

- Intent: the two-sample interval maps a binomial limit p to (p / (1 - p)) (T2 / T1). With a count of about MAX_VALUE the limits are subnormal and T2 / T1 can overflow while the product is finite; the product was then Infinity.
- Method: only where T2 / T1 is not finite (and the odds are finite), the product from the mantissas of the odds, T1 and T2 with the powers of 2 applied last (the frexp already used by `expectedCount1`). Elsewhere the same expression, so the same bits. p = 0 stays 0, and infinite odds (p = 1) stay Infinity.

## Reproduction (main `09e3ae0` (after #481), R 4.5.2, Rmpfr)

| call | R 4.5.2 | before | after |
|---|---|---|---|
| `poissonTest([1, MAX], { T: [1e-12, MAX] }).confInt` | [0, 5.571643e12] | [Inf, Inf] | [25317807984.289505, 5571643390938.897] |

The estimate is 1e12. The binomial limits are p = 28505317650971 2^-1074 and 6273112774818427 2^-1074 (rStats.js's `binomTest(1, MAX)`); Rmpfr's p / (1 - p) MAX / 1e-12 for them is 0x1.7943c5dc12874p+34 and 0x1.444ff4cef6b97p+42, the values returned (bit for bit). The exact lower end from the exact binomial limit is 2.53178079842899e10; the subnormal lower limit p carries only about 45 bits, so the lower end is about 1.5e-14 relative off. R's lower end is 0 because its `qbeta(0.025, 1, MAX)` is 0; R's upper end 0x1.444ff4cef6c13p+42 comes from its own qbeta. Recorded in docs.

## Cause

`src/htest/poissonTest.ts`: `toRatio = (p) => (p === 0 ? 0 : (p / (1 - p)) * (T2 / T1))`; T2 / T1 overflowed to Infinity before the subnormal odds could bring the product back.

## Fix

- `src/htest/poissonTest.ts` `toRatio`: the fallback above.
- docs (en, ja): a row after the expected-count row of #223 / #481.

## Tests

- `test/issue482.test.ts`: the issue's call (both limits bit for bit against Rmpfr); the limit 0, Infinity for "greater" and for x2 = 0, and an ordinary call unchanged. With `src/` stashed the first test fails.
- poissonTest tests (`htest-basic` with the fixtures, `issue223`, `issue323`, `issue325`, `issue481`, `review48`, `review57`) and `npx tsc --noEmit -p .`: pass, no errors.

## Out of scope (recorded)

- The mirror case, T2 / T1 subnormal (T1 near MAX_VALUE, T2 tiny) with large odds (p near 1): the product keeps the subnormal ratio's lost bits although the result can be normal. Not reported; not changed.

## close comment

Fixed in <commit of #482, see git log --grep='#482'>: where T2 / T1 overflows, the interval's (p / (1 - p)) (T2 / T1) is computed from the mantissas of the odds, T1 and T2 with the powers of 2 applied last, so `poissonTest([1, Number.MAX_VALUE], { T: [1e-12, Number.MAX_VALUE] }).confInt` is [2.5317807984e10, 5.5716433909e12] around the estimate 1e12 (was [Inf, Inf]). R 4.5.2 gives [0, 5.571643e12] (its qbeta(0.025, 1, MAX) is 0); recorded in docs/differences-from-r.md. A limit of 0 stays 0, and other inputs are unchanged. Test: test/issue482.test.ts. (Not pushed yet.)
