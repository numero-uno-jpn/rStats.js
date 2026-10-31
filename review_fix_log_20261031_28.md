# 外部レビュー (28 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (lmerTest の結合自由度、mixedStructure の Z の行、lmerAnova のデータ、Doolittle、VarCorr、非対称行列の固有ベクトル)。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| LMER-RANDOM-EFFECT-ROW-MISALIGNMENT-01 (17・18) | h に欠損がある `y ~ x + (1\|g) + (1\|h)` (12 行) を R の lme4 と比べた | **誤検出。** REML 基準量 30.45571048128 が 13 桁一致。固定効果・θ・σ・ランダム効果も最適化の許容範囲で一致し、nobs = 10。Z を作る `design(parsed, …, t.lhs)` は式全体を渡すので、全変数で欠損を除いた同じ行が使われる |
| **LMER-ANOVA-MUTATED-DATA-01** (19) | 適合後に `data.z` を書き換えて `lmerAnova(fit, { type: "I" })` を呼んだ | **本物の問題。** x の F が 1926.92 から 1156.14 に黙って変わった (Type II・III は変わらない。列が変わる書き換えはエラー)。**修正 (A)** |
| LMER-JOINT-DENDF-INFINITY-01 (16) | ν = Inf の項 ν/(ν−2) が Inf/Inf = NaN | **修正 (B)。** 実際に Inf の自由度が出る例は見つけていないが、極限 1 で扱う |
| LMER-ANOVA-DOOLITTLE-SCALE-01 (20) | ― | 修正済み (`b0d9907`)。対角を 1 に正規化してから閾値で判定する |
| LMER-VARCORR-SCALE-OVERFLOW-01 (21) | ― | 記録だけ。lmer の尺度依存の残課題 (No.31/120/121) にまとめる |
| EIGEN-VECTOR-NORMALIZE-OVERFLOW-01 (22) | `eigen([[1,2],[3,4]] × 1e200)`、`eigen([[0,−1e200],[1e200,0]])` | **誤検出。** 固有ベクトルは 1 倍のときと同じで、単位長 |

## A. lmerAnova と適合後のデータの変更

- **原因:** lmer は与えられたデータオブジェクトを参照のまま保存し、lmerAnova はそこから仮説 (Type I・II は X'X に依存) を作り直していた。比較の ML の再当てはめも同じ
- **修正:**
  - lmer の適合時に、データの各列の複製 (`snapshot`) を保存する
  - lmerAnova の仮説と、比較のための ML の再当てはめは、`snapshot` から作る (R が、当てはめ時のモデルフレームを使うのと同じ)
  - 比較の「同じデータオブジェクト」の判定は従来どおり参照で行い、さらに `snapshot` の値どうしも比べる。同じオブジェクトでも、当てはめの間に値を変えていればエラー ("all models must be fit to the same data object")
- fit ごとに、データ 1 つ分の複製のメモリを使う

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| fit の後に z・y を書き換えて `lmerAnova(fit, { type: "I" })` | x の F 1156.14 | 1926.92 (書き換え前と同じ) |
| 2 つの fit の後に y を書き換えて比較 | 書き換え後のデータで ML に当てはめ直す | 書き換え前と同じ表 |
| 書き換え前と後のそれぞれの fit を比較 | 比較する | エラー |

## B. jointDenDF

- ν = Inf の項を極限の 1 とした。すべての ν が等しいかの判定でも、Inf どうしを等しいとした (Inf − Inf = NaN だった)
- `[Inf, Inf]` は Inf、`[Inf, 5]` は 2e/(e − 2)、e = 1 + 5/3
- 有限の ν だけなら、式は変わらない
- テストのため、`jointDenDF` をモジュールから export した (パッケージの公開 API には含めていない)

## テスト

- `test/review28.test.ts` を追加した。src を `git stash` で戻すと、3 件すべてが失敗する
  - jointDenDF の 1 件は、修正前は export していないための失敗。値が NaN になることは式から明らか
- 全体テスト: 2150 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の lmer の節に、比較のデータの判定とスナップショット、結合 F 検定の自由度を書いた
