# Issue #107 対応ログ: lchoose の小さな k で、0 でない係数が double で 0 に落ちると −Infinity

GitHub Issue #107。rCompatible: false (数学的な一般化二項係数) の値の修正 (docs は不要)。計画は承認済み。

## 確認 (main `573b2df`)

`src/special/choose.ts` の `lchoose` (k < K_SMALL) は、double-double の積 `fallingRatio(n, k)` が 0 なら、係数が厳密に 0 とみなして −Infinity を返していた。整数でない n で係数が 2^-1074 未満に落ちた場合も 0 になる。issue の指摘どおり。

| 呼び出し (rCompatible: false) | 真値 | 修正前 | 修正後 |
|---|---|---|---|
| lchoose(MIN, 2)、lchoose(−MIN, 2) | −1075 ln 2 = −745.13321910194110762… | −Infinity | −745.1332191019411 |
| lchoose(MIN, 3) | log MIN + log 2 − log 6 | −Infinity | 一致 |
| lchoose(3, 5)、(0, 2)、(2, 3) | −Infinity (厳密に 0) | −Infinity | −Infinity |

R 互換 (既定) では、R と同じく n を整数に寄せるので、lchoose(1e-200, 3)、lchoose(MIN, 2) は −Infinity のまま (R 4.5.2 も −Inf)。

## 修正

`if (v === 0) return -Infinity;` を消し、v = 0 もすぐ下の log の和 (−lgamma(k + 1) + Σ log|n − j|) に回した。厳密に 0 の係数は因子 n − j = 0 (double の n − j が 0 になるのは n = j のときだけ) を含み、log 0 = −Infinity で和も −Infinity になる。

## テスト

- `test/issue107.test.ts`: 上の表と R 互換の既定。lchoose(MIN, 2) は −1075 ln 2 と相対 4e-16 以内 (`-1075 * Math.LN2` は double の掛け算の丸めで 1 ulp 大きい −745.1332191019412)。stash で、修正前に 3 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2471 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
