# 外部レビュー (57 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (firstTrue・lastTrue、binomTest・poissonTest の入力と信頼区間、qwilcox・qsignrank)。新しい指摘 HTEST-005〜010 の 6 件は、すべて今のコード (`ecbeb6d`) で再現した。qwilcox・qsignrank (小標本) と、二項検定の両側 p 値 (SciPy と 49,800 件)、Clopper-Pearson・Garwood 区間は、レビュアーの検査で問題なし。ユーザーが計画を承認し、6 件を直した。

ユーザーの判断:
- HTEST-008: T = 0 はエラー (R は受け付ける)
- HTEST-010: α < 1e-8 のときだけ、上限を上側確率 α の分位点で求める (実用的な信頼水準は R と同じビット)

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| HTEST-005 | `binomTest(0, 1e20)`、`binomTest(1e20, 1e20)`、`poissonTest(0, r = 1e20)` | エラー "result would be too long a vector" | 終わらない (10 秒で打ち切り) | すぐに返る (p 値 3.2e-316 など。下の「残したもの」) |
| HTEST-006 | `binomTest([1e308, 1e308], less)` | p NaN、区間 [0, 0]、推定 0 | 同じ | RangeError (スカラーの n = Inf と同じ) |
| HTEST-007 | `poissonTest([1e308, 1e308])` | エラー ("'from' must be a finite number") | p NaN | RangeError |
| HTEST-008 | `poissonTest(0, T = 0)`、`(1, T = 0)` | 推定 NaN・Inf、区間 [NaN, Inf]・[Inf, Inf] | 同じ | RangeError "'T' must be positive" |
| HTEST-009 | `poissonTest([5, 5], T = [1e308, 1e308])` | p 0、期待度数 NaN | 同じ | p 1、期待度数 5、率比 1 |
| | `poissonTest([5, 5], T = [1e-308, 1e-308])` | 率比 NaN | 同じ | 率比 1 |
| HTEST-010 | `binomTest(5, 10, confLevel = 0.9999999999999999)` | エラー (Windows 版 R はリテラルを 1 と読む。参考にならない) | 上限 1 | 0.9998143636044187 |
| | `poissonTest(5, confLevel = 0.9999999999999999)` | [0, Inf] (同上) | 上限 Inf | 52.54906424873604 |

## 修正の内容

- `src/internal/discrete.ts` `firstTrue`・`lastTrue`: 二分法の中点が端点と一致したら抜ける (2^53 を超えると隣の整数を表せず、端点が動かなくなっていた)。`discreteQuantile` の `bisect` と同じ
- `src/htest/binomTest.ts`
  - 配列の形式で合計が Inf なら RangeError
  - 上限: α < 1e-8 なら `qbeta1(α, x + 1, n − x, false, false)` (1 − α は α が 1.1e-16 未満で 1 に丸まり、それより大きくても桁が落ちる)
- `src/htest/poissonTest.ts`
  - T は有限で正 (r = 0 は今までどおり受け付ける)
  - 2 標本: x1 + x2 が Inf なら RangeError。p0 は r T1 + T2 が溢れる・正規の範囲を下回るときだけ 1 / (1 + T2 / T1 / r)。期待度数 (`expectedCount1`) と率比 (`rateRatio`) も、途中の値が溢れる・正規の範囲を下回るときだけ比の形
  - 1 標本の上限: α < 1e-8 なら `qgamma1(α, x + 1, 1, false, false)`

## 残したもの (記録だけ)

- 2^53 を超える n の両側 p 値: 観測値の確率 d(x) がアンダーフローして 0 になると、「観測値より起こりにくい」範囲の境界を、反対側で確率がアンダーフローする位置に取る。`binomTest(0, 1e20)` は 3.2e-316 (真の値 2 × 0.5^1e20 は double で 0)。修正前から 2^53 (`binomTest(0, 2^53)` = 3.07e-318) で同じ。0 に近い値どうしの違いで、検定の判断は変わらない

## テスト

- `test/review57.test.ts`: 6 件。通常の範囲 (`poissonTest([11, 23], T = [800, 3011])`、`binomTest(5, 10)` の区間) は今と同じ値
- stash で、修正前に止まる HTEST-005 を除く 3 件が失敗することを確かめた
- `test/htest-basic.test.ts`: poissonTest の R の fixture で T = 0 の 12 件を `substitute` (R は NaN・Inf) に記録した
- 全体テスト `npx vitest run`: 2245 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
- 確認中に `timeout` で打ち切った tsx の子の node が残った (3 つ)。ユーザーに終了を頼んだ

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md`
  - Where R fails: 2^53 を超えるカウントの binomTest・poissonTest、poissonTest の T の溢れ、信頼水準が 1 に近い上限
  - 「意味のない入力はエラー」: T = 0、カウントの合計の溢れ

## 外部レビュアーの次の予定

htest の残りの検定関数 (入力の境界、自由度、標本数、極端な値での安定性)
