# Issue #171 対応ログ: glmSummary が dispersion 指定時に z を使う (R と同じ、変えない)

GitHub Issue #171。夜間の自律対応。判定: issue の主張が R と違う (not planned)。コードの変更なし。

## 計画

- 意図: issue の主張 (Gamma などで dispersion を指定しても t 検定のままであるべきなのに、z と pnorm に切り替わる) を R 4.5.2 で確かめる。issue は R を実行していない
- 方法: issue の例を npx tsx と R の `coef(summary(f, dispersion = 1))` で比べる
- 選んだ理由: R と同じなら変えない (63 回目 MOD-022、68 回目 MOD-034 で同じ点を確かめ済み)

## 確認 (main `530db03`)

`glm([0, 1, 2, 3], [1, 2, 3, 4], { family: "Gamma", link: "log" })`:

| | R 4.5.2 | rStats.js |
|---|---|---|
| dispersion = 1: 列名 | "z value"、"Pr(>\|z\|)" | "z value" |
| dispersion = 1: p 値 | 0.88891278439475681、0.30862367621481503 | 0.8889127843947571、0.3086236762148149 |
| 指定なし: 列名 | "t value"、"Pr(>\|t\|)" | "t value" |
| 指定なし: p 値 | 0.439518850301434405、0.019935172755526700 | 0.43951885030143534、0.019935172755526753 |

R の summary.glm は、dispersion を推定しないとき (binomial・poisson か、dispersion を与えたとき) に z と pnorm を使う。rStats.js も同じで、p 値は R と一致する (差は表示桁の範囲)。

issue が引く `oracle/glm-behaviour.md` の文 ("2 pnorm(-|t|) ("z value") for binomial and poisson, 2 pt(-|t|, df.residual) ("t value") otherwise") は、dispersion を指定しない既定の場合の説明で、R の動作の記述として dispersion 指定時を書き落としている (文書の不備。R の動作は上の表のとおり)。

## 判定

変えない。R と同じ。HANDOFF の該当箇所:

- セッション 5 の 63 回目: 「dispersion 指定時の "z value" (R との不一致)」を直した (MOD-022: `glmSummary(gaussian fit, dispersion = 1)` の名前が "t value" で p 値は z だったのを、R と同じ "z value" に)
- 共通基盤「モデル」: 「glmSummary の `statisticName` は `zTest` (dispersion を推定しない) で決める (R と同じ)」
- 68 回目のログ: 「MOD-034 (dispersion 指定時の "t value") → "z value"、63 回目に修正済み」

## 範囲外として記録

- `oracle/glm-behaviour.md` の summary.glm の p 値の文に、dispersion を与えたときも z (pnorm) であることを書き足すとよい (R の動作の記述の書き落とし。今回は直していない)

## close comment

Not a bug: this is what R does. R's summary.glm uses z and pnorm whenever the dispersion is not estimated, which includes a supplied dispersion for any family. For the issue's Gamma (log link) fit, R 4.5.2's coef(summary(f, dispersion = 1)) has the columns "z value" and "Pr(>|z|)" with p-values 0.88891278439475681 and 0.30862367621481503; glmSummary(fit, { dispersion: 1 }) gives "z value" with 0.8889127843947571 and 0.3086236762148149. Without the dispersion both use t (0.4395188503014344, 0.0199351727555267). This was settled in review 63 (MOD-022) and confirmed in review 68 (MOD-034). The sentence in oracle/glm-behaviour.md describes the default case and omits the supplied dispersion. See review_fix_log_issue171.md. (Not pushed yet.)
