# Audit #1005 — Gamma distribution density, CDF and quantile

- 対象: `src/distributions/gamma.ts`、`src/special/igam.ts`、`src/special/igami.ts`、`src/internal/invert.ts`、Loader / DD helpers
- 監査時 HEAD: `71e2cec35e404a0d67513abf10f658a3f6088afc`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: gamma / dgamma / pgamma / qgamma のIssue検索で今回の対象に該当する未登録候補なし。既存 #368 および #245 を照合。

## 確認内容

- gammaScale: rate/scale併記時の積チェック、rate単独の逆数overflow、subnormal rateによるscale=Infinityを確認。
- dgamma1: shape/scaleの無効値、shape=0、x<0/0、shape=1の端点、shape<1/≥1のPoisson関係式、x/scale subnormal、log/linear相殺、densityの再指数化を確認。
- pgamma1: q=±Infinity、shape=0/Infinity、scale=Infinity、x=q/scaleのoverflow/underflow、tiny lower-tailのDD log、upper-tailのlog1mExp補正、overflow時のlog upper tail判定を確認。
- qgamma1/qgammaStd: 確率端点、shape=0/Infinity、scale=Infinity、tiny quantileのlog計算、DiDonato-Morris初期値、deep-tail Wilson-Hilferty初期値、invertContinuous、最大doubleを超えるquantileの扱いを確認。
- #368: standardized xが最大doubleを超える場合の制限は `docs/differences-from-r.md` に明記され、実装コメントとも整合。
- #245: rate/scaleの不整合を検出するgammaScaleの共通検査を確認。
- Rとの意図的差異: `pgamma(Inf, shape, rate)` でsubnormal rateの逆数がInfinityとなるケースは、RのNaNに対してrStats.jsは確率の定義どおり1を返すと差異文書に明記されている。今回の監査では仕様差として扱い、Issue化しない。

## 固定入力セット

```ts
const densityCases = [
  [-1, 2, 1], [0, 0.5, 1], [0, 1, 1], [0, 2, 1],
  [3.1e-272, 4.4e307, 4.1e138],
  [1.2e-289, 40.4, 1.5e-292],
  [8.8e214, 7.4e-105, 1 / 6.3e-268],
];
const cdfCases = [
  [-1, 2, 1], [0, 2, 1], [Infinity, 892.4, 1 / 2.8e-316],
  [1e-310, 5e-324, 1, false, true],
  [1e308, 1e290, 1e-10, false, true],
];
const quantileCases = [
  [0, 2, 1], [1, 2, 1], [0.5, 1e-310, 1],
  [-1e308, 1e308, 1e-308, false, true],
  [3.3e-160, 0.5, 1 / 4.19e-319],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。Rとの差異文書に記載された仕様差は再登録しなかった。Vitest、Node、R oracleは未実施。固定入力は境界経路の点検用であり、実行結果を意味しない。ソースコード変更なし。
