# Issue #55 対応ログ: 長さ 0 のベクトルの diag・cbind・rbind

GitHub Issue #55。計画は承認済み。cbind・rbind を含めることはユーザー判断 (確認中に同じ原因を見つけた)。

## 再現 (main `2ace0ce`、R 4.5.2)

`diag` と、`cbind`・`rbind` が使う `bindParts` (`src/linalg/ops.ts`) は、ベクトルを `v[i % v.length]` で繰り返す。長さ 0 では i % 0 = NaN で、undefined が数値の行列に入っていた。

| 呼び出し | 修正前 | 修正後 | R 4.5.2 |
|---|---|---|---|
| `diag([], { nrow: 2, ncol: 2 })`、`diag([], { nrow: 2 })` | `[[undefined, 0], [0, undefined]]` | RangeError "'x' must have positive length" | 同じエラー |
| `diag([], { nrow: 0, ncol: 2 })`、`diag([])` | `[]` | 同じ | 0 × 2、0 × 0 (rStats.js の 0 行の行列は 0 × 0) |
| `cbind([], [1, 2])` | `[[undefined, 1], [undefined, 2]]` | `[[1], [2]]` | 2 × 1 |
| `rbind([], [1, 2])` | `[[undefined, undefined], [1, 2]]` | `[[1, 2]]` | 1 × 2 |
| `cbind([[1, 3], [2, 4]], [])` | 3 列目が undefined | 2 × 2 | 2 × 2 |
| `cbind([], 5)` | `[[undefined, 5]]` | `[[5]]` | 1 × 1 |
| `rbind([], [[1, 3], [2, 4]])` | 1 行目が undefined | 2 × 2 | 2 × 2 |
| `cbind([], [1, 2], 3)` | 1 列目が undefined | `[[1, 3], [2, 3]]` | 同じ |
| `cbind([])`、`rbind([], [])` (すべて長さ 0) | `[]`、`[[], []]` | 同じ | 0 × 1、2 × 0 |

## 修正

- `diag`: ベクトルの枝で、値が 0 個で対角の長さ min(nrow, ncol) が正なら、R と同じエラー
- `bindParts`: 引数に行列か長さ 1 以上のベクトルがあれば、長さ 0 のベクトルを除いてから組む (R と同じ)。すべて長さ 0 なら今と同じ

長さのある入力の結果は変わらない。R に合わせる修正なので docs は変更しない。

## テスト

- `test/issue55.test.ts`: 上の表の値と、長さのある入力が今と同じこと
- stash で、修正前に 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2365 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
