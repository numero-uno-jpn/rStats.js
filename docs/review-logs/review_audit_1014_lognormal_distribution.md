# Audit #1014 — Log-normal distribution

- 対象: `src/distributions/lognormal.ts`、normal CDF/quantile、DD log/exp、erfcx helpers
- 監査時 HEAD: `7a069be38f70543a9b74f7548f984e1280cf002a`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: dlnorm / plnorm / qlnormの該当Issue検索で今回の対象に一致する未登録候補なし。

## 確認内容

- dlnorm: x<=0、x=0、sdlog<0/0/Infinity、meanlog±Infinity、x=Infinity、log density、subnormal x、z² overflow、全指数での相殺を確認。
- zOf: log(x)-meanlogのDD差、sdlog=1、巨大sdlogの2^-64 scale、subnormal比を確認。
- halfSquare: z≈1e150付近のscale-square-rescale、z²/2 overflow、low part切捨ての影響を確認。
- pnormDD/smallTail: 左右tail、erfcx、logP、1-Φ(-z)の補数構成、巨大zのDD二乗を確認。
- qlnorm: p端点、sdlog<=0、sdlog/meanlog非有限、巨大sdlog、DD exponent、expのoverflow/underflow、qnorm結果のNewton補正を確認。
- Rとの整合: density linear modeのexp(-z²/2)がunderflowしたら0を返す経路は、ソースコメントにあるR fixtureの挙動と一致する意図的な互換処理として扱った。

## 固定入力セット

```ts
const densityCases = [
  [0, 0, 1, false], [-1, 0, 1, true],
  [1, 0, 0, true], [Math.exp(1), 1, 0, false],
  [Infinity, 0, 1, true], [1, Infinity, 1, true],
  [1e-294, -0.21, 18.5, true],
  [1e-100, -100, 3, false],
  [2e-105, 1.53, 6.36, false],
];
const cdfCases = [
  [0, 0, 1], [Infinity, 0, 1],
  [2, 0, 1e302], [Number.MIN_VALUE, 0, 1e-300],
  [1e308, -1e308, 1e308],
];
const quantileCases = [
  [0, 0, 1], [1, 0, 1], [0.5, 1, 0],
  [1e-30, 0, 9e307], [0.5, 1e308, 1e302],
  [Number.MIN_VALUE, -1e308, 1e-300],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。特に巨大sdlogのDD除算、z²のoverflow回避、極端tailのerfcx経路、qlnormのquantile補正を追跡した。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
