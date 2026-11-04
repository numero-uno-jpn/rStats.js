# Audit #1019 — Pareto distribution

- 対象: `src/distributions/pareto.ts`、DD ratio/log-ratio and exp helpers
- 監査時 HEAD: `7cc39980e973802b889b22ec35f4c59fec351480`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: dpareto / ppareto / qparetoの該当Issueなし。

## 確認内容

- Parameter guard: a>0、b>0かつfinite b。a=Infinityはbへのpoint-mass limitとして扱う。
- ratio: x/bのDD標準化、x>=1e308でのlog差分、x/b overflow、近い巨大値のlog cancellationを確認。
- Density: x<b / x=Infinity、x=b、a=Infinity、a/b overflow/underflow、(a+1)lr overflow、power subnormal時の平方分割、logとlinear経路の一致条件を確認。
- CDF: q<=b、q=Infinity、a=Infinityのpoint mass、upper tail直接計算、lower-tail補数、subnormal aのlog tailを確認。
- Quantile: probability boundaries、a=Infinity、upper/lower tail、logP、exp overflow時のlog-domain積を確認。
- #425等のrandom API Issueと異なり、d/p/qではb finite guardが仕様として実装されていることを確認。Paretoのa=Infinity極限はコードコメント・extraDistr互換意図と整合。

## 固定入力セット

```ts
const densityCases = [
  [0, 1, 1], [1, 1, 1], [Infinity, 1, 1],
  [1.1e-263, 1640, 7.8e-264],
  [1e308, 1e-317, 1e-300],
  [1.79e308, 1e308, 1e-308],
  [1, Infinity, 1],
];
const cdfCases = [
  [1, 1, 1], [Infinity, 1, 1],
  [318.7, 1.04e-317, 1],
  [1e308, 1e-300, 1e-308],
  [2, Infinity, 1],
];
const quantileCases = [
  [0, 1, 1], [1, 1, 1],
  [-1000, 1e-300, 1e-300, true, true],
  [-745, 1e-300, 1e308, false, true],
  [0.5, Infinity, 1],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。DD比、a/b極端値、a=Infinityの退化極限、log-domain quantileを重点確認。Vitest、Node、extraDistr runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
