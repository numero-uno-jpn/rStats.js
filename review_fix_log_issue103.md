# Issue #103 対応ログ: pnbinom・qnbinom (mu) で p か q が double で 0 になる

GitHub Issue #103。#95 で範囲外として記録した部分。ユーザー判断: 級数で届く範囲だけ直す。調べた結果、p < 2^-1022 なら (x + 1) p < 4 なので、この領域全体が級数で届いた。計画は承認済み。

## 確認 (main `9044ead`)

`fromMu` の p = size/(size + mu) (か q = mu/(size + mu)) が 2^-1074 未満で 0 になり、pnbinom は I_p(size, x + 1) の端点の値を返していた。issue の指摘どおり (dnbinom は #95 で直してある)。

| 呼び出し (size = MIN、mu = MAX) | 真値 | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|---|
| pnbinom(0) | ほぼ 1 | 0 | 0 | 1 |
| pnbinom(0, 上側, log) | −737.15785 | 0 | 0 | −737.1594 (下を参照) |
| qnbinom(0.5) | 0 | NaN | Infinity | 0 |
| (q 側) pnbinom(0, MAX, mu = MIN, 上側, log) | −744.44007 | −Inf | −Inf | 一致 |

`src/special/incbet.ts` の `betaIncTinyX(a, b, x, lx, …)` は、x < DBL_MIN の I_x(a, b) を x の log (double-double) から作る (小さな形状の扱いを含む。F 分布が同じく正確な log を渡して使っている)。`betaIncCore` は log を `ddLog(xd)` で作るので、p = 0 では −Inf になっていた。

## 修正 (`src/distributions/negbinomial.ts`)

- pnbinom・qnbinom の mu の経路も `fromMuDensity` (#95、小さいほうの比を 2^1100 倍で持つ) を使う。比が正規化数の範囲なら `fromMu` と同じで、計算は以前と同じビット
- `pnbinomRaw`: 比を縮めて持つとき、p 側は `betaIncTinyX(size, x + 1, p, log p, lower, log)`、q 側は `betaIncTinyX(x + 1, size, q, log q, !lower, log)`。log は ddLog(仮数) − 1100 ln 2 (double-double)。x = Infinity は端の値 (分位点の探索で、最大の double からの最初の一歩が溢れると Infinity を渡すため。これがないと NaN になった)
- `quantileRaw`: 比を戻した値 (0 でよい) で始点を作る。p 側は gamma の近似で y0 = g/p を log から (MAX で頭打ち)
- docs (英・日) の「R が不正確な場合」(分布) に 1 行。#95 のログの範囲外に、ここで直したと追記

## 検証

- 参照値: Rmpfr (3000 ビット) で、極小の z (p か q) について I_z(A, B) = z^A (1 − z)^B/(A B(A, B)) Σ (A + B)_k/(A + 1)_k z^k を直接計算し、反対側は 1 − その値 (scratchpad の i103ref.R)。入力の double は仮数と指数で渡した。最初は級数の打ち切りを相対 2^-200 にしていて、下側が 1 − 6.8e-137 のように 1 に極めて近い場合に上側が誤っていた (参照値側の誤り)。2^-2900 で作り直した
- 260 件 (p 側・q 側の格子と乱数): size ≥ 1e-305 の 237 件で、下側・上側の log が最大 2.1e-14 (相対、|log| < 1 では絶対)
- qnbinom: 8 組 × 6 個の p で F(q − 1) < p ≤ F(q) (またはq = Infinity で F(MAX) < p)。size 1、mu = MAX の中央値 ≈ ln 2 × MAX、p = 0.7 は Infinity (F(MAX) = 1 − 1/e)
- `test/review56.test.ts` の `qnbinom(0.5, 1, { mu: 1.5e308 })` (p = 6.7e-309 がサブノーマルで、新しい経路に入る) の期待値を 1.039720770839915e308 から 1.0397207708399155e308 に直した。探索の目標 1/2 (1 − 8ε) での厳密な閾値は 1.0397207708399153110e308 (Rmpfr) で、新しい値はそれ以上の最小の double、古い値は 1 つ下の double (閾値に届いていない)

## テスト

- `test/issue103.test.ts`: 24 件の参照値 (log の下側・上側と線形)、issue の例、qnbinom の逆関数の条件。stash で、修正前に 3 件中 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2461 passed / 38 skipped、失敗 2 (review56 は上で直した。もう 1 件は既知の揺れの signrank の実行時間)。2 つのファイルを流し直して 35 件すべて通った。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- size が 1e-305 未満 (サブノーマル規模) では、log P[X ≤ x] ≈ −size × (数百) がサブノーマル数で有効数字が 10 ビット程度しかなく、そこから −expm1 で作る上側の log が相対 2e-6 ほどずれる (size = MIN、mu = MAX で −737.1594、真値 −737.15785)。`betaIncTinyX` (pbeta も使う) が形状がこの規模のときに持つ制約。修正前は 0 だった
