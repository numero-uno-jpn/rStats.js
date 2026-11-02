# Issue #151 対応ログ: dnbinom の size + x が溢れると NaN (#65 と同じ。以前の判断を保つ)

GitHub Issue #151。夜間の自律対応。判定: #65 の繰り返し。22・55 回目と #65 のユーザー判断どおり変えない (not planned)。コードの変更なし。

## 計画

- 意図: issue の 3 つの再現例を今の main と R 4.5.2 で確かめ、#65 と同じ指摘かを見る
- 方法: npx tsx と Rscript で同じ呼び出しを流す
- 選んだ理由: HANDOFF の方針に当たれば、ユーザーの判断を覆さず変えない

## 確認 (main `75a70cc`)

| 呼び出し | R 4.5.2 | rStats.js | 正しい値 (issue と #65 のログ) |
|---|---|---|---|
| dnbinom(1e308, 1e308, prob = 0.5) | 0 | NaN | 約 2.820947917738782e-155 |
| 同、log = TRUE | −Inf | NaN | 約 −355.8636164445677 |
| dnbinom(1e308, 1e308, mu = 1e308) | 0 | NaN | 同上 |

issue の再現例・参照値・原因 (`dnbinomRaw` の `if (!Number.isFinite(size + x)) return NaN;`) は #65 とまったく同じ (`review_fix_log_issue65.md`)。

## 判定

変えない。HANDOFF の該当箇所:

- 「Issue #63〜#66 の結果」: 「#65 変えない (not planned、ユーザー判断で以前の判断を保つ): dnbinom の size + x が溢れると NaN (22・55 回目と同じ)」
- 「記録だけにしたもの」: 「`dnbinom` などの、試行回数 (size + x) が溢れる場合の密度 (22 回目、(a) で見送り)。55 回目に、log の有無によらず NaN にそろえた (log なしが誤った 0 だった)」
- 方針「2^53 を超える整数の領域: 誤った値の代わりに NaN を返す」

変えない理由は #65 のログのとおり (密度だけ直すと pnbinom・qnbinom の NaN とそろわない、2^53 を超える整数の領域の方針、R も 0 / −Inf で誤り)。

## close comment

Confirmed, but kept as decided: this is the same case as #65 (closed as not planned). dnbinom(1e308, 1e308, prob = 0.5) and the mu form return NaN (log too) by design where size + x overflows (reviews 22 and 55, and #65): a finite density alone would not agree with pnbinom and qnbinom, which are NaN there under the policy of returning NaN rather than an inexact value for integers beyond 2^53. R 4.5.2 returns 0 and -Inf, which are wrong. The reference value (about 2.82e-155, log about -355.86) is recorded in review_fix_log_issue65.md. See review_fix_log_issue151.md. (Not pushed yet.)
