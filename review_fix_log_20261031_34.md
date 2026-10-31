# 外部レビュー (34 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (effectSize.ts の Hedges の J、ANOVA 効果量の残差自由度 0・溢れ・信頼区間・偏 ω² の分母、aovEz の MSE)。R 4.5.2 の effectsize と、2 要因の aov (y ~ A * B、18 行) で比べた。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| HEDGES-J-INFINITE-DF-01 (107) | ― | 有限の標本からは生じない。修正 A で J(Inf) = 1 にした |
| **EFFECTSIZE-ANOVA-ZERO-RESIDUAL-DF-01 など (108〜110)** | 飽和モデル (4 行) の偏 η² | R の effectsize はエラー ("No residuals data found")。rStats.js は B の偏 η² に 0.0889 (0/0 の丸め誤差の値) を返していた。**修正 (C)** |
| **HEDGES-J-LARGE-DF-CANCELLATION-01** (111) | J(df) | R (effectsize の式) も rStats.js も、df = 1e6 で 0.99999925029 (相対誤差 3e-10)、1e10 で 0.99997、1e14 で 1.28、1e16 で 1.3e-14。**修正 (A)** |
| **EFFECTSIZE-ANOVA-DENOMINATOR-OVERFLOW-01 など (112〜114)** | y を 1e154 倍した aov の η²・ω² | R も rStats.js も NaN。**修正 (B)** |
| 非偏 η²・一般化 η²・ω²・ε² の信頼区間 (115・116) | A の非偏 η² の下限: R 0.0911025309、rStats.js 0.0911025334 | **effectsize と同じ方法。** 差は effectsize の最適化の精度 (1e-9) の範囲。記録だけ |
| aovEz の MSE (117〜119) | ― | 32 回目に確認済み。afex と同じ |
| 偏 ω² の分母 (120〜122) | 偏 ω²: R 0.395118370343182、rStats.js 0.3951183703431821 | **effectsize と同じ定義** (N = 全自由度 + 1)。記録だけ |

## A. Hedges の J

- log J = lgammaDiff(½, (df − 1)/2) − ½·log(df/2)。`lgammaDiff` (lgamma(b + a) − lgamma(b) を、大きな b でも精度を保って計算する既存の関数) で、2 つの lgamma の桁落ちを避ける
- df = Inf は 1
- 小さな df では、従来の式と数 ulp しか違わない (R の fixture も通る)

| df | 修正前 (R と同じ) | 修正後 | 1 − 3/(4df − 1) |
|---|---|---|---|
| 10 | 0.922745608053087 | 0.9227456080530869 | 0.923 (近似) |
| 1e6 | 0.9999992502856084 | 0.9999992499997813 | 0.9999992499998125 (近似の誤差 3e-14) |
| 1e10 | 1 (表示上、0.99997) | 0.9999999999250004 | 0.999999999925 |
| 1e14 | 1.284 | 0.9999999999999929 | 0.9999999999999925 |
| 1e16 | 1.3e-14 | 1 | 0.9999999999999999 |

## B. 効果量の単位への依存

- **原因:** 効果量は平方和の比だが、表の平方和は尺度を戻した値で、1e154 程度のデータでは溢れて Inf になる。有限でも、その和 (分母) が溢れる
- **修正:**
  - `src/models/scaledTables.ts` を新設した。結果オブジェクトをキーにした WeakMap に、当てはめたときの平方和 (応答を 2 の冪で割った単位) の表を保存する
  - 登録するのは anova (lm の逐次表)・aovSummary・aov (誤差層。`stratumTable` が公開用と正規化したままの 2 つの表を返す)・aovEz (univariate 表) の結果。公開の型は変えていない
  - 効果量 (etaSquared・omegaSquared・epsilonSquared) は、登録があればその表を使い、さらにすべての平方和 (誤差層では各層の残差も) を共通の 2 の冪で割ってから比をとる
- ユーザーが自分で作った表 (平方和は有限で、和が溢れる場合) も、正規化で正しくなる (1e308 と 1e308 の偏 η² は 0.5)
- 2 の冪の割り算は厳密なので、通常の範囲の値は変わらない (R の fixture も通る)

## C. 残差自由度 0

- 残差自由度が 0 の表は "the model has no residual degrees of freedom: the effect sizes are not defined" のエラー (effectsize と同じくエラー)
- `ncpOfF` は、pf が NaN のとき「根がない (0)」と扱わず、NaN を返す

## テスト

- `test/review34.test.ts` を追加した。src を `git stash` で戻すと、5 件すべてが失敗する (J の 1 件は、修正前は export していないための失敗)
- `hedgesJ` はテストのためにモジュールから export した (パッケージの公開 API には含めていない)
- 全体テスト: 2174 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に、Hedges の J と効果量の単位依存を書いた
