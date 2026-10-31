# 外部レビュー (8 回目、第 29〜34 段階) 対応ログ

レポート: ユーザーがチャットに貼り付けた「rStats.js ソースコード監査: 第 29〜34 段階」。レビュアーは push 前のコードを見ているため、指摘の多くは修正済み。

## R 4.5.2 で実行して確かめた結果

| 呼び出し | R 4.5.2 |
|---|---|
| `r2dtable(Inf, c(2,2), c(2,2))`、`r2dtable(2147483648, ...)` | 警告 "NAs introduced by coercion to integer range" のあと、エラー "invalid argument 'n'" |
| `r2dtable(-1, ...)`、`r2dtable(NaN, ...)` | エラー "invalid argument 'n'" |
| `r2dtable(2.5, ...)` | 表 2 個 (切り捨て) |
| `ks.test(c(0.2, 0.2, 0.8), "punif", exact = TRUE)` | 警告 "ties should not be present for the one-sample Kolmogorov-Smirnov test" (計算は正確分布) |

## 修正

- **RNG-01 `r2dtable` (`src/random/r2dtable.ts`):** n = Infinity が `Math.trunc(n) >= 0` を通り、ループが終わらなかった。n が非有限、負、2147483647 を超える場合は、R と同じ "invalid argument 'n'" にした。ほかの乱数関数 (`generate`、`rbinom`) はすでに非有限の n を拒否していた
- **テスト (`test/locationScaleExtremes.test.ts`):** Infinity、2^31、−1、NaN の拒否と、2.5 の切り捨てを確かめる

## 判定

| ID | 判定 |
|---|---|
| F-01 (fisher の整数上限) | 修正済み (`f223097`)。R と同じエラー |
| F-02 (fisher の丸めの警告) | 付けない (ユーザー判断) |
| R-01 (quade) | 修正済み (`d717e23`)。R のバグとして記録 |
| N-01〜03、B-01 | 修正済み (`f223097`、`9b04a3f`) |
| W-01 (R 4.6 の wilcox の正確検定) | 将来の R バージョンへの追従として記録済み |
| P-02 (prop の期待度数の警告) | このまま (ユーザー判断) |
| K-01 (ks の同順位の警告) | 計算は R と一致。警告については判断待ち (P-02 と同じく出さない方針が一貫する。入れるなら、警告を返す仕組みを含む全体の仕様変更になる) |
| B-02 | 不具合ではない (前回の判定のまま) |
