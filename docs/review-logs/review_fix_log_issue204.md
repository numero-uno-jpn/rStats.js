# Issue #204 log: esW1 and esW2 add 0 for cells where both probabilities are 0

GitHub Issue #204. Session 11, judging of the issues classified C. Verdict: not planned (a deliberate difference from pwr, decided in review 33). No code changed; a test added.

## Plan

- Intent: confirm the behaviour and cite where it was decided.
- Method: run the issue's examples in rStats.js and in pwr 1.3.0 (R 4.5.2); find the decision in docs/differences-from-r.md, the review 33 log and the source.
- Why: the issue asks for pwr's NaN; rStats.js chose 0 deliberately, so the question is whether that decision stands.

## Check (main `f6eab84`, R 4.5.2, pwr 1.3.0)

| Call | pwr 1.3.0 | rStats.js |
|---|---|---|
| `esW1([0, 1], [0, 1])` | NaN | 0 |
| `esW2([[0, 0], [0, 1]])` | NaN | 0 |
| `esW1([0.5, 0.5, 0], [0.5, 0.5, 0])` | NaN | 0 |
| `esW1([0, 1], [0.5, 0.5])` (p0 = 0 < p1) | Inf | Infinity |

The issue's description of pwr is right (0 / 0 propagates NaN). rStats.js treats a category that has probability 0 under both hypotheses as absent: it contributes nothing to Cohen's w = sqrt(sum (p1 - p0)^2 / p0), which is the value of the same effect size computed without that category (esW1([1], [1]) = 0). Where p0 = 0 < p1 the term is still Infinity, as in pwr.

## Where the decision is recorded

- docs/review-logs/review_fix_log_20261031_33.md (review 33), the table of findings: "ESW1-ZERO-EXPECTED-PROBABILITY-01 (81) | p0 = 0 < p1 で Inf、両方 0 で NaN | 同じ | **修正 (E)**: 両方 0 のセルは 0 を足す" (R: Inf for p0 = 0 < p1 and NaN where both are 0; fixed (E): a cell where both are 0 adds 0), and section E: "esW1・esW2 の 0/0 のセル: p0 と p がともに 0 のセルは足さない。p0 = 0 < p は R と同じく Inf". Commit `0732ea9` ("Power and effect-size functions: NaN and out-of-range inputs, ...").
- docs/differences-from-r.md, "Where R fails and rStats.js returns a value" (line 332): "`ES.w1(c(0.5, 0.5, 0), c(0.5, 0.5, 0))` and `ES.w2` with an empty row or column (cells with both probabilities 0) | NaN (0 / 0) | such a cell adds 0 (0 here); p0 = 0 < p1 still gives Inf, as R". Also docs/ja/differences-from-r.md line 326.
- src/htest/pwr.ts, the comments at the guards: "a cell with p0 = p1 = 0 adds nothing (0 / 0 was NaN); p0 = 0 < p1 adds Inf, as pwr" (esW1) and "(a cell of an empty row or column, p0 = p = 0, adds nothing: 0 / 0 was NaN)" (esW2).
- test/review33.test.ts checks `esW1([0.5, 0.5, 0], [0.5, 0.5, 0])` = 0.

## Fix

- None (not planned).

## Tests

- `test/issue204.test.ts`: the issue's two examples and the review 33 example give 0; p0 = 0 < p1 gives Infinity.

## close comment

Not planned: this is a deliberate difference from pwr, decided in review 33 (finding ESW1-ZERO-EXPECTED-PROBABILITY-01) and recorded in docs/differences-from-r.md under "Where R fails and rStats.js returns a value". pwr 1.3.0 gives NaN for ES.w1(c(0, 1), c(0, 1)) and ES.w2(matrix(c(0, 0, 0, 1), 2)), as the issue says; rStats.js gives 0. A category with probability 0 under both hypotheses contributes nothing to Cohen's w, so the effect size is that of the table without it, rather than an undefined 0 / 0. Where p0 = 0 < p1 the term is still Infinity, as in pwr. A test was added: test/issue204.test.ts. (Not pushed yet.)
