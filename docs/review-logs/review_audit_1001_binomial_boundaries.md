# Audit #1001 — Binomial distribution boundary and tail paths

- 対象: `src/distributions/binomial.ts` と dpq / discrete / integer / incomplete-beta / Loader 依存部
- 監査時 HEAD: `51f8fc361962e8cd8ff7680bf37e812a7b57b488`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: binomial / dbinom / pbinom / qbinom の既存Issueを検索したが、今回の確認範囲に該当する重複候補なし。

## 確認内容

1. dbinom: NaN、負/非有限size、probの[0,1]外、xの負/非有限/非整数/支持域外、size=0、prob=0/1、size=Infinityの特例、half-integer入力を追跡。probと1-probはDDで保持される。
2. pbinom: q<0、q=±Infinity、prob=0/1、支持域上端、sizeの丸め/無効値を確認。CDFの離散境界はcountAtMostを経由する。
3. pbinomRaw: x+1が正確に表現できる通常域ではincomplete beta、2^53近傍ではbeta関数とpmfによる補正を使い分ける分岐を確認。upper-tail/log-domain fallbackも追跡。
4. qbinom: R互換のhalf-to-even size丸め、確率境界、prob=0/1、size=0、Cornish-Fisher初期値、離散探索を確認。
5. ベクトル化ラッパーのoptions既定値を確認。

## 固定入力セット

```ts
const densityCases = [
  [-1, 0, 0.5], [0, 0, 0], [0, 10, 0], [10, 10, 1],
  [3.6, 10, 0.3], [10, 10, 0.3], [0, Infinity, 0], [0, Infinity, 0.5],
];
const cdfCases = [
  [-Infinity, 10, 0.5], [-0, 10, 0.5], [3.6, 10, 0.3],
  [10, 10, 0.3], [Infinity, 10, 0.5], [1e16, 2e16, 0.5],
];
const quantileCases = [
  [0, 10, 0.5], [0.5, 10, 0.5], [1, 10, 0.5],
  [0.5, 10.5, 0.3], [0.5, 0, 0.3],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。2^53近傍のCDF補正式は整数境界の消失を意識した設計であり、誤りを特定できなかった。Vitest、Node、R oracleは未実行。固定入力は監査対象の境界を明示するもので、実行結果を意味しない。ソースコード変更なし。
