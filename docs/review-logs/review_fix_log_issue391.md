# Issue #391 log: Hommel p-value adjustment has unbounded quadratic work for accepted n

GitHub Issue #391. Session 12, group B4 (resource limits, part R4: O(n^2) work; with #307, #308, #316 and #321).

## Plan

- User decision (2026-11-03, item 1 and the prep's H1): the Hommel method accepts n <= 2^16 = 65536 (about 5 s); above it a RangeError.
- Intent: `hommel` pads the p-values to n with ones and runs sum_(m=2..n) m steps (O(n^2)); `pAdjust([0.01], { method: "hommel", n: 1e5 })` takes about 5e9 steps for one p-value.
- Choice: the check in `hommel` right after the integer check (the integer check keeps its message), before the padding array is built. The other methods are O(n) or O(lp log lp) and are not limited; empty or all-NaN `p` returns before `hommel` (#306).

## Check (main `4beada0`, R 4.5.2)

- The issue's n = 1e5: about 12 s by the prep's timings (excluded from the stash run; not run here). R's `p.adjust(0.01, "hommel", n = 1e5)` is also O(n^2) (not run).
- Timing at the limit (once, on this PC): `pAdjust([0.01], { method: "hommel", n: 65536 })`: 5.70 s.

## Fix

- `src/htest/pAdjust.ts`: `MAX_HOMMEL_N = 2^16`; RangeError "n must be at most 65536 for the hommel method (O(n^2) work)"; JSDoc of `pAdjust` and of the `n` option.
- Docs (en, ja): added to the item of #307 (the exact limits).

## Tests

- `test/issue391.test.ts`: n = 65537 is the RangeError (fails with src stashed: it computes); the issue's n = 1e5 and a p of 65537 values are the RangeError (excluded from the stash run); holm with n = 1e5 and an empty p are not limited; n = 3 gives 0.03.
- `test/padjust.test.ts` passes; tsc no errors.

## Out of scope (recorded)

- None.

## close comment

Fixed in <commit of #391, see git log --grep='#391'>: the Hommel method of pAdjust now accepts n up to 65536 (O(n^2) work, 5.7 s on the development machine); above it, a RangeError "n must be at most 65536 for the hommel method (O(n^2) work)" before the padding is built. The issue's pAdjust([0.01], { method: "hommel", n: 100000 }) now fails at once; n <= 65536 and the other methods are unchanged. R's p.adjust computes it however long it takes; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue391.test.ts. (Not pushed yet.)
