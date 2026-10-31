# 外部レビュー (40 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (lm の重み 0 の行、predict・glmPredict の新データ、dispersion の指定、nonEstimableRows)。コードの変更はない。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| 重み 0 の行の残差・予測値 (167)、応答の正規化 (168) | ― | レビュアーも正しい実装と判定 |
| 重み付きの R² (169) | ― | 27 回目に修正済み (重みを 2 の冪で正規化。重み 1e308 でも R² 0.982) |
| LM-PREDICT-NEW-DATA-NONFINITE-01 (170) | `predict(m, [2, NaN, Inf])` | **R 4.5.2 と同じ。** 予測値 2.127・NaN・Inf、標準誤差 0.102・NaN・NaN。NaN は欠損の行としてその行だけ NaN になり、ほかの行は計算される (全体をエラーにすると、ほかの行の予測も得られなくなる)。記録だけ |
| GLM-PREDICT-NEW-DATA-NONFINITE-01 (171・172) | `glmPredict` の newdata (と newoffset) | 同上。R の predict.glm と同じ行ごとの扱い (予測値 0.828・NaN・Inf)。記録だけ |
| GLM-DISPERSION-OVERRIDE-VALIDATION-01 (173・174) | `glmPredict(…, { dispersion: -1 })` | **対応済み (32 回目)。** "'dispersion' must be a non-negative finite number" でエラー。glmSummary・glmRstandard・glmCooksDistance・glmAnova も同じ `checkDispersion` を通す。R は標準誤差 NaN (警告)。レビュアーは古いコードを見ている |
| ESTIMABLE-DOT-OVERFLOW-01 (175) | ― | 27 回目に記録済み (誤答の具体例なし)。lm・glm の予測可能性の判定にも関わるという追記だけ |
