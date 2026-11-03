# Issue #338 log: plaplace with q and the location mu the same infinity

GitHub Issue #338. Session 12, group B (user decision).

## Plan

- User decision (2026-11-03): q = mu = ±Inf gives NaN in plaplace (lower, upper, log) and dlaplace(±Inf, mu = ±Inf) gives NaN (option A of the prep notes).
- Intent: `plaplace1` and `dlaplace1` returned the limit for an infinite mu without looking at q. Where q is the same infinity, q - mu is Inf - Inf: letting q go first gives 1, letting mu go first gives 0, so there is no limit. NaN is the answer that says so; it is also extraDistr's value and the value of rStats.js's (and R's) pnorm, plogis, pcauchy and dnorm.
- The issue asked for the endpoints F(-Inf) = 0, F(Inf) = 1 regardless of mu. Those hold for a finite mu only; with mu = ±Inf they are one of the two path limits, so they were not taken.
- Resolves the session-5 note (round 24, HANDOFF "recorded only": `plaplace(Inf, mu = Inf)` is 0, not in line with the normal distribution's NaN).

## Check (main `af41041`, R 4.5.2, extraDistr)

| call | before | after | extraDistr |
|---|---|---|---|
| `plaplace(-Inf, mu = -Inf)` lower / upper / log lower / log upper | 1 / 0 / 0 / -Inf | NaN | NaN |
| `plaplace(Inf, mu = Inf)` lower / upper / log lower / log upper | 0 / 1 / -Inf / 0 | NaN | NaN |
| `dlaplace(Inf, mu = Inf)`, `dlaplace(-Inf, mu = -Inf)` (also log) | 0 (-Inf) | NaN | NaN |
| `plaplace(Inf, mu = -Inf)`, `plaplace(-Inf, mu = Inf)`, `plaplace(0, mu = ±Inf)` | 1, 0, 0 / 1 | unchanged | the same |
| `dlaplace(-Inf, mu = Inf)` | 0 | unchanged | 0 |

## Fix

- `src/distributions/laplace.ts`: in the infinite-mu branch of `plaplace1` and `dlaplace1`, NaN when q (x) equals mu. Finite mu is untouched (the same bits).

## Tests

- `test/issue338.test.ts`: the eight plaplace calls and two dlaplace calls give NaN; opposite infinities and finite q keep their values. With `src/` stashed, the first test fails.
- `test/extradist.test.ts`: the "infinite parameter" exclusion no longer applies to dlaplace and plaplace. The 6 fixture cases with q = mu = Inf (4 plaplace, 2 dlaplace) now match extraDistr; with `src/` stashed the two suites fail. qlaplace keeps the exclusion (its infinite-mu quantiles are the limit, where extraDistr differs).
- docs: the paragraph on distributions outside base R said an infinite location is taken as the limit; it now notes the NaN for the same infinity (en and ja). The values agree with extraDistr, so no table entry.

## Out of scope

- None.

## close comment

Fixed in <commit of #338, see git log --grep='#338'>: with q and mu the same infinity (`plaplace(Inf, mu = Inf)`, `plaplace(-Inf, mu = -Inf)`), q - mu is Inf - Inf and the limit depends on the path (q first gives 1, mu first gives 0), so the endpoints F(-Inf) = 0 and F(Inf) = 1, which hold for finite mu, do not decide it. These calls (lower, upper and log) now return NaN, as do `dlaplace(Inf, mu = Inf)` and `dlaplace(-Inf, mu = -Inf)`. This matches extraDistr in R 4.5.2 and pnorm, plogis and pcauchy with an infinite mean. Opposite infinities (`plaplace(Inf, mu = -Inf)` = 1) and finite q with infinite mu keep the limits, and finite mu is unchanged.

Test: test/issue338.test.ts. (Not pushed yet.)
