# 外部レビュー (68 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (glmSummary の自由度と分散、glmFamily のリンクの微分、IRLS、入力の処理、glmAnova・glmPredict・glmConfint)。今のコード (`4574833`) と R 4.5.2 で確かめた。レビュアーは新しい確定バグを挙げていない。残っていた指摘も、すべて修正済みか撤回だった。コードは変えていない。

## 判定

| 項目 | 今のコード | 判定 |
|---|---|---|
| MOD-034 (dispersion 指定時の "t value") | "z value" | 63 回目に修正済み (レビュアーのコードが古い) |
| probit で η = −40 の逆リンクと微分が EPSILON (「R と同じクランプ」として問題なしとされた) | 5e-324 (Φ(−40) は double で表せない) | 63 回目に厳密化済み |
| glm2 論文の例 (binomial、切片だけ、y = 1, 1, 1, 0、start −1.81) で係数 2.25e15 の偽の収束 (「R 由来の既知の限界」とされた) | 係数 1.0986 (= log 3、真の最尤推定値)、deviance 4.4987、警告 "step size truncated due to increasing deviance" | 61 回目のステップ半減で直っている。R は今も 2.25e15 で converged |
| MOD-024 の新しい例 (同じ列、offset だけ違う Poisson の 2 モデル) | 自由度の差 0 で p は NaN (検定しない)。Deviance の列の 0.259 は R と同じ表示 | 対応済み |
| MOD-042 | 66 回目に修正済み | レビュアーのコードが古い |
| MOD-045 (quasibinomial の重み 0 の応答) | ― | レビュアーが撤回 (R の binomInitialize と同じ) |
| 残差自由度 0・1、ランク落ちの共分散、9 つのリンクの微分、working response と weights、step-halving のあとの状態、NaN の行の除外、2 列応答のゼロ試行 | ― | レビュアーは問題なしとしている |

## テスト・docs

- コードを変えていないので、なし

## 外部レビュアーの次の予定

GLM の分布・尤度・逸脱度 (binomial の逸脱度と二項係数の定数項、Poisson の y = 0、Gamma・inverse.gaussian の逸脱度と対数尤度、AIC と deviance の関係、整数でない prior weights)。対数尤度から独立に計算した値とも比べるとのこと
