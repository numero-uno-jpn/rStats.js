# Issue #29 対応ログ: rgamma で一方が負、他方が 0 のとき (変更なし、意図的な違い)

GitHub Issue #29。

## 確認 (main `a2d4846`)

| 呼び出し | rStats.js | R 4.5.2 |
|---|---|---|
| `rgamma(1, -1, { scale: 0 })` | NaN | 0 |
| `rgamma(1, 0, { scale: -1 })` | NaN | 0 |

どちらも乱数を消費しないので、その後の乱数列は R と同じ (`set.seed(1)` 直後の `runif(1)` は 0.2655086631421)。

## 判定

19 回目のレビューで決めた意図的な違い。負の shape や scale は分布を定めないので、もう一方が 0 でも NaN を返す (0 の 1 点分布ではない)。docs の「意図的な違い」の乱数の項 ("Random generators with parameters that define no distribution")、`test/review19.test.ts`、`src/random/gamma.ts` のコメントに記録してある。レビュアーの根拠は R のソースの分岐の順序だけで、新しい根拠はないので、変えない。

## テスト

- コードを変えていないので、なし (`test/review19.test.ts` で確かめている)
