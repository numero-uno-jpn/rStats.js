# 外部レビュー (58 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (htest: varTest・propTest・chisqTest・mantelhaenTest・fisherTest)。新しい指摘 HTEST-011〜017 の 7 件は、すべて今のコード (`c226ecf`) で再現した。確認中に、レビューより大きな問題を見つけた: fisherTest (と mantelhaenTest の正確検定) の推定値・信頼限界は、R の uniroot の慣習をわざと再現していて、真の根から外れる。

ユーザーの判断:
- Fisher (と mantelhaen の正確検定) は正確に解き直す
- HTEST-013: シミュレーションでは、整数でない B と、適合度検定の整数でない度数の合計をエラー
- HTEST-016: 正確検定の小数の度数をエラー
- 信頼水準が 1 に近い (α < 1e-8) ときだけ上側確率で求める方針 (57 回目) を、htest とモデルの全箇所に当てはめる

## 判定

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| HTEST-011 | `varTest([1, 2, 3], [2, 4, 8], confLevel = 0.9999999999999999)` | (Windows 版 R はリテラルを 1 と読む) | 下限 0 | 下限 5.9e-18 |
| HTEST-012 | `propTest(5, 10, confLevel = 同)` | 同上 | [NaN, NaN] | [0.0328, 0.9672] |
| HTEST-013 | `chisqTest([3, 4, 5], sim, B = 2.1)`、`B = 0.1`、`[3.5, 4, 5]` で B = 2 | p = 1.29、1.82、1.33 | p = 1.33、2、1.33 | RangeError (分割表のシミュレーションは今のまま: p = 0.333) |
| HTEST-014 | `mantelhaenTest(strata, confLevel = 同)` | 同上 | [0, Inf] | [0.0395, 356.9] |
| HTEST-015 | `fisherTest([[3, 1], [1, 3]], confLevel = 同)` | 同上 | RangeError "f() values at end points not of opposite sign" | [1.5e-6, 2.9e17] |
| HTEST-016 | `mantelhaenTest(小数の度数, exact)` | 結果を返す (rStats.js と同じ値) | 結果を返す | RangeError (漸近検定は今まで通り) |
| HTEST-017 | `mantelhaenTest(すべて 1e150 の 2 層)` | 統計量・p NaN | 同じ | 統計量 0、p 1、推定 1 |

### Fisher の根の精度 (レビュー外、ユーザー判断で修正)

R の fisher.test は、ψ が 1 未満なら ψ ∈ [0, 1]、それ以外は 1/ψ ∈ [ε, 1] で、絶対許容誤差 ε^0.25 ≈ 1.2e-4 の uniroot を使う。1/ψ が小さい (ψ が大きい) ほど相対誤差が大きい。rStats.js はこれを再現していた (コメントに「R の推定値と限界はこの反復が止まる位置なので、区間と許容誤差も結果の一部」とあった)。

| 表 [[3, 1], [1, 3]] | 真の値 (R で tol 1e-12 の uniroot) | R・修正前の rStats.js | 修正後 |
|---|---|---|---|
| 推定値 | 6.40831965819967 | 6.40830886700579 (1.7e-6) | 6.408319658199675 |
| 95% 下限 | 0.211735595446579 | 0.21173291530550 (1.3e-5) | 0.2117355954465785 |
| 95% 上限 | 626.243530588813 | 621.93375054542 (0.7%) | 626.2435305888127 |
| 99% 上限 | 3186.24872567422 | 2991.07350183908 (6%) | 3186.2487256742033 |
| 99.99% 上限 | 319986.249987314 | 4503599627370496 (区間の端 1/ε) | 319986.24998733966 |

## 修正の内容

- `src/internal/uniroot.ts` `logScaleRoot`: u = log ψ の座標で、u = 0 から ±1、±2、±4… と区間を広げて符号の変わる区間を探し、許容誤差 2^-50 の uniroot で解く。|u| > 745 で変わらなければ 0 か Infinity。`fisherTest.ts` の `oddsRatioRoot` と `core/mantelhaen.ts` の `oddsRoot` が使う。冒頭のコメントを書き換えた
- 信頼水準が 1 に近い区間: 両側区間で 1 − α/2 や (1 + level)/2 を作る箇所で、α/2 が 1e-8 未満のときだけ、上側確率で分位点を求める。それ以外は元の式 (R と同じビット)。対象: varTest、propTest、mantelhaenTest (漸近)、agreement (ICC)、aov (一元配置の対比)、cor、tTest、lm (`confint`・`predict`、`tQuantile`)、glmConfint、coxph、survival
- `src/htest/chisqTest.ts`: B は 0 以上の整数。適合度検定のシミュレーションで度数の合計が整数でなければ RangeError
- `src/htest/mantelhaenTest.ts`: 正確検定で度数が整数でなければ RangeError。漸近検定の分散の項 r1 r2 c1 c2 / (t² (t − 1))、期待値の項 r1 c1 / t、推定値の項 a d / t・b c / t は、有限でないときだけ比を先に作る

## 記録だけ

- 効果量の非心度の根 (`effectSize.ts`)、離散分布の qansari (`ansariTest.ts`)、pwr の検出力の `1 − sig`: 同じ種類だが、今回の対象外 (ユーザー判断の範囲は信頼区間の分位点)
- mantelhaenTest の漸近検定で、度数がさらに大きい (1e200 など) と、信頼区間の分散の項 (sR² など) が溢れる。今回は分散と推定値の項だけを直した

## テスト

- `test/review58.test.ts`: Fisher の値を R の高精度の値と比べる。fixture の 2 × 2 の表 400 件以上で、推定値で平均が度数に一致 (相対 1e-9)、限界で片側確率が α に一致 (相対 1e-8) することを、テストの中で非心超幾何分布を独立に計算して確かめる。HTEST-011〜017
- fixture: fisherTest・fisherTestSim の estimate・confInt、mantelhaenTest の正確検定の estimate・confInt を `knownDifference` (R の uniroot の許容誤差) に記録した。chisqTestSim の小数の合計の 1 件を `substitute` に記録した
- demo の fisher の 2 例は `tol: 1e-2` にした。fisherTest の JSDoc の例を新しい値にした
- stash で 5 件すべてが失敗することを確かめた
- 全体テスト `npx vitest run`: 2250 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
- 57 回目に足した `test/htest-basic.test.ts` の substitute の行に型エラーがあった (57 回目は、このテストを直したあとに型検査を流し直していなかった)。直した

## docs

- 「R が不正確な場合」の仮説検定: fisher.test・mantelhaen.test(exact) の推定値と限界
- Where R fails: 信頼水準が 1 に近い区間 (各関数)、mantelhaen の度数の積の溢れ
- 「意味のない入力はエラー」: シミュレーションの整数でない B と度数の合計、正確検定の小数の度数

## 外部レビュアーの次の予定

mcnemarTest (不一致ペアが 0、連続性補正、正確二項検定)、ksTest (同順位、離散分布、極端な標本数)、rankTests・wilcoxTest (同順位補正、正確検定の適用条件、分散)
