# Issue #76 対応ログ: optim が maxit = Infinity を受け付け、SANN が止まらない

GitHub Issue #76。計画は承認済み。

## 確認 (main `eb90fe6`)

`optim` (`src/optim/optim.ts`) は `control.maxit` を検査していなかった。SANN (`annealing`) は `while (evals < maxit)` で回るので、maxit = Infinity では止まらない (issue の主張どおり。コードで確認し、止まる呼び出しは実行していない)。Nelder–Mead (`evals <= maxit`) なども、収束しなければ同じ。NaN の maxit は比較が偽になり、黙って 1 回で終わっていた。

R 4.5.2 は maxit を `as.integer` で整数にする。

| control.maxit | R 4.5.2 |
|---|---|
| Inf、NaN、3e9 (整数の範囲外) | エラー "'maxit' is not an integer" (Nelder-Mead・BFGS・SANN とも) |
| 2.7 | 2 に切り捨て (Nelder–Mead で par 1 1、counts 5 NA) |

## 修正

R と同じく、|maxit| ≤ 2147483647 (NaN は不可) でなければ RangeError "'maxit' is not an integer" にし、それ以外は Math.trunc で切り捨てる。負の値は R と同じく受け付ける (各方法の maxit ≤ 0 の扱いのまま)。整数の maxit の値は変わらない。小数の maxit も、評価回数が整数なので、切り捨ての前後で同じ結果になる (2.7 の Nelder–Mead は修正前も 5 評価)。R と同じ振る舞いなので docs は変えない。

## テスト

- `test/issue76.test.ts`: 5 つの方法 (Nelder-Mead・BFGS・CG・SANN・L-BFGS-B) で maxit ±Infinity・NaN・3e9 が RangeError。maxit 2.7 が R と同じ counts (5) で、maxit 2 と同じ
- 修正前の SANN の Infinity は止まる呼び出しなので、stash の確認は流さなかった。止まらない部分を除いた切り捨てのテストは、修正前も通る (上のとおり同じ値)
- 全体テスト `npx vitest run`: 2414 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
