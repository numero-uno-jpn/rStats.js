# Issue #113 対応ログ: dgamma の log 密度が 0 に近いときの相対精度 (記録だけ)

GitHub Issue #113。ユーザー判断: 記録だけ (not planned)。コードの変更なし。

## 確認 (main `e25277e`)

issue の主張: `src/distributions/gamma.ts` の `logOfLinear(f, d, l)` は、打ち消しのとき Math.log(f/d) を返すので、比が 1 に近いと比の丸めが log を支配する。

| 呼び出し | 真値 | R 4.5.2 | rStats.js |
|---|---|---|---|
| dgamma(s, 1, scale = s, log = TRUE)、s = nextDown(e^-1) = 0.36787944117144228 | −1 − log s = 1.1711009840963589e-16 | 0 | 2.2204460492503128e-16 |

絶対誤差は rStats.js も R も ε 程度 (1e-16) で、log 密度としては通常の精度。log 密度が 0 に近いところの相対精度の問題。

## 分析

- issue の案 log1p((f − d)/d) は比の丸め (絶対 ε/2) を取り除くが、f = dpois(0, 1) = e^-1 自体の丸め (相対 ε/2、絶対 2.7e-17) が残る。f − d ≈ 4.3e-17 に比べて大きく、この例で約 1.51e-16 (相対誤差約 30%) にしかならない
- 0 の近くで相対精度を保つには、Poisson 密度の log を double-double で返す経路 (Loader の指数は内部で double-double だが、0.5 log(2πx) の項は double) を作り、log(scale) とともに double-double で引く必要がある。大きな変更

## 判定

記録だけ (ユーザー判断)。dgamma の log 密度が 0 に近い (1e-16 程度) とき、相対誤差は O(1) になりうる (絶対誤差は ε 程度)。`logOfLinear` のコメントの「相対精度を保つ」は、比が 1 から離れている場合のこと。
