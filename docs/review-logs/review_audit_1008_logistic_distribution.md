# Audit #1008 — Logistic distribution

- 対象: `src/distributions/logistic.ts` と `src/internal/ddexp.ts` のstandardize/location-scale helpers
- 監査時 HEAD: `abee37542a29c4ea31385eac3bc2427f627f264b`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #109、#415を確認。#415はrandom generatorの負scaleに関するもので、d/p/q関数とは別。

## 確認内容

- dlogis: scale<=0、NaN/Infinity、x/locationの±Infinity、差分のoverflow、scaleのsubnormal/巨大値、densityのsubnormal tail、分母overflow時の除算順序を確認。
- plogis: scale<=0、標準化NaN、zの符号に基づく大きい側/小さい側の選択、upper/lower tail、log1p、極端tailのexp underflowを確認。
- qlogis: 確率端点、scale<0/0/Infinity、locationの±Infinity、lowerTail反転、logPでのlogit計算、locationScaleのoverflow/underflowを確認。
- Rのqlogis.cと比較し、確率境界をscale検証より先に扱う順序、scale=0でlocationを返す挙動が一致することを確認。
- #109: 大scale時のdensity分母overflow回避が現行コードにあることを確認。

## 固定入力セット

```ts
const densityCases = [
  [0, { scale: 0 }], [0, { scale: Infinity }],
  [Infinity, { location: Infinity }], [-Infinity, {}],
  [-3.5667e-316, { scale: 4.81926e-319 }],
  [0, { scale: 1.28e308 }],
];
const cdfCases = [
  [-Infinity, {}], [Infinity, {}], [0, { scale: Infinity }],
  [Infinity, { location: Infinity }], [1e308, { location: -1e308, scale: 1e308 }],
];
const quantileCases = [
  [0, { scale: 0 }], [1, { scale: 0 }], [0.5, { scale: 0 }],
  [0.5, { scale: Infinity }], [0.25, { scale: Infinity }],
  [0.5, { location: Infinity, scale: 1 }],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。Rとの処理順の差に見える箇所はRソースと一致することを確認。Vitest、Node、R oracleは未実施。ソースコード変更なし。
