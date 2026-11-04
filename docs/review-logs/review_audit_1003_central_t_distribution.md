# Audit #1003 — Central Student t distribution

- 対象: `src/distributions/t.ts` の central `dt/pt/qt` 経路、および `src/distributions/nt.ts` の共有巨大df helper
- 監査時 HEAD: `d12bf15ecfbe8b901c358b5e6dbc82b0103c75b0`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: central t / dt / pt / qt の既存Issue検索で該当する未登録候補なし。

## 確認内容

- dt: df<=0、x非有限、df=Infinity、巨大df近似、tiny df密度近似、x² overflow、x²/dfの極端値、log/linear出力を確認。
- pt: df<=0の検証順、q=±Infinity、df=Infinityの正規分布極限、q=0、tiny dfの漸近式、huge df近似、左右tailの小さい側の直接計算を確認。
- qt: NaN、確率範囲外/端点、df<=0、df=Infinity、tiny dfの解析的反転、huge df近似、deep-tail初期値、最大有限doubleを超えるquantile判定、Newton inversionを確認。
- dtCore: Loaderのstirlerr/bd0を用いた指数構成、x²のDD演算、x²/dfが大きい場合のlog1p式、分母sqrt項を確認。
- betaArgs: t²やdfが大きい場合の共通2冪scale、DD分母、xと1-xの保持を確認。
- R 4.6.1相当の `qt.c` の処理順も参照。R実装も確率端点処理をdf<=0検証より先に行うため、`qt1` の当該順序は不具合ではない。

## 固定入力セット

```ts
const densityCases = [
  [0, 0], [Infinity, 0.5], [1e200, 1e10],
  [0, 1e-320], [1e200, 1e-200], [1e100, 1e300],
];
const cdfCases = [
  [-Infinity, 5], [Infinity, 5], [0, 5],
  [-3.5e151, 4.3e121], [-5.05, 2.4e-242],
  [1e100, 1e120],
];
const quantileCases = [
  [0, 0], [1, 0], [0.5, 0], [0.5, Infinity],
  [1e-5, 1e-310], [1.6e-243, 1e120],
  [3.048e-196, 0.633],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。特にqtの端点処理とdf検証の順序はRの実装と一致し、誤検出を回避した。Vitest、Node、R実行は未実施。固定入力は経路確認用であり、実測値を主張しない。ソースコード変更なし。
