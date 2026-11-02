# 外部レビュー (38 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (aovEz の Mauchly の特異性の判定、Mauchly の小標本、ddMatrix、aovSummary の警告、carAnova の Type II・III)。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| **MAUCHLY-SINGULAR-COVARIANCE-UNHANDLED-01、MAUCHLY-ASYMPTOTIC-RHO-NONPOSITIVE-01 (157・158・160)** | 残差自由度 n < 検定の次元 pp の `mauchlyTest` | **修正 (A)。** R 4.5.2: NaN / W = 0・p = 1 / W 2e-17・p 9e-4。修正前の rStats.js: W 4e-33・p NaN / W = 0・p = 1 / W −3.2e-33・p NaN。n < pp では共分散行列がデータによらず特異で、検定は定義されない |
| AOVEZ-MAUCHLY-RANK-TEST-PARAMETERIZATION-01 (154) | ― | 数学的な指摘は正しい (PEP の固有値は対比の変換で変わる)。ただし公開 API では被験者内の対比が `contr.sum` に固定で、観測できる違いはない。**記録だけ (B)**: 直すなら、M = (P'P)⁻¹ のコレスキー分解 L による L'·PEP·L の固有値で判定する。判定の閾値の問題 (R13、3 回目のログ) とあわせて扱う |
| GG/HF ε、Mauchly の W の不変性 (155・156) | ― | レビュアーも問題なしと判定 |
| DD-MATRIX-LU-* (159) | ― | レビュアーも確定不具合としない |
| AOV-SUMMARY-PERFECT-FIT-WARNING-DROPPED-01 (161・162) | 完全に当てはまる `aov` の `summary` | **R と同じ。** R の `summary(aov)` も警告を出さない (出すのは `anova(lm)` で、rStats.js の `anova` も出す)。**記録だけ (C)**: 35 回目に誤差層付きの要約には当てはめの警告を引き継いだので、揃えるなら任意 |
| carAnova の Type II・III の自由度 (163・164) | ― | レビュアーも不具合としない |

## A. mauchlyTest の残差自由度

- 残差自由度 n が検定の次元 pp より小さければ、"too few residual degrees of freedom for the test: n for pp dimension(s)" のエラー
- n ≥ pp なら、漸近補正の ρ = 1 − (2pp² + pp + 2)/(6pp·n) は正になる (pp/3 + 1/6 + 1/(3pp) < pp) ので、157 の ρ ≤ 0 もこの条件で防げる
- n = pp のときは従来どおり検定する

## テスト

- `test/review38.test.ts` を追加した。src を `git stash` で戻すと失敗する
- 全体テスト: 2179 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に書いた
