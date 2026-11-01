# dbinom で n − x が double で表せない場合 (Issue #24 の確認中に発見)

Issue #24 の確認中に見つけた問題。オーナーの指示: いま直す。計画は承認済み。

## 再現 (main `e5d5301`)

| 入力 | rStats.js (修正前) | 正しい値 | 修正後 |
|---|---|---|---|
| `dbinom(4e307, 1.6e308, 0.25)` | 0 (log −2.59e274) | 7.283656203947058e-155 (R も同じ) | 7.283656203947195e-155 |
| `dbinom(30000000000000020480, 1e20, 0.3)` | 8.7056342754277e-11 (相対 1.2e-12 の誤差) | 8.7056342754170117383e-11 (Rmpfr、400 ビット) | 8.705634275417011e-11 |
| n = 1e20 のほかの 3 点 | 正しい (n − x が丸められない) | Rmpfr | 同じ |

`dbinom(1.2e308, 1.6e308, 0.75)` は修正前後とも 0 で、これが正しい。0.75 n は 1.2e308 + 5e291 で double ではないので、x = 1.2e308 は平均から標準偏差の 3e137 倍離れている (R も 0)。

## 原因と修正

`binomial.ts` は n − x を double に丸めた値 nmx を渡し、`dbinomRawDD` は n を twoSum(x, nmx) で作り直していた。n − x が double で表せない (n が 2^53 を超える) と、作り直した n は元の n から最大 1 ulp ずれる。n ≈ 1e308 ではこれが標準偏差 (約 1e154) の 1e137 倍になり、bd0 が 1e274 になっていた。double-double でも n q の誤差 (約 1e276) は大きすぎる。

`src/special/loader.ts`:
- `dbinomRawDD` に省略可能な引数 `size` (元の n) を足し、`dbinom1` だけが渡す。twoSum(x, nmx) が [size, 0] と違うときだけ `exactBinomialExponent` を使う。それ以外は今と同じ計算 (同じビット)。
- `exactBinomialExponent`: p が double なら、d1 = x − n p を厳密な積 (twoProd。1e299 を超えるなら 2^-64 倍して戻す) から作り、q 側の偏差は恒等式 (n − x) − n q = n p − x から d2 = −d1 とする (q = 1 − p が厳密なので成り立つ)。q が double なら役を入れ替える。n − x は twoSum(n, −x) (厳密)。
- `bd0FromDeviance`: x・M・d を double-double で受け取る bd0。小さな |d| では bd0ddOps と同じ級数、大きな |d| では x log(x/M) − d。1e299 を超えるときは 2^-64 倍して計算する。

## 対象外 (記録)

- dmultinom: 各カテゴリの確率が double-double の商で厳密でないので、同じ方法では偏差を厳密に作れない。カウントが 2^53 を超え、残りの合計が丸められる場合に、同じ種類の誤差が残りうる。
- f・geometric・nbeta からの呼び出し: n − x にあたる量が整数でない (f) か、丸めが起きない範囲で使っているので、変えていない。

## テスト

- `test/dbinomHuge.test.ts`: n = 1.6e308、p = 1/4 の平均の点が R の値と相対 1e-13 で一致する (log も)。p = 3/4、x = 1.2e308 は 0。n = 1e20 の 4 点が Rmpfr の厳密な値と相対 1e-14 で一致する
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2311 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- R と同じ値になる (R は double のまま計算して、たまたま矛盾がない) ので、変えていない
