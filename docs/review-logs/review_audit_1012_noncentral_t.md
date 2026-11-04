# Audit #1012 — Noncentral Student t distribution

- 対象: `src/distributions/nt.ts`、normal/gamma special functions、adaptive integration、continuous quantile inversion
- 監査時 HEAD: `243d341742abc41566ca9d617cb3b50f8d6ad058`
- 判定: 今回の確認範囲で新規不具合なし
- 既存Issue検索: noncentral t / nct / ncpの該当Issueなし。

## 確認内容

- dnt1: df<=0、df最小subnormalのhalvable補正、x/ncpの非有限値、df=Infinity、HUGE_DF正規近似とcentral-tail近似を確認。
- pnt1: q=±Infinity、ncp=±Infinity、df=Infinity、q=0での厳密なΦ(-δ)、巨大dfのratio/tail近似、lower/upper・log tailを確認。
- qnt1: 確率端点、df<=0、ncp=±Infinity、df=Infinity、巨大dfの正規/central tail量子化、極端ncpでの有限double超過、far-tail power law、small-dfの無限quantile判定を確認。
- 積分経路: log(U/a)変数変換、peak Newton、台形積分のstep halving、formula Bへの切替、small/large dfのLaplace近似、large deltaのDD補正を追跡。
- Mills ratio、erfcx、gammaLogのsubnormal shape、ddExp/expm1mxの小値・大値経路を確認。
- 量子化関数の符号決定: P[T<=0]=Φ(-δ)を境界に左右の絶対値問題へ変換する実装を追跡。lowerTail=false時の反転も確認。
- hugeDfTailの符号条件 `t < 0 === lowerTail` はJavaScriptの比較優先順位により `(t < 0) === lowerTail` と評価される。符号と要求tailの対応は正しい。

## 固定入力セット

```ts
const densityCases = [
  [0, 1, 0], [Infinity, 1, 0], [-Infinity, 1, 0],
  [1, Number.MIN_VALUE, 0], [1e300, 1e201, 1e-10],
  [1e150, 1e200, 1e180], [-1e150, 1e200, -1e180],
];
const cdfCases = [
  [-Infinity, 1, 0], [Infinity, 1, 0],
  [0, 1e-320, 1e4], [0, 1, Infinity], [0, 1, -Infinity],
  [-4.05e269, 3.586e307, 1],
  [1e200, 1e201, 1e180],
];
const quantileCases = [
  [0, 1, 0], [1, 1, 0], [0.5, 1, Infinity],
  [0.5, 1, -Infinity], [0.9, 2, 1e308],
  [1e-300, 1e-200, 1e4],
  [0.9999999999999999, 1e201, 1e180],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。符号反転・tail選択、巨大df近似、±Infinityの分布極限を重点確認した。Vitest、Node、R runtimeは未実施。固定入力は境界経路の点検用で、実測値を主張しない。ソースコード変更なし。
