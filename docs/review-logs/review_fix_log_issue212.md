# Issue #212 log: localMin's midpoint 0.5 (a + b) overflows for large finite brackets

GitHub Issue #212. Session 11, judging of the issues classified C. Verdict: **Awaiting decision.** The issue's example is handled through the public `optimize` (the triage was right about it), but the same overflow is reached through `optimize` with other brackets, and there the search does not end. No code was changed.

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

## Options

- **A (recommended):** in `optimize`, search over u = x / 2 also where 2 lower or 2 upper overflows (any end beyond Number.MAX_VALUE / 2), not only where `upper + lower` or `upper - lower` does. Halving is exact and the search is invariant under it (the tolerance is halved too), so the brackets that end now keep their result; the three cases above would end at about 1.6e308 and 1.69e308.
  - Pros: one condition in the existing guard; localMin unchanged. Cons: the search on halved values for brackets that work today (values the same, as for review 49's guard; to be confirmed by a sweep).
- **B:** in `localMin`, form the midpoint as `0.5 a + 0.5 b` (or `a + 0.5 (b - a)`) only where `a + b` is not finite.
  - Pros: fixes the helper for any caller. Cons: the other expressions of Brent's step (p, q from differences of x, v, w) need checking for overflow too; more to verify.
- **C:** not planned (record only).
  - Cons: optimize does not return for these finite brackets; R does not either.

Whichever is chosen, R differs (it does not return), so the docs would record it next to review 49's entry.

## close comment

Awaiting a decision; see review_fix_log_issue212.md. (Not pushed yet.)
