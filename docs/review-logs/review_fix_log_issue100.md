# Issue #100 対応ログ: zapsmall の digits = Inf と Inf の要素 (変えない、記録だけ)

GitHub Issue #100。判定: 変えない (not planned)。コードの変更なし。

## 確認 (main `1c301bb`)

issue の主張: `zapsmall` (`src/internal/fround.ts`) は digits − log10(mx) で桁を決めるので、digits = Infinity で要素に Inf があると Inf − Inf = NaN になり、全要素が NaN になる。R 4.6.0/4.6.1 の NEWS で、この場合に x を返すよう直された。

R 4.5.2 で確かめた結果:

| 呼び出し | R 4.5.2 | rStats.js |
|---|---|---|
| zapsmall(c(1, Inf), Inf) | c(NaN, NaN) | [NaN, NaN] (同じ) |
| zapsmall(c(Inf, -Inf), Inf) | c(NaN, NaN) | 同じ |
| zapsmall(c(1, 1e-20), Inf)、c(1, 1e-20, NaN) | そのまま | 同じ |
| zapsmall(c(1, Inf), 7)、c(1, -Inf, 1e-20)、c(1, NaN) | c(1, Inf)、c(1, -Inf, 0)、c(1, NaN) | 同じ |

- `zapsmall` は内部関数で、呼び出しは `src/models/lmerHypotheses.ts` の 3 か所だけ。どれも既定の digits = 7 で、公開の関数から digits = Infinity は届かない
- 実際に使う digits = 7 では、Inf・NaN を含んでも R と同じ
- issue の指摘する差は、R 4.6 での変更 (R 4.5.2 は rStats.js と同じ NaN)

## 判定

方針「将来の R への追従は記録だけ」(HANDOFF) と、公開の関数から届かないことから、変えない。R 4.6 に追従するときは、digits = Infinity なら入力の複製を返す (1 行)。
