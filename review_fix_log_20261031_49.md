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
- (prcomp の中心化の溢れは、下の「追加」で直した)
- **`Math.sqrt(variance(...))` の形:** `sd()` 以外にも、検定・効果量などに同じ形がある。外部レビュアーの次の対象が `src/internal/` (mean・variance・sum) なので、そのときにまとめて見る

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

## 追加: 中心化した値が溢れる場合 (ユーザーの質問から)

x = [−1e308 × 4, 1.5e308] (平均 −5e307。偏差 2e308 は真に範囲外、正しい sd は sqrt(1.25e616) = 1.118e308)。

| 関数 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|
| `sd(x)` | Inf | Inf | 1.118033988749895e308 |
| `sd(c(1e-200, 2e-200, 4e-200))` | 0 | 0 (分散のアンダーフロー) | 1.5275252316519466e-200 |
| `scale(x, scale = FALSE)` | Inf × 5 | [−5e307 × 4, Inf] | 同じ (Inf は真に範囲外) |
| `scale(x)` | NaN × 5、scale Inf | [0 × 4, Inf]、scale Inf | [−0.447 × 4, 1.789]、scale 1.118e308 |
| `prcomp(x)` | エラー (svd に Inf) | エラー | sdev 1.118e308、回転 1、スコア [−5e307 × 4, Inf]、center −5e307 |
| `prcomp(x, scale = TRUE)` | エラー | エラー | スコアは `scale(x)` と同じ、sdev 0.9999999999999999 |

修正
- `src/internal/summary.ts` `standardDeviation`: `centered(x)` (2^-k の座標の偏差、double-double) から ldexp(sqrt(和 / (n − 1)), k)。4^k 倍の平方根は厳密に 2^k 倍なので、分散が正規の範囲なら `Math.sqrt(variance)` と同じビット。`sd()` (`src/descriptive/basic.ts`) はこれを使う
- `src/descriptive/moments.ts` `scale`: 入力と中心が有限なのに偏差が有限でない列だけ、2^-k の座標で偏差・尺度を作り直す。尺度の式は `rootMeanSquare` に切り出した (今と同じ)
- `src/linalg/lu.ts` `prcomp`: 49 回目の後始末 (特異値が Inf) を一般にした。入力が有限で、中心化・尺度化した行列が有限でない、または特異値が Inf なら、入力全体 (与えられた center・scale も) を 2^-e で割ってやり直す。尺度化しないときは sdev とスコアを 2^e 倍で戻す。center・scale の属性も 2^e 倍で戻す

R の fixture (`test/descriptive.test.ts`): sd・skewness・kurtosis・cv で、1e-200 規模 (R の分散がアンダーフロー) と 1e200 規模 (sd の溢れ) のケースが R の 0・NaN と食い違った。修正前の rStats.js も R と同じく誤っていたため一致していた。新しい値は、データを 2 の冪倍して通常の規模で計算した値と、ビット単位で一致することを確かめた。`underflow` の knownDifference に記録した (sd には `overflow(1e150)` も)

テスト: `test/review49.test.ts` に追記 (上の例、2^1000 倍で通常の規模の 2 の冪倍と一致、1e-200 規模の sd)。stash で失敗することを確かめた。全体テスト 2219 passed / 34 skipped、失敗 0。tsc エラーなし

`scale()` は、平方和が溢れる規模 (2^1000 倍など) では、もとからある「最大値で割って平方和を作る」経路に入るので、通常の規模の結果と 1 ulp ずれることがある (修正前から同じ)

