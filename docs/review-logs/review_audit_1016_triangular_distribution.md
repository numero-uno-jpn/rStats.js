# Audit #1016 — Triangular distribution

- 対象: `src/distributions/triangular.ts`、dpq boundary helpers、midpoint helper
- 監査時 HEAD: `51ac0d01795fe301c6428debd788e4862e91f111`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #428はrandom generatorのfinite-only guard / RNG draw sequenceが対象で、d/p/q関数とは別。

## 確認内容

- valid: finite a/b/c、a<b、a<=c<=bを確認。modeが両端に一致する三角分布も許容。
- dtriang1: xの支持域端、mode、a=c / b=c、wide intervalでのhalf scaling、densityのlinear/log、s比subnormal時の長さlog差分を確認。
- tails: mode左/右のnear/far tail、正の項によるfar-tail補数、subnormal log probabilityでのlogFarを確認。
- ptriang1: q<=a/q>=b、mode左右のtail選択、v>0.5のlog1p補数、subnormal near/far logの選択を確認。
- qtriang1: p端点、mode端点、lower/upper tail、logPでのsqrt(exp(p))、tiny-tail時のmode-end補正、wide intervalでのrecursive half scaling、support内へのrounding clampを確認。
- halfIfOverflow: b-a overflow時に全位置を1/2 scaleし、densityをh倍、log densityにlog(h)を加える変換を確認。
- 既存#428はrtriangの乱数消費・許容パラメータの問題であり、今回の決定論的d/p/q関数に重複しない。

## 固定入力セット

```ts
const densityCases = [
  [-1, -1, 1, -1], [1, -1, 1, 1],
  [0, 0, 1, 0], [0, 0, 1, 1],
  [3.1e-190, 0, 1.24e133, 5.58e132],
  [0, -1e308, 1e308, 0],
];
const cdfCases = [
  [-1, -1, 1, 0], [1, -1, 1, 0],
  [0, 0, 1, 0], [0.5, 0, 1, 0],
  [3.1e-190, 0, 1.24e133, 5.58e132],
  [2.28e-257, 0, 1.33e63, 0],
];
const quantileCases = [
  [0, 0, 1, 0], [1, 0, 1, 0], [0.5, 0, 1, 0],
  [-1000, 0, 1e308, 0, true],
  [1.6e-8, 0, 1.03e-316, 8.7e-317, false, false],
  [0.9, -1e308, 1e308, 0],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。modeが端点にある場合とwide/subnormal intervalの別経路を重点確認した。Vitest、Node、extraDistr実行は未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
