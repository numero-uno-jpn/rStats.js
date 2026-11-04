# Audit #1021 — Studentized range distribution and Brent quantile solver

- 対象: `src/distributions/tukey.ts`、Clenshaw-Curtis integration、Gauss-Legendre window integrals、log-tail integration、monotone root solver
- 監査時 HEAD: `d0a7fa3022525b566baa0c32b87cf826341f047f`
- 判定: 新規不具合1件を確認しIssue登録
- Issue: [#513 Tukey quantile Brent solver rotates bracket values incorrectly during swap](https://github.com/numero-uno-jpn/rStats.js/issues/513)

## 確認内容

- Clenshaw-Curtis weights / Chebyshev tail coefficient、16→32→64→128 refinement、piece bisection、MAX_PIECES上限を追跡。
- Normal window integral: narrow intervalのGL8、shifted double-double補正、upper/lower tail差分、logPhiWindowを確認。
- Outer integral: gamma変数変換、peak search、logPeakIntegrate、underflow時のlog-domain再積分、df=Infinity極限を確認。
- Tail: 小さい側の直接積分、1−tailの補数、TINY_Q以下の漸近スケール、memo cache keyを確認。
- Quantile: smallerTail選択、log probability residual、初期df=Infinity解、finite-df solveMonotone、Brent bracket expansionを追跡。
- validParamsはk>=2、df>=2、r>=1、finite k/r、non-NaN dfを要求し、df=Infinityを許す。

## 確定した問題

`brent()` 内の `Math.abs(fc) < Math.abs(fb)` 分岐で、3値のrotateを逐次代入している。

```ts
a = b;
b = c;
c = a;
fa = fb;
fb = fc;
fc = fa;
```

JavaScriptでは同時代入ではなく逐次代入となるため、c/fcに旧a/faではなく旧b/fbが入り、bracket状態が破壊される。正しい回転は旧値を保持して `(a,b,c)=(oldB,oldC,oldA)`、`(fa,fb,fc)=(oldFb,oldFc,oldFa)` とすること。

固定入力の入口:

```ts
const q = qtukey(0.95, 3, 12);
const p = ptukey(q, 3, 12);
```

有限dfのqtukeyはsolveMonotoneからbrentへ進む。実際にこの入力で分岐が発生するか、数値誤差がどの程度かはruntime未実施のため未確認。Issue本文でも特定の出力誤差を断定せず、分岐時の状態破壊を報告した。

## 検証範囲・制約

- 静的な制御フロー追跡。Rのptukey精度は実装コメント記載のとおり比較上の注意点として扱った。
- Vitest、Node、R runtimeは未実施。
- ソースコード変更なし。
