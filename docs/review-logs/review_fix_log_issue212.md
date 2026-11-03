# Issue #212 log: localMin's midpoint 0.5 (a + b) overflows for large finite brackets

GitHub Issue #212. Session 11, judging of the issues classified C, then user decision 6 (option A). The issue's example is handled through the public `optimize` (the triage was right about it), but the same overflow is reached through `optimize` with other brackets, and there the search did not end. Fixed in `optimize`.

## Plan

- Intent: `localMin` (src/optim/localmin.ts) is internal; its only caller is `optimize` (src/numerics/integrate.ts), which searches over u = x / 2 where `upper - lower` or `upper + lower` overflows (review 49). Check whether the midpoint of a narrowed bracket [a, b] can still overflow when `upper + lower` does not.
- Method: call `optimize` with an objective that counts its evaluations and throws beyond 100000 (so a non-ending search cannot hang), on the issue's bracket and on brackets with one end near -Number.MAX_VALUE or +Number.MAX_VALUE and the other near 0, with the minimum near the large end. Same in R 4.5.2 with the same counter.
- Why: if `optimize` reaches the overflow, the defect is not internal-only and the fix needs a choice of where to guard.

## Check (main `8fb2bb2`, R 4.5.2)

| Call | rStats.js | R 4.5.2 `optimize` |
|---|---|---|
| `optimize((x / 1e308 - 1.1)^2, 1e308, 1.7e308)` (the issue) | 1.1000000004370132e308 in 37 evaluations | more than 100000 evaluations (stopped) |
| `optimize((x / 1e308 + 1.6)^2, -1.7e308, 1e306)` | **more than 100000 evaluations** (stopped) | more than 100000 evaluations (stopped) |
| `optimize((x / 1e308 - 1.6)^2, -1e306, 1.7e308)` | **more than 100000 evaluations** (stopped) | more than 100000 evaluations (stopped) |
| `optimize((x / 1e308 - 1.69)^2, -1e300, 1.7e308)` | **more than 100000 evaluations** (stopped) | |

In the last three, `upper + lower` and `upper - lower` are finite, so `optimize` calls `localMin` on x itself. As the bracket narrows towards the minimum near 1.6e308, both a and b exceed Number.MAX_VALUE / 2 and `0.5 * (a + b)` is Infinity; the stopping test `abs(x - xm) <= tol2 - 0.5 (b - a)` can then never hold, and the search does not end. R behaves the same way (its Brent search has the same midpoint), including for the issue's bracket, which rStats.js already handles.

## Decision (user decision 6)

Option A of the judging, which was recommended (the others were B: guard the midpoint inside `localMin`, which leaves Brent's other expressions to check; C: not planned). R does not return for these brackets, so the docs record the difference.

## Fix

- `src/numerics/integrate.ts`, `optimize`: the search over u = x / 2 (tol / 2) is used wherever 2 lower or 2 upper overflows, that is, an end beyond Number.MAX_VALUE / 2. This includes the old condition (upper - lower or upper + lower overflowing implies an end beyond MAX / 2), so the condition is now only that. `localMin` is unchanged.
- `docs/differences-from-r.md` and `docs/ja/differences-from-r.md`: a row after review 49's optimize entry.

| Call (evaluations counted, stopped beyond 100000) | before | after |
|---|---|---|
| `optimize((x / 1e308 + 1.6)^2, -1.7e308, 1e306)` | does not end | -1.5999999916130706e308 in 38 evaluations |
| `optimize((x / 1e308 - 1.6)^2, -1e306, 1.7e308)` | does not end | 1.5999999916130706e308 in 38 |
| `optimize((x / 1e308 - 1.69)^2, -1e300, 1.7e308)` | does not end | 1.690000008938994e308 in 38 |
| the issue's `optimize((x / 1e308 - 1.1)^2, 1e308, 1.7e308)` | 1.1000000004370132e308 in 37 | unchanged (already in x / 2) |

Brackets that used to be searched on x and now are on x / 2: halving is exact and Brent's search is invariant under it (the tolerance is halved too). A sweep of 300 random brackets with one end in (MAX / 2, MAX] in size and the other from 0 or 1e-308 to 1e308 in size, minimum of ((x - t) / max(abs(t), 1))^2 at a random t inside: 205 ended with the old search on x (localMin called directly, counted) and gave the same bits now; the other 95 did not end with the old search.

## Tests

- `test/issue212.test.ts`: the three brackets above (counted objectives that throw beyond 100000 evaluations, so they fail rather than hang before the change) and the issue's unchanged value. With `src/` stashed, the first block fails (the count is exceeded).
- `test/issue61.test.ts`, `test/issue74.test.ts`, `test/issue220.test.ts`, `test/numerics.test.ts`, `test/optim.test.ts`, `test/review26.test.ts`, `test/review49.test.ts` pass; `npx tsc --noEmit -p .`: no errors.

## close comment

Fixed in <commit of #212, see git log --grep='#212'>. The issue's bracket was already handled through the public optimize, which searches over x / 2 where upper + lower or upper - lower overflows (1.1000000004370132e308 in 37 evaluations; localMin is internal). But with lower + upper finite and one end beyond Number.MAX_VALUE / 2, the midpoint 0.5 (a + b) overflowed once the bracket narrowed near that end, and optimize((x / 1e308 + 1.6)^2, -1.7e308, 1e306) did not end (R 4.5.2 does not either). optimize now searches over x / 2 wherever an end is beyond Number.MAX_VALUE / 2: that call gives -1.5999999916130706e308 in 38 evaluations, and (x / 1e308 - 1.6)^2 on (-1e306, 1.7e308) and (x / 1e308 - 1.69)^2 on (-1e300, 1.7e308) end as well. Halving is exact and the search is invariant under it: 205 random brackets with such an end that ended before give the same bits. The difference from R is recorded in docs/differences-from-r.md. A test was added: test/issue212.test.ts. (Not pushed yet.)
