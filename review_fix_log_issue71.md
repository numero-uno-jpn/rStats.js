# Issue #71 対応ログ: qrSolve が解の NaN を 0 にする

GitHub Issue #71。ユーザー判断: 使う列の NaN は残す (R と違う)。計画は承認済み。

## 再現 (main `1754a18`)

`qrSolve` (`src/linalg/qr.ts`) は最後に `zero` で、解のすべての NaN を 0 にしていた。横長の行列で分解が使わない列 (qrCoef が NaN を置く位置) を 0 にするための処理だが、応答の NaN から生じた NaN も 0 になる。R の `qr.solve` も `res[is.na(res)] <- 0` で同じ。

| 呼び出し | 修正前 | 修正後 | R 4.5.2 |
|---|---|---|---|
| `qrSolve([[1], [2], [3]], [NaN, 2, 3])` | [0] | [NaN] | 0 |
| `qrSolve([[1, 0], [0, 1]], [NaN, 1])` | [0, 0] | [NaN, NaN] | 0 0 |
| 単位行列と、列 (NaN, 1)・(1, 2) の行列の応答 | 1 列目が (0, 0) | 1 列目が (NaN, NaN)、2 列目が (1, 2) | 0 0 / 1 2 |
| `qrSolve([[1, 3, 5], [2, 4, 6]], [1, 2])` | [1, 0, 0] | 同じ | 1 0 0 |
| 同じ行列の LAPACK の QR (ピボット 3, 1, 2) | [1, 0, −0] | 同じ | 1 0 0 |

単位行列と (NaN, 1) では、Householder の変換で NaN が両方の成分に広がる。真の解は (NaN, 1) だが、どちらの成分も NaN を返す (R はどちらも 0、つまり正しい成分 1 も 0 になっていた)。

## 修正

一律の変換をやめ、分解で使わない列 (k = min(n, p) として `pivot[k..p−1]`。qrSolve は rank = min(n, p) を要求するので、LINPACK と LAPACK で同じ) だけを 0 にする。解から生じた NaN はそのまま。有限の応答では、値も 0 の位置も今と同じ。

docs (英・日) の Deliberate differences の線形代数に 1 項目足した。

## テスト

- `test/issue71.test.ts`: 上の表の例。横長の行列の解の −0 は、R の表示と同じく 0 に揃えて比べる (修正前からの値)。stash で、修正前に NaN の 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2405 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
