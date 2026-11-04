# Audit #986 — cov/cor の欠損・定数列対角成分を再確認

- 対象: `src/descriptive/cov.ts`
- 監査時 HEAD: `a424c121644dc2dba660f63c8a271a0654e078c1`
- 対象ソース blob: `574aaddc25d99f13ffac22f261962984d803c8df`
- 判定: 今回確認した範囲で新規不具合なし
- 関連既存Issue: #16（closed / not_planned）、#78（closed / completed）

## 確認内容

matrix-only の `cor()` で対角成分を1に上書きする経路を重点確認。
現行コードは `!Number.isNaN(r[i])` の場合だけ1に置き換えるため、定数列や `use="everything"` で欠損を含む列の未定義な自己相関NaNは保持される。Issue #78 が指摘した無条件上書きは現行ソースで修正されている。

`pairwise.complete.obs` の場合は対角上書きをせず、各列自身の有効ペアから計算する。Spearmanではペアごとに欠損除外後の順位を再計算する経路も確認した。

## 検証範囲・制約

- `src/descriptive/cov.ts`、`src/descriptive/rank.ts`、`src/htest/cor.ts` を確認。
- Issue #16 / #78 の原因と現行コードを照合。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし。