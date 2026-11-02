# Issue #141 対応ログ: chisqTest の適合度検定で度数の合計が溢れる

GitHub Issue #141。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 適合度検定の合計 n = ddSum(x) が、各度数は有限なのに溢れて Inf になり、期待度数 n p_i が Inf、統計量・残差が NaN になる。有限の正しい値にする
- 方法: n が有限ならこれまでどおり。溢れたときだけ、度数を 2^-s 倍 (2^s ≥ セルの数、s は偶数) した座標で合計・期待度数・統計量・残差を作り、期待度数と統計量は 2^s 倍、残差 (x − E)/√E と標準化残差は 2^(s/2) 倍で戻す (s を偶数にして平方根の単位も 2 の冪にした)。どの式も、指数の範囲が広い double で元の式を計算したのと同じ丸め
- 選んだ理由: 期待度数を「割合 × 合計」以外の形 (x_i / 合計 など) で作ると通常の入力でも丸めが変わる。2 の冪の単位なら、s = 0 (合計が有限) で以前と同じビット。期待度数そのものが最大の double を超える場合 (`chisqTest([MAX, MAX], p = [0.9, 0.1])` の 3.2e308) は、その期待度数と統計量は Inf (表せない値なので正しい)
- シミュレーション (simulatePValue) は合計が整数の度数を引く必要があり、溢れる合計は引けないので今のままエラー ("the simulation needs counts summing to an integer"、合計 Inf は整数でない)
- 57 回目の判断 (binomTest・poissonTest でカウントの合計が溢れるものはエラー) との関係: あれは合計が分布の試行数そのもので、表せない n では検定が定義できない場合。適合度の χ² 統計量・期待度数・p 値は有限で表せるので値を返す。衝突しないと判断した (シミュレーションは多項分布の試行数が要るのでエラーのまま。こちらは 57 回目と同じ扱い)

## 確認 (`5deae56`)

issue の指摘どおり。R 4.5.2 も NaN (期待度数 Inf)。

| 呼び出し | R | 修正前 | 修正後 | 参照 (Rmpfr、300 ビット) |
|---|---|---|---|---|
| chisqTest([1e308, 1e308]) | NaN | NaN、期待度数 Inf | 0 (p 1)、期待度数 1e308、残差 0 | 0 |
| chisqTest([1.2e308, 0.8e308]) | NaN | NaN | 7.999999999999996e306、期待度数 1e308、残差 ±2e153 | 7.9999999999999980920e306 (相対 2.5e-16) |
| chisqTest([1.2e308, 0.8e308], p = [0.3, 0.7]) | | NaN | 8.571428571428569e307、期待度数 [6e307, 1.4e308] | 8.5714285714285705927e307 |
| chisqTest([1e308, 1e308, 1e308, 0]) | | NaN | 1e308 | 1e308 |
| chisqTest([1.2e300, 0.8e300], p = [0.3, 0.7]) | | 8.571428571428571e299 | 同じ | |

## 修正

`src/htest/chisqTest.ts` の `goodnessOfFit`。s = 0 のときは、xs・Es は x・E そのもので、ldexp(v, 0) は v。

## テスト

- `test/issue141.test.ts`: 上の表 (期待度数・残差・標準化残差も Rmpfr と相対 1e-15)、シミュレーションはエラーのまま。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2532 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

`docs/differences-from-r.md` と `docs/ja/differences-from-r.md` の「R が失敗し rStats.js が値を返す」表に 1 行足した (#139 の行の下)。

## 範囲外として記録

- 分割表の経路 (`contingency`) で表の合計が溢れる場合 (`chisqTest([[1e308, 1e308], [1e308, 1e308]])` は "the expected counts contain NaN" のエラー。productOver(行和, 列和, Inf) が 0 か NaN になる)。行和・列和の溢れも同じ。issue は適合度の経路だけ
- 統計量の最下位の数 ulp は、#140 と同じ `squareOver` の (d/√e)² の経路の丸め

## close comment

Fixed in <commit of #141, see git log --grep='#141'>: where the total of the counts overflows (each count finite), the goodness-of-fit test forms the total, the expected counts, the statistic and the residuals from the counts in units of 2^s (2^s >= the number of cells, s even), and scales the expected counts and the statistic back by 2^s and the residuals by 2^(s/2); with a finite total the bits are unchanged. chisqTest([1e308, 1e308]) now gives a statistic of 0, a p-value of 1 and expected counts [1e308, 1e308], and chisqTest([1.2e308, 0.8e308]) 7.999999999999996e306 (Rmpfr for these doubles: 7.9999999999999981e306); R gives NaN (recorded in docs/differences-from-r.md). A simulated p-value still needs a representable total and is still an error. The same overflow in the contingency-table path is not covered here. Test: test/issue141.test.ts. (Not pushed yet.)
