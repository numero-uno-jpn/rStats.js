# Audit #1015 — Uniform distribution

- 対象: `src/distributions/uniform.ts`、dpq boundary helpers
- 監査時 HEAD: `6e6229f9478ef3f722dbe8846153aaec6bdd2e10`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: dunif / punif / qunifの該当Issue検索で今回の対象に一致する候補なし。

## 確認内容

- dunif: max<=min、x=min/max端点、x outside support、finite/infinite endpoints、max-min overflow、linear/log densityを確認。Rのdunif.cも照合し、densityは非有限rangeを明示拒否せず、幅がInfinityなら0 / -Infinityを返す仕様であることを確認。
- punif: max<min、非有限min/max、q端点、左右tail、max-min overflow、half scalingを確認。Rのpunif.cとパラメータ検査順・tail式が一致。
- qunif: max<min、非有限min/max、min=maxのdegenerate case、probability/log-probability端点、lower/upper tail、small p保持、range overflow時のhalf interpolationを確認。
- halfIfOverflow: max-minが有限かどうかで両端を1/2 scaleする経路と、log densityの+log(h)補正を追跡。
- Upper-tail quantile: p<0.5ではmax - p*widthを使用し、1-pで小さい確率を失わない経路を確認。logPでは-expm1(p)を使用する分岐も確認。

## 固定入力セット

```ts
const densityCases = [
  [0.5, 0, 1], [-1, 0, 1], [1, 0, 1],
  [0, -1e308, 1e308],
  [0, -Infinity, Infinity],
  [Infinity, -Infinity, Infinity],
  [0, -Infinity, 1],
];
const cdfCases = [
  [-Infinity, 0, 1], [0, 0, 1], [1, 0, 1],
  [0, -Infinity, 1], [0, 0, Infinity],
  [0, -1e308, 1e308],
];
const quantileCases = [
  [0, 0, 1], [1, 0, 1], [0.5, 1, 1],
  [1e-300, -1e308, 1e308],
  [1e-300, -1e308, 1e308, false, false],
  [-1000, -1e308, 1e308, true, true],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。dunifとpunif/qunifで非有限rangeの扱いが異なる点はRソースと一致するため、誤検出しなかった。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測値を主張しない。ソースコード変更なし。
