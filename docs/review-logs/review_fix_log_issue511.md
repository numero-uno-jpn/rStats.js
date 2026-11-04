# Issue #511 log: qexp with rate = Infinity at the endpoints

GitHub Issue #511. Session 15. Classification C (not reproduced). No code change.

## Plan

- Intent: the issue says `qexp1` returns the boundary (`Infinity`) from `quantileBoundaries` before dividing by the rate, so `qexp(1, { rate: Infinity })` would be `Infinity` where R gives NaN (0 * Inf).
- Method: run the calls on main and in R 4.5.2. If they agree, add a test that pins the current values and close as not planned.

## Check (main `32b0bc1`)

| call | rStats.js | R 4.5.2 |
|---|---|---|
| `qexp(1, { rate: Inf })` | NaN | NaN (warning) |
| `qexp(0, { rate: Inf, lowerTail: false })` | NaN | NaN |
| `qexp(0, { rate: Inf, logP: true })` | NaN | NaN |
| `qexp(-Inf, { rate: Inf, lowerTail: false, logP: true })` | NaN | NaN |
| `qexp(0, { rate: Inf })`, `qexp(0.5, { rate: Inf })` | 0 | 0 |

## Cause

The issue misreads the early return: `if (Number.isNaN(b) || b === 0) return b!;` returns only NaN and 0. For the infinite endpoint b is Infinity, which falls through to `-lu / rate` = Inf / Inf = NaN, the same as R's `-scale * R_DT_Clog(p)` with scale 0. The file header's claim (rate = 0, Inf as R) holds. This also agrees with EXP-INF-RATE-01 (review round 25: the zero scale as R).

## Tests

- `test/issue511.test.ts`: the four endpoint calls are NaN, p = 0 and 0.5 give 0 (R's values). Passes on main (nothing to stash).

## close comment

Not planned: this does not reproduce. On the current main, `qexp(1, { rate: Infinity })`, `qexp(0, { rate: Infinity, lowerTail: false })` and both log-scale endpoints are all NaN, the same as R 4.5.2 (NaN with a warning). The early return in `qexp1` (`if (Number.isNaN(b) || b === 0) return b!`) passes only NaN and 0; the infinite boundary falls through to `-lu / rate` = Inf / Inf = NaN. A test pinning these values was added (`test/issue511.test.ts`, <commit of #511, see git log --grep='#511'>). (Not pushed yet.)
