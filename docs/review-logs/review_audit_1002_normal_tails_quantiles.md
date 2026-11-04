# Audit #1002 — Normal distribution tails, quantiles and scaling

- 対象: `src/distributions/normal.ts`, `src/special/erf.ts`, `src/special/ndtri.ts`, `src/internal/ddexp.ts`
- 監査時 HEAD: `6ae5e29856a291aa2638b5917123d8406a737307`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: normal / pnorm / qnorm / dnorm の既存Issue検索で今回の対象に該当する未登録候補なし。

## 確認内容

- pnorm: ±Infinity、q=mean=±Infinity、sd<0/0/Infinity、mean/sdが有限範囲外、標準化差分のoverflow回避、lower/upper tail、logPを追跡。
- lowerTailProb / pnormStd: erfとerfcxの切替点、極端な負値のlog tail、1 - tail と log1p(-tail)の使い分けを確認。
- scaledExpNegHalfSq: 1/16刻み分割、指数のoverflow/underflow、subnormal最終積の経路を確認。
- qnorm: pの通常/log表現での範囲外・端点・±Infinity、lowerTail反転、sd<0/0、mean/sdのaffine復元を確認。
- ndtriLogRefined: log p<-2048のNewton補正、erfcxによるhazard比、巨大xでの二乗overflow時の補正skipを追跡。
- dnorm: sd=0/Infinity、x=mean=±Infinity、標準化値overflow、log密度の二乗overflow、tiny sd向けtinySdDensityの分岐を確認。

## 固定入力セット

乱数なし。以下は境界経路を点検するための入力値であり、実行結果やRとの数値一致を主張するものではない。

```ts
const pCases = [
  [-Infinity, { mean: 0, sd: 1 }],
  [Infinity, { mean: 0, sd: 1 }],
  [0, { mean: 0, sd: 0 }],
  [1, { mean: 0, sd: -1 }],
  [-40, { logP: true }],
  [-1.5e154, { logP: true }],
  [1e308, { mean: -1e308, sd: 1e308 }],
  [Infinity, { mean: Infinity, sd: 1 }],
];
const qCases = [
  [0, {}], [1, {}], [0.5, { sd: 0 }],
  [-100000, { logP: true }],
  [-1e5, { logP: true, lowerTail: false }],
  [0.5, { mean: 1e308, sd: 1e308 }],
];
const dCases = [
  [0, { sd: 0 }], [1, { sd: 0 }],
  [0, { sd: Infinity }], [Infinity, { mean: Infinity }],
  [4.85e-319, { sd: 1.7e-322 }],
  [-1.59e-321, { sd: 3e-323 }],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。既知の極端log-tail問題（Issue #33）に対応する overflow 回避が実装されていることを確認。Vitest、Node、R oracleは未実行。ソースコード変更なし。
