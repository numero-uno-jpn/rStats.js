# Issue #92 対応ログ: extraDistr の乱数と無限大のパラメータ

GitHub Issue #92。ユーザー判断: r を q にそろえる。確認のため、ユーザーの許可を得て extraDistr 1.10.0.5 をローカルの R 4.5.2 に入れた。計画は承認済み。

## 確認 (main `9016ad1`)

`src/random/extra.ts` の `rkumar`・`rpareto`・`rinvgamma` は、パラメータが有限でなければ乱数を引かずに NaN を返していた。extraDistr (set.seed(1) のあとの runif(1) で、引いた乱数の数を判定):

| 呼び出し | extraDistr | 乱数 | rStats.js の d・p・q | 修正前 | 修正後 |
|---|---|---|---|---|---|
| rkumar(2, Inf, 2) | 1, 1 | 2 | 極限 (q = 1) | NaN、0 | 1, 1、2 |
| rkumar(2, Inf, Inf) | 1, 1 | 2 | NaN | NaN、0 | NaN、2 |
| rkumar(2, 2, Inf) | 0, 0 | 2 | NaN (extraDistr: p 1、q 0) | NaN、0 | NaN、2 |
| rpareto(2, Inf, 2) | 2, 2 | 2 | 極限 (q = b) | NaN、0 | 2, 2、2 |
| rpareto(2, 2, Inf)、(Inf, Inf) | Inf, Inf | 2 | NaN (extraDistr: p 0、q Inf) | NaN、0 | NaN、2 |
| rinvgamma(2, Inf, 3) | 0, 0 | 0 | 極限 (q = 0) | NaN、0 | 0, 0、0 |
| rinvgamma(2, 3, Inf)、(Inf, Inf) | Inf, Inf | 0 | NaN (extraDistr の d・p・q も NaN) | NaN、0 | NaN、0 |
| rkumar(2, −1, Inf)、rpareto(2, NaN, Inf) | NA | 0 | NaN | NaN、0 | NaN、0 |
| rinvgamma(2, −1, Inf) | Inf | 0 | NaN | NaN、0 | NaN、0 (#91 と同じく、分布を定義しない形状) |

issue の指摘 (無限大で値と乱数の消費が extraDistr と違う) は正しい。rStats.js の中でも、a・alpha = Inf では q が極限の値を返すのに、r (q(1 − u) による逆関数法) だけが NaN で、食い違っていた。

## 修正

- a・alpha = Inf は、q と同じ極限の値 (rkumar 1、rpareto b、rinvgamma 0)。値も引く乱数の数も extraDistr と一致する。rinvgamma は extraDistr の 1/rgamma と同じく乱数を引かない
- b・beta = Inf は、rStats.js の d・p・q と同じく NaN のまま。extraDistr が引く乱数 (kumar・pareto は 1 個、invgamma は 0 個) は引き、乱数列をそろえる (rlogis の負の尺度と同じ扱い)
- 有限のパラメータは以前と同じ式で、同じ値・同じ乱数
- docs (英・日) の "Distributions outside base R" の項に書き足した

## テスト

- `test/issue92.test.ts`: 上の表の各行の値と、引いた乱数の数 (次の runif(1) が何番目の一様乱数か)。stash で、修正前に 3 件中 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2441 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## 範囲外として記録

- b・beta = Inf の d・p・q は NaN のまま (extraDistr は kumar の b = Inf で p 1・q 0、pareto の b = Inf で p 0・q Inf を返す)。極限として扱う案もユーザーに示したが、選ばれなかった
