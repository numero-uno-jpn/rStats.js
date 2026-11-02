# Issue #94 対応ログ: sampleInt・sample の size を切り捨ててから判定する

GitHub Issue #94。R と同じ値にする修正 (docs は不要)。#93 と同じ型。計画は承認済み。

## 確認 (main `0a61766`)

`src/random/sample.ts` の `sampleInt1` は、切り捨ての前に `size < 0` を拒否していた。R 4.5.2 は size を整数にしてから負を判定する。issue の指摘どおり。

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| sample.int(5, −0.5)、(5, −0.9) | integer(0)、乱数を引かない | エラー | []、引かない |
| 同、prob あり・replace・replace + prob | integer(0)、引かない | エラー | []、引かない |
| sample.int(1e6, −0.5)、sample(c(3, 7, 9), −0.5) | 空、引かない | エラー | []、引かない |
| sample.int(5, 2.7)、prob = 1:5 | 2 個、乱数 2 個 | 同じ | 同じ |
| sample.int(5, −1)、(5, −1.1) | "invalid 'size' argument" | エラー | エラー |
| sample.int(5, NaN) | "vector size cannot be NA/NaN" | エラー | エラー |

## 修正

判定を `!Number.isFinite(size) || size <= -1` (切り捨てた値が負のときだけ拒否) にした。個数は今までどおり `Math.trunc(size)`。`sample` も同じ関数を通る。

## テスト

- `test/issue94.test.ts`: 上の表の各行 (値と引いた乱数の数)、2.7 が 2 と同じ結果と乱数。stash で、修正前に 3 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2446 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
