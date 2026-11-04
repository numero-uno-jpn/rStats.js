# Audit #1009 — Cauchy distribution extreme tails and location-scale boundaries

- 対象: `src/distributions/cauchy.ts` と locationScale / DD helpers
- 監査時 HEAD: `c8ad712ea9c2f8b69c774246124fe92e0c119e5d`
- 判定: 今回の確認範囲で新規不具合なし
- Issue: Cauchy / dcauchy / pcauchy / qcauchyの既存Issue検索で今回の範囲に該当する新規候補なし。

## 確認内容

- dcauchy: scale<=0、NaN/±Infinity、x-location overflow、z overflow、subnormal scale、tinyScaleDensity、frexpによる指数復元、π*scale overflowを確認。
- pcauchy: d=q-location overflow時のhalfDistance、|z|<=1の中央域、反転した小さいtail、w=scale/|d| underflow、log tailのlog(w)-log(π)を確認。
- qcauchy: p/logPの範囲と端点、scale=0/negative/Infinity、tinyTail、tan近傍の計算切替、locationScale復元を確認。
- Rのqcauchy.cと比較し、確率の妥当性検査→scale=0でlocation返却→scale Infinity拒否の順序が一致することを確認。
- 現行実装がscale=Infinityで独自の極限値を返す点は、コードコメント・差異文書に明記された仕様として扱い、新規Issue化しない。

## 固定入力セット

```ts
const densityCases = [
  [0, { scale: 0 }], [Infinity, { location: Infinity }],
  [1.79e308, { location: -1.1e307, scale: 2.7e296 }],
  [-2.165e-309, { scale: 1.578e-312 }],
  [1e-10, { scale: 5e-324 }],
  [0, { scale: 1.28e308 }],
];
const cdfCases = [
  [-Infinity, {}], [Infinity, {}],
  [1.79e308, { location: -1.1e307, scale: 2.7e296, lowerTail: false }],
  [0, { scale: Infinity }],
];
const quantileCases = [
  [0, { scale: 0 }], [1, { scale: 0 }],
  [0.5, { scale: Infinity }], [0.25, { scale: Infinity }],
  [1e-200, { scale: 1e308 }], [1e-300, { scale: 5e-324 }],
];
```

## 結論・制約

今回の静的確認で確定できる新規不具合はなかった。Rの処理順と差異文書を確認し、意図的なscale=Infinityの挙動を誤検出しなかった。Vitest、Node、R oracleは未実施。ソースコード変更なし。
