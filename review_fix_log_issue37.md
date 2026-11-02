# Issue #37 対応ログ: wilcox・signrank の台の最大値と 2^53

GitHub Issue #37。計画は承認済み。signrank も含めることはユーザー判断。

## 再現 (main `da4faa4`)

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `pwilcox(2^53, 3, 3002399751580331, lowerTail: false, logP: true)` (厳密な mn = 2^53 + 1) | −Inf (端を 2^53 と取り違える。正しくは約 −105 の有限値) | NaN |
| `pwilcox(2^53, 3, 3002399751580331)` | 1 | NaN |
| `dsignrank(9007199992938512, 134217733, log: true)` (厳密な n(n+1)/2 は …511、丸めると …512。x は台の外) | −9.3e7 (正しくは −Inf) | NaN |
| `psignrank(5, 134217733)` | 0 (2^−n 程度の値がアンダーフロー) | NaN |
| `pwilcox(0, 2, 2^52, logP: true)` (厳密な mn = 2^53) | −71.394… | 同じ |
| `dsignrank(1, 2^27 − 1, log: true)` (n(n+1)/2 = 2^53 − 2^26) | −n log 2 | 同じ |

R は、`psignrank(5, 134217733)` が 2 分で終わらなかった (Rscript を timeout で止めた)。

## 原因と修正

- `src/distributions/wilcox.ts` (`wilcoxParams`): 丸めた積で `m * n > 2 ** 53` を判定していた。厳密な積 2^53 + 1 だけが、偶数への丸めで 2^53 に下がる (それより大きい積は 2^53 を超えたまま)。丸めた積がちょうど 2^53 のときだけ BigInt で厳密な積を確かめ、2^53 でなければ NaN。厳密に 2^53 (m = 2, n = 2^52 など) は通す
- `src/distributions/signrank.ts` (`signrankN`): 2^53 の検査がなかった。n(n+1)/2 ≤ 2^53 は n < 2^27 と同じ (n = 2^27 − 1 で 2^53 − 2^26、2^27 で 2^53 + 2^26) なので、n ≥ 2^27 を NaN にした。wilcox と、2^53 を超える整数の台の方針 (phyper など) にそろう。d・p・q がすべてこの関数を通る。rsignrank は台の端を使わないので範囲外
- docs (`docs/differences-from-r.md`、`docs/ja/`): wilcox の項に、判定が厳密な積であることと signrank の上限を加えた

## テスト

- `test/issue37.test.ts`: 上の NaN になる例 (d・p・q) と、境界のすぐ内側 (厳密な mn = 2^53、n = 2^27 − 1) で値が今と同じこと。境界の値は BigInt で確かめた
- stash で、修正前に 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2330 passed / 34 skipped、失敗 1。失敗は `test/distributionProperties.test.ts` の signrank の実行時間の上限 (`dsignrank(302775, 1100)` が 1333 ms)。HANDOFF にある負荷による既知の失敗で、ファイル単独では 33 件すべて通る。`npx tsc --noEmit -p .`: エラーなし
