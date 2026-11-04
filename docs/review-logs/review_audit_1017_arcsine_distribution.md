# Audit #1017 — Arcsine distribution

- 対象: `src/distributions/arcsine.ts`、beta density/CDF/quantile delegates、DD log/exp helpers
- 監査時 HEAD: `828cc44e939f41519c394b10b1400de13b301214`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: darcsine / parcsine / qarcsineの該当Issueなし。

## 確認内容

- Parameter guard: finite a/b、a<b。非有限境界を拒否することを確認。
- Density: x outside/at endpoints、x-a / b-xの直接計算、product overflow/underflow回避、wide interval時のhalf scalingとlog density補正を確認。
- CDF: q endpoint、nearer-endの選択、z subnormal/zero時のsqrt/log近似、upper-tail反転、log1p補数、beta delegateの引数順を確認。
- Quantile: p endpoint、wide interval時のhalf scale、small tailのlog probabilityからの距離復元、lower/upper tailの反転、upper halfでbから距離を引く経路、support clampを確認。
- qbeta delegateの呼び出しは小tail専用経路を除いて対称性を利用し、1-zの桁落ちを避けている。

## 固定入力セット

```ts
const densityCases = [
  [0, 0, 1], [1, 0, 1], [0.5, -1e308, 1e308],
  [0.5, 0, 1e308], [Number.MIN_VALUE, 0, 1],
  [1 - Number.EPSILON / 2, 0, 1],
];
const cdfCases = [
  [0, 0, 1], [1, 0, 1],
  [Number.MIN_VALUE, 0, 1], [1 - Number.EPSILON / 2, 0, 1],
  [0, -1e308, 1e308], [1e-300, 0, 1e308],
];
const quantileCases = [
  [0, 0, 1], [1, 0, 1], [0.5, -1e308, 1e308],
  [-1000, 0, 1e308, true, true],
  [-745, 0, 1e308, false, true],
  [Number.MIN_VALUE, 0, 1e308],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。端点・巨大幅・subnormal tail・対称tail変換を重点確認。Vitest、Node runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
