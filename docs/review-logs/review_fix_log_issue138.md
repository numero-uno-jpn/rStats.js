# Issue #138 対応ログ: 非心 t の分位点が最大の double の近くで Infinity

GitHub Issue #138。夜間の自律修正 (Plan モードの代わりに計画をここに書く)。

## 計画

- 意図: `qnt1` の遠い裾のべき乗則 (|t| = exp(ly)) が `ly > 709.78` で Infinity を返す。log(Number.MAX_VALUE) = 709.7827… なので、(1.7928e308, 1.7977e308] の有限の分位点が Infinity になる
- 方法: 閾値を外して `s * Math.exp(ly)` にする。Math.exp は最大の double を超えると Infinity になるので、閾値は要らない
- 選んだ理由: issue の案どおり。ly ≤ 709.78 では同じ式なのでビットは変わらない

## 確認 (main `731b15c`)

issue の例 (ncp = 0、log p = −1419.565225786768) は誤り: df = 2 の上側確率は (1 − t/√(t² + 2))/2 ≈ 1/(2t²) で、issue の式は 1/2 を落としている。分位点は 1.2710338964086606e308 で、rStats.js は修正前から正しい (`pt` に戻すと同じ log p)。

ただし ncp ≠ 0 では指摘どおり。参照: df = 2 では P[T > t] = c/t² (1 + O(1/t²))、c = (1 + δ²) Φ(δ) + δ φ(δ) (V ~ χ²₂ の P[V < v] ≈ v/2 から)。R の `log(c) - 2 * log(.Machine$double.xmax)` が、分位点が最大の double になる log p。rStats.js の pt(MAX, 2, ncp, 上側, log) と 3e-13 以内で一致する。

| ncp | log p (上側) | R | 修正前 | 修正後 |
|---|---|---|---|---|
| 0.5 | -1419.5258582683982 | Inf | Infinity | 1.7976931348622732e308 |
| 3 | -1417.2628610374888 | | Infinity | 1.7976931348622732e308 |
| -0.5 | -1421.1277928215623 | | Infinity | 1.7976931348622732e308 |
| 1e-300 | -log 2 − 2 log MAX | Inf | Infinity | 1.7976931348622732e308 |
| 0.5 | 上の値 − 1e-12 (分位点は MAX を超える) | | Infinity | Infinity |

R の qt は log p から p = exp(log p) = 0 を作るので Inf (R の pt も t = MAX で −0.369 などの誤った値)。

## 修正

`src/distributions/nt.ts` の `qnt1` の 1 行。docs (英・日) の differences-from-r の非心分布の表に qt の行を 1 行。

## テスト

- `test/issue138.test.ts`: 上の 4 つの ncp で、分位点が MAX と相対 1e-12、log |t| = 709.781 (旧閾値と MAX の間) の分位点、MAX を超えると Infinity、ncp = 0 と −0.5 の以前の値。stash で、修正前に 2 件中 1 件が失敗することを確かめた
- 全体テスト `npx vitest run`: 2511 passed / 38 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし (テストの配列の型を直してから流し直した)

## 範囲外として記録

なし。

## close comment

Fixed in <commit of #138, see git log --grep='#138'>: the far-tail power law of qt with ncp no longer cuts off at log |t| = 709.78; Math.exp itself gives Infinity only beyond the largest double, so quantiles in (1.7928e308, 1.7977e308] are kept (the bits are unchanged below the old cutoff). The example in the issue (ncp = 0) was already right: the df = 2 tail is 1/(2 t^2), so its quantile is 1.2710338964086606e308. With ncp != 0 the report holds: qt(log(c) - 2 log(MAX), 2, ncp = 0.5, upper, log), with c = (1 + d^2) pnorm(d) + d dnorm(d) the constant of the tail c / t^2, was Infinity and is now 1.7976931348622732e308 (R gives Inf, recorded in docs/differences-from-r.md). Test: test/issue138.test.ts. (Not pushed yet.)
