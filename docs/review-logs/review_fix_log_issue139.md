# Issue #139 対応ログ: propTest のプールした割合で試行数の合計が溢れる

GitHub Issue #139。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 等しい割合の検定 (p を与えない) のプールした割合 Σx / Σn で、各群の n は有限なのに Σn が溢れて Inf になり、割合が 0 になる。期待度数 0 で統計量が Inf か NaN (p 0)。有限の正しい値にする
- 方法: Σn が有限ならこれまでどおり。溢れたときだけ、x と n を 2^-s 倍 (2^s ≥ 群の数) してから両方の合計を取り、比を取る。共通の 2 の冪は比で打ち消すので、戻す必要がない
- 選んだ理由: issue の案 (群の割合の重み付きの組み合わせ) は通常の入力でも丸めが変わる。2 の冪の単位なら、溢れない範囲では元の和と同じ丸め。Σn が有限な通常の入力は同じビット。統計量の各項 (期待度数 n_i p など) は群ごとで有限なので、ほかは変えない
- 57 回目の判断 (binomTest・poissonTest でカウントの合計が溢れるものはエラー) との関係: あれは合計が二項分布の試行数そのもので、表せない n では検定が定義できない場合。ここで溢れるのは群をまたいだ合計で、どの群の n も有限で、プールした割合・統計量・p 値は有限で表せる。値を返すので衝突しないと判断した。表の形式で 1 群の成功 + 失敗が溢れる場合 (`propTest([[1e308, 1e308]])`) は、群の n 自体が表せないので今のまま ("elements of 'n' must be finite")

## 確認 (`b9e3db9`)

issue の指摘どおり。R 4.5.2 は Inf (p 0)。

| 呼び出し | R | 修正前 | 修正後 | 参照 (Rmpfr、300 ビット) |
|---|---|---|---|---|
| propTest([5e307, 5e307], [1e308, 1e308], correct false) | Inf | NaN (p 0) | 0 (p 1) | 0 |
| propTest([6e307, 4e307], [1e308, 1e308], correct false) | Inf | NaN | 7.999999999999995e306 | 7.9999999999999976928e306 (相対 3e-16。squareOver の (d/√e)² の経路の丸め) |
| propTest([6e307, 4e307, 5e307], [1e308 × 3]) | | NaN | 7.999999999999995e306 | 同上 |
| propTest([MAX/2, MAX/2], [MAX, MAX]) | | | 0 | |
| propTest([6e299, 4e299], [1e300, 1e300], correct false) | | 8.000000000000001e298 | 同じ | 8.0000000000000004200e298 |

既定 (correct true) の [5e307, 5e307] は、修正前から補正が上限に当たって統計量 0 だった (プールした割合を使わない)。

## 修正

`src/htest/propTest.ts`: `pooledProportion(xs, ns)` を足した。

## テスト

- `test/issue139.test.ts`: 上の表と、R の例 (smokers) の値 12.60041129712764 が変わらないこと。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2530 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

`docs/differences-from-r.md` と `docs/ja/differences-from-r.md` の「R が失敗し rStats.js が値を返す」表に 1 行足した (#140 の行の下)。

## 範囲外として記録

- 統計量の最下位の数 ulp は、#140 と同じ `squareOver` の (d/√e)² の経路の丸め (共有の関数なので触らない)

## close comment

Fixed in <commit of #139, see git log --grep='#139'>: where the total of the trials overflows (each n finite), the pooled proportion is formed from both totals in units of 2^s, 2^s >= the number of groups; the common power of 2 cancels in the ratio, and elsewhere the bits are unchanged. propTest([5e307, 5e307], [1e308, 1e308], { correct: false }) now gives a statistic of 0 and a p-value of 1, and propTest([6e307, 4e307], [1e308, 1e308], { correct: false }) 7.999999999999995e306 (Rmpfr for these doubles: 7.9999999999999977e306); R gives Inf (recorded in docs/differences-from-r.md). A table row whose successes plus failures overflow is still rejected, as that group's n is not representable. Test: test/issue139.test.ts. (Not pushed yet.)
