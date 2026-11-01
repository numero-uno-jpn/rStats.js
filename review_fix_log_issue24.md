# Issue #24 対応ログ: dmultinom・dbinom の分母の溢れ

GitHub Issue #24 (監査ラウンド #96)。計画は承認済み。

## 再現 (main `b965556`)

| 入力 | rStats.js (修正前) | R 4.5.2 | 修正後 |
|---|---|---|---|
| `dmultinom([8e307, 8e307], [0.5, 0.5])` | 0 (log −355.0588974883506 は正しい) | 整数の範囲を超えてエラー | 6.3078313050504e-155 |
| `dbinom(8e307, 1.6e308, 0.5)` (同じ経路) | 0 | 6.307831305050802e-155 | 6.3078313050504e-155 |

正しい値は C(2m, m)/4^m ≈ 1/sqrt(π m) (m = 8e307。補正は double の精度より小さい)。

## 原因と修正

`src/special/loader.ts` の `dbinomRawDD` は、分母 2π x (n − x)/n を左から計算していて、2π x が溢れて Inf になっていた (対数の経路は別の式で正しかった)。

修正: x (n − x)/n が 2e307 を超えるときは、同じファイルの `dpoisRawCore` (dchisq(1e308, 1e308) のときの修正) と同じく、分母を (π/8) x (n − x)/n にして、結果を 4 で割る。ふつうの範囲は今の式のまま (同じビット)。

## 見つけた別の問題 (記録だけ。この Issue の範囲の外)

n が 1e307 規模で p ≠ 1/2 のとき、`dbinom(4e307, 1.6e308, 0.25)` は 0 (log −2.6e274) になる。R は 7.283656203947058e-155 (正しい。x = n/4 がちょうど成り立つので、平均にあたる点の確率)。

原因: `binomial.ts` は n − x を double に丸めた値 (nmx) を渡し、`dbinomRawDD` は n を twoSum(x, nmx) で作り直す。n − x が double で表せないとき、作り直した n は元の n と 1 ulp (約 1e292) ずれる。この規模では標準偏差 (約 1e154) よりはるかに大きいずれなので、bd0 が 1e274 になる。直すには、n − x を double-double のまま bd0 に渡す必要があり、`dbinomRawDD` を呼ぶ箇所 (binomial、f、geometric、multinomial、nbeta) に関わる。別に扱う。

## テスト

- `test/issue24.test.ts`: dbinom と dmultinom の中心の確率が、R の値と 1/sqrt(π m) に相対 1e-13 で一致し、log の値の exp とも合う。ふつうの範囲は今と同じ
- stash で、修正前に失敗することを確かめた
- 全体テスト `npx vitest run`: 2309 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- R の dbinom と同じ値になるだけなので、変えていない (R の dmultinom はこの規模でエラーになる)
