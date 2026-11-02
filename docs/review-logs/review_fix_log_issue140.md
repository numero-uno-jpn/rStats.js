# Issue #140 対応ログ: mcnemarTest で不一致の組の和が溢れる

GitHub Issue #140。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: 組の項 (n_ij − n_ji)² / (n_ij + n_ji) で、セルは有限なのに和が溢れて Inf になり、squareOver の分母が Inf で項が 0 になる (統計量 0、p 1)。有限の正しい値にする
- 方法: 和が有限ならこれまでどおり squareOver(d, a + b)。溢れたときだけ、差を 2^520、セルを 2^1040 を単位にして squareOver(d 2^-520, a 2^-1040 + b 2^-1040)。二乗と和の比なので単位は打ち消し、戻す必要がない。和が溢れるときは両方のセルが 2^969 を超える (どちらも最大の double 以下) ので、2^-1040 倍しても正規化数のままで厳密。d 2^-520 の二乗も溢れない
- 選んだ理由: 半分にするだけ (d² / (a/2 + b/2) / 2) では d² が溢れて squareOver の (d/√e)² の経路に入り、丸めが 3 回 (1 ulp ずれた)。2 の冪の単位を分けると、和が有限な場合と同じく丸めは二乗・和・商の 3 回で、参照値と同じビットになった。和が有限な通常の入力は同じビット
- 57 回目の判断 (binomTest・poissonTest でカウントの合計が溢れるものはエラー) との関係: あれは合計が分布の試行数 n そのもの (二項分布のパラメータ) で、double で表せない n では検定が定義できない場合。McNemar の和は統計量の途中の分母で、統計量・p 値は有限で表せるので、値を返す。衝突しないと判断した

## 確認 (main `55e98c1`)

issue の指摘どおり。R 4.5.2 は NaN ((b − c)² が Inf、Inf / Inf)。

| 呼び出し | R | 修正前 | 修正後 | 参照 (Rmpfr、200 ビット) |
|---|---|---|---|---|
| mcnemarTest([[0, 1e308], [8e307, 0]], correct false) | NaN | 0 (p 1) | 2.2222222222222226e306 (p 0) | 0x1.950ff5260674bp+1017 (同じビット) |
| 同じ、correct true (既定) | NaN | 0 | 同上 (2e307 − 1 は 2e307 に丸まる) | |
| mcnemarTest([[0, MAX], [8e307, 0]], correct false) | | 0 | 3.8318290101042034e307 | 3.8318290101042024e307 (差 2 ulp は MAX − 8e307 の double の丸め。修正前の和が有限な経路と同じ) |
| 3 x 3 [[0, 1e308, 1], [8e307, 0, 2], [3, 4, 0]] | | 1.6666666666666665 | 2.2222222222222226e306 | |
| mcnemarTest([[0, 1e300], [8e299, 0]]) | | 2.2222222222222223e298 | 同じ | |

## 修正

`src/htest/mcnemarTest.ts`: `pairTerm(d, a, b)` を足し、2 x 2 の補正つきと r x r の和の両方で使う。

## テスト

- `test/issue140.test.ts`: 上の表。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2528 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

`docs/differences-from-r.md` と `docs/ja/differences-from-r.md` の「R が失敗し rStats.js が値を返す」表に 1 行足した (chisq.test(c(1e200, 1e200), …) の行の下)。

## 範囲外として記録

- `squareOver` (`src/internal/summary.ts`) の d² が溢れる経路 (d/√e)² は丸めが 3 回 (平方根を含む) で、最下位が 1 ulp ずれうる。共有の関数で、ほかの検定のビットが変わるので触らない
- chisqTest の分割表で表の合計が溢れる場合 (`chisqTest([[1e308, 1e308], [1e308, 1e308]])` は "the expected counts contain NaN" のエラー)。#141 は適合度の経路だけ

## close comment

Fixed in <commit of #140, see git log --grep='#140'>: where n_ij + n_ji overflows, the pair's term is formed with the difference in units of 2^520 and the cells in units of 2^1040, (d 2^-520)^2 / (a 2^-1040 + b 2^-1040), which is exact scaling and needs no scaling back; elsewhere the bits are unchanged. mcnemarTest([[0, 1e308], [8e307, 0]]) (with or without the correction) now gives 2.2222222222222226e306, the correctly rounded quotient for these doubles (Rmpfr), instead of 0; R gives NaN (recorded in docs/differences-from-r.md). Test: test/issue140.test.ts. (Not pushed yet.)
