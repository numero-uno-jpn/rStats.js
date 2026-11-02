# Issue #134 対応ログ: Kendall の corTest (exact: false) が n = 2 で NaN

GitHub Issue #134。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: Kendall の正規近似の S の分散の 2 つ目の同順位の項 Σt(t−1)(t−2) Σu(u−1)(u−2) / (9 n (n−1)(n−2)) が、n = 2 で分母 0 の 0/0 になり、統計量と p 値が NaN になる。n = 2 では同順位の組はどれも 2 個以下なので、分子の和は厳密に 0 で、項の値は 0
- 方法: `src/htest/cor.ts` で n < 3 のときだけその項を 0 にする (issue の案)
- 選んだ理由: n ≥ 3 の式は変わらず、通常の入力のビットは同じ。R も同じ 0/0 で NaN を返すので、R と違う値になる (方針「正しい値を優先」)。docs に記録する

## 確認 (main `4f4e69e`)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| cor.test(c(1, 2), c(1, 2), kendall, exact = FALSE) | z NaN、p NaN | NaN、NaN | z 1、p 0.31731050786291415 |
| 同 (c(1, 2), c(2, 1))、continuity = TRUE | NaN、NaN | NaN、NaN | z 0、p 1 |
| cor.test(c(1, 2, 3), c(1, 3, 2), kendall, exact = FALSE) | z 0x1.0b621e9bc3addp-1、p 0x1.33f8dfcb668e6p-1 | 同じ | 同じ |

Var S = n(n−1)(2n+5)/18 = 1、S = ±1 で z = ±1。2 Φ(−1) = 0.3173105。

## 修正

- `src/htest/cor.ts`: 2 つ目の同順位の項を `n < 3 ? 0 : …`
- docs (英・日) の「R が失敗し rStats.js が値を返す」表に 1 行
- `test/cor.test.ts`: R の fixture に n = 2 の Kendall (exact = FALSE) が 12 件 (統計量と p 値で 24 個) あり、R は NaN。`knownDifference` に理由を付けて記録

## テスト

- `test/issue134.test.ts`: n = 2 の z と p (両側、less、continuity)、n = 3 は R と同じビット。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 1 回目は test/cor.test.ts の fixture の 24 個だけが失敗 (上の knownDifference で記録)。記録後 test/cor.test.ts は通る。ほかは 2516 passed / 38 skipped。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

なし

## close comment

Fixed in <commit of #134, see git log --grep='#134'>: for n < 3 the second tie term of the variance of Kendall's S, sum t(t-1)(t-2) * sum u(u-1)(u-2) / (9 n (n-1)(n-2)), is now 0 (with n = 2 every tie group has at most 2 values, so the sums are 0; the denominator is 0 too, which gave 0/0). corTest([1, 2], [1, 2], { method: "kendall", exact: false }) now gives z = 1 and p = 0.3173105078629141 (were NaN); n >= 3 is unchanged. R's cor.test gives NaN there as well, recorded in docs/differences-from-r.md and as a known difference in test/cor.test.ts. Test: test/issue134.test.ts. (Not pushed yet.)
