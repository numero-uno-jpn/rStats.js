# Issue #61 対応ログ: optimize で関数が NaN・±Inf を返すとき

GitHub Issue #61。計画は承認済み。R と同じ置き換えを入れることはユーザー判断。

## 確認 (main `2c9526e`、R 4.5.2)

issue は「内部の点で関数が NaN を返すと localMin が終わらない」とするが、再現しない。issue の例は 8 回の評価で 0.2 を返した。+Inf、−Inf、すべて NaN の場合も 21 回以内で終わった (評価の回数を数え、timeout 付きで確かめた。残ったプロセスもない)。NaN の点では比較がすべて偽になり、`fu <= fx` が偽の枝で区間の端 (a か b) が u に動くので、区間は縮み続ける。

ただし、有限でない値のときの結果が R と違った。R の optimize は、NaN と +Inf を最大の double、−Inf を最小の double に置き換えて探す (警告 "NA/NaN replaced by maximum positive value"、"Inf replaced by maximum positive value"、"-Inf replaced by maximally negative value" で観察できる)。

| 関数 (区間 0〜1) | 修正前 | 修正後 | R 4.5.2 |
|---|---|---|---|
| x ≥ 0.5 で NaN、それ以外 (x − 0.2)² | 0.2 | 0.19999999999999996 | 0.19999999999999996 |
| x ≥ 0.5 で +Inf | 0.2 | 0.19999999999999996 | 0.19999999999999996 |
| x ≥ 0.5 で −Inf | 0.9999338930386481 | 0.6180798245708707 (objective −Inf) | 0.61807982457087078 (objective −Inf) |
| x < 0.3 で NaN | 0.7 | 0.7 | 0.7 |
| すべて NaN | 0.3819660112501051 | 0.9999338930386481 (objective NaN) | 0.9999338930386481 (objective NaN) |

## 修正

`optimize` (`src/numerics/integrate.ts`) で、localMin に渡す関数を包み、NaN と +Inf を `Number.MAX_VALUE`、−Inf を `-Number.MAX_VALUE` にした。maximum のときは符号を反転したあとの値に置き換える。x/2 の区間で探す枝も同じ関数を通る。objective は今どおり元の f(x)。警告は返さない (方針どおり)。`localMin` は変えていない。

docs (`docs/differences-from-r.md` と `docs/ja/`) の「R に合わせた動作」の数値計算の節に書いた。

## テスト

- `test/issue61.test.ts`: 上の表の 5 例 (R の値)、maximum: true、有限の関数は今と同じ
- 有限の `(x − 0.2)²` は、修正の前後とも 0.20000000000000007 で、R の 0.20000000000000009 と 1 ulp 違う (今回の変更とは関係ない。関数の評価か Brent の手順の末尾のビットの違いとみられる。記録だけ)
- stash で、修正前に 2 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2374 passed / 34 skipped、失敗 1。失敗は `test/distributionProperties.test.ts` の signrank の実行時間の上限 (`dsignrank(302775, 1100)` が 1056 ms)。HANDOFF にある負荷による既知の失敗。`npx tsc --noEmit -p .`: エラーなし
