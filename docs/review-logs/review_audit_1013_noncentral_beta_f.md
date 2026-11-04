# Audit #1013 — Noncentral beta and noncentral F distributions

- 対象: `src/distributions/nbeta.ts` の `dnbeta1/pnbeta1/qnbeta1` と `dnf1/pnf1/qnf1`、Poisson mixture / extreme-parameter integral / noncentral chi-square / gamma helpers
- 監査時 HEAD: `49434af8a1fcf418c097365fa6b3115f3e18f135`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #63、#96、#114、#135、#158、#493、#420、#421を照合。すべて今回の確認範囲で既知経路・別APIのIssueとして重複登録せず。

## 確認内容

- Noncentral beta density: a/b境界、x=0/1の端点、ncp=0/極小、j=0成分、b subnormal、a+ncp/2 overflowのlog密度、mixture density recurrenceを確認。
- Noncentral beta CDF: q<=0/q>=1の端点とパラメータ検証順、ncp/2 underflow、leftTailLogのPoisson和、lower/upper・log tailを確認。Rのpnbeta wrapperはsupport端点をパラメータ本体の検証より先に返すため、pnbeta1のq端点の順序は仕様に整合。
- Noncentral beta quantile: a/b/ncpの有限性、p端点、smallest/largest representable x、narrow quantile、mixture/integral method選択、invertContinuousとsearchDoublesを確認。
- Noncentral F transform: fPairでx=mq/(n+mq)と1-xをDDで保持、mq underflow/overflow、m*qとn comparable、fOddsでkのunderflowを扱う経路を確認。既存 #158の補正が存在。
- Noncentral F density/CDF: x=0のm境界、x=Infinityの既知差異 #493、df2=Infinity/hugeDf2のnoncentral-chi-square極限、tinyFx/tiny-q近似、Chernoff bounds、ncp=0 central委譲を確認。
- Noncentral F quantile: p端点、df2=Infinity極限、Chernoff bounds at Number.MIN_VALUE/MAX_VALUE、Patnaik開始値、narrowQuantile、invertContinuous、double-grid searchを確認。
- #420/#421はrandom generatorの明示ncp経路であり、今回のd/p/q関数とは別。#418はrandom betaのshape-zero pathであり、density/CDF/quantileとは別。

## 固定入力セット

```ts
const betaDensityCases = [
  [0, 1, 2, 0.1], [1, 2, 1, 0.1],
  [0.5, 0.75, Number.MIN_VALUE, 0.1],
  [1, 1.5e308, 1, 1.5e308],
  [0.5, 1e14, 2, Number.MIN_VALUE],
];
const betaCdfCases = [
  [0, 1, 2, 0.1], [1, 1, 2, 0.1],
  [0.5, 1e14, 2, Number.MIN_VALUE],
  [0.5, 1e15, 1e-200, 1e12],
];
const betaQuantileCases = [
  [0, 1, 2, 1], [1, 1, 2, 1],
  [1e-300, 1e-200, 1e200, 1e100],
  [0.9999999999999999, 1e200, 1e-200, 1e200],
];
const fCases = [
  [0, 2, 5, 1], [Infinity, 2, 5, 1],
  [1e100, 1e-200, 1e200, 1],
  [1e200, 1e100, 1e300, 1e300],
  [2.9957, 2, 1e308, 1],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。既存Issueの修正箇所を現行コードで確認し、random generatorの問題を分布関数へ誤って拡張しなかった。Rのpnbeta.cの端点処理も照合した。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測結果を主張しない。ソースコード変更なし。
