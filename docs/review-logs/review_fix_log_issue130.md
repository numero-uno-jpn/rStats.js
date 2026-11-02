# Issue #130 対応ログ: QR の Householder の内積が 1e308 規模の列で溢れる

GitHub Issue #130。夜間に下準備 (scratchpad の decisions_linalg_misc.md の Q1-b)、2026-11-03 朝にユーザー判断で案 B (結果が有限でないときだけ、列ごとに 2 の冪で割って分解し直す)。計画は承認済み (Plan モード)。

## 計画

- 意図: LINPACK 型の QR (`linpackQR`) は列のノルムは尺度を変えて求めるが、変換の内積 t = −Σ v_i a_ij は 1e308 規模の列でそのまま溢れる。`qr(matrix(1e308, 2, 2))` がランク 2、R[, 2] = −Inf (正しくはランク 1)、lm が係数 NaN。LAPACK 型 (`geqp3`、larfLeft) も同じく溢れる
- 方法: 今のまま分解し、入力が有限なのに結果 (qr と qraux) に有限でない値が出たときだけ分解し直す
  - LINPACK: [2^-256, 2^256] の外の列をそれぞれ、最大の要素の 2 の冪で割った複製 (`rangeExponent` を列ごとに) で分解し直す。LINPACK の判定 (残りのノルム < 元のノルム × tol、ノルムの更新の 1 − (abs(x)/norm)^2) は列ごとの相対なので、2 の冪の割り算 (厳密) で列の入れ替えとランクは変わらない。上三角 (R) の列 j は、その列の元の番号の指数 2^e で戻す。Householder ベクトル (対角より下) と、変換した列の qraux は単位がない。変換しなかった列 (最後の行の列、残りのノルムが 0 の列) の qraux はノルムなので戻す (`linpackQR` が変換した列の印 `transformed` を返すようにした。計算は変えていない)
  - LAPACK: 列の入れ替えがノルムの順なので、列ごとには割れない。行列全体を `decompositionExponent` (#131 と同じ、2^256 まで) で割って分解し直し、R を戻す。tau は単位がない
- 選んだ理由: ユーザー判断 (案 B)。今有限な結果は分解し直さないので 1 ビットも変わらない。常に列ごとに割る案 C は、列の中で巨大な値と極小の値が混ざるとき今より悪くなりうる
- 夜の試作からの変更: 割るのは範囲外の列だけにした (範囲内の列は割っても益がなく、サブノーマルの入力の桁を失いうる)。qraux を戻す列は試作の「最後の行以降」から「変換しなかった列」に正確にした

## 確認 (main `cf369c8`、R 4.5.2)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 | 真の値 |
|---|---|---|---|---|
| issue の `qr(matrix(1e308, 2, 2))` | ランク 2、R[, 2] = −Inf | 同じ | ランク 1、R = [−1.4142135623730951e308, −1.414213562373095e308; 0, 0] | ランク 1 |
| 同じ行列、`LAPACK = TRUE` | −Inf (decisions の下準備で確認) | R[1, 2] −Inf、R[2, 2] NaN、tau Inf | R は上と同じ、tau (1.7071067811865472, 0) | |
| `qr([[1e308, 1], [1e307, 2], [5e307, 3]], LAPACK)` | — | NaN を含む | R = [−1.1224972160321825e308, −2.4053511772118195; 0, −2.866057521105554] (LINPACK の値 −2.866057521105555 と 1 単位) | |
| `lm(y ~ x)`、x = (1e308, 5e307, 3e307, 8e307)、y = (1, 3, 2, 4) | (NaN, NaN) | (NaN, NaN) | (2.9482758620689657, −6.896551724137934e-309) | x/2^1000 の当てはめ: (2.9482758620689653, −7.389714532319081e-8 × 2^-1000) |
| 同じ `glm` (gaussian) | エラー "names() applied to a non-vector" (非有限の係数) | (0, 0) (誤り) | lm と同じ | |

- R の dqrdc2・LAPACK も同じく溢れるので、R と違う値になる。docs の「R が失敗する所」の表に 1 行足した
- 掃引 (scratchpad の `la4.ts`): 2^1023 規模の乱数行列 3000 個 (n = 2〜6、p = 1〜4、3 個に 1 個は列ごとに 2^-400 までずらす、5 個に 1 個は従属な列、LINPACK と LAPACK が半々) を、A/2^1000 の分解を 2^1000 倍で戻したものと比べた。すべて有限、ランクと列の入れ替えはすべて一致、R の差は最大の要素の 4.7e-16 倍以内。lm (x が 2^1023 規模、6 点) 1000 件で係数はすべて有限、x/2^1000 の当てはめとの相対差 1.6e-13 以内 (条件数による)
- 今有限な結果が変わらないこと: review_fix_log_issue131.md の掃引 (qr・縦長の qr・qr lapack・lm の 4200 件ずつ) で、修正前と違ったのは修正前に NaN を含んでいた qr lapack の 1 件だけ

## 修正

- `src/linalg/qr.ts`: `qr` で分解のあとに有限性を確かめ、有限でなければ分解し直す (LINPACK は列ごと、LAPACK は全体)。`linpackQR` が `transformed` を返す
- docs (英・日) の「R が失敗する所」の表に `qr(matrix(1e308, 2, 2))` と lm の行を追加

## テスト

- `test/issue130.test.ts`: issue の行列 (LINPACK のランク 1 と R、LAPACK の R と tau)、LAPACK だけ溢れていた 3 × 2 (LINPACK の値は修正前のビット)、lm と glm (gaussian) の係数と x/2^1000 の当てはめとの比較、溢れない 1e300 規模の lm は修正前のビット。stash で、修正前に 4 件中 3 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 271 files、2555 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- glm の poisson・Gamma は同じ x で直らない。poisson は "non-finite coefficients at iteration 1" で (0, 0)、未収束 (x/2^1000 の当てはめは (1.0930885747615884, −2.762496599344877e-309))。Gamma は「the matrix contains NaN or infinite values」のエラー。重み √W を掛けた計画行列 (√W x) が QR の前に溢れるため (QR の入力が有限でない)。binomial は (−0, 0) で x/2^1000 の当てはめと同じ。glm の作業重みは別のグループ (#165〜#168) で扱う
- `qr(..., LAPACK = TRUE)` は入力の有限性を確かめない (下準備の範囲外の記録と同じ。NaN・Inf の入力では分解し直さない)

## close comment

Fixed in <commit of #130, see git log --grep='#130'>: qr now checks its result, and where the decomposition of a finite matrix is not finite (the Householder products overflowed), it is made again: for the default LINPACK method with each column beyond [2^-256, 2^256] divided by the power of 2 of its largest entry (LINPACK's dependence tests are relative to each column, so the pivoting and the rank are unchanged by the exact scaling), and for lapack: true with the whole matrix divided by a power of 2 (the pivoting compares column norms). The upper triangle and the norms kept in qraux for untransformed columns are scaled back; the Householder vectors, the other qraux and tau have no units. qr(matrix(1e308, 2, 2)) now has rank 1 and R = [[-1.4142135623730951e308, -1.414213562373095e308], [0, 0]] (was rank 2 with -Inf, as in R), and lm(y ~ x) with x = (1e308, 5e307, 3e307, 8e307) gives (2.9482758620689657, -6.896551724137934e-309), the fit of x / 2^1000 scaled back (was NaN, as in R); glm with the gaussian family gives the same. In a sweep of 3000 random matrices near 1e308 the results are finite with the rank and pivoting of the scaled decomposition. A result that was finite is not recomputed, so its bits are unchanged. Recorded in docs/differences-from-r.md. Test: test/issue130.test.ts. Recorded for later: glm with the poisson or Gamma family on the same predictor still fails, since the weighted model matrix overflows before the QR. (Not pushed yet.)
