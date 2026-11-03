# Issue #280 log: jonckheereTest loses small upper-tail p-values

GitHub Issue #280. Session 12, group B (user decision 5).

## Plan

- Intent: in the normal approximation of `jonckheereTest`, `upper = 1 - pnorm(z)` is 0 beyond z ~ 8.3, so the increasing and two-sided p-values were 0 for strongly ordered data.
- User decision (2026-11-03): only where 1 - pnorm(z) is below 1e-8, take the upper tail as `pnorm(z, { lowerTail: false })`; elsewhere keep the packages' expression (the same bits). The threshold is the one of sessions 57-58 (alpha / 2 < 1e-8 for extreme confidence levels).
- Why not always the direct tail: 1 - pnorm differs from it in the last bits for most z > 0 (4 fixtures would change by 1.5e-13 relative), while its relative error is at most 5.4e-9 where the tail is at least 1e-8.

## Reproduction (main `057891a`, R 4.5.2)

| call | before | clinfun / DescTools | Rmpfr (z exact) | after |
|---|---|---|---|---|
| 1:101, groups 34/34/33, increasing | 0 (two-sided 0) | 0, 0 | 1.4902389037944002e-26 | 1.4902389037943768e-26 (1.6e-14 relative, the rounding of z) |
| 1:102, groups 51/51, increasing | 0 | 0, 0 | 1.6038302269514695e-18 | 1.6038302269514655e-18 (2.5e-15) |

Decreasing stays 1. The two-sided values (both variants) use the same upper tail and are twice these.

## Fix

- `src/htest/trendTests.ts`, the normal branch of `jonckheereTest`: if `1 - lower < 1e-8`, `upper = pnorm(z, { lowerTail: false })`.
- docs (en, ja): the packages give 0 there.

## Tests

- `test/issue280.test.ts`: the two calls against Rmpfr (relative 1e-13), both variants, two-sided and decreasing. With `src/` stashed, both tests fail.
- `test/moreTests.test.ts` (the 16 R fixtures of jonckheere), `review59`, `issue142`, `issue321`, `issue322`: pass (fixture bits unchanged).

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #280, see git log --grep='#280'>: in the normal approximation of `jonckheereTest`, where 1 - pnorm(z) is below 1e-8 the upper tail is now taken directly as `pnorm(z, { lowerTail: false })`. 1:101 in ordered groups of 34, 34, 33 had an increasing p-value of 0 (clinfun and DescTools also give 0); it is now 1.4902389037943768e-26 (Rmpfr 1.4902389037944002e-26, the difference is the rounding of z), and the two-sided value twice that. Above 1e-8 the value is the packages' 1 - pnorm(z), with the same bits as before (the R fixtures are unchanged). Recorded in docs/differences-from-r.md.

Test: test/issue280.test.ts. (Not pushed yet.)
