# 外部レビュー (37 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (Mauchly の p 値、ddMatrix の LU、contrastCrossprod、aovEz の Mauchly の特異性の判定)。コードの変更はない。

## 判定

| ID | 判定 |
|---|---|
| MAUCHLY-PVALUE-INTERMEDIATE-OVERFLOW-01 (145)、MAUCHLY-PVALUE-RESULT-GUARD-01 (146) | レビュアーが撤回。36 回目の確認でも、溢れるのは観測数が 1e150 程度のときだけ |
| DD-MATRIX-LU-PIVOT-HIGH-PART-ONLY-01 (147)、DD-MATRIX-LU-SINGULARITY-HIGH-PART-ONLY-01 (148) | 改善候補・実害未確認 (レビュアーも同じ判定)。上位成分が同じ候補どうしの差は、LU の精度に影響しない程度。正規化された double-double では、上位成分が 0 なら下位成分も 0。記録だけ |
| MAUCHLY-CONTRAST-QR-DD-RANK-MISMATCH-01 (149) | 具体例なし (レビュアーも要再現とする)。aovStrata の 132 と同じく、内部の前提の問題。記録だけ |
| MAUCHLY-CONTRAST-QR-PIVOT-ORDER-01 (150・151) | レビュアーが撤回。QR は LINPACK の限定ピボットで、先頭に置いた X の独立な列は後ろの M の列に追い越されない (35 回目の 127 と同じ理由) |
| AOVEZ-MAUCHLY-RANK-TEST-PARAMETERIZATION-01 (152) | 公開 API からは通らない。被験者内の因子の対比は `contr.sum` に固定され (aovEz.ts の within の modelMatrix)、利用者は変えられない。応答も正規化済み。判定の閾値そのものは、HANDOFF の残課題「aovEz の特異性の判定 (R13)」として記録済み |
| AOVEZ-MAUCHLY-RANK-EIGEN-DOUBLE-01 (153) | 具体例なし。閾値 1e-12 に対して、double-double の下位成分 (相対 1e-16 以下) で判定が変わる経路は考えにくい。記録だけ |
