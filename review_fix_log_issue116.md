# Issue #116 対応ログ: df・pf で m x ≥ 1e290 かつ n がさらに大きいとき、p ≈ 1 の近似に誤って落ちる

GitHub Issue #116。計画は承認済み。

## 確認 (main `b8e0b92`)

`src/distributions/f.ts` の `fRatios(x, m, n)` は、m x ≥ 1e290 で undefined を返し、呼び出し側 (fDensity、pfRaw、pfBoth) は m x ≫ n とみなして q = n/(m x)、p = 1 − q とする。n がもっと大きいと q > 1 になり誤る。issue は NaN になると書いていたが、実際は端の値 (下側と上側が入れ替わったような値) だった。

真値はベータの座標 p = m x/(n + m x) での pbeta・dbeta (rStats.js の値。ベータの側は正しい)。

| (x, m, n) | | 真値 | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|---|---|
| (1e150, 1e150, 1e308) | pf 下側 log | −0 | 0 | −Inf | −0 |
| | pf 上側 log | −4.999999975e299 | −Inf | 0 | 一致 |
| | df log | −4.999999975e299 | −Inf | −Inf | 一致 |
| (3e295, 1, 1e300) | df log | −1.4999775004499899e295 | | +5.2071565881510596e300 | 一致 |

下側は R が正しく、rStats.js が誤っていた。上側と密度の log は R も −Inf。

## 修正

`fRatios` で積が 1e290 以上のとき、すぐ諦めずに、大きいほうの因子と n を 2^600 で割って (厳密、比は変わらない) 比を double-double で作る。割った積がまだ 1e290 以上か、n/2^600 が 1e-290 未満なら、m x ≫ n なので今どおり undefined (呼び出し側の p ≈ 1、q ≈ n/(m x) が正しい)。m x ≫ n の既存の場合の値は変わらない (pf(1e300, 5, 7)、df(1e295, 10, 1e10) など)。docs (英・日) の「R が失敗する場合」に 1 行。

## テスト

- `test/issue116.test.ts`: 3 組でベータの座標の pbeta (下側・上側の log)・dbeta + log(dp/dx) と相対 1e-14 以内。m x ≫ n の場合は以前と同じ値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2486 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
