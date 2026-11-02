# 外部レビュー (32 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (lm のゼロ重み行、glmSummary の dispersion、anova の比較、aovEz、ddLeastSquares、mauchlyTest、aovStrataFit、aovEz の MSE)。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| lm のゼロ重み行の Inf (56) | ― | R の lm.wfit と同じ (重み 0 の行は検査しない)。記録だけ |
| **GLM-SUMMARY-DISPERSION-VALIDATION-01** (57) | `glmSummary(fit, { dispersion: -1 })` | R は標準誤差 NaN (警告)、rStats.js は NaN (警告なし)。**修正 (B)** |
| **LM-ANOVA-NONNESTED-NO-WARNING-01** (58) | `anova(lm(y ~ x2), lm(y ~ x1 + x3))` | R も rStats.js も F 1110、p 4.6e-7。**修正 (C)** |
| LM-ANOVA-RESPONSE-DATA-MISMATCH-01 (59) | 名前が同じで値の違う y | 既に "models were not all fitted to the same response values" でエラー |
| **GLM-ANOVA-NONNESTED-NO-WARNING-01** (60) | glmAnova の入れ子でない比較 | **修正 (C)** |
| 型の衝突 (61・62・64) | ― | レビュアーが撤回 (R の factor と同じ規則) |
| DD-LS-ZERO-COLUMN-UNSAFE-01 (63) | ― | 内部関数で、呼び出し元がランクを判定済み。記録だけ |
| MAUCHLY-ZERO-COVARIANCE (65) | 定数の行列 | R と同じく W・p とも NaN |
| MAUCHLY-ZERO-TEST-DF (66) | 検定の次元 1 (X = ~1、2 列) | W = 1、p = 1。球面性は自明に成り立つので妥当 |
| MAUCHLY-SINGULAR-COVARIANCE (67) | 2 列が同一 | R と同じく W = 0、p = 0 (非球面性の極限) |
| **MAUCHLY-ZERO-CONTRAST-DIMENSION-01** (68) | `mauchlyTest(y, { X: "~1", M: "~1" })` | R はエラー ("'a' is 0-diml")、rStats.js は W = 1・p = NaN。**修正 (A)** |
| AOV-STRATA-* (70〜73) | 誤差層の変数に欠損がある `aov(y ~ A + Error(id))` | **誤検出。** rStats.js は欠損行を除いた 11 行で計算し (`rows` も 11 行)、値は R に欠損行を除いたデータを渡した結果と完全に一致する。R 自身はこの入力でエラー ("'qr' and 'y' must have the same number of rows") |
| AOVEZ-CORRECTED-MSE-01 (74) | GG 補正の MSE | **afex と同じ。** afex も補正後の自由度で割った MSE (3.1013) を表示し、値は完全に一致する |
| 効果量への波及なし (75) | ― | レビュアーの確認どおり |

## A. mauchlyTest の検定の次元 0

- X が M を張る (検定の次元 0) ときは "X spans M: the test has no dimensions" のエラー (R もエラー)

## B. 与えられた dispersion

- `checkDispersion` (glm.ts) で、0 以上の有限値でなければ "'dispersion' must be a non-negative finite number"
- glmSummary・glmRstandard・glmCooksDistance・glmPredict・glmAnova の 5 か所に通した
- 0 は R と同じく標準誤差 0 (統計量は ±Inf)

## C. 入れ子でないモデルの比較

- **入れ子の判定 (`nestedColumns`、estimable.ts):** パラメータの少ないモデルの計画行列の列が、他方の列空間に入るかを、rank([X_大, X_小]) = rank(X_大) で判定する。LINPACK の QR の許容幅 (1e-7、列ごとの相対値) なので、説明変数の単位によらない
- **lm (`anova(fit1, fit2, …)`):** 隣どうしが入れ子でなければ F と Pr(>F) を NaN。Df と Sum of Sq は R と同じく残す
- **glm (`glmAnova([…])`):** 入れ子でなければ、検定の列 (Pr(>Chi)、Rao、F、Pr(>F)) を NaN。Cp は検定ではないので残す
- lmerAnova (入れ子でない比較のカイ二乗は NaN) と揃えた
- **R の fixture:** `test/anovaLm.test.ts` の #61 (`y ~ A` と `y ~ B`、別の因子) で、R は F 11.10・p 0.0033。意図的な NaN として記録した
  - `test/helpers/anova.ts` の `KnownDifference` に、意図的な値を表す `value` を加え、実際の値がそれと一致すれば通すようにした

| 呼び出し | 修正前 (R と同じ) | 修正後 |
|---|---|---|
| `anova(lm(y ~ x2), lm(y ~ x1 + x3))` | F 1110、p 4.6e-7 | F・p NaN |
| `anova(lm(y ~ x1), lm(y ~ x1 + x2))` (入れ子) | F 1.7583 | 同じ |
| 同 (x1 を 1e-9 倍) | F 1.7583 | 同じ (単位によらない) |

## テスト

- `test/review32.test.ts` を追加した。src を `git stash` で戻すと、4 件すべてが失敗する
- 全体テスト: 2164 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に、入れ子でない比較と dispersion を書いた
