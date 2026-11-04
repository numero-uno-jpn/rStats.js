# Audit #1007 — Weibull distribution endpoints and extreme scaling

- 対象: `src/distributions/weibull.ts` と DD exponential / dpq helpers
- 監査時 HEAD: `c512b64d8945499662a6e457c024bd9b85c81cc6`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #111、#408、#451を確認。#451はrandom generatorのzero-scale経路で、今回のdensity/CDF/quantileとは別。

## 確認内容

- dweibull: shape/scale<=0、NaN/Infinity、x<0/0/Infinity、scale=Infinity、shape=Infinity、x/scaleのoverflow/subnormal、logU・logRatio・DD exponentを確認。
- pweibull: q<=0、q=Infinity、shape/scale無限値、q/scaleのNaN/Infinity、lower/upper tail、logPでのsubnormal t、expm1/log1mExpを確認。
- qweibull: パラメータ検証、確率境界、lower/upper・logP、tiny lower-tailのDD反転、scaleとの積がsubnormal/overflowとなる場合、無限shape/scale経路を確認。
- cpow: 1^Infinityを1として扱う補助関数と、他の無限指数のMath.pow委譲を確認。
- #111: 近接するshape/scaleのlog比にlog1p差分を使う既存修正を確認。
- #408: random generator固有のscale処理であり、density/CDF/quantileとは対象外。重複Issue化せず。
- #451: zero-scale random generator issueであり、現在のAPIはscale<=0をinvalidとして拒否する設計。対象範囲の再現ではないため登録せず。
- docs/differences-from-r.mdに記載されたscale=Infinityのdensity極限（有限x>0で0）は、現行実装と一致。

## 固定入力セット

```ts
const densityCases = [
  [-1, 2, 1], [0, 0.5, 1], [0, 1, 1], [0, 2, 1],
  [1, Infinity, 1], [1, 2, Infinity],
  [1.9e-255, 6.6e306, 98.6],
  [2 ** 52 - 0.5, 2 ** 52, 2 ** 52 - 0.5],
];
const cdfCases = [
  [-1, 2, 1], [0, 2, 1], [Infinity, 2, 1],
  [1e-5, 1000, 1], [1e300, 0.169, 1.18e-86],
];
const quantileCases = [
  [0, 2, 1], [1, 2, 1], [0.5, 2, Infinity],
  [-720.6156070081367, 1, 1.3552e257, true],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。既存の仕様差とrandom generator issueをdensity/CDF/quantileに誤って拡張しないよう分離した。Vitest、Node、R oracleは未実施。ソースコード変更なし。
