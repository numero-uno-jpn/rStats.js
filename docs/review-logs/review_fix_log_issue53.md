# Issue #53 対応ログ: firstTrue で lo + step が溢れるとき

GitHub Issue #53。計画は承認済み。

## 再現 (main `c5f6a5d`)

`firstTrue` (`src/internal/discrete.ts`) は、lo から step を倍にして j = lo + step を試し、そのあと 2 分探索する。hi = Infinity で lo + step が溢れると、j = Infinity を候補にしていた。

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `firstTrue(x => x >= 1.6e308, 1e308, Infinity)` (issue の例) | Infinity (有限の区間がないまま 2 分探索が止まる) | 1.6e308 |
| `firstTrue(x => x >= 1.6e308, 0, Infinity)` | Infinity | 1.6e308 |
| `firstTrue(x => x >= Number.MAX_VALUE, 0, Infinity)` | Infinity | MAX_VALUE |
| `firstTrue(() => false, 1e308, Infinity)` | 終わらない (`j > hi` が Inf > Inf で偽のまま回り続ける) | Infinity (hi + 1) |
| `firstTrue(x => x >= 5, 0, Infinity)` など通常の範囲 | 5 | 同じ |

終わらない場合は、確認中に再現した (npx tsx が timeout で止まり、残った node のプロセスはユーザーが終了した)。

公開関数で hi = Infinity を使うのは poissonTest だけ。その述語 (dpois(i) ≤ cut) は Infinity で真になり、探す境界は m + O(sqrt(m)) なので、MAX_VALUE には届かない。公開関数からは届かないとみる。内部関数の約束 (最初に真になる整数、なければ hi + 1) の誤りとして直した。R との違いではないので docs は変更しない。

## 修正

倍にしていく探索で、j = lo + step が Infinity になったら、候補を一度だけ `Number.MAX_VALUE` (整数) にする。そこで真なら今の 2 分探索に進み、偽なら hi + 1 を返す。2 分探索の式は変えていないので、今まで有限の j で終わっていた場合の値は変わらない。

## テスト

- `test/issue53.test.ts`: 上の表の値
- stash で、修正前に失敗することを確かめた (終わらない `it` は `-t` で除いた)
- 全体テスト `npx vitest run`: 2360 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし。テストのあと、残った node のプロセスがないことを確かめた
