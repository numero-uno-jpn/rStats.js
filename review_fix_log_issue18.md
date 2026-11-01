# Issue #18 対応ログ: table が不正な useNA を黙って受け付ける

GitHub Issue #18 (監査ラウンド #76)。計画は承認済み。

## 再現 (main `8331905`)

`table([1, NaN, 2], { useNA: "sometimes" })` は、"no" と同じ { values: [1, 2], counts: [1, 1] } を返していた。R 4.5.2 の `table(c(1, NA, 2), useNA = "sometimes")` はエラー `'arg' should be one of "no", "ifany", "always"` (match.arg)。

## 修正

`src/descriptive/table.ts`: `useNA` が "no"・"ifany"・"always" 以外なら、RangeError `'arg' should be one of “no”, “ifany”, “always”` (ほかの match.arg のエラーと同じ書式)。指定しない場合は今まで通り "no"。

## テスト

- `test/issue18.test.ts`: 不正な値でエラー、正しい 3 つの値は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2299 passed / 34 skipped、失敗 0 (#16・#17・#19 と合わせて)。`npx tsc --noEmit -p .`: エラーなし
