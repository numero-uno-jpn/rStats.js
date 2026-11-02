# Issue #102 対応ログ: qbinom の整数でない size (変えない、docs の R の説明を直す)

GitHub Issue #102。ユーザー判断: NaN のまま (意図した違いを保つ)、docs の R の説明を直す。コードの変更なし。

## 確認 (main `7d279d9`)

issue の主張: R の qbinom は size を R_forceint (偶数への丸め) で整数にしてから計算するのに、rStats.js の qbinom は整数でない size をすべて NaN にする。

R 4.5.2 で確かめた結果、issue の説明どおり。

| 呼び出し | R 4.5.2 | rStats.js |
|---|---|---|
| qbinom(0.5, 10.2, 0.3) | 3 (= qbinom(0.5, 10, 0.3)) | NaN |
| qbinom(0.5, −0.1, 0.3) | 0 | NaN |
| qbinom(0.5, 10.5, 0.3)、qbinom(0.5, 11.5, 0.3) | 3、4 (10 と 12 と同じ) | NaN |
| dbinom(3, 10.2, 0.3)、pbinom(3, 10.2, 0.3)、rbinom(1, 10.2, 0.3) | NaN、NaN、NA | NaN、NaN |

size 0.1〜30 (0.1 刻み)・100.5・1000.3・1e6 + 0.5、確率 5 種、p 9 種の 13635 例で、R の qbinom(p, n, prob) は qbinom(p, round(n), prob) と `identical` だった。

docs の Deliberate differences (Distributions) には、0.5.0 のときから「R は pbinom の NaN で探索し、意味のない値 (−0 を含む) を返す」と書いてあった。今の R には当てはまらない (−0 は R が整数の size でも返す値で、size とは関係がない)。

## 判定

R の中でも、整数でない size を受け付けるのは qbinom だけで、dbinom・pbinom・rbinom は NaN。rStats.js は d・p・q の扱いをそろえて NaN を保つ (ユーザー判断)。docs (英・日) の R の欄を「size を整数に丸める (偶数への丸め: 10.5 は 10、11.5 は 12)。dbinom・pbinom・rbinom はその size で NaN」に直した。
