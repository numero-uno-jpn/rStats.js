# Issue #198 log: pwr2p2nTest's n1 n2 overflow (already fixed in #155)

GitHub Issue #198. Session 11, judging of the issues classified C. Verdict: completed, fixed by #155 (a duplicate). No code changed; no new test (test/issue155.test.ts already has this example).

## Plan

- Intent: confirm that the issue's example no longer overflows, and find the commit of #155.
- Method: run the example in rStats.js and pwr 1.3.0 under R 4.5.2; `git log --grep='#155'`.
- Why: #155 reported the same product n1 n2 in pwr2p2nTest with the same example.

## Check (main `101a89a`, R 4.5.2, pwr 1.3.0)

| Call | pwr 1.3.0 | rStats.js |
|---|---|---|
| `pwr2p2nTest({ h: 1e-100, n1: 1e200, n2: 1e200 })` (the issue) | 1 (0x1p+0) | 0.10895461755061556 |
| `pwr2p2nTest({ h: 1e-150, n1: 1e300, n2: 1e300 })` | | 0.10895461755061556 |
| `pwr2p2nTest({ h: sqrt(1/2), n1: 2, n2: 2 })` (the same shift sqrt(1/2)) | 0x1.be4732720c9f3p-4 (0.1089546) | 0.10895461755061556 (0x1.be4732720c9f2p-4) |

The effective sample size of the issue's example is 5e199 and h times its square root is sqrt(1/2), so the power is that of n1 = n2 = 2 with h = sqrt(1/2). rStats.js gives it (within 1 ulp of pwr's value for the small sizes); pwr itself saturates at 1.

## The fix

- `b05ad93` "pwr2p2nTest: the effective sample size where n1 n2 overflows (#155)" (pushed; on origin/main). Log: docs/review-logs/review_fix_log_issue155.md; test: test/issue155.test.ts, which checks this exact call (`{ h: 1e-100, n1: 1e200, n2: 1e200 }`, relative error below 1e-14 of 0.10895461755061557).

## close comment

Fixed by #155 (commit b05ad93): pwr2p2nTest no longer forms n1 n2 where it overflows. pwr2p2nTest({ h: 1e-100, n1: 1e200, n2: 1e200 }) now gives power 0.10895461755061556, the power of the shift sqrt(1/2) (as n1 = n2 = 2 with h = sqrt(1/2); pwr 1.3.0 gives 0.1089546 there and 1 for the issue's call). test/issue155.test.ts checks this exact call. See review_fix_log_issue198.md. (Not pushed yet.)
