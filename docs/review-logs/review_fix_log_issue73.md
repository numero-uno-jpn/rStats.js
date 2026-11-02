# Issue #73 対応ログ: kappa が大きな尺度の有限の行列で Infinity・NaN

GitHub Issue #73。計画は承認済み。

## 再現 (main `9cf52dc`)

条件数は行列のスカラー倍で変わらないが、`kappa` (`src/linalg/kappa.ts`) は要素が 1e308 規模の行列で壊れていた。A = [[1, 1], [0, 1]]、B = 1e308 A として:

| 呼び出し | A | B (修正前) | B (修正後) | R 4.5.2 の B |
|---|---|---|---|---|
| `method: "direct", triangular: true` (issue) | 3.333333333333333 | Infinity | 3.3333333333333335 | Inf |
| 既定 (QR の推定) | 3.333333333333333 | NaN | 3.3333333333333335 | エラー "NA/NaN/Inf in foreign function call" |
| `exact: true, norm: "1"` | 4 | Infinity | 4 | エラー "computationally singular" |
| `exact: true, norm: "I"` | 4 | Infinity | 4 | |
| `method: "direct"` (rcond) | 3.3333333333333335 | 3.333333333333333 (すでに正規化) | 同じ | エラー (dgecon −5) |
| `exact: true` (2 ノルム、svdScaled) | 2.618033988749894 | 同じ (すでに正規化) | 同じ | 2.618034 |

issue の主張 (trco の列和が溢れる) は正しく、既定の QR の経路と exact の 1・∞ ノルムも同じ原因 (ノルムの溢れ) で壊れていた。B の値が A と 1 ulp 違うのは、1e308 が 2 の冪でないため。

## 修正

`rcond` と同じく、要素がすべて有限で範囲が [2^-256, 2^256] の外なら、`scaledCopy` (`src/linalg/solve.ts`、export した) で 2 の冪で割った行列で、direct の三角・QR の経路・exact の 2 以外のノルムを計算する。範囲内の行列は今の計算のまま。

ただし、割ると 0 でない要素が正規化数の範囲より下に落ちる行列は割らない。修正の途中で、R の fixture の `diag(1e-200, 1, 1e200)` (exact の 1・∞・F・M ノルム、R は "computationally singular") がエラーにならず Infinity を返すようになった。1e200 で決まる 2^-664 で割ると 1e-200 が 0 に落ちて、厳密に特異と見なされたため。この行列 (条件数 1e400) は以前と同じく R と同じエラーになる。

R が Inf かエラーになる場合に値を返すので、docs (英・日) の「R が失敗し rStats.js が値を返す」に 1 行足した。

## テスト

- `test/issue73.test.ts`: 9 通りの指定 (direct の三角の U・L・I、QR、direct、exact の 2・1・I・F) で、2^1000 A と 2^-1000 A が A と同じ値、1e308 A が A と相対 1e-15 以内。横長の行列 W (QR の前に転置) の 2^1000 倍は 1e-15 以内 (割る指数は最大の要素で決まり、2^1000 と違うので QR の丸めが 1 ulp 違う)、1e307 倍は 1e-14 以内 (各要素の積の丸めが条件数 22 倍になる)。stash で、修正前に 1e308 の確認が失敗することを確かめた
- 途中でテストの入力の誤りを直した (W の最大の要素 7 を 1e308 倍すると溢れる)
- 全体テスト `npx vitest run`: 2409 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
