# Revision of review 2 (C-02/C-03): Welch's degrees of freedom in R's forms

## Plan
- Intent: review 2 put every Welch-type df on `satterthwaiteDf`, (sum w)^2 / sum(w^2 / df) on w scaled by a power of 2.
  R's t.test and effectsize use stderr^4 / (stderrx^4 / (nx - 1) + stderry^4 / (ny - 1)) and PMCMRplus's
  gamesHowellTest A^2 / (s2_i^2 / (n_i^2 (n_i - 1)) + s2_j^2 / (n_j^2 (n_j - 1))). All three are within a few ulp of the
  exact df (60 synthetic cases against Rmpfr: at most 5, 3 and 3 ulp), so by criterion K2 the results should be R's
  bits; the scaling only matters where R's terms overflow.
- Decision: D13 (session 14, `prep/rbits.md` question 1, recommended option 1).
- Form: `satterthwaiteDfSe` (t.test / effectsize) and `satterthwaiteDfPM` (PMCMRplus) in `src/internal/summary.ts`, on
  the values scaled by an even power of 2 (exact also through sqrt, so R's bits wherever R's terms are in range; the
  largest scaled value in [1, 4), so the fourth powers cannot overflow); `satterthwaiteDf` only where the result is not
  finite and positive (K3). tTest (Welch) and cohensD / hedgesG (pooledSd: false) use the first, gamesHowellTest the
  second. icc's two-way bounds keep `satterthwaiteDf`, which is irr's expression in the same order of operations.
- cohensD with pooledSd: false also takes effectsize's se = sqrt(se1^2 + se2^2), se_i = sqrt(s_i^2 / n_i) (the
  prototype of the preparation had it with the df; the same root as tTest's standard error, revision of review 3).

## Original decision
- Review 2, C-02/C-03 (no user decision): the df of tTest, gamesHowellTest, cohensD / hedgesG and icc unified on
  `satterthwaiteDf` against overflow at 1e±150; the log noted that the last bits may differ from R's stderr^4 form.

## Gap with the current criteria
- K2: R's forms are right in the usual range, and the df differed from R's in the last bits (tTest Welch: 22 of 176
  fixture cases with R's bits).

## Reproduction (R 4.5.2)
| call | R | before | now |
|---|---|---|---|
| `t.test(c(1.2, 3.4, 2.2, 5.1), c(2, 4, 6, 9, 11, 3))$parameter` (Linux fixture) | 7.5116241523196683 | 7.511624152319669 | R's bits |
| fixture case 129 (5 and 5 values) | 6.9401538431552519 | 6.9401538431552545 | R's bits |
| PMCMRplus's expression on s2 = 2.5, 0.7, 13.1 and n = 4, 6, 9 (3 pairs, local R) | 0x1.08d556797cab9p+2, 0x1.5ea56b70f8bc2p+3, 0x1.27a4d48b5a785p+3 | | R's bits |

Fixture (tTest, 176 finite Welch cases): df with R's bits 22 before, 165 now; stdErr 165 (after review 3's revision).
Interval ends with R's bits over the whole fixture: 460 after review 3's revision, 452 now (Welch 133 to 125: with R's
df, qt's last-bit differences show differently; the preparation's estimate was 452). Ends beyond the tolerance: 7 pooled
and 12 Welch, unchanged. cohensD, hedgesG, gamesHowellTest (p within 3e-16) and icc fixtures pass unchanged.

## Fix
- `src/internal/summary.ts`: `satterthwaiteDfSe`, `satterthwaiteDfPM` and the comment of `satterthwaiteDf`.
- `src/htest/tTest.ts`, `src/htest/effectSize.ts`, `src/htest/multipleComparisons.ts`: the callers.
- Docs: none (the row of the Welch df at 1e±150 still holds; the values are now R's bits elsewhere).

## Tests
- `test/rev2.test.ts`: the rows above, scaling by 2^±600 and 2^±1000, and NaN for zero variances. Fails with src
  stashed.
- ttest, rev3, cohensD, issue 74 (revision), 143, 270, 313, 314, lmerTest, mcompPMCMR, review 33, reviewModels14,
  scaleInvariance, scaleInvarianceAll, htest-basic, docExamples pass.

## Out of scope (recorded)
- Windows R's `^` (pow) is not always correctly rounded: for se = sqrt(2.5 / 4 + 0.7 / 6) its se^4 0.55006944444444459
  is 1 ulp above the exact rounding 0.5500694444444447 (BigInt), which V8's `**` gives; the Linux fixture agrees with
  V8 here. So the t.test form is checked against the Linux fixture only.
- The remaining Welch df differences (11 of 176) come from the last bit of `variance` (1 to 2 ulp from R's var); the
  remaining interval ends mostly from qt. Separate roots.
- gamesHowellTest's p-values still differ from R's in the last bits through ptukey (recorded in the test's RANGE_P).
