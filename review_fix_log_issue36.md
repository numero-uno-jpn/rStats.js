# Issue #36 対応ログ: cov・cor の行の長さがそろわない行列

GitHub Issue #36。計画は承認済み。

## 再現 (main `9616caf`)

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `cov([[1, 2], [3, 4, 5]])` | `[[2, 2], [2, 2]]` (5 が黙って捨てられる) | TypeError |
| `cov([[1, 2], [3]])` | `[[2, NaN], [NaN, NaN]]` (undefined が NaN として伝わる) | TypeError |
| `cor([[1, 2], [3, 4, 5]])` | `[[1, 1], [1, 1]]` | TypeError |
| `cov([[1, 2], [3, 4]], [[1], [2, 3]])` | `[[1], [1]]` (y も同じ) | TypeError |

R の行列は構造上長方形なので、R との値の違いではなく、入力の形の検査の漏れ。docs は変更しない。

## 原因と修正

`src/descriptive/cov.ts` の `columns` は、列数を 1 行目の長さで決め、各行の長さを確かめていなかった。行列のとき、全行が配列で長さが 1 行目と同じことを確かめ、違えば `TypeError("all rows of the matrix must have the same length")`。レビュアーは RangeError を提案していたが、同じ検査をしている `toMat` (`src/linalg/matrix.ts`)・chisqTest・fisherTest の型とメッセージにそろえた。x と y の両方が `columns` を通る。長方形の行列の値は変わらない。

## テスト

- `test/issue36.test.ts`: x・y の行の長さがそろわない 5 例が throw する。長方形の行列とベクトルの結果は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2327 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
