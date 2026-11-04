# Audit #1020 — Laplace distribution

- 対象: `src/distributions/laplace.ts`、DD standardization / expNeg / locationScale helpers
- 監査時 HEAD: `7cc39980e973802b889b22ec35f4c59fec351480`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #110、#338、#425を照合。#110はdensity subnormal計算、#338は同一無限値の差分、#425はrandom generatorのパラメータ許容範囲であり、現在のd/p/q処理の重複ではない。

## 確認内容

- Parameter guard: mu=NaN、sigma<=0/NaN、mu=±Infinity、sigma=Infinityの仕様分岐を確認。
- Density: x/mu同符号Infinity、sigma Infinity、2*sigma overflow、standardizeDDの符号付きlow part、expNeg/expNegOverのsubnormal分岐を確認。
- CDF: sigma Infinityで有限q/muの0.5、mu Infinityでq finiteの0/1、q=mu=±InfinityのNaN、lower/upper tail、log probability、half probabilityの計算を確認。
- Quantile: probability boundaries、sigma Infinity時の±Infinity/mu、mu Infinity、smallerTailでのlog(2t)、locationScaleのoverflow・underflowを確認。
- 比較演算 `lowerTail === z[0] < 0` はJSのrelational precedenceにより `lowerTail === (z[0] < 0)` と評価される。負側小tailを選ぶ条件として整合する。
- #110の巨大sigma density補正と#338の同一無限値NaN処理が現行コードに存在することを確認。

## 固定入力セット

```ts
const densityCases = [
  [0, 0, 1], [0, 0, Infinity],
  [Infinity, Infinity, 1], [-Infinity, -Infinity, 1],
  [Infinity, 0, 1], [1, Infinity, 1],
  [1.447e308 / 2, 0, 1.447e308],
];
const cdfCases = [
  [-Infinity, 0, 1], [Infinity, 0, 1],
  [0, 0, Infinity], [1, Infinity, 1],
  [Infinity, Infinity, 1], [-Infinity, -Infinity, 1],
];
const quantileCases = [
  [0, 0, 1], [1, 0, 1], [0.5, 0, Infinity],
  [0.25, 0, Infinity], [0.75, 0, Infinity],
  [0.1, Infinity, 1], [0.9, -Infinity, 1],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。±Infinity、sigma Infinityの極限、巨大sigma density、両側tailの符号判定を重点確認。Vitest、Node、extraDistr runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
