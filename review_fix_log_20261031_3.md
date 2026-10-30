# 外部レビュー (3 回目、再監査) 対応ログ

レポート: `C:\Users\numer\Downloads\rstats_audit_recheck.md` (R01〜R13)

ユーザーの指示: `scaleToUnit()` を個別の関数に足すのではなく、平均・偏差・分散・共分散・平方和を計算する共通基盤そのものを整える。計画は `~/.claude/plans/quirky-questing-giraffe.md`。

## 基盤の原則 (`src/internal/summary.ts` の冒頭コメントに明記)

1. **先に正規化、後で中心化**: データを 2 の冪 2^-k で割ってから (丸め誤差なし)、平均・偏差・積和を計算する
2. **無次元量は正規化した座標のまま計算する**: t、F、χ²、相関、効果量、ICC、α、ε、W、自由度、p 値
3. **単位のある量は出力の直前に戻す**: 平均・差・SE・CI は 2^k 倍、平方和・分散は 2^2k 倍。戻した値から無次元量を計算しない
4. **通常の範囲では従来と同じ値になる**: 2 の冪の正規化はビットを変えない

## 基盤の関数 (`src/internal/summary.ts`)

| 関数 | 内容 |
|---|---|
| `centered(x)` | 正規化してから double-double で中心化した偏差と k。`covariance`/`variance` と、cor.ts の `pearsonDD` がこれを使う (R02) |
| `standardize(x)` | (x − m)/s を正規化した座標で計算 (正規性検定用) |
| `groupMoments(groups)` | 共通の k での群ごとの n・平均・平方和・分散 (分散は double-double のまま割る)、全体平均、群間・群内平方和 |
| `pairedDifferences(x, y)` | 両方を共通の k で正規化してから差を取る (R03) |
| `productOver` | 積のアンダーフローを真のゼロと誤認していた (R01)。0 は a か b が 0 のときだけ。範囲外のときは 3 つを [1, 2) に正規化し、指数を足し戻す |
| `scaleToUnit` | 既存。内部の指数計算を `unitExponent` に統一 |

`src/descriptive/moments.ts` (skewness/kurtosis) も、中心化の前に正規化する形に変更した。

## 載せ替えた関数

| No. | 関数 | 内容 |
|---|---|---|
| R03/R11 | `tTest` | paired は `pairedDifferences`。CI を mu からではなく推定値を中心に作る。stdErr = 0 のときは、R と同じく有限側の端を NaN にする |
| R04 | `zTest` | x、y、sigmaX、sigmaY、mu を共通の k で正規化する |
| R05 | `cohensD`/`hedgesG` | 1 標本は `scaleToUnit`、paired は `pairedDifferences`、2 標本は `groupMoments`。mu も正規化する。単位は戻さない (無次元) |
| R06 | `icc`、`cronbachAlpha` | 評価行列全体を正規化する。`requireComplete` で Infinity をエラーにした (kappa 系にも効く) |
| R07 | `adTest`、`cvmTest`、`lillieTest`、`pearsonTest`、`sfTest` | 前の 4 つは `standardize`。`sfTest` は正規化した x で共分散比を計算する |
| R08 | `aov` (一元配置)、`TukeyHSD`、`leveneTest` | `groupMoments`。平方和、diff、区間だけ単位を戻す。levene は偏差を取る前に正規化する |
| (統一) | `onewayTest`、`varTest`、`bartlettTest`、多重比較の `pooled`/`gamesHowellTest`、`pairwiseTTest` | 前回の `scaleToUnit` + `variance` を `groupMoments` に統一 |
| R08 | `fitLm` (lm.ts) | 応答を 2^-k で正規化して当てはめ、coefficients、residuals、fitted、effects、sigma、SE を 2^k 倍、rss を 2^2k 倍して戻す。t、F、R²、p は正規化した当てはめから得る。`LmCore.yScale` に k を残す |
| R08 | `anova` (anovaSequential.ts) | 系列平方和と、複数モデル比較の RSS を、応答の尺度で正規化して計算する (`responseScale`、`scaledRss`)。F は正規化した座標、表の平方和だけ戻す |
| R09 | `aovStrata` | y を正規化してから層に分ける。表の Sum Sq、Mean Sq だけ戻す |
| R10 | `aovEz` | `anovaTable` に正規化した ss/errSS を渡し、ges/pes を戻す前に計算する。MSE だけ戻す |
| R12 | `aovEz`、`mauchlyTest` | 残差自由度が 0 以下なら RangeError ("no residual degrees of freedom: ...") |

## テスト

- `test/helpers/scaleInvariance.ts`: `expectScaleInvariant(name, run, { unitless, units, squared })`。倍率 2^-500、1e-200、1e200、2^500 で、無次元量の一致と、単位のある量が倍率どおりになることを確かめる
- `test/scaleInvarianceAll.test.ts`: 上の全関数の表と、基盤自体のテスト (中心化のオーバーフロー、paired の差、mu = 1e100 の CI、productOver、自由度不足のエラー)。新しく平均・分散・平方和を使う関数は、この表に足す
  - src を修正前に戻して流すと 14 件中 13 件が失敗した (検出力の確認)
- `test/ttest.test.ts`: mu が無限大のとき R の CI は NaN になる (mu + (t ± q) stdErr)。CI は mu に依存しないので `knownDifference` にした
- 結果: `npx tsc --noEmit -p .` エラーなし。`npx vitest run` 全件成功

## R13 (aovEz の特異性判定): 調査のみ

完全に加法的なデータ (被験者効果 + 共通の被験者内効果) で確かめた結果は次のとおり。

- 倍率 1、3、0.1、2^±300: 誤差 SSP は特異と判定され、補正を出さない
- 倍率 1e±100: 補正を出す (GG ε 0.87、0.83 など、倍率ごとに違う値)

2 の冪では変わらないので、判定自体は尺度不変。10^k 倍で変わるのは、入力の丸め (相対 1e-16) で加法構造が崩れ、その丸め誤差だけからなる誤差 SSP が、自分の最大固有値に対してはフルランクになるため。

改良案 (判断待ち): 誤差 SSP の固有値を、自分の最大固有値ではなく、被験者内の全変動 tr(YP'YP) と比べる。例えば固有値 > 1e-24 × tr(YP'YP) (相対の大きさで 1e-12) なら、丸め誤差だけの誤差 SSP を特異とみなせる。ただし car/afex との一致を確かめる必要がある。

## 範囲外 (次の段階で同じ基盤に載せる)

- `carAnova` の型 II/III (`Anova`)、`etaSquared` などの効果量関数が使う aov の平方和 (Inf/Inf になりうる)、`glm`、`lmer`、`coxph`
- X の列が 1e±200 の lm (QR は列ノルムに相対的だが、ノルム計算自体の範囲は未確認)

## R 突合が必要

- 上の docs の新しい行 (zTest、cohens_d、icc、alpha、nortest、aov、TukeyHSD、leveneTest、lm、anova、Error 層、ges の 1e±200 倍) で、R が実際に NaN・0・Inf を返すか
- `cov(c(MAX, MAX, -MAX), ...)`: R の cov は long double で計算するので、R では有限値になる可能性がある
- `t.test(x, mu = 1e100)` の R の区間が [0, 0] になること
