# Issue #50 対応ログ: propTrendTest の NaN の score

GitHub Issue #50。計画は承認済み。

## 再現 (main `2a62353`、R 4.5.2)

R の `prop.trend.test` は、p = sum(x)/sum(n) と重み w = n/p/(1 − p) を全行から作り、`lm(freq ~ score, weights = w)` が score が NA の行を落とす (na.omit)。rStats.js は全行で回帰の和を作っていたので、score に NaN が 1 つあると統計量が NaN だった。

| 呼び出し | 修正前 | 修正後 | R 4.5.2 | 厳密な値 |
|---|---|---|---|---|
| `([1, 2, 3, 4], [10, 10, 10, 10], [1, NaN, 3, 4])` | NaN | 2.48888888888889、p 0.11465264168449397 | 2.48888888888888937、p 0.11465264168449634 | 112/45、p 0.11465264168449485 (Rmpfr) |
| `([1, 5, 3, 4], [10, 12, 10, 9], [1, NaN, 3, 7])` | NaN | 2.422669720993098、p 0.11959096225282984 | 2.42266972099309763、p 0.11959096225283008 | 2.4226697209930985 (有理数)、p 0.11959096225282952 |
| 残る score が 1 つ (`[NaN, NaN, NaN, 4]`) | NaN | NaN | NA | — |
| score がすべて NaN | NaN | RangeError "no non-missing scores" | エラー "0 (non-NA) cases" | — |

修正後の値と R の値は、どちらも厳密な値から丸めの範囲 (相対 1.3e-14 以内) でずれている。テストは厳密な値と相対 1e-13 で比べる。

## 修正

`src/htest/trendTests.ts` の `propTrendTest` で、p と w は今どおり全行から作り、回帰の和 (sBar、fBar、sxy、sxx) は score が NaN でない行だけで取るようにした。残る行がなければ RangeError。残る行が 1 つか score が一定なら sxx = 0 で NaN (R の NA と同じ)。NaN のない入力は和の順も同じで、値はビット単位で変わらない。JSDoc の `score` に扱いを書いた。R に合わせる修正なので docs は変更しない。

## テスト

- `test/issue50.test.ts`: 上の表の値。score を省略した場合と NaN のない場合は今と同じ (9.573428850537288)
- stash で、修正前に 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2352 passed / 34 skipped、失敗 1。失敗は `test/distributionProperties.test.ts` の signrank の実行時間の上限 (`dsignrank(302775, 1100)` が 3688 ms)。HANDOFF にある負荷による既知の失敗。`npx tsc --noEmit -p .`: エラーなし
