# 外部レビュー (36 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (aovStrata の小さな列、ddSumSquares、aovEz の応答、Mauchly の p 値)。

## 判定

| ID | 呼び出し | R 4.5.2 | 修正前 | 判定 |
|---|---|---|---|---|
| **AOV-STRATA-DD-QR-NORM-UNDERFLOW-01 (136)** | `aov(y ~ W + Error(z))`、z を 1e-200 倍 | z の層の W 0.9865 (1 倍と同じ) | **0.2275** (Within も変わる) | **修正 (A)** |
| AOV-STRATA-TREATMENT-PROJECTION-SS-UNDERFLOW-01 (137) | `aov(y ~ x + W + Error(id))`、x を 1e-200 倍 | **x が両方の層から消える (R の誤り)** | 1 倍と同じ表 | 35 回目の修正 (処置の列の正規化) で対応済み。docs に追記 (B) |
| DD-SUM-SQUARES-SCALE-INVARIANCE-01 (138) | ― | ― | ― | 補助関数の性質。呼び出し側で正規化して扱う (lm・aovEz は応答を正規化済み。レビュアーも 139 で同意) |
| AOVEZ-RESPONSE / CELL-AGGREGATION (140・141) | ― | ― | ― | レビュアーが撤回 |
| AOVEZ-MAUCHLY-EIGEN-DD-TRUNCATION-01 (142) | ― | ― | ― | 具体例なし。記録だけ |
| MAUCHLY-PVALUE-INTERMEDIATE-OVERFLOW-01 (143)、RESULT-GUARD-01 (144) | データを 1e150 倍した mauchlyTest | **W = Inf、p = 1 (R の誤り)** | 1 倍と同じ (W 0.3189、p 0.4978) | 溢れるのは観測数 n が 1e150 程度のときで、現実の入力では起きない。記録だけ |

## A. 誤差モデルの列の正規化 (aovStrataFit)

- **原因:** 誤差モデルの列は QR (ノルムは正規化して計算) でランクを決めた後、double-double の分解 (`ddLeastSquaresMulti`) で 2 乗される。1e-200 程度の共変量では 2 乗がアンダーフローし、別の層を作っていた
- **修正:** 誤差モデルの各列を、その列の 2 の冪で割ってから QR と double-double の分解に渡す (厳密)
  - 誤差層は列が張る空間だけで決まるので、列の倍率は結果に影響しない
  - 切片やダミー変数 (最大値 1) の列は倍率 1 で、通常のモデルはまったく同じ計算
- 35 回目の処置の列と同じ方法。z を 1e-200 倍・1e200 倍しても、1 倍のときと同じ表 (相対 1e-13 以内)

## テスト

- `test/review36.test.ts` を追加した
  - src を `git stash` で戻すと、誤差モデルの列のテストが失敗する
  - 処置の列のテストは、35 回目の修正の確認なので、修正前でも通る
- 全体テスト: 2177 passed / 34 skipped。ほかに `distributionProperties.test.ts` の signrank が、実行時間の上限で 1 回失敗した (1004 ms)。これまでと同じ負荷による一時的なもので、ファイル単独では 33 件すべて通った
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に、処置の小さな共変量を R が落とすことと、rStats.js の扱いを書いた
