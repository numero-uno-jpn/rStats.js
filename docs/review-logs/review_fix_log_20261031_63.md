# 外部レビュー (63 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (glmFamily の残りのリンク、glmPredict、glmConfint、glmSummary)。9 件 (MOD-014〜022) を今のコード (`7a25b49`) と R 4.5.2 で確かめた。MOD-021 は 58 回目に修正済み、MOD-015 は R が正しい。ユーザーが計画を承認し、7 件を直した。

ユーザーの判断:
- probit・cloglog・cauchit・power のリンクは、62 回目と同じ方針で直す (表せる範囲は厳密な値、μ を 0・1 にしない端だけ止める)。cloglog の link は log1p
- sqrt で η < 0 を拒否すること、power の名前の丸めは R のまま

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| MOD-014 | probit、offset −10 | 2.2e-16 (η を −qnorm(eps) で切る) | 同じ | 7.62e-24 |
| MOD-015 | sqrt リンク、offset −1 | エラー (`valideta`: eta > 0) | 同じ | 変えない (R が正しい) |
| MOD-016 | cloglog、offset −40 | 2.2e-16 | 同じ | 4.25e-18 |
| MOD-017 | power 0.5、offset 1e-8 | 2.2e-16 | 同じ | 1e-16 |
| MOD-017 | `power(0.0004)` の名前 | "mu^0" (`round(lambda, 3)`) | 同じ | 変えない (R と同じ表示) |
| MOD-018 | cloglog、y = 1e-20、2e-20 | エラー "NA/NaN/Inf in 'y'" | 係数 0、未収束 | 係数 −46.74、0.6931 (= log 2)、収束 |
| MOD-019 | cauchit、offset −1e9 の作業重み | 1.5e-22 (微分が eps) | 同じ | 3.18e-28 |
| MOD-020 | `glmPredict(gaussian fit, newdata 1e155)` の標準誤差 | Inf | Inf | 1.069e154 |
| MOD-021 | glmConfint、level = 1 − 1e-16 | ― | 分位点は修正済み (58 回目) | 変えない (NaN の原因は 61 回目の MOD-008) |
| MOD-022 | `glmSummary(gaussian fit, dispersion = 1)` の名前 | "z value" | "t value" (p 値は z で計算していた) | "z value" |

### MOD-015 を変えない理由

sqrt リンク g(μ) = √μ の値は 0 以上なので、η < 0 はリンクの値域の外にある。逆リンク μ = η² は η < 0 で逆関数にならない (η = −1 → μ = 1 → g(1) = +1 ≠ −1)。R の `valideta` (η > 0) は正しい。

### リンクの端の扱い

- probit・cauchit・cloglog の逆リンク: 厳密な値を `inUnit` (最小の double と 1 未満の最大の double の間に収める) に通す。R の範囲 [eps, 1 − eps] の内側では値が変わらず、同じビット
- 微分 (probit・cauchit・cloglog・power): 下限を eps から Number.MIN_VALUE にした (0 にはしない)
- power の逆リンク: max(η^(1/λ), Number.MIN_VALUE)
- cloglog の link: `log(-log1p(-m))`。R の fixture は、ふつうの範囲でもすべてそのまま通った (link は初期値にだけ使う)

### MOD-020

前進代入の z の二乗和が、溢れるか正規化数の下に落ちたときだけ、最大の |z| で割ってから計算し直す。ふつうの範囲は同じビット。

## 修正の内容

- `src/models/glmFamily.ts`: probit・cauchit・cloglog・power のリンク、`inUnit`、使わなくなった `EPS` を削除
- `src/models/glm.ts`: glmPredict の標準誤差、glmSummary の `statisticName` (`zTest` で決める)

## テスト

- `test/review63.test.ts`: リンクの厳密な値と (0, 1) の中に収まること、R の範囲内では R と同じ値。cloglog の小さな平均の当てはめ。glmPredict の標準誤差が newdata に比例すること。dispersion を指定したときの名前
- stash で、修正前に 4 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2268 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- 「R が不正確な場合」: probit・cauchit・cloglog・power のクリップ、cloglog の link
- Where R fails: 二乗が溢れる glm の予測の標準誤差

## 外部レビュアーの次の予定

GLM の診断関数 (重み 0 の観測、ランク落ち、外れ値、極端なレバレッジがあるときのハット値・標準化残差・Cook の距離)。chol2inv の結果を使う共分散と標準誤差の、極端な説明変数の尺度での安定性
