# 外部レビュー (15 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (生存時間解析・順位検定、二項・Fisher・カイ二乗・検出力、相関・回帰、GLM)。レビュアーは push 前のコードを見ていて、binomTest の O(n)、anova の行、confint の水準などは修正済み。

## R 4.5.2 で実行して確かめた結果

| 項目 | R 4.5.2 | rStats.js (修正前) | 判定・対応 |
|---|---|---|---|
| `survdiff`、全員が同時にイベント | エラー (特異行列) | 同じ | **修正 (ユーザー判断: 統計学的に正しい方向)**: 一般化逆行列、自由度 = rank(V)。rank 0 なら chisq 0、df 0、p NaN。結果に `df` を追加 |
| `survdiff` の時刻 Inf (打ち切り / イベント) | どちらもエラー | どちらも計算 | **修正**: 打ち切りの Inf は許す (時刻 1e6 と同じ結果)、イベントの Inf と −Inf はエラー |
| `survfit` の S = 0 の時点 | summary の std.err NaN、限界 NA | NaN | 一致。変更なし |
| `kruskal.test`・`friedman.test` で全観測値が同じ | NaN、NaN | NaN | 一致。変更なし |
| `ks.test(x, function(q) 1.5)` | D = 1.5、p = 0 | 同じ | **修正 (ユーザー判断)**: [0, 1] の外や NaN はエラー |
| `chisq.test(c(Inf, 10))` | NaN | NaN | **修正**: エラー (文言は以前から「finite」を要求していた) |
| power.t/prop/anova の NaN・Inf・負の n | NaN、または power 1 (n = Inf) | 同じ | 一致。変更なし (n = Inf の power 1 は正しい極限) |
| lm・glm の重み Inf | エラー | エラー | 一致 |
| glm の offset Inf | エラー | 係数 [0, 0] | **修正**: エラー |
| glm の逆ガウス・identity link (レビューの例) | −1.263082685、1.464455727 | 同じ | 一致。**修正 (ユーザー判断)**: 平均は正であることを求める (muOk) |
| `anova` で分布族が違う glm | 比較表を返す | 同じ | **修正 (ユーザー判断)**: エラー |
| glmConfint の再フィットの収束 | (確認していない) | 確認しない | **修正 (ユーザー判断)**: 収束しなければ、その限界を NaN にする |

## テスト

- `test/review15.test.ts`: survdiff (Inf と特異の場合)、chisq の Inf、ks の CDF、glm の offset、glmAnova の分布族
- `test/chisq.test.ts`: R fixture の Inf を含む 2 件を、理由を付けてエラーに差し替えた
- glmConfint の収束しない場合と、逆ガウスの平均が負になる場合は、そうなる入力を作れなかったので、テストは追加していない

docs (英・日) に R との違いを記載した。
