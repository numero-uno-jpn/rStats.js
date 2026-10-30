# ChatGPT 外部レビュー (2026-10-30) 対応ログ

レポート: `ChatGPT_notices_20261030.txt`。番号はレポート内の No. (前半の段階別番号と後半の通し番号が重複するものは併記)。

## 判断基準

ユーザー判断 (2026-10-31): **R と違っても正しい値を優先し、R と違う理由を記録する**。R が正しい範囲では R と一致させる。

- オーバーフロー対策は「通常は従来の式で計算し、溢れたときだけ別の式に切り替える」形にして、通常範囲の値は R と同じまま
- R と違う箇所は `docs/differences-from-r.md` と `docs/ja/differences-from-r.md` に追記 (「R が失敗し、rStats.js が値を返す場合」の表と、「意図的な違い > 全般」の入力検証の項目)
- R の値を正解としているテストには、`knownDifference`/`substitute` で理由を書いて例外にした (`test/descriptive.test.ts` の weightedMean/skewness/kurtosis、`test/anova.test.ts` の zTest、`test/chisq.test.ts` の chisqTest)

## 修正済み

- No.1/2 `sample()`/`rmultinom()`: 重みの合計が Infinity のときだけ最大値でスケーリングして正規化 (通常入力の丸めは不変。R は long double で合計するので溢れない)
- No.4/49 `matrix()`/`diag()`: nrow/ncol を R の as.integer と同じく切り捨て、負・非有限はエラー
- No.5/13/46 `uniroot()`: tol は非負有限、maxiter は 1 以上 (切り捨て)
- No.6/45 `optimize()` (`optim` Brent 経由も): tol は非負有限 (負の tol で無限ループしていた)
- No.7 `expm()` Taylor/Pade 系: ノルム積のオーバーフロー回避、2^p が溢れるときはスケールの一部を A 側へ移す
- No.8/70 `eigen()`: `isSymmetric` の和が溢れるときだけ最大値で割って判定 (R の mean は long double で溢れない)
- No.11/12/69 `eigen()`/`svd()`/`svdValues()`: 要素の最大絶対値が [2^-256, 2^256] の外なら 2 のべき乗でスケーリングして計算し、値を戻す (R は LAPACK が内部でスケーリングする)
- No.9/86 `chol(pivot)` / No.10 `prcomp` / No.62 `solve` / No.85 `qr`: tol の NaN を拒否
- No.14/63 `sampleInt(0, size>0)`: エラー
- No.16 `integrate()`: subdivisions を切り捨て、非有限の subdivisions や NaN の許容誤差はエラー
- No.22/23/107 `tabulate`/`cut`/`wilcoxTest` など 30 か所以上: `Math.max(...arr)`/`Math.min(...arr)` を `maxOf`/`minOf` (新規 `src/internal/extremes.ts`) に置換 (大きな配列でのスタックオーバーフロー)
- Fligner (No.50 付近の追加指摘)/No.104 Levene: htest 内部の `median()` を `midpoint` に (R の median は mean = long double なので溢れない)
- No.21/74 `glm` 二列形式の二項: 負の度数を拒否
- No.20 `glm`: epsilon は有限、maxit は R の 1:maxit と同じく切り捨て
- No.24 `addColumn`: `__proto__` 列が消える問題を defineProperty で修正
- No.25/40/98 `cochranQTest`: 0/1 (と NaN) 以外を拒否
- No.26/44/78 `moodTest`: 片群が空ならエラー
- No.27/61 `wilcoxTest` の tolRoot: 有限を要求
- No.28/32/43/56 `coxph`: eps・tolerChol・tolerInf は正の有限、No.53 `init` は有限、No.57 説明変数の ±Inf を拒否
- No.29/89 `survdiff`: 群が 1 つならエラー (R も "There is only 1 group")
- No.29/105 `modelFrame` の levels 重複: エラー (R の factor(levels=) と同じ)
- No.30 `split()` 複数因子: sep で連結した名前が衝突したらエラー (黙って上書きしていた)
- No.30/41 正規性検定 (ad/cvm/lillie/pearson/sf): 定数データはエラー (R の nortest も ad/cvm/lillie は if(NA) でエラー)
- No.31/52 `pearsonTest`: nClasses は整数かつ自由度 > 0
- No.34 `aggregate()`: 結果の列名が重複したらエラー (黙って上書きしていた)
- No.34/37/38/39 `powerTTest`/`powerPropTest`/`powerAnovaTest`: power・p1・p2 は確率、sd・withinVar は正の有限、betweenVar は非負、n >= 2、tol は正の有限
- No.35 `aovEz` correction / No.123 `aovEz` es: 不正値はエラー
- No.36 `aovEz` observed / `etaSquared` など: 正規表現 `\b` をやめて、項名を ":" で分けて比較 (".grp" のような列名が見つからなかった)
- No.75/108 `lm` / No.110 `glm`: y・x の非有限値はエラー (R の "NA/NaN/Inf in 'y'")
- No.77 `propTest`: n の Infinity を拒否
- No.79 `hist`: breaks が狭義単調増加でなければエラー (R と同じ)
- No.101 `factanal`: 不正な rotation は q によらずエラー
- No.102 `rank` ties "last"/"random": 比較を引き算から大小比較に (Inf 同士の同順位が崩れていた)
- No.103 `rank` naLast: 不正値はエラー
- No.106 `rbindFrames`: 型の混在を R と同じ共通型に変換 (文字列があれば文字列、数値と論理値なら数値)
- No.109 `predict`(lm)/`glmPredict`: newdata の列数が合わなければエラー
- No.111 `lmer`: 「完全適合」判定のしきい値を 1e-12 から 64ε に (平均が大きく散らばりが小さい応答を誤判定していた)
- No.112 `predict`(lm) interval / No.114 `glmAnova` test / No.115 `glmConfint` test / No.116 `glmPredict` type: 不正値はエラー (R の match.arg と同じ)

## 2 回目に追加した修正 (正しい値を優先する方針に切り替えたあと)

- No.17/18 `fivenum`、`hist` の mids、No.54 KM 中央値、No.24/66 Wilcoxon の HL 推定値と midrange、No.65 三角分布の既定の最頻値、No.67 `splinefun` monoH.FC: `midpoint` (溢れたときだけ a/2+b/2)
- No.18 `skewness`/`kurtosis`: 偏差が [2^-120, 2^120] の外なら 2 のべき乗でスケーリング
- No.19/51 `scale()`: 二乗和が溢れた/アンダーフローしたときだけ最大値で割る
- No.22/26 `weightedMean`: 結果が非有限で入力が有限のときだけスケーリングして再計算
- No.28/23 `merge` 複数キー: 照合キーを JSON 符号化 (並び順のテキストは R のまま)
- No.8/12 `eigen` の自動対称判定: 最大値で正規化してから判定 (`isSymmetric()` 自体は R のまま)
- No.33/42 `zTest`: 既知標準偏差は正の有限
- No.73 `runif`: 幅が溢れるときは min(1-u)+max u
- No.50 `seq(by = ±Infinity)`: from だけを返す
- No.76 `chisqTest`: 確率の Infinity を拒否
- No.3/58 シミュレーション p 値: 分母は実際の回数 (B の整数部分) + 1
- No.95 JT 検定: 両側 p 値は最大 1
- No.96 `propTrendTest`: 0 <= x <= n、n は正の有限
- No.97 `polychor`: 表の度数は非負の有限
- No.90/91/92 `icc`/`kappamFleiss`: 被験者・評価者が 2 未満ならエラー、`icc` の r0 は [-1, 1)
- No.100 `pwrChisqTest`: df は正の有限
- No.71 `optim`: reltol は非負の有限、abstol は NaN 不可
- No.80/81 `distSummary`: unif の平均 (幅が溢れるとき)、triang の平均、beta の分散 (溢れる/アンダーフローするとき)

## 3 回目: double-double 演算の修正 (No.27/87/88)

- `src/special/dd.ts`
  - 乗除算 (twoProd/ddMul/ddMulNum/ddDiv ほか計 18 か所): Veltkamp 分割の `SPLITTER * x` が |x| > ~1e300 で溢れ、有限の積の誤差項が NaN になっていた。誤差項が非有限で積が有限のときだけ、各オペランドを 2 のべき乗で 1 付近にスケーリングして誤差項を求め、元に戻す (`prodErrScaled`)
  - 基本演算 (twoSum/twoProd/ddAdd/ddSub/ddMul/ddMulNum/ddDiv/ddDivNum) の和・積・商そのものが double の範囲を超えたときは `[±Inf, 0]` を返す (誤差項の計算が Inf - Inf で NaN になり、結果全体が NaN になっていた)
- 特殊関数側は、溢れたときに dd 演算が NaN を返すことに頼って極限値へ分岐していた (`incbet.ts` の betaIncTinyX、pbeta(4.2e-310, a≈2.52e305, 1113))。上の修正で dd 演算が ±Inf を返すようになり、既存の分岐 (e < -746 → 0) がそのまま働くので、特殊関数側の変更は不要だった
- `src/internal/summary.ts` の `meanDD`: 補正ステップ Σ(v - m) で、値が double の両端近くにあると偏差が溢れる。以前は NaN が後段の処理で偶然吸収されていたが、±Inf になって結果に伝わったため、補正項が非有限なら double-double の商 m をそのまま返すようにした (`mean([MAX, MAX, -MAX, 1, 3], trim 0.1)` の R オラクルテストで検出)
- 確認: `ddMulNum([1e302, 0], 1)` などが [1e302, 0]。数式形式の `lm("y ~ x")` で y を 1e150 倍しても R² = 0.97827 (行列形式・R と同じ)
- 性能: 演算ごとに `Number.isFinite` の判定が 1 回増える。`npm run bench` での計測は未実施

## 4 回目: 残っていた小〜中規模の項目

- No.117 `lmerTest` の `fTestOf`: 1 行のコントラストも、L V L' が 0 以下 (階数 0、0 だけの行など) なら複数行と同じく `undefined` (検定なし)
- No.119 `lmerAnova` の比較: 行数に加えて、使った行 (`rows`) と応答 (式の左辺) が一致しなければエラー (lme4 は行数だけを比べる)
- No.118 `predict` (lm) / `glmPredict`: R 4.5 の predict.lm (rankdeficient = "warnif") と同じく、ランク落ちの当てはめで推定可能でない newdata の行を零空間で判定し、`nonEstimable` (0 始まりの行番号) と R の警告文 `warnings` を返す (新規 `src/models/estimable.ts`)。推定可能な行だけなら何も付かない
- No.122 `aovStrata`: 層への射影を採用するしきい値を、R の絶対値 1e-5 から「1e-5 × 列の平均二乗」に。レビューの例で x を 1e-4 倍・1e4 倍しても同じ表になることを確認
- `docs/differences-from-r.md` (英日) に No.119・No.122 の行を追加

## 変更しなかったもの

- No.64 `rlogis` の負の scale: NaN を返すと乱数を消費しないので、乱数列が R とずれる (random.test で確認)。R のまま
- No.15/60 `setSeed(-2147483648)`: R の set.seed でも使えない値 (NA_integer_) なので、対応する R の乱数列がない
- No.48/25 `mean` の trim 範囲外: レビュー側で取り下げ済み (R の仕様どおり、0〜0.5 に丸める)
- No.55 `poissonTest(T = 0)`: 推定値 NaN は「定義できない」を正しく表している
- No.68 `integrate` の tol=Infinity / No.85 `qr` の tol=Infinity: 指定どおりの動作 (NaN だけ拒否)
- No.72 `optim` の maxit=0: 反復しないことを指定した結果として R と同じ
- No.93 `ansariTest` の CI 探索範囲が空: 未対応 (R 4.6.0 では NA と警告になった、との指摘あり → R 突合)
- No.94 `binomTest` の 1e-7 の整数判定許容: 浮動小数点で渡された度数を受け付けるための許容で妥当
- No.99 `pwrTTest` の n=Infinity: 未対応 (極限としての検出力は意味を持ちうる)

## 未修正・要対応 (設計を伴う作業)

- No.31/120/121 `lmer` のスケール依存 (応答 1e200 倍で収束しない、Satterthwaite 自由度が Inf になる、ランダム傾きが説明変数の単位で収束しない)
- No.33 `coxph` の標準誤差が共変量 1e200 倍でアンダーフロー (R の coxph は内部でスケーリングする)

## R 突合が必要 (後でまとめて)

- No.3/58: `fisher.test`/`chisq.test(simulate.p.value=TRUE, B=2.5)` の p 値の分母が 3.5 になるか
- No.8/12: `eigen(matrix(c(1,3,2,4),2)*1e-60)` が対称扱い (5.854, -0.854) になるか。rStats.js は R と同じ判定にしてある
- No.11/12/69: `eigen`/`svd` の 1e±200 倍での R の値 (LAPACK のスケーリング後の値) と、rStats.js の 2 のべき乗スケーリングの値の一致
- No.7: expm パッケージの Taylor/Pade が [[0,1e308],[0,0]] で何を返すか (R 側もノルム積が溢れるなら R 互換ではなくなっている)
- No.17〜19/26/54/65〜67/80/81: 上の「元に戻したもの」が本当に R で Inf/NaN になるか (fivenum、hist mids、scale、KM 中央値、wilcox HL、triangle、splinefun monoH.FC、distSummary)
- No.30: nortest の `pearson.test`/`sf.test` は定数データでエラーにならず結果を返す可能性がある (rStats.js はエラーにした)
- No.82〜84: `pf(1, 1e308, 1e308)`、`qf(0.5, 1e308, 1e308)`、`pbeta/qbeta/dbeta(0.5, 9e307, 9e307)`、`pgamma(1, 8e307, scale=1.25e-308)` の R の値
- No.93: R 4.5.2 と 4.6.0 で `ansari.test` の CI 探索範囲が空のときの挙動
- No.106: `rbind.data.frame` の型変換 (数値の文字列化の書式、論理値と数値) の一致
- No.111: lme4 の lmer が y≈1e12 のデータで何を返すか

## 検証

- `npx tsc --noEmit`: エラーなし
- `npx vitest run`: 2031 passed / 34 skipped (3 回目の dd.ts 修正後も同じ。全件成功。初回の全体実行では signrank と qtukey の時間制限テストが負荷で落ちたが、単独実行では変更前後とも成功)
