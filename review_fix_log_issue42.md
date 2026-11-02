# Issue #42 対応ログ: chisqTest の因子の水準の順 (コードポイント)

GitHub Issue #42。計画は承認済み。

## 再現 (main `9f2064b`)

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `chisqTest(["\u{10000}", "", "\u{10000}", "", ""], ["a", "a", "b", "b", "b"])` の rowLevels | `[U+10000, U+E000]` (表の行もこの順) | `[U+E000, U+10000]` |
| ASCII の水準 (`["B", "a", "b"]` など) | コードポイントの順 | 同じ |

統計量・p 値は、行と列の並べ替えで変わらない。R の C ロケールの順 (コードポイント、UTF-8 のバイト順と同じ) に合わせる修正で、R との違いではない。docs は変更しない。

## 原因と修正

`src/htest/chisqTest.ts` の `byCodePoint` は `<`・`>` で比べていたので、UTF-16 のコード単位の順だった。補助面の文字 (先頭のサロゲートが U+D800〜U+DBFF) が U+E000〜U+FFFF の文字より前になる。ほかの関数 (`src/data/grouping.ts`、`src/descriptive/dataFrames.ts`、`src/htest/trendTests.ts`、`src/models/aovEz.ts`、modelFrame) はすでに `compareCodePoints` (`src/models/modelFrame.ts`) を使っているので、chisqTest もそれを使うようにし、`byCodePoint` を消した。

## テスト

- `test/issue42.test.ts`: rowLevels・colLevels・observed がコードポイントの順になること。ASCII の水準の順と統計量が今と同じこと
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2339 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外 (記録だけ)

`src/htest/agreement.ts` の水準の並べ替えも `<`・`>` で比べているが、水準は `formatR` で書いた数値 (ASCII だけ) なので、順は変わらない。変更していない。
