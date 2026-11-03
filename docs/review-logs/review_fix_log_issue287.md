# Issue #287 log: the goodness-of-fit simulation allocates all B n draws at once

GitHub Issue #287. Session 12, group B4 (allocation limits, part R1: remove the allocation).

## Plan

- User decision (2026-11-03, item 4): draw column by column (O(k) memory) and limit B n to 2^27 draws (RangeError).
- Intent: `simulateGoodnessOfFit` called `sampleInt(k, { size: B n, replace: true, prob })`, one array of B n entries (`chisqTest([1e9, 1e9], { simulatePValue: true, B: 1 })` asks for 2e9). Time is also proportional to B n (75 to 230 ns per draw here).
- Choice: `sample.ts` gets an internal drawer (`sampleIntReplaceDrawer`): the weighted draw with replacement (cumulative search, or Walker's alias method with more than 200 large weights) one draw per call; `sampleInt` now fills its array from the same drawer. The method depends only on k and p, not on the size, and the counts are integers here (a fractional total is already an error), so drawing n per column takes the same uniforms in the same order as R's `matrix(sample.int(k, B n, TRUE, prob = p), nrow = n)`: p-values and the stream are bit-identical. 2^27 draws is about 10 to 30 s.

## Check (main `6ba593a`, R 4.5.2)

- `chisqTest([1e9, 1e9], { simulatePValue: true, B: 1 })`: before, `new Array(2e9)` filled with draws (code reading; not run). With B 2000 (4e12 draws) before: "Invalid array length". R allocates B n draws as far as memory allows (not run).
- The documented `set.seed(1); chisq.test(c(20, 15, 25), simulate.p.value = TRUE)` is 0.296351824087956 in R and in rStats.js before and after.
- Before and after, the same p-value and next `runif(1)` for 2 categories (default B), given p with B 500, 301 categories (Walker) with B 50 and with sample kind "Rounding", c(5000, 5000) with B 200, and the same `sampleInt` output with prob.

## Fix

- `src/random/sample.ts`: `probSampleReplace` and `walkerSample` become drawers (`probReplaceDrawer`, `walkerDrawer`); `sampleIntReplaceDrawer(n, prob)` (internal export) with sampleInt's checks of n and prob.
- `src/htest/chisqTest.ts` (`simulateGoodnessOfFit`): B n > 2^27 is RangeError "the simulation needs B * sum(x) <= 2^27 (134217728) draws"; then n draws per replicate, counted. The recycling of a partial last column (fractional n) is gone: n is an integer here.
- Docs (en, ja): the limit, as R accepts any size it can allocate.

## Tests

- `test/issue287.test.ts`: B 2000 with c(1e9, 1e9) is the error (fails with src stashed: "Invalid array length"); B 1 (the issue) and B n = 2^27 + 1 are the error (excluded from the stash run: they reach the allocation before the fix); p-values, the next uniform and `sampleInt` with prob as before.
- Test files using `chisqTest` and `sample`/`sampleInt` pass; tsc no errors.

## Out of scope (recorded)

- The contingency-table simulation's B (time only, below 2^31) is not limited; its log-factorial table is #285.

## close comment

Fixed in <commit of #287, see git log --grep='#287'>: the goodness-of-fit simulation of chisqTest no longer materialises the B * n draws. It now draws n categories per replicate and counts them, from the same uniforms in the same order as R's sample.int(k, B * n, TRUE, prob = p) laid out in an n-row matrix (the method, cumulative search or Walker's alias, depends only on k and p), so p-values and the random stream are unchanged (set.seed(1); chisq.test(c(20, 15, 25), simulate.p.value = TRUE) is still R's 0.296351824087956). B * sum(x) above 2^27 (134217728 draws, tens of seconds) is now RangeError "the simulation needs B * sum(x) <= 2^27 (134217728) draws" before any draw: the issue's chisqTest([1e9, 1e9], { simulatePValue: true, B: 1 }) is this error. R accepts any size it can allocate; the difference is recorded in docs/differences-from-r.md. A test was added: test/issue287.test.ts. (Not pushed yet.)
