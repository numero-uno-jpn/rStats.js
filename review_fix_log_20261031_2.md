# 外部レビュー (2 回目、2026-10-31) 対応ログ

レポート: `C:\Users\numer\Downloads\ChatGPT_notices_20261031\` の 3 本

- `rstats_audit_report.md` (F-01〜F-04)
- `rstats_audit_followup_report.md` (A-01〜A-08)
- `rstats_common_foundation_report.md` (C-01〜C-08。A 系と重複あり。A-04 はこのレポートで撤回)

方針は前回と同じで、R と違っても正しい値を優先し、違う箇所は `docs/differences-from-r.md` (英・日) に書いた。

## 共通化したもの (`src/internal/summary.ts`)

- `scaleToUnit(groups)`: データ全体を 2 の冪 2^-k で割り、最大の絶対値を [1, 2) にする。2 の冪なので丸め誤差は入らず、単位に依存しない統計量 (t、F、χ²、分散比、自由度) は元のデータと同じ値になる。単位のある量 (推定値、標準誤差、区間、平方和) は `ldexp` で戻す
- `satterthwaiteDf(w, df)`: Satterthwaite の自由度 (Σw)² / Σ(w²/df)。w を 2 の冪で正規化してから二乗する
- `squareOver(d, e)`: Pearson 型の項 d²/e。d² がオーバーフロー (または正規化数未満) のときだけ (d/√e)²
- `productOver(a, b, n)`: 期待度数 ab/n。積が範囲外のときだけ (a/n)b
- `isCount` (`src/htest/types.ts`): binomTest と poissonTest の重複を統合

通常の範囲では従来と同じ式になる (2 の冪の正規化は値を変えず、ほかは範囲外のときだけ別の式)。

## 修正したもの

| No. | 対象 | 内容 |
|---|---|---|
| F-01 | `binomTest`、`poissonTest` | カウントの整数判定を相対 1e-7 から絶対 1e-7 に (R と同じ)。2^53 以上の double はすべて整数なので、`isSafeInteger` の制限は入れていない |
| F-02 | `poissonTest` | 1 標本では `confLevel` の 0 と 1 を受け付ける (R と同じ。1 で [0, Inf))。2 標本は従来どおり開区間 |
| F-03 | `chisqTest`、`mcnemarTest`、`propTest`、`mantelhaenTest` | 偏差の二乗、周辺度数の積のオーバーフロー。`squareOver`/`productOver` に統一 |
| C-01 | `covariance` | 2^kx と 2^ky を別々に掛けていたため cov(x,y) ≠ cov(y,x)。`ldexp(v, kx + ky)` に |
| C-02/C-03 | `tTest`、`gamesHowellTest`、`cohensD`/`hedgesG`、`icc` の二元配置 | Welch 型自由度を `satterthwaiteDf` に統一 |
| C-04 | `tTest`、`onewayTest`、`varTest`、`bartlettTest`、`tukeyTest`、`dunnettTest`、`glhtDunnett`、`gamesHowellTest`、`pairwiseTTest` (pooled SD) | `scaleToUnit` で 2 の冪に正規化してから計算 |
| A-01/C-07 | `aovEz` | 誤差 SSP 行列の正則判定を絶対値 √eps から「最大固有値 × 1e-12」の相対判定に。応答も `scaleToUnit` で正規化し、平方和は 2^2k 倍して戻す。補正できないときは警告を出す (afex は出さない) |
| A-02/C-06 | `sphericityW` | det(U)/(tr(U)/p)^p を det(U / (tr(U)/p)) で計算。`mauchlyTest` もデータを正規化 |
| A-03/C-08 | `aovStrata` | 層への列の採用しきい値を「1e-5 × 列の平均二乗」から「1e-14 × 列自身の平方和」に。前回の相対化 (No.122) は、被験者間で大きく変動する共変量の小さな被験者内成分を落としていた。Q は double-double で精度が高いので、他の層にある列の射影はこのしきい値より十分小さい |
| A-05/C-05 | `aovEz` | 応答の null/NaN はそのセルを欠測にし、その id を除く (afex と同じ警告)。応答の Infinity はエラー。id・因子が欠測の行は除く |
| A-06/C-06 | `mauchlyTest` | y に欠測値がある行と group が欠測の行を除く。Infinity はエラー |
| A-07 | `aovEz` | 被験者内因子が 1 水準ならエラー (被験者間因子と同じ文言)。afex は空の表を返すが、指定の誤りを黙って通すため (ユーザー判断)。`test/aovEz.test.ts` で fixture #28 の期待値をこのエラーに差し替えた |
| A-08 | `jonckheereTest` | `variant: "clinfun"` では非有限の値を除く (clinfun と同じ) |

テストの変更

- `test/ttest.test.ts`: R が分散のアンダーフローで "data are essentially constant" になる 42 件と、オーバーフローで stdErr = Inf を返す 43 件を `substitute` で置き換えた。期待値は、データを 2^600 倍 (または 2^-600 倍) した rStats.js の結果を単位を戻したもの (尺度不変性の確認)。#809 (1e300 付近のほぼ定数のデータ) は正しい分散なら R 自身の判定で "essentially constant" になるので、期待値はそのエラー
- `test/scaleInvariance.test.ts` を追加: 上の修正の回帰テスト

結果: `npx tsc --noEmit` エラーなし。`npx vitest run` 全件成功 (2046 passed / 34 skipped)

## 修正しなかったもの

- A-04 (`quadeTest` の欠損ブロック): 3 本目のレポートで誤検出として撤回。R も元のブロック数を使う
- F-04 (`poissonTest` の T、r の Infinity): 有限値に限る厳格化を維持し、docs に意図的な差として記載

## 判断待ち

- `aovEz` の低ランク (d < p など) で GG ε を出すか。現状は car/afex と同じく補正を出さない (今回、警告だけ追加)。GG ε 自体は特異でも計算できるが、HF の分母が 0 以下になりうる

## R 突合が必要 (後でまとめて)

- `chisq.test(c(1e200, 1e200), p = c(0.1, 0.9))` などで R が本当に Inf/NaN を返すか (docs には記載済み)
- `mauchly.test` が 1e±100 倍で NaN になるか、afex/car が 1e-4 倍で補正を出さなくなるか (レポートの記述に基づき docs に記載済み)
- `oneway.test`、`var.test`、`bartlett.test`、PMCMRplus の `tukeyTest`/`gamesHowellTest` の 1e-200/1e155 倍での R の値
- afex `aov_ez` が id や因子の NA の行をどう扱うか (rStats.js は行を除く)
- `aovStrata` の新しいしきい値で、既存の R 一致テスト以外の典型例 (共変量が層ごとにわずかに変動するもの) が R とどう違うか。R は射影の平方和 1e-5 未満を落とすので、単位が 1 程度の共変量の非常に小さい成分は R だけが落とす
- Welch 自由度の計算式を (Σw)² の形に変えたため、R (stderr^4 の形) と最後の数ビットが違う場合がある。既存テスト (許容 1e-12) は通過
