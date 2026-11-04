# Audit #1004 — Central F distribution

- 対象: `src/distributions/f.ts` の central `df/pf/qf`、incomplete-beta / gamma-limit / quantile inversion依存部
- 監査時 HEAD: `3d3dac9a464fc0e8a934d938e827d3a2f1f63bbc`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue: #32、#116、#493 などを確認。今回の確認範囲では重複登録せず。

## 確認内容

- df: x<0/0/Infinity、df1/df2<=0、片側/両側Infinity、m=2のx=0、m<2の端点、tiny shape、極端なmx/n比、subnormal、log/linear経路を確認。
- fRatios: m*xの積のoverflow/underflow、2^600 scaling、DD保持、p≈1側のq直接計算、nが小さい場合のfallbackを確認。
- pf: q<=0/Infinity、両df Infinityの一点集中、片側df Infinityのchi-square/gamma極限、pfTiny、betaIncTinyX、betaIncDDへの切替を確認。
- qf: df検証と確率境界、両df Infinityの極限、片側Infinityのgamma quantile、巨大df2のchi-square極限、0/Infinityへ量子化する極端tail、invertContinuousのbracketとlog/linear CDFを確認。
- 既存 #493 の再発有無: dfDensity1は両側Infinity判定とx===Infinity判定をreciprocal-gamma変換より先に行うため、issue本文のNaN経路は現行ソースでは遮断されている。
- 既存 #116 の再発有無: mxが巨大なとき、p≈1/q≈n/(mx)を直接構成するfallbackがあり、issueの対象経路は現行ソースに反映されている。

## 固定入力セット

```ts
const densityCases = [
  [-1, 3, 10], [0, 2, 10], [0, 1, 10],
  [Infinity, Infinity, 1], [Infinity, 1, 1],
  [1e301, 1.4e-312, 6.72], [6.6e-112, 3.2e-173, 1868],
];
const cdfCases = [
  [-1, 3, 10], [0, 3, 10], [Infinity, 3, 10],
  [1e150, 1e150, 1e308], [1e300, 0.169, 1.18e-86],
  [5.43e-319, 1.04, 206159],
];
const quantileCases = [
  [0, 3, 10], [1, 3, 10], [0.5, Infinity, Infinity],
  [1.9e-13, 0.0885, 6e302],
  [5.95e-155, 2875.5, 1],
  [8.8e-131, 0.754, 4.6e-152],
];
```

## 結論・制約

現行ソースに反映済みの既存修正を除き、今回の静的確認で確定できる新規不具合はなかった。Vitest、Node、R oracleは未実施。固定入力は境界経路の点検用であり、実行結果を意味しない。ソースコード変更なし。
