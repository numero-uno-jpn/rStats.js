# Audit #1022 — Geometric distribution and discrete quantile boundaries

- 対象: `src/distributions/geometric.ts`、Loader binomial raw probability、DD arithmetic、discrete integer/fuzz helpers
- 監査時 HEAD: `1e73a58c0fea50b34117f38cb1ad90d4d68382b9`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #327を確認。x+1が2^53以降で正確に表現できない上側tailの補正が現行コードに存在。

## 確認内容

- prob validation: prob<=0、prob>1、NaN、prob=1の端点を確認。
- probPair: p<=0.5とp>0.5で小さい側を正確なDD baseとして保持する処理を確認。
- dgeom: xの負値、非整数、±Infinity、0、巨大整数、log mode、q^nのLoader経路とn>=1e290のscaled DD経路を追跡。
- pgeom: q<0、q=Infinity、prob=1、countAtMostによる非整数q、lower/upper tail、logP補数、upper(x)のx+1非exact経路を確認。
- qgeom: probability端点、prob=1のdegenerate distribution、lower/upper tail、logP、log(1-p)のDD、離散quantile fuzz、整数jump近傍、結果の非負clampを確認。
- qPow: n>=1e290でのtiny probのlog(1-p)近似、scaled product、exp underflowを追跡。
- Existing #327の補正は、x+1が正確でない場合にq^x*qとして計算し、指数が1つずれる問題を回避している。

## 固定入力セット

```ts
const densityCases = [
  [-1, 0.3], [0, 0.3], [1, 1], [1.5, 0.3],
  [2 ** 53, 1e-14], [8.7e299, 1.1e-300],
  [1e290, Number.MIN_VALUE], [Infinity, 0.5],
];
const cdfCases = [
  [-1, 0.3], [0, 0.3], [1.5, 0.3], [Infinity, 0.3],
  [2 ** 54, 1e-14], [8.7e299, 1.1e-300],
  [1e290, Number.MIN_VALUE],
];
const quantileCases = [
  [0, 0.5], [1, 0.5], [0.75, 0.5],
  [0.7500000000000866, 0.5],
  [0.9999999999, 1e-10],
  [-744.24, 1.13e-300, true, true],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。2^53超のx+1、巨大n×log(q)、subnormal success probability、離散quantile jumpのfuzzを重点確認。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測値を主張しない。ソースコード変更なし。
