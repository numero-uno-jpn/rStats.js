# Audit #1010 — Beta distribution support boundaries and degenerate shapes

- 対象: `src/distributions/beta.ts`、incomplete-beta、Loader、continuous quantile inversion
- 監査時 HEAD: `796ea76ca11809c772893331c78669014fa2a3a1`
- 判定: 新規不具合1件を確認しIssue登録
- Issue: [#512 pbeta checks q < 0 before zero-shape point masses, reversing R's endpoint behavior](https://github.com/numero-uno-jpn/rStats.js/issues/512)

## 確認内容

- dbeta: a/b<0、shape=0/Infinity、point mass、x<0/0/1/>1、a=1/b=1の解析式、a+b overflow、x・1-x subnormal、DD Loader exponent、densityの再指数化を確認。
- pbeta: q<0/0/1/>1、shape=0/Infinity、point mass、lower/upper tail、logP、incomplete-beta呼び出し順を確認。
- qbeta: 確率境界、shape=0/Infinityのpoint mass、smaller-tail変換、左右半区間への分岐、stepQuantile、betaQuantileGuess、gamma極限初期値、invertContinuousを確認。
- 既存Issue検索でpbeta zero-shape negative-qの重複候補なし。
- Rのpbeta.cと比較し、point massをq<0より先に扱う必要があることを確認。

## 確定した問題

`pbeta1()` はq<0の支持域外判定を、shape=0等のpoint-mass判定より先に実行する。Rの `pbeta_raw()` はq>=1のみを先に判定し、その後point massを評価してからq<=0を処理するため、negative qで結果が逆転する。

固定再現入力:

```ts
pbeta(-1, 0, 2); // current: 0; R: 1
pbeta(-1, 0, 0); // current: 0; R: 0.5
pbeta(-1, 0, 2, { lowerTail: false }); // current: 1; R: 0
```

Issue #512に登録済み。logPでも同じtail選択順の差が波及する。

## 検証範囲・制約

- 固定入力による静的な制御フロー追跡。
- Rのpbeta.cソースを参照。Vitest、Node、R runtimeは未実施。
- ソースコード変更なし。
