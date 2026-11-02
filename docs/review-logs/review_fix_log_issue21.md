# Issue #21 対応ログ: varimax で負荷量が 0 の行があると NaN

GitHub Issue #21 (監査ラウンド #91)。

## 再現 (main `05e52ef`)

| 入力 | rStats.js (修正前) | R 4.5.2 | 修正後 |
|---|---|---|---|
| varimax (内部関数) に [[0, 0], [0.8, 0.1], [0.1, 0.7], [0.75, 0.12], [0.08, 0.72]] | エラー "the matrix contains NaN or infinite values" | `varimax(L)`: エラー "infinite or missing values in 'x'" | 0 の行は 0、残りの 4 行は R の `varimax(L[-1, ])` と 1e-15 で一致 |
| `factanal(null, 2, { covmat: S })` (1 番目の変数がほかと無相関の相関行列) | 同じエラー (rotation: "none" なら 1 行目の負荷量 0 で成功) | `factanal(covmat = S, factors = 2)`: 同じエラー | 有限の回転後の負荷量 (1 行目は 0)。promax も同じ |

## 原因と修正

Kaiser の正規化で、各行をその長さで割っていた。長さ 0 の行は 0/0 で NaN になり、SVD が失敗した。R も同じ計算で失敗する。

`src/descriptive/factanal.ts` (`varimax`): 長さ 0 の行は、正規化と回転の基準から除く (回転について何も言わない行なので)。回転はほかの行だけで決め、0 の行は 0 のまま返す。p (基準の変数の数) も、ほかの行の数にする。こうすると、R でそれらの行だけを varimax したものと一致する。すべての行が 0 なら、回転は単位行列。0 の行がなければ、計算は今と同じ。

## 進め方について

この Issue では、計画を出して承認をもらう前にコードを直してしまった (手順の逸脱)。

## テスト

- `test/issue21.test.ts`: varimax の結果が R の 4 行の varimax と一致し、0 の行は 0。factanal (varimax・promax) の負荷量が有限で、1 行目は 0
- stash で、修正前に失敗することを確かめた
- factanal・omega の既存のテストはそのまま通った
- 全体テスト `npx vitest run`: 2305 passed / 34 skipped、失敗 0 (#22 と合わせて)。`npx tsc --noEmit -p .`: エラーなし

## docs

- Where R fails: 負荷量が 0 の行がある varimax と factanal
