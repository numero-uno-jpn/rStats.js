# Issue #27 対応ログ: pexp の log 下側確率 (rate × q が非正規化数)

GitHub Issue #27。オーナーの判断: 直す (以前は「R に合わせて残す」として既知の違反に記録していた)。計画は承認済み。

## 再現 (main `486c0e9`)

| 入力 | rStats.js (修正前) | R 4.5.2 | 修正後 |
|---|---|---|---|
| `pexp(1e-20, { rate: 1e-300, logP: true })` | −736.8272408909739 | 同じ (fixture) | −736.8272297580946 (= log(1e-300) + log(1e-20)) |
| `pexp(9.530984706928441e-97, { rate: 4.936871737348155e-227, logP: true })` | log の誤差あり | ― | log rate + log q と相対 1e-15 |

## 原因と修正

rate × q を double-double で作っても、積が非正規化数だと下位の部分が残らず、丸めた積で log(−expm1(−t)) を取っていた (非正規化数の刻みの相対誤差がそのまま出る)。

`src/distributions/exponential.ts` (`pexp1`): 下側確率の対数で、積の上位の部分が最小の正規化数 (2^-1022) より小さいときは log(rate) + log(q) + log1p(−t/2) とする (log((1 − e^-t)/t) = −t/2 + O(t²))。それ以外は今と同じ (同じビット)。線形の値は、非正規化数の精度しかないので変えていない。

## テストと fixture

- `test/issue27.test.ts`: 2 例が log rate + log q と相対 1e-15 で一致する。積が正規化数のときは今と同じ
- `test/simple.test.ts`: pexp の fixture のうち、R と違う 1 件 (pexp(1e-20, 1e-300, log.p = TRUE)) を `knownDifference` に記録した。値が log rate + log q と相対 1e-14 以内であることを、テストの中で確かめる
- `test/helpers/distributionKnown.ts`: 指数分布の既知の違反 (pexp の対数の精度と、qexp の往復) を消した。修正で不要になった (性質のテストが「不要な既知の違反」として知らせた)
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2316 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- 「R が不正確な場合」: rate × q が非正規化数の pexp の log 下側確率
