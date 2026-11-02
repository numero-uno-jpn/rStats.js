# Issue #65 対応ログ: dnbinom の size + x が溢れると NaN (以前の判断を保つ)

GitHub Issue #65。判定: 主張は正しいが、22 回目 (NB-DENS-OVERFLOW-01) と 55 回目 (DIST-008) のユーザー判断どおり変更しない (not planned)。今回もユーザーの判断で、以前の判断を保つ。

## 確認 (main `b634448`)

| 呼び出し | R 4.5.2 | rStats.js | 正しい値 (正規近似) |
|---|---|---|---|
| `dnbinom(1e308, 1e308, prob = 0.5)` | 0 | NaN | 約 2.8209479177387814e-155 |
| 同 `log = TRUE` | −Inf | NaN | 約 −355.8636164445677 |
| `dnbinom(1e308, 1e308, mu = 1e308)` (同じ分布) | 0 / −Inf (log) | NaN / NaN | 同上 |
| `pnbinom(1e308, 1e308, 0.5)` | 0.5 | NaN | 約 0.5 |
| `dnbinom(1e300, 1e300, 0.5, log = TRUE)` | −346.65327607259144 | −346.6532760725914 | 一致 |

`dnbinomRaw` (`src/distributions/negbinomial.ts`) の `if (!Number.isFinite(size + x)) return NaN;` による意図した NaN。issue のコメントで訂正された参照値 (log 約 −355.86) は、分散 2e308 の正規近似の値として正しい。

## 変えない理由 (22 回目のログ `review_fix_log_20261031_22.md` の判断と同じ)

- 密度だけ直すと、dnbinom は有限の値、pnbinom・qnbinom は NaN になり、分布の中で扱いがそろわない。pnbinom まで直すには 1e308 規模のパラメータの不完全ベータの漸近展開が要る
- 2^53 を超える整数の領域は「誤った値の代わりに NaN」の方針 (HANDOFF の方針、例: `pnbinom(1e308, size = 1e308, …)`)
- R も 0 / −Inf で誤っている

密度だけ直す場合の見積もり (鞍点法の各項を size + x を作らずに書く、20〜40 行) は 22 回目のログにある。
