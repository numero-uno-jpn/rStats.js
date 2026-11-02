# Issue #49 対応ログ: wilcoxTest の 2 標本で、すべてが同順位のとき

GitHub Issue #49。計画は承認済み。p = 1 にすること (R 4.5.2 と違う) はユーザー判断。

## 確認 (main `bc4f771`、R 4.5.2)

issue は「R の wilcox.test は `.wilcox_test_two_pval_asymp` で、z = 0 かつ sd = 0 なら 1 を返す」としている。この関数はローカルの R 4.5.2 にはなく (R 4.6 のコードとみられる)、R 4.5.2 は NaN を返す。

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| `wilcoxTest([1], [1])` | W 0.5、p NaN | 0.5、NaN | 0.5、1 |
| `wilcoxTest([1, 1], [1, 1], { exact: false })` (correct の有無とも) | 2、NaN | 2、NaN | 2、1 |
| 同じ、alternative "less" (補正あり) | 3、1 | 3、1 (補正の 0.5 を 0 で割って Inf) | 3、1 |
| `wilcoxTest([3, 3], [1, 1], { mu: 2, exact: false })` | 2、NaN | 2、NaN | 2、1 |
| `wilcoxTest([1, 1, 2], [1, 1, 1], { exact: false })` | 6、0.50498507509384583 | 同じ | 同じ |

すべての値が同じなら、W はいつも期待値に等しい (退化した分布) ので、p = 1 が正しい。

## 修正

`src/htest/wilcoxTest.ts` の `rankSum` の正規近似の枝で、x − mu と y の値がすべて同じなら、alternative と連続補正によらず p = 1。標準偏差の浮動小数の 0 ではなく、値で判定する (同順位の補正の和は大きな N で丸まりうる)。正確検定の枝 (同順位があると通らない)、信頼区間 (すべて同順位でエラー、R も)、符号付き順位の差がすべて 0 の場合 (59 回目の方針でエラー) は変えない。

docs (`docs/differences-from-r.md` と `docs/ja/`) の「R が失敗し、rStats.js が値を返す場合」の表に 1 行足した。R の fixture の 1 件 (`x = [1, 1]`、`y = [1, 1]`) は `test/wilcox.test.ts` の `knownDifference` に記録した。

## テスト

- `test/issue49.test.ts`: 上の表の値
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2349 passed / 34 skipped、失敗 1。失敗は `test/distributionProperties.test.ts` の signrank の実行時間の上限 (`dsignrank(302775, 1100)` が 1300 ms)。HANDOFF にある負荷による既知の失敗で、ファイル単独では通る。`npx tsc --noEmit -p .` (テストを直したあとに流し直した): エラーなし
