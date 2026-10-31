# 外部レビュー (49 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (線形代数 `src/linalg/`、`src/optim/`・`src/numerics/`。zip は `src(3).zip`)。確定指摘 6 件 (LINALG-001〜004、NUM-001・002) は、今のコード (`1219a61`) で確かめた。LINALG-001〜004 と NUM-001 は再現し、R 4.5.2 も同じく誤っている (LINALG-001 の solve だけは R がエラー)。NUM-002 は、d = 0 はもともとエラーで、eps = 0 の NaN などの検査を足した。ユーザーが計画を承認し、全件を直した。

RNG-002 の追加の例 (`setSeed(4); rexp(1, rate = 1e-309)`) は、48 回目の修正で 1.7160061001777616e308 を返す (レビュアーの zip は 48 回目より前)。台帳の 14 件のうち、ほかの 10 件は 48 回目までに対応済み。

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| LINALG-001 | `solve(diag(1e-308, 2), c(1, 2))` | エラー (rcond = 0) | [NaN, Inf] | [1e308, Inf] |
| | `backsolve(同)`、`forwardsolve(同, transpose)` | [NaN, Inf] | [NaN, Inf] | [1e308, Inf] |
| | `forwardsolve(同)`、`backsolve(同, transpose)` | ― | [1e308, Inf] (列の形でなく内積の形で、0 × Inf が起きない向き) | 同じ |
| | `backsolve(3 × 3 の例, c(1, 2, 3))` | [NaN, Inf, 3] | [NaN, Inf, 3] | [−Inf, Inf, 3] (x1 = (1 − 3)/1e-308) |
| LINALG-002 | `prcomp(c(1e308, −1e308, 1e308, −1e308))$sdev` | Inf | Inf | 1.1547005383792517e308 |
| LINALG-003 | `determinant(diag(c(1e308, 1e308, 1e-308, 1e-308)), logarithm = FALSE)` | Inf | Inf | 0.9999999999999999 (真値は 1 + 5e-17。逐次の積の丸め 3 回で 1 ulp) |
| | 小さい値が先 (diag(1e-308, 1e-308, 1e308)) | ― | 0 | 1e-308 |
| LINALG-004 | `matrix(c(1e308, 1e308), 1) %*% matrix(c(1e308, −1e308))` | NaN | NaN | 0 |
| NUM-001 | `optimize((x/1e308 − 1.05)^2, c(1e308, 1.1e308), tol = 1e-8)` | 終わらない (10 秒で打ち切り) | 終わらない | 1.0500000063442146e308、1 ms 未満 |
| NUM-002 | `grad(x^2, 1, d = 0)` | エラー "function returns NA at 0 distance from x." | エラー "func returned NaN at step 0 from x" | RangeError "'d' must be a finite nonzero number" |
| | `method: "simple", eps: 0` | NaN | NaN | RangeError |
| | `hessian(x^2, 1, d = −0.1)` | 2.000000000000556 | 同じ | 同じ (負の刻みは受け付ける) |
| | `r = 0` | エラー (subscript out of bounds) | RangeError | 同じ |

## 修正の内容

- `src/linalg/solve.ts` の `getrs`・`trsv`、`src/linalg/basic.ts` の `trsm`: 三角方程式の代入の更新で、係数が厳密に 0 なら飛ばす (全方向)。溢れた成分は有限の値の代わりなので、厳密な 0 との積は 0 とする (26 回目の expm と同じ考え方)。係数が 0 でなければ今と同じビット
- `src/linalg/lu.ts` `prcomp`: 特異値が Inf で、中心化・尺度化した行列が有限のときだけ、2^k で割った行列を分解し直し、sdev = ldexp(d / sqrt(max(1, n − 1)), k)。回転もやり直した分解から取る
- `src/linalg/solve.ts` `determinant` (logarithm = false): 対角の要素も途中の積も、[2^-500, 2^500] の外なら仮数と 2 の冪の指数に分けて掛け、最後に `ldexp` で戻す。範囲内では今と同じビット
- `src/linalg/ops.ts` `matMul`: 結果が有限でない要素で、行と列の成分がすべて有限なら、行・列それぞれの最大の指数の 2 の冪で割って積和を取り直し、`ldexp` で戻す (`rescaledDot`)。真の値も溢れるなら Inf のまま
- `src/numerics/integrate.ts` `optimize`: x/2 の座標で解く条件に、upper + lower が溢れる場合を足した
- `src/numerics/deriv.ts`: d・eps は有限で 0 でないこと、zeroTol は有限で 0 以上であることを検査する (`steps`、"simple" の `simpleEps`)

## 残したもの (記録だけ)

- **matMul の積和の制約:** 最大の積に比べて 2^-1074 未満の項は、2 の冪で割ったときに 0 になる。大きな項どうしが厳密に打ち消し、小さな項だけが残る場合 (例: [1e308, 1e308, 1e-300] · [1e308, −1e308, 1e300]、真値 1) は 0 になる。HANDOFF の「1e308 近くの積和」(27・40 回目) と同じ性質
- **prcomp の中心化の溢れ:** 中心化した値そのものが溢れる場合 (例: 1.7e308、−1.7e308、1.7e308) は今回の範囲外 (`scale` の問題)

## テスト

- `test/review49.test.ts`: 6 件と、通常の範囲で値が変わらないこと、真の値が溢れる場合の Inf
- `git stash push -- src` で、NUM-001 (修正前に止まる) を除く 5 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2218 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md`
  - Where R fails の表: backsolve・forwardsolve の 0 × Inf、prcomp の sdev、determinant(logarithm = FALSE)、%*% の打ち消し、optimize が止まらない
  - 「意味のない入力はエラー」: grad・jacobian・hessian の eps = 0 と、有限でない d・eps・zeroTol

## その他

- NUM-001 の確認で、`timeout` を付けた tsx の子の node が残った (PID 36664)。47 回目の SPEC-009 の確認で残ったと思われる 2 つ (PID 31080、54184) と合わせて、ユーザーに終了を頼んだ
