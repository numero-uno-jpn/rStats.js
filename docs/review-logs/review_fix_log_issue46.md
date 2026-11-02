# Issue #46 対応ログ: pearsonTest で pnorm が 1 に丸まる観測値

GitHub Issue #46。計画は承認済み。R (nortest) と違う値にすることはユーザー判断。

## 再現 (main `639331c`、R 4.5.2 + nortest)

issue は「nortest の pearson.test は `cut(..., n.classes)` を使い、最大値を最後の区間に入れる」としているが、これは誤り。ローカルの nortest の `pearson.test` のソースは次のとおりで、R も同じ観測値を捨てる:

```r
num <- floor(1 + n.classes * pnorm(x, mean(x), sd(x)))
count <- tabulate(num, n.classes)
```

pnorm(z) は z ≥ 約 8.3 で 1 に丸まる (R で確かめた)。そのとき区間の番号は k + 1 になり、`tabulate` が捨てる。rStats.js も `c <= k` のときだけ数えていたので、R と同じく捨てていた。

| `x = [0 × 99, 1e6]` (n = 100、k = 13) | 統計量 | p 値 |
|---|---|---|
| nortest | 1176.1299999999995 | 2.0279846422282057e-246 |
| 修正前 | 1176.1299999999994 | 2.0279846422282042e-246 |
| 修正後 (外れ値を 13 番目の区間に数える) | 1174.26 (= 11e + (99 − e)²/e + (1 − e)²/e、e = 100/13) | 5.1329907383211708e-246 (R の pchisq で計算) |

## 修正

`src/htest/normalityTests.ts` の `pearsonTest` で、区間の番号を `Math.min(k, ...)` で打ち切った。NaN (sd が 0 など) は今と同じく数えない。R と違うのは、pnorm がちょうど 1 になる観測値があるときだけ。

docs (`docs/differences-from-r.md` と `docs/ja/`) の「R が不正確な場合」の仮説検定の表に 1 行足した。

## テスト

- `test/issue46.test.ts`: 上の例の統計量と p 値 (adjust の有無)。外れ値のないデータは nortest と同じ (0.3、p 0.98981417288881666)
- stash で、修正前に失敗することを確かめた
- 既存の pearsonTest の fixture (`test/moreTests.test.ts`) は変わらない
- 全体テスト `npx vitest run`: 2348 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
