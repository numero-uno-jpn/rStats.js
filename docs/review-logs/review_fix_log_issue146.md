# Issue #146 log: pnbinom with q just below an integer

GitHub Issue #146: `pnbinom(0.99999999, 1, prob = 0.5)` and `pnbinom(0.99999999, 1, mu = 1)` gave 0.75 = P[X <= 1] (`floor(q + 1e-7)` in `pnbinom1` and `pnbinomMu1`); P[X <= 0.99999999] = P[X <= 0] = 0.5. R 4.5.2 also gives 0.75.

Fixed together with #145 (pgeom) and the same rule in ppois, pbinom, phyper, pwilcox, psignrank and the exact Ansari-Bradley distribution, in one commit. The plan, the check against R, the fix, the tests, the reversal of the review 25 decision and the proposed HANDOFF text are in `review_fix_log_issue145.md`.

- After the fix: both calls give 0.5. A q within 1e-9 max(1, abs(q)) of an integer counts as that integer (as `dnbinom` judges it); any other q gives floor(q).
- Test: `test/issue145.test.ts` (the issue's two calls, and the rule for `pnbinom` with prob and with mu).

## close comment

Fixed in <commit of #145 #146, see git log --grep='#146'>, together with #145: pnbinom (with prob and with mu) now takes P[X <= q] as P[X <= floor(q)], except that a q within 1e-9 max(1, abs(q)) of an integer counts as that integer, as dnbinom judges it. pnbinom(0.99999999, 1, prob = 0.5) and pnbinom(0.99999999, 1, mu = 1) are now 0.5 (were 0.75). R 4.5.2 gives 0.75 (floor(q + 1e-7)); the difference is documented in docs/differences-from-r.md. Details in docs/review-logs/review_fix_log_issue145.md. Test: test/issue145.test.ts. (Not pushed yet.)
