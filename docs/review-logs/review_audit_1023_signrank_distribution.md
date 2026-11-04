# Audit #1023 — Wilcoxon signed-rank distribution

- 対象: `src/distributions/signrank.ts`、discrete quantile / integer helpers、qnorm
- 監査時 HEAD: `9e0cb3d58a585faf191d2a87728854d5dff2be3a`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: dsignrank / psignrank / qsignrankの該当Issueなし。

## 確認内容

- signrankN: finite n、half-even rounding、n<2^27のsupport exactness limitを確認。
- buildTable: descending subset-sum update、J truncation、SCALE_LIMIT rescale、minTrustedの累積誤差上限、Kahan cumulative sumを追跡。
- table/cache: low/high tableのkey分離、doubling growth、LRU eviction、CACHE_BUDGET、MAX_LEN例外、古いテーブルの再利用条件を確認。
- tableValue: rescale後のlow entriesでtrust boundを下回る場合、low tableを構築し直し、必要時はsまで正確なテーブルを再構築する経路を確認。
- toProb: table scaleとnの指数合成、linear underflow、log probabilityのmantissa/exponent分離を確認。
- dsignrank: noninteger x、support外、対称性によるlower-half lookup、point mass端点を確認。
- psignrank: countAtMostの離散境界、upper tailの対称index、直接計算と補数、log1pを確認。
- qsignrank: quantile boundaries、normal approximation start、discreteQuantileへのcdf callback、support clampを確認。

## 固定入力セット

```ts
const densityCases = [
  [-1, 5], [0, 5], [7.5, 5], [15, 5],
  [5, 2000], [95000, 2000],
  [0, 2 ** 26 - 1],
];
const cdfCases = [
  [-1, 5], [0, 5], [3.6, 5], [7.5, 5], [15, 5],
  [95000, 2000], [100000, 2000],
];
const quantileCases = [
  [0, 5], [1, 5], [0.025, 10], [0.5, 10],
  [0.25, 2000], [0.999999, 2000],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。subset-sum更新順、再スケール後の低位count信頼性、LRU budget、対称tail index、離散quantileを重点確認。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
