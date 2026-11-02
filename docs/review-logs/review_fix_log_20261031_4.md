# 外部レビュー (4 回目) 対応ログ

レポート: `C:\Users\numer\Downloads\rstats_src2_reaudit_report.md` (F-01〜F-07)。計画は `~/.claude/plans/quirky-questing-giraffe.md`。

ユーザー判断

- **F-05:** 誤差 SSP が特異でも、GG を別判定で出す (car/afex と違う)
- **F-06:** GLM は下流の関数も含めて今回直す

## 修正

| No. | 対象 | 内容 |
|---|---|---|
| F-01 | `aovEz` の ges | 誤差平方和の重複除去を、数値の `Set` から、within 項をキーにした `Map` に変更。偶然同じ値になった別の誤差層も両方数える |
| F-02 | `Anova` 型 II/III (carAnova.ts) | `addedSS` は y を 2^-k で正規化してから計算する。rss は `scaledRss` (anovaSequential.ts から export)。Sum Sq だけ戻す。「residual sum of squares is 0」は rss < √eps × (中心化・重み付きの全平方和) で判定する。car の絶対値 √eps は単位に依存するため |
| F-03 | `predict` (lm) | seFit = √(z'z) × sigma (sigma² を経由しない)。予測区間の半幅は t × hypot(seFit, sigma) |
| F-03 付随 | lm の "essentially perfect fit" の判定 | 正規化した fitted と rss で比べる (`LmCore.rssScaled` を追加) |
| F-04 | `scaledRss`、`sequentialRows` | 重み 0 の行を飛ばす (0 × Inf = NaN を作らない) |
| F-05 | `aovEz` | GG は tr(A²) > 0 なら出す。HF は d − p·GG > 0 のときだけ出し、それ以外は NaN (`correction: "HF"` なら GG で補正し、警告)。Mauchly はフルランクのときだけ出し、それ以外は NaN と警告。誤差 SSP が 0 なら補正なしと警告 |
| F-06 | glm (gaussian、quasi・定数分散、いずれも identity link) | `glm()` は y、offset、start を 2^-k で正規化した model で当てはめ (`fitModel`)、公開する結果は単位を戻す (`unscaledResult`)。aic は + 2nk·ln2。正規化した結果は列挙されないプロパティ `scaled` に持たせ、`model.yScale = k` を記録する |
| F-06 | 下流の関数 | `scaledView(fit)` で正規化した fit に切り替えて計算し、出口で単位を戻す。対象は `glmDispersion`、`glmSummary` (estimate・SE は 2^k 倍、dispersion・covScaled は 2^2k 倍)、`glmResiduals`、`glmRstandard`・`glmCooksDistance` (無次元)、`glmPredict` (newoffset と dispersion も正規化)、`glmAnova` (Deviance、Resid. Dev、Rao、Cp の列を 2^2k 倍)、`glmConfint`。利用者が渡す dispersion は 2^-2k 倍して使う |
| F-07 | `cv`、`meanAD` | `scaleToUnit` で正規化した座標で計算する。meanAD だけ 2^k 倍して戻す |

注意: 公開する GlmResult をスプレッドでコピーすると `scaled` が落ち、従来の (正規化しない) 計算になる。結果は正しいが、1e±200 の範囲では溢れる。

## テスト

- `test/scaleInvarianceModels.test.ts` を追加: Anova 型 II/III、predict、glm とその下流の全関数、cv/meanAD の尺度不変性、および F-01、F-04、F-05 の個別ケース。src を修正前に戻すと 7 件すべて失敗する
- `test/descriptive.test.ts`: cv の R fixture で、1e200 程度のデータでは R の分散がオーバーフローする 2 件を knownDifference にした
- 結果: `npx tsc --noEmit -p .` エラーなし。`npx vitest run` 全件成功

## 範囲外・残り

- glm の gaussian 以外の family、および gaussian の log/inverse link: 応答の尺度変換と可換ではないので、正規化していない
- lmer、coxph の尺度 (前回からの残り)
- R13 (aovEz の特異性判定を被験者内の全変動と比べる案): 判断待ちのまま。F-05 で GG は特異でも出すようになったので、影響は Mauchly 検定の有無だけになった

## R 突合が必要

- 応答 1e±200 での car `Anova`、`predict.lm`、gaussian `glm` 一式、`CoefVar`/`MeanAD` の R の値 (docs に Inf/0/NaN と記載した)
- 2 被験者×3 条件などで car/afex が補正を出さないこと (rStats.js は GG を出す)
