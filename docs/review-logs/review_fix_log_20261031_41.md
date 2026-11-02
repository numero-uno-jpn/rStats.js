# 外部レビュー (41 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (glmPredict の応答尺度、gaussian と inverse.gaussian の family の検査、逆リンクの溢れ)。コードの変更はない。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| glmPredict の応答尺度の標準誤差 (176) | ― | レビュアーも問題なしと判定 |
| GLM-GAUSSIAN-NONFINITE-FITTED-MEAN-01 (177) | family の validmu・valideta と IRLS の検査 | **R 4.5.2 と同じ定義。** R でも gaussian (identity・log) の validmu・valideta は TRUE。非有限の平均は逸脱度を Inf にし、IRLS の逸脱度の検査 (glm.ts の "no valid set of coefficients" / "inner loop 1"。R の glm.fit と同じく、刻みを半分にし、直らなければエラー) で捕まる。具体例もない。記録だけ |
| GLM-FAMILY-INVERSE-GAUSSIAN-MUOK-01 (178) | ― | **R と同じ。** R の inverse.gaussian も validmu は TRUE で、valideta で η が有限かつ正かを確かめる (rStats.js の 1/mu^2 リンクの `positive` も同じ) |
| GLM-PREDICT-INVERSE-LINK-OVERFLOW-01 (179) | gaussian・log で exp(η) が溢れる予測 | レビュアー自身も数学的な誤りではないと判定。真の予測平均が double の範囲を超えるなら Inf が正しい表現 (R の predict.glm も Inf)。記録だけ |
