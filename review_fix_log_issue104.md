# Issue #104 対応ログ: dnbinom(x, size = 0, { mu > 0 }) (R と同じ、変えない)

GitHub Issue #104。判定: issue の主張が R と違う (not planned)。コードの変更なし。

## 確認 (main `e30a662`)

issue の主張: R の dnbinom_mu は size = 0・mu > 0 の正の x で NaN を返すのに、rStats.js は 0 を返す。

R 4.5.2 で実行した結果は 0 で、issue の主張は誤り (ソースを読んだ推定で、R を実行していない)。

| 呼び出し | R 4.5.2 | rStats.js |
|---|---|---|
| dnbinom(0:2, size = 0, mu = 1) | 1 0 0 | 1 0 0 |
| dnbinom(1, size = 0, mu = 1, log = TRUE) | −Inf | −Inf |
| dnbinom(0:2, size = 0, mu = Inf) | 1 0 0 | 1 0 0 |
| dnbinom(0:2, size = 0, mu = 0) | 1 NaN NaN | 1 NaN NaN (R に合わせている、コードのコメントのとおり) |
| dnbinom(0:2, size = 0, prob = 0.5) | 1 0 0 | 1 0 0 |
| pnbinom(0:2, size = 0, mu = 1)、qnbinom(0.5, size = 0, mu = 1) | 1 1 1、0 | 同じ |

## 判定

R と同じ値なので変えない。issue の主張が R と違った例 (#43・#46・#49・#78 などと同じ)。
