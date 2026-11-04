# Audit #1018 — Kumaraswamy distribution

- 対象: `src/distributions/kumaraswamy.ts`、DD log/exp helpers
- 監査時 HEAD: `828cc44e939f41519c394b10b1400de13b301214`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: dkumar / pkumar / qkumarの該当Issueなし。

## 確認内容

- Parameter guard: a>0、b>0かつfinite b。a=Infinityを退化極限として許す仕様を確認。
- Density: x=0/1、support外、a=1/b=1、a=Infinity、subnormal x^a、subnormal a*log(x)、巨大shape、log densityの相殺、linear densityの積順序を確認。
- log1mPow/powOneMinus: x^aが0.5以上/未満、Fast2Sum残差、b-1が大きく誤差を増幅するケース、subnormal baseの指数計算を追跡。
- CDF: q=0/1、a=Infinityのpoint-mass limit、upper-tailを直接評価する経路、lower-tail補数、small xa/bxaでのlog近似、subnormal bのlog tailを確認。
- Quantile: p端点、lower/upper tail、logPでの補数、lu/bのsubnormal/overflow、tiny lower-tail logのDD復元、1/a overflow、逆数丸め補正を確認。
- a=Infinity時のdensity/CDF/quantileは連続分布の通常値でなく、集中する極限として実装コメントと照合した。

## 固定入力セット

```ts
const densityCases = [
  [0, 0.5, 2], [1, 2, 0.5], [0.5, 1, 1],
  [1 - 1.1e-16, 2.6e-300, 0.29],
  [0.305, 486, 3.8e247],
  [0.2, 0.42, 1.85e-317],
  [0.5, Infinity, 2],
];
const cdfCases = [
  [0, 2, 3], [1, 2, 3],
  [0.2, 0.42, 1.85e-317],
  [0.2, 0.42, 1e-300],
  [0.5, Infinity, 2],
];
const quantileCases = [
  [0, 2, 3], [1, 2, 3],
  [-744.24, 1.13, 0.124, true, true],
  [4.8e-52, 9.9e-314, 2],
  [0.5, Infinity, 2],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。subnormal shape、a=Infinityの退化極限、極小log-tail、逆数丸め補正を重点確認。Vitest、Node、extraDistr runtimeは未実施。固定入力は境界経路の点検用で、実測値を主張しない。ソースコード変更なし。
