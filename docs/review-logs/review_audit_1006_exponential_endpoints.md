# Audit #1006 — Exponential distribution and infinite-rate endpoints

- 対象: `src/distributions/exponential.ts` と `src/internal/dpq.ts` / DD exponential helpers
- 監査時 HEAD: `4d0429d487fcde0a8806707616a5f01c3aa376b6`
- 判定: 新規不具合1件を確認しIssue登録
- Issue: [#511 qexp returns infinite endpoints when rate = Infinity, unlike R's scale-zero result](https://github.com/numero-uno-jpn/rStats.js/issues/511)

## 確認内容

- dexp: rate<0/Infinity、rate=0、x<0/0/Infinity、rate*xのoverflow/subnormal、DD exponent、densityの再指数化を確認。
- pexp: rate<0/0/Infinity、q<=0/Infinity、rate*qのNaN/Infinity、lower-tailのexpm1/log1mExp、subnormal積のlog補正を確認。
- qexp: rate<0/0/Infinity、確率範囲外/端点、lower/upper tail、logP、expNegOverによるsubnormal確率の反転を確認。
- Rの `src/nmath/qexp.c` と比較。Rはscale<0のみを拒否し、`-scale * R_DT_Clog(p)` を返すため、scale=0かつ該当端点では0×Infinity=NaNとなる。

## 確定した問題

`qexp1()` はrateを評価する前に一般的な確率境界を返すため、rate=Infinityの端点でRと異なる。

固定再現入力:

```ts
qexp(1, { rate: Infinity });
qexp(0, { rate: Infinity, lowerTail: false });
```

現行コードではどちらも `quantileBoundaries()` がInfinityを返して早期returnする。Rではrate=Infinityに対応するscale=0となり、qexp.cの積が0×InfinityとなるためNaN。ファイル先頭コメントの「rate=0, InfはRと一致」とも矛盾する。Issue #511に登録済み。

## 検証範囲・制約

- 固定入力による静的な制御フロー追跡。
- Rのqexp.cソースを参照。Vitest、Node、R runtimeは未実施。
- ソースコード変更なし。
