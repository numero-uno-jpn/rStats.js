# Audit #1011 — Central and noncentral chi-square distribution

- 対象: `src/distributions/chisq.ts`, `src/distributions/nchisq.ts`、Poisson mixture / Bessel asymptotic / gamma-tail / quantile inversion helpers
- 監査時 HEAD: `2343c76c176c25fa16f68b4a0a721ebee2814de6`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #26、#115、#147、#157を確認。該当する既存修正・コメントを追跡。

## 確認内容

- central wrapper: df<0の最小subnormalがdf/2で-0へ丸められるケースを含め、central gamma委譲の前処理を確認。既存 #26 のガードを確認。
- dnchisq1: NaN/Inf/負パラメータ、x<0/0/Inf、df=0の原点、ncp=0、negligibleNcp近似を確認。Rのdnchisq.cと照合し、x=0かつdf<2でInfを返す順序はRと一致することを確認。
- pnchisq1: q<0/0/Inf、df=0の原点point mass exp(-ncp/2)、ncp=0 central gamma経路、Chernoff far-tail bound、lower/upper・log tailを確認。
- qnchisq1: df/ncp無効値、確率端点、ncp=InfinityのlogP端点、df=0の原点質量を使ったquantile=0判定、Patnaik/Wilson-Hilferty初期値、narrow quantile、bracket上限、double格子探索を確認。
- Poisson mixture: gamma component recurrence、mode選択、double-double補正、tail truncationとlarge-ncp fallbackを追跡。
- Bessel asymptotic: Hankel/Debye切替、巨大引数の指数差、rootDiff/sqrtDD、積分tailのlog-concavity停止条件を追跡。
- subnormal x/2: odd-last-bit補正、density/CDFの再スケール、既存 #115/#147の対策を確認。
- qnchisq Infinity終端: qchisqのbracketがInfinityでCDFが終わらない既存 #157のガードを確認。

## 固定入力セット

```ts
const densityCases = [
  [-1, 0, 2], [0, 0, 2], [0, 2, 0],
  [0, 0, 1e-300], [1e-320, 0, 24.3],
  [3e307, 0.5, 2.2e-320],
  [1.79e308, 3, 1e308],
];
const cdfCases = [
  [-1, 0, 2], [0, 0, 2], [0, 0, 0],
  [Number.MIN_VALUE, 0, 100],
  [7.02e-315, 0.5, 24.3],
  [555, 1.01, 80],
  [Infinity, 4, 1e6],
];
const quantileCases = [
  [0, 0, 2], [1, 0, 2], [0.1, 0, 2],
  [0.5, 3, 0], [0.5, 3, Infinity],
  [1e-300, 1e100, 1e100],
  [0.9999999999999999, 1e308, 1e308],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。df=0の原点密度・CDF point mass・quantileの境界処理は相互に区別され、Rソースとの順序差も問題ではないことを確認した。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
