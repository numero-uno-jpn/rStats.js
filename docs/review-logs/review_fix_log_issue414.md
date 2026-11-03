# Issue #414 log: sampleInt's weighted size of 2^31 or more

GitHub Issue #414. Session 13, group A (input checks in random, as R).

## Plan

- Intent: R's weighted `do_sample` takes size with `asInteger`, so a size of 2^31 or more is NA and "invalid 'size' argument" before anything is allocated or drawn. rStats.js checked n < 2^31 on that path but not size: `sampleInt(2, { size: 2147483648, replace: true, prob: [0.5, 0.5] })` allocated an array of 2^31 and started 2^31 draws.
- Method: on the weighted path, reject a truncated size of 2^31 or more first (before the n and prob checks, as R reports size before prob). The unweighted path is unchanged (R takes long-vector sizes there). No docs entry (the same as R).

## Check (main `c03f34b`)

R 4.5.2 was run only on calls it rejects before allocating (`set.seed(1)`, uniforms drawn from the next `runif(1)`):

| call (R `sample.int(2, size, ..., prob = c(0.5, 0.5))`) | R 4.5.2 | before | after |
|---|---|---|---|
| size 2147483648, replace = TRUE | "invalid 'size' argument" (after a coercion warning), 0 drawn | allocates 2^31 and draws (does not end in practice; found by reading the code) | RangeError, 0 drawn |
| size 1e15 or 2147483648.5, replace = TRUE | the same | the same | RangeError, 0 drawn |
| size 2147483648, replace = FALSE | the same | "larger than the population" | RangeError (size) |
| size 2147483648, prob c(-1, 0.5) | the same (size reported first) | prob error | RangeError (size) |
| size 3.5, replace = TRUE | 2 2 1 | [1, 1, 0] | the same |

## Fix

- `src/random/sample.ts`, `sampleInt1`: with prob, `k >= 2 ** 31` throws "size must be less than 2^31 with prob" before the other checks. `SampleOptions.size` documents the truncation and the bound.

## Tests

- `test/issue414.test.ts`: the rows above (error and uniforms drawn). With `src/` stashed, run with `-t` leaving out the first test (it does not end before the fix): the prob and population-size test fails, the unchanged test passes.
- `test/issue94.test.ts`, `errors`, `issue233`, `issue234`, `issue287`, `random-kinds`, `random`: pass. `npx tsc --noEmit -p .`: no errors.

## Out of scope (recorded)

- A weighted size just below 2^31 (or an unweighted one with replacement, which R takes as a long vector) is still accepted and allocates that many elements, as R does. `sampleInt` has no array cap of the session 12 kind (2^24 elements); this issue asked only for R's integer range.

## close comment

Fixed in <commit of #414, see git log --grep='#414'>: the weighted path of `sampleInt` and `sample` now rejects a (truncated) size of 2^31 or more before allocating or drawing, as R's `asInteger` in the weighted `do_sample` ("invalid 'size' argument"). `sampleInt(2, { size: 2147483648, replace: true, prob: [0.5, 0.5] })` throws "size must be less than 2^31 with prob" at once and draws no uniforms; the size is reported before an invalid prob, as in R. Smaller weighted sizes and the unweighted path are unchanged.

Test: test/issue414.test.ts. (Not pushed yet.)
