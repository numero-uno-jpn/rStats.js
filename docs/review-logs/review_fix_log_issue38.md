# Issue #38 対応ログ: scale の行の長さがそろわない行列

GitHub Issue #38。計画は承認済み。#36 (cov・cor) と同じ種類。

## 再現 (main `f9b5cc8`)

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `scale([[1, 2], [3, 4, 5]], { center: false, scale: false })` | `[[1, 2], [3, 4, 5]]` (余分な 5 がそのまま残る) | TypeError |
| `scale([[1, 2], [3, 4, 5]])` | 2 行目が `[0.707, 0.707, 5]` (5 は中心化も尺度化もされない) | TypeError |
| `scale([[1, 2], [3]])` | center `[2, NaN]`、scale `[1.414, 0]`、2 行目に NaN の列が足される | TypeError |

R の行列は構造上長方形なので、R との値の違いではなく、入力の形の検査の漏れ。docs は変更しない。

## 原因と修正

`src/descriptive/moments.ts` の `scale` は、列数を 1 行目の長さで決め、各行の長さを確かめていなかった。行の配列にしたあと、全行の長さが 1 行目と同じことを確かめ、違えば `TypeError("all rows of the matrix must have the same length")` (#36 と同じ型とメッセージ)。行列の判定は今と同じく 1 行目が配列かどうか。2 行目以降が数値なら、今と同じく行のコピー (`[...r]`) が TypeError を出す。ベクトル (1 列の行列) と長方形の行列の値は変わらない。

## テスト

- `test/issue38.test.ts`: 上の 3 例と、`center`・`scale` を数値の配列で与えた場合が throw する。長方形の行列・ベクトル・空のベクトルの結果は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2333 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外 (記録だけ)

列数を 1 行目の長さで決める箇所は、ほかにもある (`src/htest/rankTests.ts`、`src/htest/polycor.ts`、`src/linalg/ops.ts` など)。検査済みのもの (`toMat`、chisqTest、fisherTest、agreement、groups) もある。今回は見ていない。
