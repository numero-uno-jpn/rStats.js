# Issue #33 対応ログ: pnorm の log で a² が溢れる

GitHub Issue #33。計画は承認済み。

## 再現 (main `d535346`)

| 入力 | rStats.js (修正前) | R 4.5.2 | 修正後 |
|---|---|---|---|
| `pnorm(-1.5e154, { logP: true })` | −Infinity | −1.125e308 | −1.1250000000000002e308 |
| `pnorm(1.5e154, { lowerTail: false, logP: true })` | −Infinity | ― | 同じ |
| `pnorm(-1.89e154, { logP: true })` | −Infinity | ― | −1.78605e308 |

## 原因と修正

`src/distributions/normal.ts` の `pnormStd` は、対数の裾を log(erfcx(a/√2)/2) − (a·a)/2 で作る。a·a が a = 1.34e154 を超えると溢れるが、a²/2 は 1.89e154 まで有限。

修正: (a/2)·a にする。a/2 は正確なので、溢れない範囲では同じビット。normal.ts のほかの 2 乗 (`dnorm` の 0.5·z·z) は左から 0.5·z を先に計算するので溢れない。

## テスト

- `test/issue33.test.ts`: z = −1.5e154、−1.8e154 で、下側と上側の log 確率が −(z/2)·z − log|z| − log√(2π) と相対 1e-15 で一致し、R の −1.125e308 とも一致する。ふつうの z は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2321 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- R と同じ値になるだけなので、変えていない
