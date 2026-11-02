# Issue #128 対応ログ: solve の LU の消去が溢れる

GitHub Issue #128。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: `solve` は条件数の検査を 2 の冪で割った複製 (`scaledCopy`、31 回目) で行うが、解は元の行列の LU で求める。1e308 規模の行列では消去が溢れ (−1e308 − 1e308)、U に −Infinity が入って誤った有限の解を返す。`solve(1e308 * [[1, 1], [1, -1]], c(1, 0))` が (1e-308, 0) (正しくは (5e-309, 5e-309))
- 方法: 入力が有限で、元の行列の LU が有限でないときだけ、条件数の検査で使う複製の LU で解く (`solveScaled`)。A = 2^k S なら X = (S^-1 B) / 2^k で、各列を最後に 1 回で戻す (サブノーマルへも 1 回の丸め)。S^-1 B がその前に溢れる列 (右辺も巨大) は、右辺の列を最大の要素の 2 の冪で割って解き直す。また、LU は有限でも代入で解が溢れる場合 (有限の右辺) も同じ関数で解き直す (複製の LU、複製がなければ元の LU で k = 0)
- 選んだ理由: issue の案 (尺度に安全な座標で分解・代入) を、今の値が有限な場合を変えない形で入れた (共通基盤の「必要なときだけ正規化」)。複製は条件数の検査と同じもの (`scaledCopy` → `rangeExponent`) を使うので、検査と解が同じ分解に基づく。右辺を常に割る形は、右辺の小さな成分がサブノーマルに落ちうる (issue の注意) ので、溢れた列だけにした
- 線形代数の全体スケーリングの判断 (decisions_linalg_misc.md の Q1-a、`rangeExponent` の目標を 2^256 にするか) との関係: 今回は `scaledCopy` をそのまま使い、目標は変えない。Q1-a で目標を変えれば、solve の複製も自動で同じになる。Q1-b (QR の分解し直し) とは別の関数で、方針も同じ「結果が有限でないときだけ」。先取りする部分はないと判断した

## 確認 (main `33647e3`)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 | 真の値 |
|---|---|---|---|---|
| solve(1e308 H, c(1, 0))、H = [[1, 1], [1, −1]] | (1e-308, 0) | (1e-308, 0) | (5e-309, 5e-309) | (5e-309, 5e-309) |
| solve(1e308 H) | [[1e-308, 0], [0, 0]] | 同じ | [[5e-309, 5e-309], [5e-309, −5e-309]] | H / 2e308 |
| solve(1e308 H, c(1e308, 0)) | (1, 0) | (1, 0) | (0.5, 0.5) | (0.5, 0.5) |
| solve(1e308 H, c(1.7e308, 1.7e308)) | (1.7, 0) | (1.7, −0) | (1.7, 0) | (1.7, 0) |
| 3 × 3 (テストの例) | (−1.9999999999999993e-308, −0, 2.9999999999999997e-308) | 同じ | (−2e-308, −1.6666666666666667e-308, 4.666666666666667e-308) | 2^-1000 倍した系の解と同じビット |
| solve(H, c(1.7e308, −1.7e308)) | (−Inf, Inf) | (−Inf, Inf) | (0, 1.7e308) | (0, 1.7e308) |

R (LAPACK の dgesv) も同じく溢れる。R と違う値なので docs の「R が失敗する所」の表に 1 行足した。

掃引: n = 2〜5 の乱数行列 (要素 2^1018〜2^1023 規模) と右辺 (3 件に 1 件は 2^1020 規模、他は 2^±20) を 600 件。参照は BigInt の有理数の Gauss 消去。誤差を max abs(真の解) × kappa (exact) で割った値 (サブノーマルの解は 2^-1074 × 4 kappa の許容を引く):

- 修正前: 600 件のうち 10 件で解に NaN・±Inf (真の解は有限)。その他も誤った有限の解があった
- 修正後: 0 件。最大 2.4e-16
- 元の LU と解が有限な場合は経路が変わらない (修正前と同じビット。テストの 4 例で確認)

## 修正

- `src/linalg/solve.ts`: `solveScaled` を足し、`solve` で元の LU が有限でないとき、または解が溢れたときに使う。複製の LU (`getrf(scaled)`) は tol によらず先に作る (条件数の検査もそれを使う。値は以前と同じ)
- docs (英・日) の「R が失敗する所」の表に solve の行を追加

## テスト

- `test/issue128.test.ts`: issue の例と逆行列、巨大な右辺 (ベクトルと行列)、3 × 3 で 2^-1000 倍の系の解と同じビット、範囲内の行列で代入が溢れる場合、範囲内の値は修正前のビット。stash で、修正前に 4 件中 3 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 267 files、2538 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- `determinant(1e308 H)` の modulus が NaN (同じ消去の溢れ。log|det| = log 2e616 ≈ 1419.1 で有限)。`determinant` は複製を使っていない。R は確かめていない
- tol = 0 (条件数の検査なし) で、複製が厳密に特異になる行列 (`solve([[1e308, 1e308, 0], [1e308, -1e308, 0], [0, 0, 1e-300]], [1, 0, 1], tol = 0)` は (1e-308, 0, 1e300)、正しくは (5e-309, 5e-309, 1e300))。1e-300 が複製でアンダーフローするため。tol > 0 なら今までどおり「computationally singular」で止まる。複製の目標の尺度 (Q1-a) の判断に含まれる

## close comment

Fixed in <commit of #128, see git log --grep='#128'>: where the LU of a finite matrix is not finite (the elimination overflowed), solve now solves from the LU of the copy divided by a power of 2 that the condition check already uses: X = (S^-1 B) / 2^k, each column scaled back once at the end, and where S^-1 B itself overflows (a huge right-hand side too), with that column of B divided by the power of 2 of its largest entry first. A finite right-hand side whose substitution overflows is solved again the same way. solve(1e308 * [[1, 1], [1, -1]], [1, 0]) is now [5e-309, 5e-309] (was [1e-308, 0], as in R), and the inverse [[5e-309, 5e-309], [5e-309, -5e-309]]; solve([[1, 1], [1, -1]], [1.7e308, -1.7e308]) is [0, 1.7e308] (was [-Inf, Inf]). In a sweep of 600 random matrices near 1e308 checked against exact rational elimination, the error is within 2.4e-16 times the condition number. Where the LU and the solution are finite, the bits are unchanged. Recorded in docs/differences-from-r.md. Test: test/issue128.test.ts. Recorded for later: determinant of the same matrix (NaN modulus). (Not pushed yet.)
