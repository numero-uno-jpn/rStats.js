# Issue #118 対応ログ: 超幾何分布で m + n が double で丸められると確率が誤る

GitHub Issue #118。方針「2^53 を超える整数の領域では、誤った値の代わりに NaN」(HANDOFF) と、55 回目の記録「dhyper の m + n の溢れも NaN のまま」に合わせて NaN にした。issue は double-double で厳密に計算する案を挙げていたが採らなかった。計画は承認済み。

## 確認 (main `389af48`)

`src/distributions/hypergeometric.ts` は母集団の大きさ N = m + n を double で作る。m + n が 2^53 を超えて丸められると、`k === m + n` の判定や q = (N − k)/N が誤る。issue の指摘どおり。

| (m = 1、n = 1e16、k = 1e16、真の N = 1e16 + 1) | 真値 | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|---|
| dhyper(1) | 1 − 1e-16 | 1 | 1 | NaN |
| dhyper(0) | 1e-16 | 0 | 1 (確率の和が 2) | NaN |
| phyper(0) | 1e-16 | 0 | 0 | NaN |
| qhyper(0.5) | | | | NaN |
| dhyper(2)、phyper(1)、phyper(−1) | 0、1、0 | | 同じ | 同じ |

m + n が溢れる場合 (issue の追加の例 dhyper(5e307, 1e308, 1e308, 1e308)) は、修正前から NaN (R も NaN)。55 回目の記録のとおり変えない。

## 修正

`exactTotal(m, n)` (twoSum の下位が 0) を足し、dhyper は k = 0 の後・`k === m + n` の前に、phyper・qhyper は台の端の後・台の中の計算の前 (既存の `hi > MAX_EXACT` の判定の隣) に、m + n が厳密でなければ NaN を返す。台の端 (0、1)、台の外、二項分布の極限 (k/(m + n) < 2^-60) は値を返す。和が厳密な場合は以前と同じ。docs (英・日) の「phyper と qhyper の台が 2^53 を超える場合」の項に書き足した。

## テスト

- `test/issue118.test.ts`: 上の表、和が厳密な場合 (n = 2^52) と二項分布の極限は以前と同じ値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2488 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
