# 外部レビュー (48 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (`src/models/`、survival、random、htest、descriptive。zip は `src(3).zip`)。確定指摘 10 件 (MOD-001・002、SURV-001、RNG-001・002、HTEST-001〜004、DESC-001) は、すべて今のコード (`49dbfbd`) で再現した。R 4.5.2 と比べたところ、レビュアーの説明には誤りが 3 件あった (下の表の「判定」)。ユーザーの指示で全件を直した。

ユーザーの判断:
- RNG-001: R と乱数列がずれても数式を直す
- MOD-001: offset を入れ子の判定に含める (32 回目と同じく、入れ子でなければ検定の列を NaN にする)
- poissonTest の事象数 [0, 0]: R どおり結果を返す (binomTest([0, 0]) だけをエラーにする)

レビュー中で撤回された指摘 (coxph の Efron 法で、ケースウェイトと観測の複製が一致しないもの) は、R の coxfit6.c と同じ扱いで、不具合ではない。レビュアー自身も撤回している。

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 判定 | 修正後 |
|---|---|---|---|---|---|
| MOD-001 | `glm(y ~ 1, poisson)` と `glm(y ~ x, poisson, offset = log(y) − x/2)` の glmAnova | p = 0.000417 (offset を見ない) | 同じ | 確定 (R も同じ) | 検定の列 NaN。offset = 2x (列空間に入る) なら今までどおり検定する |
| MOD-002 | `glm([1, 2], [1, 0], weights [0, 0])` | エラー (R 内部の不具合 "object 'fit' not found") | rank 2、残差自由度 −2、係数 0 | 確定 | RangeError "all weights are zero" (lm と同じ) |
| SURV-001 | time = [1, 1 + 1e-9, 2, 3]、status = [0, 1, 1, 0] | survfit: time [1, 2, 3]、n.risk [4, 2, 1]、surv [0.75, 0.375, 0.375]。survdiff の χ² 0 | 4 時点、surv [1, 0.667, 0.333, 0.333]、χ² 0.0588 | 確定 (R が正しい) | R と同じ |
| RNG-001 | `set.seed(439); rbinom(1, 10000, 0.5)` | **5023** | 5023 | 数式の誤りは確定。ただし **R も 4 項とも足している** (「R は引いている」というレビュアーの説明は誤り) | 4879 (R と乱数列がずれる) |
| RNG-002 | `rexp(3, rate = 1e-310)` | NaN (警告。乱数を引かない) | NaN | 確定 (R も同じ) | `exp_rand() / rate` (多くは Inf。指数乱数が約 0.018 未満なら有限) |
| HTEST-001 | `binomTest([0, 0])` | **p = 1** (エラーにならない。「R は拒否する」というレビュアーの説明は誤り) | p = 1、estimate NaN | 入力の検査漏れとして直す (方針「意味のない入力はエラー」) | RangeError (`binomTest(0, 0)` と同じ文言) |
| HTEST-002 | `shapiroTest([-1e308, 0, 1e308])` | NaN | NaN | 確定 | W = 1、p = 0.9999999999999933 (`[-1, 0, 1]` と同じ) |
| HTEST-003 | polyserial で x を 1e200 倍 | rho 0、chisq NaN | レビューの例は rho = 0.9999 に張り付く退化した例。退化しない例 (下) では **ρ が 0.589 → 2.2e-9** に壊れ、χ² も 2.73 → 54.7 | 確定 (壊れるのは χ² だけではない) | 元の尺度と同じ (2^664 倍ではビット単位で一致) |
| HTEST-004 | `kappa2([])`、`kappa2([[NaN, NaN]])` | irr はエラー ("invalid 'times' argument") | NaN | 確定 | RangeError "no complete rating pairs" |
| DESC-001 | 非対称な covmat の factanal・omega | factanal は同じ結果を返す (検査しない) | 結果を返す | 確定 (入力の検査漏れ) | RangeError (正方・有限・対称・対角が正) |

HTEST-003 の退化しない例: x = [0.3, −1.2, 0.8, 1.9, −0.4, 0.1, 2.2, −0.9, 1.1, 0.5, −1.6, 0.7, −0.2, 1.4, −0.7, 0.9]、y = [1, 1, 3, 2, 2, 1, 3, 2, 2, 3, 1, 1, 3, 3, 1, 2]。polycor は rho 0.589378114901656、χ² 2.72829008198893。rStats.js は 0.58937822576284、2.728290081988924 (rho の差 1.1e-7 は最適化の許容誤差で、修正前から同じ)。

## RNG-001 の詳細

- log f(ix)/f(m) = log m! + log (n − m)! − log ix! − log (n − ix)! + (ix − m) log(p/q) なので、Stirling の補正 δ(k) ≈ 1/(12k) は、f1 = m + 1、z = n − m + 1 に +、x1 = ix + 1、w = n − ix + 1 に − で入る。R の rbinom.c も修正前の rStats.js も、4 項とも足していた
- lchoose による厳密な値との差 (m ± 3σ の範囲の最大):

| n | p | 修正前 (R と同じ) | 修正後 |
|---|---|---|---|
| 60 | 0.5 | 1.26e-2 | 5.8e-15 |
| 100 | 0.3 | 1.18e-2 | 1.2e-14 |
| 10000 | 0.5 | 6.67e-5 | 1.4e-12 |
| 1e6 | 0.01 | 1.73e-5 | 1.2e-10 (lchoose の丸め) |

- 乱数の fixture: rbinom の 3 件 (n = 20000 の要約。size 1000・p 0.3、size 1e5・p 0.02、size 5000・p 0.9) で、値と次の一様乱数が R とずれた。`test/helpers/random.ts` に `streamDifference` を足し、BTPE の経路 (size min(p, 1 − p) ≥ 30) の引数に限って、理由付きで記録した。rmultinom・rlong などは、ずれがなく今までどおり完全に一致する

## 修正の内容

- `src/models/glmAnova.ts`: 複数モデルの比較で、d = offset_small − offset_large が 0 でなければ、小さいモデルの各行に d の列を足してから `nestedColumns` に渡す
- `src/models/glm.ts` `refit`: `prepareResponse` の後で、正の重みがなければ RangeError。二項分布で行の合計がすべて 0 の場合も含む
- `src/models/tiedTimes.ts` (新規): `mergeTiedTimes` を coxph.ts から移した。`src/models/survival.ts` の `prepare` (survfit・survdiff) でも使う
- `src/random/binomial.ts`: `btpeLogRatio` (export、テスト用) に切り出し、x1・w の補正を引く。rbinom の JSDoc に、R と乱数列がずれることを書いた
- `src/random/continuous.ts` `rexp`: 0 < rate で 1/rate = Inf のときだけ `expRand() / rate`。それ以外は今と同じ
- `src/htest/binomTest.ts`: 配列の形式で試行数 0 なら RangeError。本体を `binomTestCounts` (export) に分けた。`src/htest/poissonTest.ts` は `binomTestCounts` を呼ぶので、[0, 0] は R どおり p = 1
- `src/htest/core/shapiro.ts` `swilkOneMinusW`、`src/htest/polycor.ts` `standardise`: 先に `scaleToUnit` で 2 の冪で割る。2 の冪の拡大・縮小は厳密で、範囲との比も標準化した値も変わらないので、溢れない範囲では同じビット
- `src/htest/agreement.ts` `kappa2`: 完全な行がなければ RangeError
- `src/internal/covmat.ts` (新規) `checkCovmat`: 正方・有限・対称 (`isSymmetric`、R と同じ 100ε。和が溢れないよう 2 の冪で割ってから)・対角が正。factanal・omega で使う

## テスト

- `test/review48.test.ts`: 10 件と、offset が列空間に入る場合の検定、一部が 0 の重み、poissonTest([0, 0])、丸め程度の非対称の受け入れ、2^1022・2^664 倍のビット一致
- `git stash push -- src` で、7 件すべてが失敗することを確かめた
- `test/htest-basic.test.ts`: binomTest の R の fixture の `x = c(0, 0)` の 3 件を `substitute` (R は p = 1) に記録した
- `test/random.test.ts`: rbinom に `streamDifference`
- 全体テスト `npx vitest run`: 2212 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md`
  - Where R fails の表: offset の違う glm の anova、shapiro.test の溢れ、polyserial の溢れ、rexp の極小の rate
  - General の「意味のない入力はエラー」: binomTest([0, 0])、factanal・omega の covmat
  - Random numbers: BTPE の rbinom は R の乱数列と一致しないこと
- SURV-001 (R が正しい)、MOD-002・HTEST-004 (R もエラー) は書いていない
