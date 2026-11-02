# Issue #98 対応ログ: seqLength の不正な長さと、approx・spline・seq の length.out

GitHub Issue #98。R と同じ値・エラーにする修正 (docs は不要)。計画は承認済み。

## 確認 (main `2951e90`)

内部の `seqLength` (`src/internal/seq.ts`) は長さを確かめず、NaN と負の値を空の配列にしていた (issue の指摘どおり)。公開の関数への影響を R 4.5.2 と比べた。

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| approx(1:3, 1:3, n = NaN) | エラー | 空の結果 | エラー |
| approx(..., n = Inf) | "'length.out' must be a finite number" | "Invalid array length" (JS) | R と同じ文言 |
| spline(..., n = NaN)、n = Inf | "'length.out' must be a finite number" | 空の結果、"Invalid array length" | R と同じ文言 |
| approx・spline の n = −0.5 | エラー | エラー | エラー |
| approx・spline の n = 0.5、2.1 | 1 個、3 個 | 同じ | 同じ |
| seq(0, 10, length.out = −0.1)、−0.999、seq(5, length.out = −0.1) | integer(0) | エラー | [] |
| seq の length.out = −1、NaN、Inf | エラー | エラー | エラー |
| cut(1:3, NaN)、1.5、0.5 | エラー | エラー | (変更なし) |

issue の「R は −0.1 を拒否する」は誤り。R は length.out を切り上げてから負を判定し、−0.1 は 0 で空を返す (#93・#94 と同じ型)。rStats.js の seq は逆にエラーにしていた。

## 修正

- `seqLength`: n が有限でないか、切り上げた長さが負なら RangeError ("'length.out' must be a non-negative number")。呼び出し側の誤りを空の配列にしない
- `approx`・`spline` (`src/numerics/interp.ts`): n が Infinity なら "'length.out' must be a finite number" (spline は NaN も)、それ以外の正でない n (approx の NaN を含む) は "'approx' requires n >= 1" / "'spline' requires n >= 1"
- `seq` (`src/linalg/ops.ts`): 拒否するのは length.out ≤ −1 だけ ((−1, 0) は切り上げて 0、空)

## テスト

- `test/issue98.test.ts`: 上の表の approx・spline・seq と、内部の seqLength (NaN・−1・Infinity はエラー、−0.5・0 は []、2.1 は 3 個)。stash で、修正前に 4 件中 3 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2451 passed / 38 skipped、失敗 4 (いずれも実行時間の上限: distributionProperties の signrank・tukey、extremeAccuracy の qtukey・ptukey、extremeParameters の ptukey。HANDOFF の既知の揺れ)。3 つのファイルを流し直して 193 件すべて通った。`npx tsc --noEmit -p .`: エラーなし
