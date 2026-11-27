# 引継ぎ: rStats.js (外部レビュー対応 2026-10-30〜11-04、1.0.0 への準備 11-04〜)

最終更新: 2026-11-27 夜 (セッション 39 の終わり、Mac mini: 1.20.0 の時系列の大部分を実装 (作業ブランチ `dev/ts-meta-1.20`、手元だけ、最後のコミット `92fac09b` の後に HANDOFF)。次のセッションは下の「セッション 40 で最初にやること」から。以前: 2026-11-26 (セッション 38、Mac mini: 1.20.0 の準備が済んだ (Issue #570、作業ブランチ `dev/ts-meta-1.20`、イメージ、チェッカー)。時系列の R の実験 1〜13 (arima・forecast の Arima・tseries・stats の土台) が済んだ。以前: 2026-11-26 (セッション 37、Mac mini: 1.19.0 (時間依存 ROC) を公開し、1.20.0 の範囲を決めた (時系列とメタ分析、下の節)。次は準備。以前: 2026-11-26 (セッション 36 の終わり、Mac mini: **1.18.0 を公開** (管理図・一対比較、1.16.0・1.17.0 の極端な尺度の修正)。次は 1.19.0 の範囲を決める (下の節)。以前: 2026-11-25 (セッション 36 の続き、**1.18.0 が作業ブランチ `dev/qcc-bt-1.18` でほぼ完成** (実装・fixture・端のケース 2 回・配線・デモ・文書・版 1.18.0)。残りはユーザーの確認と公開 (下の節)。以前: 2026-11-25 (セッション 36、1.18.0 の R の実験が済んだ)。以前: 2026-11-25 (セッション 35 の終わり、Mac mini: **1.17.0 を公開** (tobit・betareg・loglin・loglm、survreg の parms)。1.18.0 = 管理図と一対比較の範囲をユーザーが決め、準備済み (Issue #568、作業ブランチ `dev/qcc-bt-1.18`)。次は R の実験から (下の節)。以前: 2026-11-25 (セッション 35、1.17.0 が作業ブランチで完成。以前: 2026-11-25 (セッション 34 の終わり、Mac mini: **1.16.0 を公開** (mediate・simSlopes・johnsonNeyman・sobelTest・mediationMonteCarlo・moderatedMediation・mvrnorm)。次は 1.17.0 = Tobit 回帰・ベータ回帰・対数線形モデル、範囲はユーザーが決めた (下の節)、準備から)。以前: 2026-11-25 (セッション 34、1.16.0 が作業ブランチで完成)。以前: 2026-11-25 (セッション 33 の終わり、Mac mini: **1.15.0 を公開** (step・stepAIC・drop1・add1・extractAIC、glm の式の入口)。次は 1.16.0 = 媒介・調整・調整媒介分析、範囲はユーザーが決めた (下の節))。以前: 2026-11-25 (セッション 33、1.15.0 の範囲を決め、glm の式の入口と step 本体を実装)。以前: 2026-11-24 (セッション 32 の終わり、Mac mini: **1.14.0 を公開** (`/regression` の multinom とその関数)。次は 1.15.0 = 変数選択 (`step`・`stepAIC`、ROADMAP の 4)、範囲を決めるところから (下の節))。以前: 2026-11-24 (セッション 32、Mac mini: 1.14.0 を版 1.14.0 まで済み)。以前: 2026-11-24 (セッション 31 の終わり、Mac mini: **1.13.0 を公開** (`/causal` の weightit・trimWeights・weightSummary、`/tests` の svyglm・survfitCoxph、整数でない重みの survfit)。次の作業は未定 (ROADMAP の 3 = 多項ロジスティック回帰 `multinom` から))。以前: 2026-11-24 (セッション 31 の続き、Mac mini: 1.13.0 の fixture・実装・端のケース・文書 (英・日)・訳・デモまで済み)。以前: 2026-11-24 (セッション 31、Mac mini: 1.13.0 (IPTW) の準備。作業ブランチ `dev/iptw-1.13` (手元だけ)、Issue #563、イメージとチェッカーに WeightIt・CBPS・survey・sandwich、最初の R の実験 `experiments/iptw113` と仕様書 `oracle/weightit-behaviour.md`、Choices をユーザーが決めた。次は fixture と実装)。以前: 2026-11-24 (セッション 30 の終わり、Mac mini: **1.12.0 を公開** (`/causal` の match・matchWeights・balTab・tableOneSmd、`/tests` の clogit)。次は 1.13.0 = IPTW、範囲はユーザーが決めた (下の節))。以前: 2026-11-24 (セッション 30、Mac mini: 1.12.0 (マッチング) の準備。作業ブランチ `dev/psm-1.12` (手元だけ)、Issue #562、イメージとチェッカーに Matching・cobalt・tableone、最初の R の実験 3 本と仕様書の下書き `oracle/match-behaviour.md`。Match・バランス・clogit を実装して R と一致、端のケースも点検、訳・文書・デモ・版 1.12.0 まで済み。次は main への push とタグ)。以前: 2026-11-24 (セッション 29 の終わり、Mac mini: **1.11.0 を公開** (acf・pacf・ccf の `/timeseries`、ca・caSummary・caCoord・mjca・sammon・isoMDS)。次は 1.12.0 = 傾向スコア (ROADMAP の新しい 1 番)、範囲を決めるところから)。以前: 2026-11-24 (セッション 29: 1.11.0 の作業ブランチは完成、GitHub Actions が支払いのロックで止まっていて取り込み待ち)。以前: 2026-11-23 (セッション 29 の始め、Mac mini: 1.11.0 の範囲をユーザーが決めた (mjca も入れる、ほかは推奨どおり)。準備が全部済んだ (Issue #560・draft PR #561・作業ブランチ `work/ca-acf-mds-1.11`)。段階 1 も済み、Decisions を決めて choices・fixture・段階 2 の指示を置いた (ブランチ `40aa5d94`)。次は ChatGPT の段階 2 (実装))。以前: 2026-11-23 (セッション 28 の終わり、Mac mini: **1.10.0 を公開** (dist・hclust・cutree・kmeans・cmdscale)。次は 1.11.0 = ca・acf・pacf・isoMDS・sammon、1.12.0 = arima (ユーザーの決定)。範囲を決めるところから)。以前: 2026-11-22 夜 (セッション 28、Mac mini: 1.10.0 の範囲をユーザーが決め (全部推奨どおり)、準備 (チェッカー・R の実験・指示書) を main に置き、Issue #556・draft PR #557 を作った。段階 1 を終え、次は ChatGPT の段階 2)。以前: 2026-11-22 夜 (セッション 27 の終わり、Mac mini: **1.9.0 を公開** (T2・Page・Grubbs、manova・lda・cancor)。次は 1.10.0 = クラスタ分析と多次元尺度法 (ユーザーの決定)、範囲を決めるところから)。以前: 2026-11-22 (セッション 27 の始め、Mac mini: 1.9.0 の範囲を決め、準備中)。以前: 2026-11-22 (セッション 26 の終わり、Mac mini: **1.8.0 を公開** (rq・geeglm・glmnet)。次は 1.9.0 = 小さな検定 3 つ + 多変量 3 つ (ユーザーの決定)、範囲を決めるところから)。以前: 2026-11-20 夜 (セッション 26 の始め: 1.8.0 の範囲を決め、準備)。以前: 2026-11-20 夕 (セッション 25 の終わり、Mac mini: **1.7.0 を公開** (回帰 polr・rlm・nls、`/regression`)。次の作業は未定 (ROADMAP の 2 = 1.8.0)。以前: 2026-11-20 昼 (セッション 25、Mac mini: 段階 3 の端の入力の直しも済み (最後は私が引き継いだ)。次は「nls の後」の配線と文書)。以前: 2026-11-19 深夜 (セッション 24、polr・rlm は完了、nls を ChatGPT に依頼)。以前: 2026-11-19 (セッション 23、1.6.0 を公開 (混合モデルの confint と simulate))。以前: 2026-11-17 (セッション 22、1.5.0 を公開)。その前: 2026-11-16 (セッション 21、Mac mini: 1.4.0 を公開、同時刻の Gray の検定を ChatGPT がクリーンルームで修正 (1.4.1 に入る、未公開)、外注用の R の実験の仕組みを作った。次は ROADMAP の 1 番)


## セッション 40 で最初にやること (2026-11-27 夜に書いた)

**セッション 40 の結果 (2026-11-27): A・B とも解決 (ログ 88-90)。** 別の LLM に、ソースを引用させずに不具合かどうかだけを確かめてもらった (ユーザーの依頼)。
A は urca の誤り (分母を y_{t−1} でなく y_t で作る。use.lag = 0 の 1:0 ループ)。B は forecast の off-by-one
(1..maxlag を共通の標本で比べ、選んだ L から 1 を引く)。方針は「R の誤りは模倣しない」。A は教科書の形のまま、
B はユーザーの決定で 0..maxlag を共通の標本で比べ、選んだ L を使う形に実装した (`ocsbTest` の `lagMethod`、nsdiffs は AIC・maxlag 3)。
仕様書の Departures from R の 9・10 に記録し、Open points から外した。テストは通る。未コミット。Issue #570 への記録はまだ。
R への報告 (forecast は GitHub、urca は保守者) はユーザーが行う。**次は下の「1.20.0 の残り」から。**

**セッション 40 の続き (2026-11-27):** forecastSimple・forecastUtils を R と照合した (oracle/forecastSimple.R、テスト 37 件、ログ 91-93)。
stlm・forecastStlm・forecast (振り分け) を足した (src/timeseries/forecastDispatch.ts)。tseries の 8 関数を実装した
(src/timeseries/tseries.ts、oracle/tseries.R、全部 1e-9、Fuller の表を R の出力から読み取って確認、ログ 94-95)。
R との違いが 11-14 増えた (croston・easter の四半期・hw の simple・thetaf の季節の区間 (ユーザー決定))。
**時系列は端のケースの点検を残して実装済み。次はメタ分析 (meta・netmeta、ログ 61-77) から。**

**ユーザーの指示:** 未解決 2 件 (下の A・B) をさらに探る。そのあと 1.20.0 の残り (下の「残り」)。作業は Mac で、作業ブランチ
`dev/ts-meta-1.20` (push していない)。**push・タグはユーザーの確認なしにしない。** R の実験は毎回チェッカーを先に
(`node scripts/r-experiment-check.mjs f.R && docker run --rm --platform linux/amd64 -v "$PWD/experiments:/e:ro" rstats-oracle-amd64:4.6.2 Rscript /e/f.R > f.json`)、
外れも含め `experiments/tsmeta120-log.md` (いま項目 87 まで) と Issue #570 に記録する。R・GPL (urca も) のソースは読まない。

**探索のやり方 (セッション 39 で効いた、メモリ feedback-rstats-designed-probes の項目 4):** 判定 (1 ビット) から手元で式を当てない。
裏にある公開関数を R の中で直接比べ、中間量 (時点ごとの残差、slot、最適化を止めた固定値の出力 `init` + `optim.control = list(maxit = 0)`、
項を消す公開引数) を記録する。候補の格子を広げるのは最後の手段。

### A. ndiffs(test = "pp") の統計量 = urca の ur.pp の Z-tau (ログ 78-79, 85)

- **分かっていること:** ndiffs の PP は `ur.pp(x, type = "Z-tau", model = "constant" / "trend", lags = "short")` の統計量を、ur.pp の
  臨界値 (= MacKinnon 1991 の応答曲面を N = n − 1 で、実装済み `src/timeseries/forecastArima.ts` の `MACKINNON`・`ppPValue`) で線形補間した
  p 値 (ndiffs6: 45/45・67/67)。ur.pp の検定回帰と残差 (@testreg・@res) は私のもの (y_t を 1, y_{t−1}, t − n/2 に回帰) と 4e-14 で一致。
  ラグは trunc(4 (n/100)^0.25)。
- **分かっていないこと:** ur.pp の Z-tau の式。私の Phillips-Perron の形 (`ppStatisticConst`) とは最大 0.025 (constant)・0.05 (trend) 違う。
  **use.lag = 0 でも t = (ρ − 1)/se にならない** (lh の constant: ur.pp −3.650、t −3.381) ので、ラグで消えない項がある。いまは判定が
  1160 件すべて一致 (p の差は最大 3.4e-3)。データ: `experiments/tsmeta120-ndiffs6/7/8.json` (8 は use.lag 0..4 の統計量と @res・@testreg)。
- **次の一手 (設計した入力):**
  1. `type = "Z-alpha"` の use.lag = 0 を記録する。Z-alpha = n(ρ − 1) − ½ (n² σ̂_ρ² / s²)(λ² − γ0) は λ² について**一次**なので、
     各系列で (λ² − γ0) をそのまま解ける。use.lag = 0 で 0 にならなければ、λ² か γ0 の分母 (n か n − k か) が違う → その値を Z-tau に
     入れて残りの項を確かめる。
  2. @auxstat (Z-tau-mu、Z-tau-beta) も同じ式の部品なので、同じ λ² で再現できるかを見る (整合性の検査)。
  3. 尺度・ずらしの不変性 (y × c、y + c) で、統計量がどの量に依存するかを分ける。
  - 文献の候補: Phillips and Perron (1988)、Hamilton (1994) 17.6 節の形。urca の作者の本 (Pfaff 2008) の式もヘルプの参照にあれば候補にしてよい
    (ソースではないので可)。

### B. nsdiffs(test = "ocsb") のラグの選び方 (ログ 80, 86)

- **分かっていること:** nsdiffs(test = "ocsb") = `ocsb.test(y, lag.method = "AIC", maxlag = 3)` の統計量 > 臨界値 (295/295)。ラグ L の
  回帰は完全に再現 (w = Δm Δ1 y の AR(L) を平均なしの最小二乗で当て、その係数で Δm y_{t−1} と Δ1 y_{t−m} を濾過してから w_t を
  w_{t−1..L} と濾過した 2 つに定数なしで回帰、最後の係数の t 値、`src/timeseries/stl.ts` の `ocsbTest`)。n = 9 (m = 4) で ocsb.test が
  エラーになり、nsdiffs は 0 を返す。**選ばれるラグはいつも maxlag − 1 以下** (AIC・BIC・AICc × maxlag 1〜3 の 9 通りで)。
- **合わなかった候補 (同じことを試さない):** ar() の次数 (ols の平均あり・なし、yule-walker の平均あり・なし、burg、mle)、
  Arima(w, c(L,0,0)) の AIC・AICc・BIC、ocsb.test(fixed, maxlag = L) の fitted.model の AIC・BIC (自分の行、0..maxlag、0..maxlag − 1、
  1..maxlag で当てて 1 を引く)、手元での lm の AIC 12 通り (ログ 80)。最も良くて 2685 件中 1827 件。データ:
  `experiments/tsmeta120-nsdiffs-ocsb2.json` (系列・9 通りの選択・候補の値)。
- **次の一手 (設計した入力):**
  1. maxlag を 1〜6 に広げ、同じ系列で選択がどう変わるかを見る (「maxlag − 1 以下」が maxlag を上げても続くか、0 と maxlag − 1 だけか)。
  2. 系列の長さを 1 点ずつ切り詰めて選択が切り替わる境目を集め、境目で 2 つのラグの基準が等しいことから、各ラグの「尤度」と
     罰則の n・k を逆算する (BIC と AIC の境目の違いで n が、AIC と AICc の違いで k が分かる)。
  3. w の AR の次数がはっきりした系列 (AR(2) の係数を大きく) を作り、正しい次数が 2 のときに何が選ばれるかを見る (選択の対象が
     AR の次数そのものか、ずれた添字か)。

## 1.20.0 の残り (セッション 39 の終わりの状態)

- **実装・テスト済み (時系列、fixture と R の比較、テストはすべて通る):** `arima`・`predictArima`・`arima0` (delta つき、R と一致)、
  `forecastArima`・`forecastFromArima`・`boxCox`・`invBoxCox`・`boxCoxLambda`・`ndiffs`、`stl`・`supsmu`・`mstl`・`seasadj`・`nsdiffs`・`ocsbTest`、
  `autoArima`、`ets`・`forecastEts`、`tsFilter` (stats の filter、名前はユーザー決定)・`boxTest`・`diffinv`・`decompose`・`ar`・`predictAr`、
  `holtWinters`・`predictHoltWinters`。テスト: `test/arima・forecastArima・stl・ets・autoArima・statsTs.test.ts` (autoArima は約 2 分)
- **書いたが未テスト (コミット `a5006cd3`):** `src/timeseries/forecastSimple.ts` (meanf・rwf・naive・snaive・ses・holt・hw・thetaf・croston・
  stlf・tslm)、`src/timeseries/forecastUtils.ts` (accuracy・ma・fourier・seasonaldummy・monthdays・easter・bizdays・dmTest・cvLm・
  checkresiduals・tsCV・arimaorder・specAr・findfrequency・naInterp・tsoutliers・tsclean・seasonalComponent・trendcycle・remainder)。
  次は oracle/forecastSimple.R (ログ 28-32, 47, 52-60 の確かめた事例) と test を書いて合わせる。stlm と forecast() の振り分け (Arima・ets・
  stlm・HoltWinters など) はまだ書いていない
- **まだ:** tseries 8 関数 (ログ 6-9, 14-18、po の表はログ 18)、メタ分析 (meta・netmeta、ログ 61-77、GLMM は glmer の nAGQ = 7)、
  端のケースの点検 (仕様書の Edge-case plan、全部の関数を全部の軸で)、配線 (entries、型、option-keys の生成)、文書 (英・日)・訳・デモ、
  版 1.20.0、ユーザーの確認、main へ squash とタグ
- **R との違い (仕様書 "Departures from R" 1〜8):** HoltWinters の乗法区間 (Bug 19369)、stl の中央値 (Bug 19370)、ets の class 3 減衰と
  ANA/MNA の区間、hw(乗法) の局所解、arima の kappa、auto.arima の古い定数の印 (ログ 81)、ets の減衰トレンドの amse (ログ 82)。
  ほかに推定が R より良い最適点に届くことによる違い (ets の ZZZ の選択: AirPassengers MAM・uspop MAN、auto.arima の一部の模型の値、
  ログ 83 の R の optim の失敗)。文書を書くときにすべて載せる
- **未解決 (ユーザーに相談済み、A・B が続き):** 上の A・B。仕様書の "Open points" 節


## まず読むこと (セッション 16 から)

## 1.20.0 の範囲 (ユーザーが決めた、2026-11-26)

- **時系列とメタ分析の両方を 1 版で**、各パッケージの公開関数を広く、入口は既存と同じ (時系列 `/timeseries`、メタ分析 `/tests`)。
  作業は時系列 → メタ分析の順に、分野ごとに実験・仕様書・実装・端のケースの点検を済ませる
- ReactiveStat の呼び出し: `stats/時系列分析/時系列分析.php` (ts、forecast の na.interp・tsoutliers・tsclean・ndiffs・nsdiffs・ets・Arima・
  auto.arima・forecast・accuracy・checkresiduals、decompose・stl、tseries の adf・kpss・pp)、`季節指数分析.php` (stats::filter の中心化移動
  平均)、`メタ解析/metaAnalysis.php` (metabin・metagen に method.tau = "REML"・method.random.ci = "HK"、metabias、metareg、funnel)、
  `networkMetaAnalysis.php` (pairwise・netmeta (random、reference.group)・netrank・netgraph・funnel)
- **時系列:** forecast (`Arima`・`auto.arima`・`arimaorder`・`ets`・`forecast`・`accuracy`・`BoxCox`・`BoxCox.lambda`・`InvBoxCox`・`ndiffs`・
  `nsdiffs`・`ocsb.test`・`na.interp`・`tsclean`・`tsoutliers`・`checkresiduals`・`meanf`・`naive`・`snaive`・`rwf`・`ses`・`holt`・`hw`・`thetaf`・
  `croston`・`stlf`・`stlm`・`mstl`・`seasadj`・`seasonal`・`trendcycle`・`remainder`・`fourier`・`seasonaldummy`・`tslm`・`findfrequency`・`dm.test`・
  `tsCV`・`CV`・`ma`・`bizdays`・`monthdays`・`easter`)、その土台の stats (`arima` (カルマンフィルタの厳密な尤度) と predict・`decompose`・`stl`・
  `filter`・`HoltWinters`・`Box.test`・`ar`・`diffinv`)、tseries (`adf.test`・`kpss.test`・`pp.test`・`po.test`・`jarque.bera.test`・`runs.test`・
  `white.test`・`terasvirta.test`)
- **メタ分析:** meta (`metabin` (MH・Peto・逆分散)・`metacont`・`metagen`・`metainc`・`metacor`・`metamean`・`metarate`・`metaprop` (GLMM も、2026-11-27 に範囲へ)、
  REML・HK、サブグループ、`metabias` (Egger・Begg・Harbord・Peters・Thompson-Sharp)・`trimfill`・`metareg`・`metainf`・`metacum`、funnel・baujat の値)、
  netmeta (`pairwise`・`netmeta` (共通・変量効果)・`netrank` (P スコア)・`netsplit`・`netleague`・`decomp.design`・`netmeasures`・`netconnection`・
  `netcomb`・`discomb`・`netposet`、forest・funnel の値)
- **入れない:** 描画 (`autoplot`・`gg*`)、`nnetar`・`tbats`/`bats`・`baggedETS`・`arfima`・`dshw`・`splinef`・`garch`、
  リサンプリングの `rankogram`
- **準備済み (セッション 38、2026-11-26):** Issue #570、作業ブランチ `dev/ts-meta-1.20` (main の HANDOFF の 3 コミット込み、手元だけ)、
  イメージ (x86_64・arm64 とも作り直し済み) に forecast 9.0.2・tseries 0.10.63・meta 8.5.0・netmeta 3.7.0 (netmeta の igraph に
  libglpk40 が要る、apt で同じ層に)、実験用 Dockerfile にも同じ層 (未ビルド)。チェッカーに 4 パッケージの公開関数と S3 メソッド
  (`getNamespaceExports` と `getNamespaceInfo(p, "S3methods")` から) と stats の時系列関数 (arima・predict.Arima・Kalman*・decompose・
  stl・filter・HoltWinters・Box.test・PP.test・ar*・diffinv・StructTS など)。**除いた名前:** tseries の `value`、meta の `ci`・`rd`・`rob`
  (既存の実験の変数名とぶつかる。実験では呼ぶだけにする)、magrittr の `%>%`。既存の実験の判定は足す前と同じ (15 行)、acf・timeroc の
  fixture は新しいイメージで変わらない
- **時系列の R の実験 (セッション 38、2026-11-26、ログ 1〜13、`experiments/tsmeta120-*`、Issue #570 に 4 回記録):**
  - stats の arima: 厳密な尤度 (Toeplitz・LDL) と loglik・sigma2・残差 (v/√D)・予測と se が 1e-14。差分は **kappa = 1e6 の有限の事前分布**
    (最初の d + sD 個は尤度から除く) を安定な形で計算すると 6e-11。CSS は sigma2 = SS/(n − d − sD − n.cond) だが loglik は nobs (n.cond を
    引かない) を使う。var.coef = J Hu⁻¹ J' (Hu は atanh(PACF) の空間で optimHess、J は刻み 1e-3 の前進差分) で 1e-6、回帰変数の行だけ 1e-4
    (直交化、追わない)。既定の当てはめは手前で止まる → 厳しく当て直した値と比べる
  - forecast の Arima・forecast(): sigma2 = Σ残差²/(nobs − 係数の数) を予測に使う、aicc・bic・Box-Cox・biasadj・区間がすべて完全一致
  - tseries: kpss・adf (p は n − 1 で表を補間)・pp (論文の det(X'X) の閉じた式)・po (lag は n − 1 から)・jarque.bera・runs が一致
  - stats: filter・Box.test・diffinv・decompose (figure は最初の観測の位置から)・ar.yw・ar.burg・ar.ols (AIC の式も)・ar.mle (= arima0)・
    HoltWinters (初期値・フィルタ・加法の区間 = var(残差)) が一致
  - terasvirta.test はユーザーの指示で再探索して解決 (ログ 14: Chisq = n·log(SSR0/SSR1)、n は系列の長さ、F の分母の自由度は m − df)
  - white.test もユーザーの指示で再探索して解決 (ログ 15: 重みは runif((lag+1)q, −range/2, range/2) を列順、logistic、主成分は scale. = TRUE、
    Chisq = n·log(SSR0/SSR1))
  - HoltWinters の乗法モデルの区間もユーザーの指示で再探索して解決 (ログ 16): var_h = var(残差) Σ_{j=0}^{h−1} (ψ_j num/den)²、
    num = 係数[2 + ((h−1) mod f + 1)]、den = 係数[2 + ((h−j) mod f)] (係数は (a, b, s1..sf) を常に仮定)。添字 0 で b で割り、
    β なしでは季節係数が 1 つずれ h = 12・24 は NA になる R の添字の不具合 (ソースは読んでいない、出力からの推定)。
    **ユーザーの決定 (2026-11-27): A = 正しい添字 (季節係数を周期どおり s_h / s_{h−j}) で計算し、R との違いを文書に書く** (トレンドありで
    h < f は R と同じ)。R への報告はユーザーが済ませた (2026-11-27、R Bugzilla Bug 19369「Bug in stats::predict.HoltWinters: Incorrect coefficient indexing for prediction intervals in multiplicative seasonal models」。文書の R との違いにこの番号を書く)。再現: `m <- HoltWinters(co2, alpha = 0.5, beta = 0.01,
    gamma = 0.4, seasonal = "multiplicative"); p <- predict(m, 24, prediction.interval = TRUE)` で h = 11 → 12 の幅が約 3 倍に跳ぶ
    (b = 0.1257 で割る)。`HoltWinters(AirPassengers, alpha = 0.4, beta = FALSE, gamma = 0.5, seasonal = "multiplicative")` では
    h = 12・24 の区間が NA。証拠は `experiments/tsmeta120-hw3.{R,json}` とログ 16
  - po.test の p 値もユーザーの指示で探索して解決 (ログ 17・18: 出力の折れ線の節から Phillips-Ouliaris の表 Ia・Ib を読み取り、新しいデータ 4000 件で差 0。
    表はログ 18 にある)。**時系列の未解明は無い**
  - **stl (ログ 19〜23、2026-11-27):** 論文 (Cleveland ら 1990) どおりの候補 (q > n なら h + (q − n) %/% 2、lowess の閾値、periodic は最後に
    周期ごとの平均) が 18 構成中 16 で 1e-11。**未解明:** USAccDeaths の periodic + robust と s.window 7・inner 5・outer 3 だけ外れる
    (外側 2 回目までは完全一致、3 回目で全点が分かれる)。**ユーザーの指示で再探索して原因が分かった (ログ 24〜27):** 当てはめは一致していて、
    頑健化の重みの尺度 h が違う。R は n が偶数のとき約 1 割 (400 系列中、偶数 218 件のうち 23 件) で、中央の 2 つの順序統計量のうち 1 つを
    無関係な順位の値にして h = 3 (s_a + s_b) を使う (奇数の n は常に正しい)。部分ソートの不具合とみられる (ソースは読んでいない)。
    **ユーザーの決定 (2026-11-27): R の誤りは模倣しない。rStats.js は正しい中央値 (論文・ヘルプどおり)、R との違いを文書に。** 調査はユーザーが別の LLM で行い、報告済み (2026-11-27、R Bugzilla Bug 19370「Bug in stats::stl: Incorrect median calculation in robustness weights (stlrwt) for even-length series due to consecutive psort calls」。文書の R との違いにこの番号を書く)。R の誤った値を再現するには部分ソートの算法が要り、出力からは分からない
  - **forecast の小さな関数 (ログ 28〜32、2026-11-27):** meanf・naive・rwf・snaive (σ の取り方も)・accuracy・ma・fourier・seasonaldummy・
    monthdays・easter (割合を小数 2 桁に丸める)・dm.test・CV・checkresiduals・BoxCox・InvBoxCox・BoxCox.lambda (guerrero は末尾から区切り
    optimize の既定の精度、loglik は 0.05 刻みの格子)・na.interp (線形)・tsCV (起点の行に入る)・arimaorder・findfrequency (閾値 10)・
    bizdays (5 市場の暦、NYSE の臨時休場の一覧はログ 32) が完全一致。**未解明:** na.interp の季節版 (2 回で決着せず)
  - **ets (ログ 33〜35):** 13 モデルのフィルタ・尤度 (loglik = −0.5·lik)・aic/bic/aicc (p = length(par))・sigma2 = SSE/(n − p)・mse が R の
    推定値を入れて 2e-12。予測はクラス 1・2 の閉じた式で一致 (ANA・MNA だけ 1e-4 ほどずれ、未解明)。クラス 3 (乗法季節) の平均と分散、
    hw の乗法と ets(MAM) の違い、initial = "simple" の母数の推定基準、amse、モデル選択 (ZZZ)、admissible の範囲は未着手
  - **ets の予測区間はすべて突き止めた (ログ 36〜38):** クラス 3 (MNM・MAM) は厳密なモーメント (状態の平均と 2 次モーメントの伝播)。
    **forecast パッケージの不具合とみられるもの 2 件:** (1) MAdM などクラス 3 の減衰トレンドの予測が T = l + b (モデルは l + φb、標本内の
    フィルタやクラス 1・2 は l + φb)。(2) ANA・MNA (トレンドなし・加法季節) の区間で季節の項が 1 つ早い ((j+1) mod m)。四半期の UKgas で
    幅が 35% ずれる。**方針: R の誤りは模倣しない (ユーザーの stl での決定を当てはめた)、正しい式で実装し文書に。報告するかはユーザー**
  - **ndiffs・nsdiffs・ocsb・auto.arima (ログ 39〜46、2026-11-27):** ndiffs は KPSS (lag trunc(3√n/13)、p < alpha)・ADF (k = 1、
    Dickey-Fuller の表を n ≤ 25/50/100/250/500 の区間で、p > alpha で差分)・PP (Z(t_α)、定数つき) で全件一致。nsdiffs は mstl の強さ > 0.64。
    ocsb の統計量は一致、臨界値は m = 2〜400 の値を表として (式が出ない)。auto.arima は探索の順序・基準 (CSS-ML の AICc)・根 < 1.01 の棄却・
    近似 (CSS の AICc で順位、表示だけ系列ごとの定数がずれる、選択には効かない) が分かった。チェッカーは `trace =` を引数名として許すよう変更
  - **分解と残りの予測法 (ログ 47〜50):** mstl (季節 1 つなら stl(s.window = 11)、季節なしのトレンドは supsmu)・seasadj・stlf・thetaf (ses は
    MSE 最小)・croston・tslm が完全一致。stats の **supsmu** を Friedman (1984) から書いて一致 (半幅は四捨五入、端で窓を内側にずらす)。
    **未解明:** tsoutliers の分解 (AirPassengers で外れ値の集合が合わない、2 回で決着せず)、na.interp の季節版 (置き換えに使う)。
    ログ 47 に手順の誤り (チェッカーの判定前に 1 回実行、出力は読まずに削除) を記録
  - **ets の推定まわり (ログ 51):** ZZZ の選択 (許されるモデルの AICc 最小) と amse が一致。ses の simple は l0 = y1・SSE 最小。hw の乗法は R が
    悪い局所解で止まる (rStats.js は最適解へ、文書に)
  - **na.interp の季節版はユーザーの指示で再探索して解決 (ログ 52〜57、設計した入力で):** lm(x ~ fourier(K = min(5, floor(m/2))) + poly(t,
    min(6, floor(n/10)))) で補完 → mstl(robust) の季節 → x − 季節を線形補間 → 季節を戻す。28 構成で 1e-13
  - **tsoutliers・tsclean もユーザーの指示で再探索して解決 (ログ 58〜60):** 残差 = mstl(robust) の季節調整済み − supsmu のトレンド
    (季節なしは x − supsmu)、[Q1 − 3 IQR, Q3 + 3 IQR] の外、置き換えは na.interp、iterate = 2 は「1 回目」と「1 回目を置き換えた系列で同じ手順」
    の和集合。iterate 1・2 と tsclean が 7 系列で完全一致。iterate = 3 だけ UKgas で違う (既定は 2、未解明として残す)
  - **時系列の実験は済んだ (ログ 1〜60)。** 小さな未解明: auto.arima の近似モードの表示の offset (選択に効かない)、tsoutliers の iterate = 3、
    supsmu の同じ x の扱い (forecast では使わない)stlm は stlf と同じ
    作りの見込み (fixture で確かめる)。ets と auto.arima の最適化の終点は fixture で厳しい当てはめと比べる
  - **meta の実験 (ログ 61〜70、2026-11-27):** metagen = metafor の rma (予測区間は t(k − 1)、τ² の区間は DL なら一般化 Q (重み 1/se) で
    他は QP、H・I² の区間は Higgins-Thompson で Q ≤ k なら中心 log max(H, 1))。metabin (MH・Peto・IV、ゼロの扱いは効果量ごと)、
    metacont (SMD の分散は 1/n1 + 1/n2 + (1 − (N−4)/((N−2)J²)) g²、設計した入力で特定)、metainc (MH は Greenland-Robins)、metacor・
    metamean・metarate・metaprop (Inverse)、サブグループ、metabias (Egger・Begg・Thompson・Harbord・Peters)、trimfill (FE で L0)、metareg、
    metainf・metacum (共通効果) が一致。**rStats.js に足すもの:** rma の GENQ (一般化 Q の区間、重みつきカイ二乗の和の分布)。
    **metaprop の GLMM (ログ 75):** glmer(cbind(x, n − x) ~ 1 + (1 | study), binomial, nAGQ = 7) と完全一致 (= metafor の rma.glmm)。
    rStats.js の glmer で組める。**ユーザーの決定 (2026-11-27): 範囲に戻し、既定も R と同じ GLMM** (範囲の「入れない」から外す)
  - **netmeta の実験 (ログ 71〜74、2026-11-27):** Rücker (2012) のグラフ理論的な当てはめ (L = B′WB の擬似逆行列、多群は有効抵抗が分散に
    一致する重み)、τ² (DL) = (Q − df)/tr(W(I − H)S(I − H)′) (S は多群の対比の共分散 (1/2)CC′、Jackson ら 2012)、P スコア、netsplit
    (直接 = その比較の行を補正なしの分散で逆分散統合、割合 = v_net/v_dir)、decomp.design、pairwise (多群のどこかにゼロなら全腕に 0.5)、
    netconnection、netcomb (加法 CNMA)、discomb、netcomb の変量効果、forest の値、netleague の配置と書式、netposet (M0 はハッセ図) が一致
  - **metaprop の GLMM (ログ 75〜76):** 範囲に戻した。glmer(nAGQ = 7)、Q は Wald (飽和 glm の Wald 検定、全研究) と LRT (共通 glm の逸脱度)
  - **実験の段階は済んだ (ログ 1〜77、2026-11-27)。** 未確認の小さな点: funnel の値、tsoutliers の iterate = 3、auto.arima の近似の表示 offset
  - **仕様書 `oracle/tsmeta-behaviour.md` を書いた (2026-11-27、英語、ログの番号つき)。Choices 1〜7 はユーザーがすべて推奨どおりに決めた (2026-11-27)**
  - **実装 (2026-11-27〜):** `src/timeseries/arima.ts` (arima・predictArima: カルマンフィルタ、kappa = 1e6、CSS、R と同じ数値 Hessian、
    非可逆な MA に動いたら反転して可逆な領域で当てはめ直す、回帰係数は尺度で正規化して最適化)、fixture `oracle/arima.R` (R の尤度を
    fixed で評価して Newton で最適点へ。境界に向かうときは R の既定の当てはめの局所極大)、`test/arima.test.ts` 16 件が通る
  - **実装済み (2026-11-27):** forecastArima・forecastFromArima・boxCox 系・ndiffs (src/timeseries/forecastArima.ts)、
    stl・supsmu・mstl・seasadj・nsdiffs・ocsbTest (stl.ts)、autoArima (autoArima.ts)、ets・forecastEts (ets.ts)。
    fixture: oracle/forecastArima.R・stl.R・autoArima.R・ets.R。テスト 105 件が通る (autoArima は約 2 分)
  - **R との違い 7・8 を追加** (auto.arima の定数の印、ets の減衰トレンドの amse)。**ユーザーに相談する未解決 2 件**:
    ndiffs の PP (trend) (log 78-79)、nsdiffs の OCSB のラグの AIC 選択 (log 80)。仕様書の "Open points" 節
  - **実装済み・テスト済み:** statsTs.ts (filter・boxTest・diffinv・decompose・ar・predictAr・arima0)、holtWinters.ts。42 件通過。
    arima0 は厳密尤度 (R の既定 delta = 0.01 の近似は未解決、log 84、相談事項)
  - **書いたが未テスト (WIP コミット):** forecastSimple.ts (meanf・rwf・naive・snaive・ses・holt・hw・thetaf・croston・stlf・tslm)、
    forecastUtils.ts (accuracy・ma・fourier・seasonaldummy・monthdays・easter・bizdays・dmTest・cvLm・checkresiduals・tsCV・
    arimaorder・specAr・findfrequency・naInterp・tsoutliers・tsclean)。ets に optCrit "mse" を追加
  - **次:** 上の 2 ファイルの oracle (oracle/forecastSimple.R) とテストを書いて合わせる → tseries → forecast() の振り分け → メタ分析
  - stats の filter は `tsFilter` (ユーザー決定 2026-11-27) → 端のケースの点検 → 配線・文書・訳・デモ → 版 1.20.0。
    実装で新たに要るもの: rma の GENQ、supsmu、R の乱数に依る white.test、ocsb の臨界値の表、Phillips-Ouliaris の表、bizdays の暦 (ndiffs・nsdiffs・ocsb・auto.arima・ets・ses/holt/hw・thetaf・croston・BoxCox.lambda・mstl・
    tsclean・tsoutliers・na.interp・accuracy・dm.test・tsCV など)、その後メタ分析

## 次のセッションで最初にやること: 次の版の範囲を決める (1.18.0 は公開済み、2026-11-26)

- **1.18.0 を公開した (2026-11-26):** main `e2947e18` (作業ブランチを squash、違いは CHANGELOG の日付だけ)、CI・Pages 緑 → タグ `v1.18.0` →
  stage (id `80983efc-...`) をユーザーが承認。npm latest = 1.18.0、jsDelivr の `dist/regression.js`・`dist/descriptive.js`、`/api/`・
  `/ja/api/` の qcc・btm・medianChart・qvcalc のページ、R の関数の索引、デモ v1.18.0 を確かめた。Issue #568 を閉じた。証拠はタグ
  `archive/qcc-bt-1.18` (push 済み)。作業ブランチ `dev/qcc-bt-1.18` はユーザーの指示で削除 (2026-11-26、手元だけにあった。タグと同じ `a0299cca` を確かめてから)。クリーンルームの証拠は、タグの 17 コミットの履歴と、main の `experiments/qccbt118-*` (35 ファイル、ログ 23 項目)・`oracle/qcc-bt-behaviour.md`・fixture の oracle、Issue #568 のコメント
- **GitHub の障害 (2026-11-25 15:45〜 UTC、Actions・Webhooks・Pages が degraded):** 最初のタグの push で Release が起動しなかった →
  GitHub 上のタグを消して push し直した (1 回 500、1 分後に成功)。Release の後の Pages の配備が 500 で失敗 → `gh run rerun --failed` で成功
- ユーザーの決定 (2026-11-26): 1 つ前の報告の「私が決めたこと」(関数名、btm の入口、`{ lcl, ucl }`、mqcc は連を返さない) は了承。
  1.16.0・1.17.0 の 3 回目の点検は 1.18.0 の公開の前に (直したことは CHANGELOG の 1.18.0 の Fixed)
- **次: 1.19.0 = 時間依存 ROC。範囲はユーザーが決めた (2026-11-26、すべて推奨どおり):**
  - **timeROC の公開関数を広く:** `timeROC` (周辺・Cox・Aalen の打ち切りの重み、単一の事象と競合リスク (cause、AUC_1・AUC_2)、
    iid の標準誤差)、`confint`、`compare`、`SeSpPPVNPV` (カットオフでの感度・特異度・PPV・NPV)、時点ごとの AUC の推移と差
    (`plotAUCcurve`・`plotAUCcurveDiff` の値)。ReactiveStat (`scripts/検査の正確度/時間依存性ROC.php`) は
    `timeROC(T, delta, marker, cause = 1, times, ROC = TRUE, iid = TRUE)`・`confint()$CI_AUC` (パーセント単位)・`compare()`、
    カットオフは TP − FP の Youden (TP・FP の行はマーカーの降順、最後の行は全員陽性)、AUC < 0.5 ならマーカーの符号を反転
  - **survivalROC も:** KM 法と NNE 法 (span・lambda)。ReactiveStat は使っていない
  - I/D (incident/dynamic) 型 (risksetROC) は入れない
  - **置き場所:** `/tests` (既存の roc・auc・ciAuc・rocTest・coords、生存解析と同じ)
  - **準備済み (2026-11-26):** Issue #569、作業ブランチ `dev/tdroc-1.19` (main の HANDOFF の 3 コミット込み、手元だけ)、イメージ
    (x86_64・arm64 とも作り直し済み) に timeROC 0.4.1・survivalROC 1.0.3.1・timereg 2.0.7 (pec 2025.6.24・mvtnorm 1.4.2 も入る)、
    実験用 Dockerfile にも同じ層 (未ビルド)。チェッカーに 2 パッケージの公開関数と S3 メソッド 15 個 (**`compare` は除いた**:
    1.16.0 の実験の変数名とぶつかる。実験では `compare()` を呼ぶだけにする)。既存の実験に新しい違反なし
  - **R の実験 (セッション 37、2026-11-26、ログ 1〜46、`experiments/tdroc119-*`):** 周辺の重み (事例 T < t、打ち切りの KM は同じ時刻の
    事象を先に外す、事例 1/G(T−)・対照 1/G(t))、TP/FP の行、CumulativeIncidence = 事例の重みの和 / n、iid (行は時刻の順、打ち切りの項は
    時刻で数える跳びと位置ごとの補償子が混ざる R の癖、vect_sd = sd/√n)、競合リスクの定義 (i)・(ii) (定義 (ii) の iid は N/(F(1−F)) の
    影響関数)、confint (CI は小数 2 桁に丸め、同時信頼帯は乗数ブートストラップで同じ種なら一致)、compare (adjusted は mvtnorm の乱数の
    GenzBretz)、SeSpPPVNPV (ベイズの形、NPV_1 の分母は定義 (ii)、iid 6 種)、Cox の重み (rms の cph、厳密な最大値と 6e-7)、Aalen の重み
    (同点がなければ 1e-14、同点は timereg が乱数で崩すので再現できない)、survivalROC の KM 法 (一致)。**NNE 法は 9 回試して見つからない**。
    描画の関数は NULL を返す
  - **ユーザーの決定 (2026-11-26):** (1) survivalROC の NNE 法は入れない (KM 法だけ。NNE は後で調べ直す)。(2) Aalen の重みで同点は
    決まった形で扱う (同じ時刻の打ち切りをまとめて最小二乗の増分に。R とは乱数の幅の中で違うと文書に)。(3) R の癖は正しい形に:
    confint の区間は丸めない、iid は同点を正しく扱う (データの順に依らない)、定義 (ii) の iid は報告する AUC_2 を中心に (どちらも R とは
    同点や t ちょうどの事象があるときだけ違う。正しさは無限小のジャックナイフ (重みを ε 動かした数値微分) で自分で確かめる)。
    **(3) の読み方 (丸めもやめる) はユーザーに確認中**。(4) compare(adjusted = TRUE) は多変量正規の確率を自分で正確に (1e-7) 計算し、
    R とは 1e-6 程度で比べる。私の決定: Cox の重みは厳密な最大値 (R の cph とは 6e-7)、差の同時信頼帯は値を返さないので点ごとの区間だけ
  - **セッション 37 の続き (2026-11-26):** 仕様書 `oracle/tdroc-behaviour.md`、fixture `oracle/timeroc.R`、実装 `src/htest/timeROC.ts`
    (timeROC・timeROCConfint・timeROCCompare・timeROCAucCurve・timeROCAucDiff・seSpPPVNPV・survivalROC)、テスト `test/timeROC.test.ts`
    (R と比べる、同点を正しく扱う iid を無限小のジャックナイフで確かめる) と `test/tdroc119Edge.test.ts` (端のケースの全軸、R の値は
    `experiments/tdroc119-edge*.json`)、配線・索引 (英日)・結果の全項目の説明 (TypeDoc の新しいファイルの警告 0、英日)・訳 (sonnet、
    survival-analysis.json の 158 件)・デモ (time-roc・sespppv・survival-roc、1190/1190)・版 1.19.0・サイズ 348.2 KB。ログは 47〜52。
    全テストは既知の issue179・513 以外通る
  - 私が決めたこと (ユーザーに報告): Cox の重みは coxph の timefix を切って 1 本の曲線から (時刻の順序だけに依る)、Aalen の従属な共変量は
    外す (R は黙って重み 1)、NA の対象は R と同じく除く、R が失敗するところ (生存者 1 人、n = 2、退化した Cox) も計算する、survivalROC の
    予測時点が最初の時刻より前なら S = 1 で TP は NaN (R は最初の時刻の KM を読む)、閾値が 2 つ以上なら最後の点は (0, 0) (R と同じ)
  - **公開の前の追加の点検 (ユーザーの質問から、ログ 53):** 共変量どうしの尺度の混在・極端な重みは問題なし。調整 p 値が 1 − P の
    引き算で小さな値を失っていた → 最初の超過による正の項の和に書き直し (Bonferroni の上下限と等相関の閉じた形で確かめた、
    b = 30 まで)。Cox の重みは exp(−exp(log H_0 + lp)) に (守りの修正)。main に別のコミットで入れた
  - **公開済み (2026-11-26):** npm 1.19.0 (latest)、タグ v1.19.0、archive/tdroc-1.19 (作業ブランチの履歴)、Issue #569 を閉じた。
    作業ブランチ `dev/tdroc-1.19` はユーザーの指示で消した (手元だけにあった。履歴は archive/tdroc-1.19)。次は 1.20.0 の範囲を決めるところから (ROADMAP の 9)
    `oracle/tdroc-behaviour.md` → fixture → 実装 → 端のケース (3 回目の内容) → 配線・文書・訳・デモ → 版 1.19.0
  - **最初から 3 回目の点検の内容 (尺度 1e±150・1e±300、共通の値 1e8、混ざった尺度、同点・打ち切りだけの時点・事象のない時点などの退化、
    大きな n、R と比較) を計画に入れ、公開した関数を 1 つずつすべての軸で確かめる**

## (以前) 1.18.0 = 管理図と一対比較 (範囲はユーザーが決めた、2026-11-25)

### 範囲 (ユーザーの決定 2026-11-25、ROADMAP の 7 から)
- **管理図:** qcc の公開関数を広く (ReactiveStat `scripts/品質管理/管理図.php`・`計数値管理図.php` の xbar・R・S・xbar.one と移動範囲・
  p・np・c・u、std.dev の UWAVE-R・UWAVE-SD・RMSDF・MR・SD、newdata、nsigmas、violations、process.capability に加えて、CUSUM・EWMA・
  OC 曲線など。具体的な一覧はイメージに入れて公開関数を見て決める)。図は対象外 (値だけ)
- **メディアン管理図 (Me-R):** ReactiveStat (`メディアン管理図.php`) の手順の関数 (JIS の A4・D3・D4、群の大きさ 2〜10)
- **一対比較:** BradleyTerry2 の `BTm` (`cbind(win1, win2) ~ player1, player2`、基準の対象)、`BTabilities`、qvcalc の準分散、
  **対象の共変量つきのモデルも** (ユーザーの選択。`~ x[..] + (1|..)` は PQL の混合モデルが要る)。ReactiveStat は `一対比較.php`
- **置き場所:** 管理図は `/descriptive`、Bradley-Terry は `/regression`
- 時間依存 ROC は 1.19.0、ネットワークメタアナリシスと時系列はその後 (推奨の順。ユーザーは 1.18.0 だけ決めた)
- **準備済み (2026-11-25):** Issue #568、作業ブランチ `dev/qcc-bt-1.18` (main の HANDOFF のコミット込み、手元だけ)、イメージ (x86_64・arm64)
  に qcc 2.7・BradleyTerry2 1.1.4・qvcalc 1.0.4、実験用 Dockerfile (未ビルド)、チェッカーに 3 パッケージの関数 101 個 (既存の実験と衝突なし)。
  「広く」の中身は Issue #568 に書いた (qcc・mqcc・cusum・ewma・ewmaSmooth・oc.curves・process.capability・pareto.chart の表・
  qcc.overdispersion.test・qcc.groups・shewhart.rules。図だけの cause.and.effect・ellipseChart と、gnm が要る GenDavidson は除く)
- (済み) R の実験 (`experiments/qccbt118*`、試行錯誤は `experiments/qccbt118-log.md` に時系列で)。まず qcc の各種類の統計量・σ・限界、
  違反の規則、BTm の共変量と PQL

### セッション 36 の続き (2026-11-25): 1.18.0 を作業ブランチで完成
- **中身:** `/descriptive` に `qcc`・`shewhartRules`・`cusum`・`ewma`・`ewmaSmooth`・`ocCurves`・`processCapability`・`mqcc`・
  `qccOverdispersionTest`・`paretoChart`・`qccGroups`・`medianChart` (`src/descriptive/qcc.ts`・`qccTools.ts`)、`/regression` に
  `btm`・`btAbilities`・`countsToBinomial`・`qvcalc`・`worstErrors` (`src/models/bradleyterry.ts`)
- fixture `oracle/qcc.R`・`oracle/bradleyterry.R`、テスト `test/qcc.test.ts`・`bradleyterry.test.ts`・`qccbt118Edge.test.ts`。
  R と一致: qcc は 1e-11〜1e-12 (R の qtukey・ptukey は 2.5e-7 まで不正確なのでそこだけ 1e-6)、PQL は R の tol 1e-10 の当てはめと
  1e-12 (rStats.js は REML の固定点を Woodbury で解く 1 次元の根)、qvcalc は 1e-8 (R の最適化が手前で止まる)
- **fixture で見つけて直したこと (ログ 18・19):** Cp_l だけでなく **Cp_u も片側の z** (実験 7 の読み違い)、Bissell の区間は乗法の形 (規格が
  逆のとき符号が反転)、**p 管理図は大きさが揃っても群ごとの管理限界**、qcc は揃った p 管理図の確率限界で失敗する (rStats.js は求める)
- 端のケース (2 回): 尺度 1e±150・1e±300 で相対 1e-13、特異な共分散はエラー、つながらない対象と対戦のない対象は NaN (標準誤差も揃える)、
  対戦で変わらない共変量はエラー、g 管理図の平均 < 1 は "NaNs produced"
- 配線: 入口、`option-keys.mjs --write`、R の名前の文、`docs/r-functions.md` と日本語版 (`r-functions.json` に 17 件)、デモ 7 例
  (`npm run demo:r`、`test:browser` 1190/1190・284 例)、CHANGELOG・README (英日)・ROADMAP (英日、7 を済みに、8 を新設)・API の説明と
  R との違い (英日)、結果のすべての項目に説明 (TypeDoc の新しいファイルの警告 0)、版 1.18.0 (package・lock・demo/app.js)。サイズ:
  全部入り 334.0 → 340.7 KB
- 全テスト: 既知の issue179・513 以外は通る (5373 件)、ブラウザ 1190/1190
- **3 回目の点検 (2026-11-26、ユーザーの指摘「桁落ち・overflow・underflow の包括的チェックは?」で):** ログ 20・21。直したこと:
  Cpm を hypot に、mqcc は変数ごとに 2 のべき乗で割る (特異の判定も各対角に対して)、過分散検定は計数を割る、g 管理図の σ を
  g sqrt(1 - 1/g)、c・u の OC 曲線は 1e6 点を超えたら断る、PQL は疎な Z と M の逆行列 1 回 (200 対象・4000 対戦で 22 秒 → 0.3 秒)、
  μ と dμ/dη の下限 (R の二項族と同じ)、分離はわかるエラー、σ = 0 に落ちたら glm の警告を残す。R は mqcc (1e±300・混ざった尺度)、
  過分散検定 (1e±200)、ewma の管理限界 (1e-300) で崩れる。テストは `qccbt118Edge.test.ts` に追加 (計 42 件)
- **1.16.0・1.17.0 の 3 回目の点検 (2026-11-26、ユーザーの決定で 1.18.0 の公開の前に。ログ 22・23、`test/edge116117Third.test.ts`
  14 件):** 直したこと: **tobit・survreg で共変量に 1e6 以上の共通の値があると係数が NaN** (R は当てはめる。別名が出たら中心化して
  当てはめ直す、普通の当てはめは変えない)、survreg の標準誤差と tobitSummary の Wald を尺度の座標で (1e±300)、betareg の
  標準誤差 (summary・confint) を尺度の座標で、johnsonNeyman を尺度を合わせた 2 次式で (結果変数 1e±150 で Infinity・31% ずれ
  だった)、sobelTest を hypot に、Sobel・MC・調整媒介・JN は分散が倍精度の範囲外ならエラー (mediate と同じ)。R はこれらの多くで
  崩れる。CHANGELOG の 1.18.0 に「Fixed」、R との違い (英日) の 1.16.0・1.17.0 の節に追記
- **日本語の API の訳 (済み):** 187 件は sonnet のサブエージェント (1 回)、結果の項目の説明を足した 79 件は私。全体で未訳 0
  (6024 件)。サブエージェントの訳の "signal を出す" 4 か所を「管理外れを知らせる」に直した
- **私が決めたこと (ユーザーに未確認):** 関数の名前 (qcc の名前に寄せた camelCase、`medianChart`・`btm`)、`btm` の入口 (列名と
  `contestCovariates`・`predictors`)、qcc の結果の `limits` を `{ lcl, ucl }`、`mqcc` の violatingRuns は返さない (中心がない)、
  NA を含む移動範囲は飛ばす、qcc.groups の名前は文字列
- 次: ユーザーの確認 → main に squash + タグ `v1.18.0` → CI・Pages → `npm stage approve` → `archive/qcc-bt-1.18`

### セッション 36 (2026-11-25): R の実験が済んだ
- `experiments/qccbt118-*.R` と `.json` (11 本、作業ブランチに未コミット)、試行錯誤は `experiments/qccbt118-log.md` (17 項目、チェッカーに
  断られた 3 回と構文の誤り 1 回も)。まとめは Issue #568 のコメント。R のソースは誰も読んでいない
- **決まったこと (詳しくはログ):** qcc の σ の 5 方法・中心 (大きさで重みづけ)・限界 (R は d3、S は √(1−c4²)、確率限界は R が qtukey・S が
  χ²)・違反の規則・cusum・ewma (σ は各点の n の閉じた式)・OC 曲線 (各 n の限界、c は 0:ceiling(c+10√c)、u は 0:ceiling(nu+10√u))・
  工程能力 (Cp_l の区間だけ片側の z、Cpm の ν = n(1+d²)/(1+2d²)、1e-4 未満の exp は 0)・mqcc・過分散 (p 値は有効 5 桁)・pareto・
  qcc.groups。BTm は ±1 の計画行列の glm、PQL は作業用 LMM の **REML の固定点** (R の tol 1e-10 と 1e-10 で一致)、varFix・varSigma、
  σ = 0 は glm、欠けた共変量は別の能力。qvcalc は log の最小二乗、worstErrors は対比の一般化固有値
- **R の癖 (実装で合わせるか決める):** NA の統計量で beyond.limits に NA が入る、群の大きさ 26 以上で xbar の既定が黙って RMSDF・UWAVE-R は
  NA、Cp_l の区間の z、片方の規格が NA で Cpk・Cpm も NA、R の既定の tol 1e-6 は真の固定点から 1.5e-7 ずれる (1.17.0 の betareg と同じく
  正確な方を出す案)
- **ユーザーに聞くこと (仕様書の Choices):** 上の癖をどこまで R に合わせるか、関数名と入口の形 (qcc の type ごとか 1 つの関数か)、
  `br = TRUE` (Firth) を入れるか (Issue の範囲外)、Me-R の群の大きさが揃わないときの扱い (ReactiveStat は最初の群の n)
- **仕様書 `oracle/qcc-bt-behaviour.md` を書いた。Choices はユーザーが決めた (2026-11-25、全部推奨どおり):** qcc は 1 つの関数、
  違反の番号から NA を除く (26 以上の RMSDF と R 管理図の NA は R と同じ)、工程能力の癖は R と同じ (過分散検定の p 値だけ丸めない)、
  Me-R の群の大きさが揃わないときはエラー、br = TRUE は入れない
- 次: fixture (`oracle/qcc.R`・`bradleyterry.R` など、名前の重なりを確認) →
  実装 → 端のケースと極端な尺度を 2 回 → 配線・文書・訳・デモ → 版 1.18.0

## (以前) 次の版の範囲を決める前の記録

- **1.17.0 を公開した (2026-11-25):** main `f0aeb613` (作業ブランチを squash、中身は同じ)、CI・Pages 緑 → タグ `v1.17.0` → stage
  (id `188f232e-...`) をユーザーが承認。npm latest = 1.17.0、jsDelivr の `dist/regression.js`、`/api/`・`/ja/api/` の betareg・tobit・
  loglm のページ、デモ v1.17.0 を確かめた。Issue #567 を閉じた。証拠はタグ `archive/tobit-beta-1.17` (`fbfbb53f`)。作業ブランチ
  `dev/tobit-beta-1.17` はユーザーの指示で削除 (2026-11-25、手元だけにあった。タグと同じ `fbfbb53f` を確かめてから)
- 公開の前にユーザーの決定: t 分布の自由度は tobit・survreg とも `parms` と `df` のどちらでも (両方はエラー)。ほかの「私が決めたこと」は
  「公開して」で了承
- main は origin と同じ (このあとの HANDOFF のコミットだけ先)

## セッション 35 (2026-11-25): 1.17.0 = Tobit 回帰・ベータ回帰・対数線形モデル


- **1.17.0 は作業ブランチ `dev/tobit-beta-1.17` で完成** (手元だけ、push していない。main の未 push の HANDOFF の 4 コミットを含む)。
  Issue #567 に実験と実装の記録 4 件。試行錯誤の全過程は `experiments/regression117-log.md` (30 項目、外れも含む)
- 残りはユーザーの確認と公開: main に squash + タグ `v1.17.0` → CI・Pages → `npm stage approve` → `archive/tobit-beta-1.17`
- 手元で確認済み: 型、全テスト (既知の issue179・513 以外 5289 件)、`npm run test:browser` (デモ 1190/1190、例 277)、TypeDoc の新しい
  ファイルの警告 0 (SurvregResult の項目にも説明を付けた)、訳の未訳 0

### 1.17.0 の中身
- `/regression`: `tobit`・`tobitSummary` (AER、survreg の上)、`betareg`・`betaregSummary`・`betaregConfint`・`betaregPredict`・
  `betaregResiduals` (ML・BC・BR、平均のリンク 6 つ、精度のリンク 3 つ、残差 7 種類)、`loglin`・`loglm`・`loglmResiduals`・`loglmAnova`。
  ガンマ回帰は既存の glm (新しく作らない)
- 仕様書 `oracle/tobit-betareg-loglin-behaviour.md`、fixture `oracle/tobit.R`・`betareg.R`・`loglin.R`、テスト `test/tobit.test.ts`・
  `betareg.test.ts`・`loglin.test.ts`・`regression117Edge.test.ts`
- **ユーザーの決定 (2026-11-25):** betareg の推定は ML・BC・BR の全部、y の 0・1 はエラー、残差は 7 種類、平均のリンクに log も
- **R と同じにした癖:** tobit の Wald 検定の自由度 p − 1 (切片なしで 1 つ少ない)、cloglog・loglog のバイアスの項で 2 階微分を eps で
  切り上げ、deviance 残差の絶対値、loglm の anova の p 値 `1 - pchisq()`、loglin の start を合計に合わせる
- **R と違えた所:** betareg は R より正確に最大化 (R と 1e-6 程度で一致)、列の尺度合わせ (R が失敗する 1e150・+1e8 でも当てはまる)、
  phi の初期値が正にならないときはモーメントから、tobit は 2^±30 を超える応答を尺度合わせ、loglin は 1e300 の度数でも統計量を出す
- **私が決めたこと (ユーザーに未確認):** 表の形 `{ counts, dim, names, levels }` (R の順) と入れ子の配列、周辺は名前か 1 始まりの番号、
  `paramNames` (オブジェクトでは数字の名前が先に並ぶため)、t の自由度は tobit も survreg も `parms` (R の名前) と `df` のどちらでも (両方はエラー、ユーザーの決定 2026-11-25)、loglm のデータフレームの水準は
  `levels` が無ければ並べ替え、loglin の `iter` は 1 以上、`betaregSummary` は表・AIC・quantile 残差の 5 数要約、SurvregResult の
  各項目に説明を付けた (既存の型)、訳はセッション 34 と同じく sonnet のサブエージェント (2 回、計 228 件)
- 速さ: betareg n = 100000 で 1.1 秒 (R 58 秒)、BR n = 20000 で 0.8 秒 (R 10.5 秒)
- サイズ: 全部入り 333.9 → 334.0 KB (回帰は別の入口なので増えない)

### セッション 35 で分かった注意
- R の list の `$` は部分一致する (`cs$link` が `link_phi` を拾った)。fixture の case の取り出しは `[[ ]]`
- 数値積分 (`integrate`) で候補の期待値を作ると、閉じた式を書く前に R の値と照合できた (BC・BR の符号の誤りを見つけた)
- 切片だけのモデルでは全観測の η が同じなので、R が内部で使う量 (2 階微分) を 1 つの値として逆算できた
- jsonlite は -Inf・Inf を null にする (tobit の fixture の限界)。テストで null を ±Infinity に読み替えた

## (以前) セッション 35 の始めに書いた予定: 1.17.0 = Tobit 回帰・ベータ回帰・対数線形モデルの準備 (範囲はユーザーが決めた、2026-11-25)

### 範囲 (ユーザーの決定 2026-11-25、ROADMAP の 6)
- **Tobit 回帰:** `AER::tobit(formula, left, right, dist, data)` に合わせた式とデータの入口 (既存の `survreg` の上に作る)、
  summary・McFadden の R²・尤度比検定。ReactiveStat (`scripts/多変量/Tobit回帰.php`) は `AER::tobit(y ~ x, left, right, dist)` と
  null モデル (`y ~ 1`) の logLik から McFadden、`exp(icoef["Log(scale)"])`
- **ベータ回帰:** `betareg::betareg`。平均の link (logit・probit・cloglog・cauchit・loglog) と、精度 phi は **定数と `y ~ x | z` の
  モデルの両方** (ユーザーの選択)。summary・擬似 R²・confint・predict。ReactiveStat (`scripts/多変量/ガンマ・ベータ回帰.php`) は
  `betareg(y ~ x, link)`、null モデル、`confint(level)`、`exp(coef(model, model = "mean"))`
- **対数線形モデル:** R の `loglin` (反復比例当てはめ) と `MASS::loglm` (ReactiveStat は `glm(poisson)` + `anova` で、これは既存で足りる)
- **ガンマ回帰:** 既存の `glm` の Gamma 族で済み (新しく作らない。ReactiveStat の `glm(family = Gamma(link))` と合うかは確かめる)
- **置き場所:** `/regression` (polr・rlm・nls・multinom と同じ)

### 手順 (1.16.0 と同じ)
Issue → 作業ブランチ `dev/tobit-beta-1.17` (main の HANDOFF のコミット込み) → イメージ (`oracle/Dockerfile.r46` と experiments) に
AER・betareg (と依存) を足して作り直す → チェッカーの許すパッケージと関数 → R の実験 (x86_64、`experiments/regression117*`、
**外れも含めた試行錯誤を `experiments/regression117-log.md` に時系列で記録**) → 仕様書 → fixture (名前の重なりを確かめる) → 実装 →
端のケースと極端な尺度を 2 回 → 配線・文書・訳・デモ → 版 1.17.0 → ユーザーの確認 → main に squash + タグ → `npm stage approve`


### 始めに確かめること
- `git status -sb` で main にいて、origin より HANDOFF のコミットだけ先 (4 つ、push しない) こと。作業ブランチは無い
- `colima status` (止まっていたら `colima start`)、イメージ `rstats-oracle-amd64:4.6.2` があること (`docker images | grep rstats`)
- 最初に Issue を作り、作業ブランチ `dev/tobit-beta-1.17` を main から切る (HANDOFF のコミット込み)
- 先に確かめること: `survreg` が左・右・区間の打ち切りと AER::tobit の dist (gaussian・logistic・t など) を全部扱えるか、
  fixture の名前 (`oracle/tobit.R`・`betareg.R`・`loglin.R` など) が既存と重ならないか

### セッション 34 で分かった注意 (1.17.0 でも当てはまる)
- **試行錯誤は外れも含めて時系列のログに残す** (ユーザーの指示、クリーンルームの証拠)。スクリプトを上書きして途中の版を消さない
  (書き足すならログに「replaced」「added」と書く)。手本は `experiments/mediation116-log.md`
- R の実験で **関数の引数に `.Random.seed` を渡すと遅延評価で読まれる**。先に変数に取る
- チェッカーは `step`・`se`・`args`・`fix`・`m` (`cs$m` は nls の m と見なされる) などの名前も断る。新しいパッケージの関数名が
  過去の実験の変数名とぶつかったら、その名前はチェッカーの一覧から外す (1.16.0 で jtools の `summ`・`center`、lmtest の `reset`)
- R の `update()` で当てはめ直す関数 (mediate のブートストラップなど) の oracle では、`fit$call$formula` に式の実体を入れる。
  非標準評価の引数 (interactions の `modx` など) は文字列を直書き
- 当てはめの options は `Symbol.for("rstats.js fit options")` の属性 (`src/models/fitOptions.ts`)。CDN のバンドルをまたいでも読める
- CDN の `dist/rstats.js` と分野のバンドルは乱数の状態が別。デモは両方に種を設定する (`demo/app.js`)。分野のバンドルの乱数を使う
  関数の例は `dist/distributions.js` の `setSeed`
- demo/examples.json は 1 例 1 行の形。Python の json.dump で全体を書き直さない (末尾に行を足す)
- 日本語の API の訳は sonnet のサブエージェントに頼めた (148 件、1 回で未訳 0)。依頼文に用語・半角の括弧とコロンの規則を書く
- 全テストは約 2 分 (既知の失敗は issue179・513 の 2 件)

## セッション 34 (2026-11-25): 1.16.0 = 媒介・調整・調整媒介分析

- **1.16.0 を公開した (2026-11-25):** main `65931158` (作業ブランチを squash、中身は同じ)、CI・Pages 緑 → タグ `v1.16.0` → stage
  (id `aaeeb51b-...`) をユーザーが承認。npm latest = 1.16.0、jsDelivr の `dist/causal.js`、`/api/`・`/ja/api/` の mediate・mvrnorm の
  ページ、デモ v1.16.0 を確かめた。Issue #566 を閉じた。証拠はタグ `archive/mediation-1.16`。作業ブランチ `dev/mediation-1.16` は
  ユーザーの指示で削除 (2026-11-25、手元だけにあった)
- (公開前) **1.16.0 は作業ブランチ `dev/mediation-1.16` で完成** (手元だけ、push していない。main の未 push の HANDOFF の 4 コミットを含む)。
  Issue #566 に実験と実装の記録 7 件。試行錯誤の全過程 (外れた候補も) は `experiments/mediation116-log.md` (ユーザーの指示:
  クリーンルームの証拠として過程を残す)
- (公開前の記録) 残りはユーザーの確認と公開だった。「私が決めたこと」もユーザーは「公開して」で了承
- 手元で確認済み: 型、全テスト (既知の issue179・513 以外 5253 件)、`npm run test:browser` (デモ 1190/1190)、TypeDoc (英・日) の新しい
  ファイルの警告 0、訳の未訳 0

### 1.16.0 の中身
- `/causal`: `mediate` (mediation::mediate、lm と binomial logit/probit・gaussian の glm、準ベイズとブートストラップ (perc・BCa)、
  treatValue/controlValue・covariates・robustSE)、`simSlopes`・`johnsonNeyman` (interactions)、ReactiveStat の手順 `sobelTest`・
  `mediationMonteCarlo`・`moderatedMediation`。`/distributions`: `mvrnorm` (MASS)
- 実装 `src/causal/mediate.ts`・`moderation.ts`・`mediationProcedures.ts`、`src/random/mvrnorm.ts` (2×2 は LAPACK dlaev2 の移植、
  対称な平方根と 3 次元以上は Jacobi 法)。仕様書 `oracle/mediation-behaviour.md`、fixture `oracle/mediation.R`、テスト
  `test/mediate.test.ts` (52)・`simSlopes.test.ts` (10)・`mediationProcedures.test.ts` (13)・`mediationEdge.test.ts` (23)
- **R と同じ値:** mediate (同じ setSeed で draw・推定・区間・p 値)、mvrnorm の 1・2 次元、Monte Carlo、2 値の経路の調整媒介
- **ユーザーの決定:** mvrnorm の 3 次元以上は統計的な一致 (dstemr を移植しない)。公開 API は「R の関数 + 手順の関数」
- **R と違えた所 (丸めだけ):** 線形の結果の draw が理論上 0 のとき R は ±1e-17 の残りで p 値が 2/sims 揺れる、p = 0.5 の際で
  rbinom が裏返る (小さな 2 値データのブートストラップ)。尺度 1e±150 で R の準ベイズは壊れる (rStats.js は Jacobi 法で正しい)、
  1e±300 はエラー (ブートストラップを勧める)
- **私が決めたこと (ユーザーに未確認):** sims は 2 以上、処置・媒介変数・covariates は数値だけ (R は factor の処置も受ける)、
  結果に `warnings`、fitOptions を `Symbol.for` の属性に (CDN のバンドルをまたいで lm の結果が使えるように。step にも効く)、
  デモの setSeed を分野のバンドルの生成器にも効かせた (`demo/app.js`)、README のサイズ表の polr・nls を現在の値に (1.7.0 から古かった)、
  API リファレンスの CDN の版 1.14.0 → 1.16.0、日本語の API の訳 148 件は sonnet のサブエージェント (残り 36 件は私)
- 速さ (n = 2000): 準ベイズ 1000 回 1.4 秒、ブートストラップ 200 回 1.9 秒 (R 27 秒・13 秒)
- サイズ: 全部入り 332.9 → 333.9 KB

## (以前) 1.16.0 の範囲 (セッション 33 の終わりに書いたもの)

### 範囲 (ユーザーの決定 2026-11-25、すべて推奨どおり)
- **3 つとも:** 媒介分析 (`mediation::mediate`、Sobel 検定、係数の Monte Carlo)、調整分析 (交互作用モデル、単純傾斜、Johnson-Neyman、
  `interactions::sim_slopes` に合わせる)、調整媒介分析 (index of moderated mediation)
- **mediate の区間:** 準ベイズ (`boot = FALSE`) と非パラメトリック・ブートストラップ (`boot = TRUE`、パーセンタイルと BCa)
- **乱数:** 同じ `setSeed` で R と同じ値 (`MASS::mvrnorm` の固有分解と R の乱数の使い方まで合わせる。固有ベクトルの符号などで無理な所が
  あれば、そこだけ統計的な一致にして理由を記録)
- **置き場所:** `/causal` (傾向スコア・IPTW と同じ)

### ReactiveStat の呼び方 (`numero-uno-jpn/ReactiveStat` の `scripts/多変量/媒介分析.php`・`調整分析.php`・`調整媒介分析.php`)
- 媒介: `med_model <- lm(M ~ X + 共変量)` か `glm(..., binomial(logit))`、`out_model <- lm(Y ~ X + M + 共変量)` か glm。Sobel は
  a・b と標準誤差から `sqrt(b² sa² + a² sb²)`。M・Y がともに連続なら係数の Monte Carlo: `set.seed(1234)`、NMC = 20000、
  `a_mc <- rnorm(NMC, a, sa)`、`bc <- MASS::mvrnorm(NMC, coef(out)[c(M, X)], vcov(out)[...])`、間接・直接・総効果・割合の分位点 (type 7)。
  どちらかが 2 値なら `set.seed(1234); mediation::mediate(med, out, treat, mediator, control.value, treat.value, boot = FALSE,
  sims (100〜1000), conf.level, robustSE)`、X が 2 値ならその 2 水準、連続なら平均 ± 1SD
- 調整: `lm(Y ~ X * W + 共変量)` か glm(logit)、X・W の中心化 (`scale(scale = FALSE)`)、`lmtest::coeftest(model, vcovHC(type = "HC3"))`、
  効果量 (主効果モデルとの比較)、`interactions::sim_slopes(model, pred, modx, modx.values = "mean-plus-minus" | 四分位 | ± 2SD |
  2 値の W の 2 値, johnson_neyman = TRUE, jnalpha, confint = TRUE, ci.width, robust = "HC3" | FALSE)`、`interact_plot` (図は対象外)
- 調整媒介: W を両方のモデルに主効果 (と X:W) で入れ、連続なら係数の Monte Carlo (`set.seed(1234)`、`mvrnorm` を両モデルに)、
  2 値なら W の低・高で `mediate` を同じ `set.seed(1234)` で 2 回、index は `d0.sims`/`d1.sims` の差の分位点

### 手順 (1.15.0 と同じ)
Issue → 作業ブランチ `dev/mediation-1.16` (main の HANDOFF のコミット込み) → イメージ (`oracle/Dockerfile.r46` と experiments) に
mediation・interactions (と依存の jtools) を足して作り直す → `scripts/r-experiment-check.mjs` の許すパッケージと「呼ぶだけ」の関数 →
R の実験 (x86_64、`experiments/mediation116*`、Issue に記録。まず mediate の乱数の使い方と mvrnorm の固有分解、sims・boot の区間、
sim_slopes の数値と JN の境界) → 仕様書 `oracle/mediation-behaviour.md` → fixture (既存の名前と重ならないか先に確かめる) → 実装 →
端のケースと極端な尺度を 2 回 → 配線・文書・訳・デモ → 版 1.16.0 → ユーザーの確認 → main に squash + タグ → `npm stage approve`
→ `archive/mediation-1.16`

### 細部 (実験で決める、必要ならユーザーに聞く)
M・Y のモデルの種類 (ReactiveStat は lm と logit。probit などを足すか)、X の型 (2 値・連続)、共変量、robustSE、mediate の
`treat.value`/`control.value`、ACME・ADE の control と treated の両方と平均、割合 (prop.mediated)、p 値の定義、sims の上限
(rStats.js にはクラウド R の 20 秒の制約がない)、sim_slopes の評価点と HC3、JN の境界の求め方、glm の調整分析の単純傾斜 (logit の尺度)

### 始めに確かめること
- `git status -sb` で main にいて、origin より HANDOFF のコミットだけ先 (push しない) こと。作業ブランチは無い (`dev/step-1.15` は削除済み)
- `colima status` (止まっていたら `colima start`)、イメージ `rstats-oracle-amd64:4.6.2` があること (`docker images | grep rstats`)
- 最初に Issue を作り、作業ブランチ `dev/mediation-1.16` を main から切る (HANDOFF のコミット込み)

### セッション 33 で分かった注意 (1.16.0 でも当てはまる)
- **チェッカーは `trace` という名前を断る** (base の trace のため)。step・mediate などの引数 `trace` は既定のまま (表示は
  `capture.output`) か位置で渡す。ほかにも `deparse` などは使えないので、項は `attr(terms(fit), "term.labels")` で取る
- R の `update()` や `step` は呼び出しを作り直して評価するので、**データは大域に置く** (`assign("cur", d, envir = globalenv())`)。
  関数の中の局所変数だと "object not found" になる。`keep` の関数に渡る aic は数 1 つ
- `toJSON` の data.frame は既定で行の形。fixture には `dataframe = "columns"`、欠損は `na = "null"`
- **macOS に `timeout` コマンドは無い** (付けると何も実行されず黙って終わる)。全テスト (`npx vitest run`) は約 2 分なので
  バックグラウンドで流し、結果はファイルに残す
- `node scripts/option-keys.mjs --write` は新しい関数の options の検査を自動で入れる。新しいカテゴリは `test/categories.test.ts`・
  `typedoc.json`・`scripts/typedoc-ja-plugin.mjs` の 3 か所。doc comment の「Equivalent to R's `f()`.」は重ね定義のうち 1 つだけ
  (`test/rNames.test.ts`)。デモの例は全部の新しい関数を含める (`test/demo.test.ts`)、`node scripts/demo-examples.mjs` →
  `npm run oracle -- demo`。訳は `node scripts/api-ja-extract.mjs` → 空と stale を埋める
- タグの push で GitHub が Internal Server Error を返しても、タグは届いていることがある (`git ls-remote --tags origin` で確かめる)
- README のサイズ表は `node scripts/size.mjs` の値に合わせる (1.15.0 で glm+glmSummary 40.6 KB、全部入り 332.9 KB)

## セッション 33 (2026-11-25): 1.15.0 = 変数選択 (step・stepAIC・drop1・add1・extractAIC、glm の式の入口)

- **範囲 (ユーザーの決定):** lm と glm、step と stepAIC の両方、k は数、結果は fit・経路・途中の表、`/tests`。glm に式の入口を足す、
  欠損値で行が変わるときと重み 0 の edf は R と同じ。drop1・add1・extractAIC の公開とサイズの増加は「進めろ」で了承
- **公開:** main `07c63d22` (作業ブランチを squash、中身は同じ)、CI・Pages 緑 → タグ `v1.15.0` → stage (id `1ee15d1b-...`) をユーザーが承認。
  npm latest = 1.15.0、jsDelivr、`/api/`・`/ja/api/` の step のページ、デモ v1.15.0 を確かめた。Issue #565 を閉じた。証拠はタグ
  `archive/step-1.15` (`a6190480`)。作業ブランチ `dev/step-1.15` はユーザーの指示で削除 (2026-11-25、手元だけにあった)
- main は origin より HANDOFF のコミットだけ先 (push しない。次の作業ブランチの最初に含める)

### 作業ブランチでの記録
- **1.15.0 は作業ブランチ `dev/step-1.15` で完成** (手元だけ、push していない。main の HANDOFF の 3 コミットを含む)。Issue #565 に実験の記録 6 件
- **範囲 (ユーザーの決定 2026-11-25):** lm と glm、step と stepAIC の両方、k は数、結果は fit・経路 (`anova`)・途中の表 (`visits`)、
  置き場所は lm・glm の隣 (`/tests`)。glm に式の入口を足す、欠損値で行が変わるときと重み 0 の edf は R と同じ。**drop1・add1・
  extractAIC も公開した (私が足した。ユーザーに未確認、公開前に確かめる)**
- 実装: `src/models/step.ts` (step・stepAIC・drop1・add1・extractAIC、カテゴリ "Model selection" = 変数選択を新設)、`src/models/glm.ts` の
  `glm(formula, data, options)`、`src/models/fitOptions.ts` (fit の options を WeakMap に記録)
- 照合: `test/step.test.ts` 99 件 (`oracle/step.R`: 探索 77・表 22・extractAIC) と `test/glmformula.test.ts` (15 件、1e-13)、
  `test/stepEdge.test.ts` 9 件 (端のケース 2 回分。尺度・共通の値・重み・オフセットは理論値と 1e-13、引数の検査)
- 仕様書 `oracle/step-behaviour.md`。R の実験 `experiments/step115{,-detail,-threshold,-perfect,-perfect2,-gamma,-edge}.{R,json}`
- **R と違えた所:** 応答 1e±300 でも選べる (R は動かない/−∞ のエラー)、共通の値 1e15 で丸めたデータの厳密な値 (R は 0.4 ずれる)、
  重み 0 の行のある gaussian の glm (R は AIC = Inf で動かない、rStats.js の glm はその行を尤度から外す既存の選択)。`.` の scope は断る
- 文書: README (英・日、サイズ表も: `glm`+`glmSummary` が 35.1 → 40.6 KB、全部入り 322 → 333 KB)、CHANGELOG、ROADMAP の 4 を済みに、
  api-reference・differences-from-r (英・日)、R の関数の索引 (英・日)、API の訳 (`docs/ja/api/model-selection.json` 新規、glm の 22 件)、
  デモの例 3 つ (`step-lm-both`・`step-glm-bic`・`drop1-add1-extractaic`)、`demo/app.js` の VERSION v1.15.0、版 1.15.0
- 手元で確認済み: 型、全テスト (既知の issue179・513 以外 5143 件)、`npm run build`、`npm run test:browser` (デモ 1190/1190)、TypeDoc の
  新しいファイルの警告 0、文書の例のテスト
- 時間 (rStats.js / R): 60 項 + 20 水準、300 行の後ろ向き 23 秒 / 22 秒 (候補を double-double で当てはめるため。倍精度なら 10 倍速いが完全な
  当てはめの fixture から外れる)、前向き 0.9 秒 / 2.2 秒、n = 20000・10 項で 2〜5 秒


## セッション 32 (2026-11-24): 1.14.0 = 多項ロジスティック回帰 (multinom)

- **範囲 (ユーザーの決定 2026-11-24):** `/regression` に式とデータ (polr と同じ)、厳密な最尤推定 (Newton) で R を厳しく収束させた
  値と照合、summary (標準誤差・Wald・exp・confint・logLik・deviance・AIC)・擬似 R² (McFadden・Cox-Snell・Nagelkerke)・
  predict (class・probs・newdata)・尤度比検定 (anova)・weights・decay まで全部
- 作業ブランチ **`dev/multinom-1.14`** (push していない)、**Issue #564** (実験の記録 3 件)。チェッカーに nnet (`trace = FALSE` は
  チェッカーが断るので、実験では `capture.output` で反復の表示を捨てる。`...` で包むと multinom の weights の評価が壊れるので
  weights はデータの列で渡す)
- R の実験 `experiments/multinom114{,-ties,-edge}.{R,json}`、仕様書 `oracle/multinom-behaviour.md`。分かったこと: 既定の BFGS は
  最大値から 6e-5、厳しくしても 5e-8。Hess は −log L の解析的な Hessian、decay は切片を含む全係数の 2 乗和 (deviance・AIC は
  罰則込み、Hessian は罰則なし)、confint は Wald、anova は残差自由度の大きい順、**予測クラスの同点は max.col と同じ (相対 1e-5、
  k 番目の同点を k u < 1 で選び直す、setSeed で R と同じ)**
- fixture `oracle/multinomreg.R` → `test/fixtures/multinomreg.json` (**既存の `oracle/multinom.R` は dmultinom 用。一度上書きして
  しまい git から戻した**)。sim・weights・5 水準・MASS survey (欠損値)・housing (度数の重み)・decay・2 水準・anova・predict。
  iris (萼だけ) は setosa が分離するので端のケースへ
- 実装 `src/models/multinom.ts`: multinom・multinomSummary・multinomConfint・multinomPredict・multinomAnova・multinomVcov。
  列を中心化して 2 のべき乗で縮め (尺度・大きな共通の値に不変)、別の列で表せる列は落として NaN、分離は `converged: false` と警告。
  **擬似 R² の null モデルはモデルが使った行で** (rStats.js の選択。ReactiveStat は全行、欠測値があると違う)。テスト
  `test/multinomreg.test.ts`・`multinomEdge.test.ts`
- 端のケース: R は共変量 1e±150・1e300・共通の値 1e8・1e15・重み 1e±200 で崩れる、rStats.js は不変。n = 20000 は 0.04 秒 (R 10 秒)
- 配線・例・索引 (英・日)・デモの例 3 つ・文書 (英・日)・訳 74 件 (私)・TypeDoc の新しいファイルの警告 0・版 1.14.0。手元で型・
  全テスト (既知の issue179・513 以外)・ブラウザ・デモ 1190/1190
- **端のケースの 2 回目 (ユーザーの指摘で 2026-11-24):** `experiments/multinom114-edge2.{R,json}` (Issue に記録)。decay と尺度・共通の
  値の組み合わせは R と一致、**R の標準誤差は共通の値 100 からもう崩れる** (rStats.js は理論の変換と 13 桁一致)、重み 0 の行は R と
  同じ、準完全分離と iris も収束しない印、係数 180 個は 0.8 秒 (R 42 秒)、newdata の極端な尺度、擬似 R² を −expm1 に (重み 1e-200 で
  Cox-Snell が 0、Nagelkerke が NaN だった)。`test/multinomEdge.test.ts` は 15 件
- **1.14.0 を公開した (2026-11-24):** main `0fe71c9e` (作業ブランチを squash、中身は同じ)、CI・Pages 緑 → タグ `v1.14.0` → Release の
  stage (id `b16b4b66-...`) をユーザーが承認。npm latest = 1.14.0、jsDelivr の `dist/regression.js`、`/api/`・`/ja/api/` の multinom の
  ページ、デモ v1.14.0 を確かめた。Issue #564 を閉じた。証拠はタグ `archive/multinom-1.14` (`6f3982a1`)

## セッション 31 の続き (2026-11-24): 1.13.0 の fixture と実装

- **fixture** `oracle/weightit.R` → `test/fixtures/weightit.json` (x86_64、3.2 MB): sim・cobalt の lalonde・survival の veteran で
  weightit の全手法 × estimand、trim 120 件、summary、bal.tab 33 件 + 2 水準の factor、svyglm 20 件、survfit(coxph) 12 件 +
  既定の newdata、重み付き KM 12 件、エラーと警告
- **実装 (全部 R と一致):** `src/causal/weightit.ts` (weightit・trimWeights・weightSummary・covariateColumns)、`src/causal/balance.ts`
  (weightit を受ける、prop.score の行、factor の水準 (`levels` で R の順)、ATO の分母)、`src/models/svyglm.ts`、
  `src/models/survfitCoxph.ts`、`src/models/survival.ts` (survfit が整数でない重みを受ける、既定は robust。stype 2 + robust +
  整数でない重みだけは断る: se(rmean) がおかしかった)。テスト `test/weightit.test.ts`・`svyglm.test.ts`・`survfitCoxph.test.ts`・
  `iptwEdge.test.ts`、既存の `survival2*.test.ts` を整数でない重みの照合に直した (R を直した既知の違いは reference と比べる)
- **分かったこと** (仕様書 `oracle/weightit-behaviour.md` の「Settled at the fixture stage」): ipt は対照と処置の 2 つの傾きだけ
  (ebal・cbps logit の ATT と同じ解)、cbps の ps は [eps, 1−eps]、summary の 0 は 1e-10 未満、svyglm の deviance は重みを平均 1 に
  した glm (反復の回数も)、dispersion は Pearson 残差の重み付き分散 × n/(n−1)、survfit(coxph) の SE は fit の `var` (robust なら
  robust。最初の実験の「robust に依らない」は誤り: 整数でない重みの coxph は既定で robust)、重み付き KM の既定は robust
- **端のケース** `experiments/iptw113-edge.{R,json}` (Issue #563 に記録): 共変量の尺度 1e-150・1e-300 で R の cbps・ipt・ebal が
  崩れる (rStats.js は列を厳密に縮めるので不変)、1e15 の共通の値、定数・共線の列は落とす、収束しないときは R の警告文、
  重み 1e-200 で R の bal.tab・coxph が崩れる (rStats.js は不変)
- **配線:** option-keys、R の名前の文、例、R の関数の索引 (英・日)、デモの例 4 つ (R の結果は既存の 257 件が不変)、README・
  API・差異・CHANGELOG の Unreleased・ROADMAP (英・日)。手元で型・全テスト (既知の issue179・513 以外)・ビルド・ブラウザ
  16/16・デモ 1190/1190
- **日本語の訳 (私、ユーザーの指示 2026-11-24):** API 97 件 + TypeDoc の警告を消すために分けた説明 22 件、未訳 0。README.ja・
  docs/ja/api-reference・docs/ja/differences-from-r・r-functions。英・日の TypeDoc で新しいファイルの警告 0 (残りの 302 件は以前から)
- **端のケースの 2 回目 (ユーザーの指摘で 2026-11-24):** `experiments/iptw113-edge2.{R,json}`・`iptw113-edge3.{R,json}` (Issue に
  記録)。直したもの: trim の `at` の読み替え (0.5 未満は 1 − at、件数は n/2 を超えると n − at、n 以上は警告して切らない。以前は
  件数が誤り)、glm の ps を [eps, 1−eps] に、重みが全部 0 の群の entropy を NaN に、n = 5000 の ipt の収束判定 (直線探索に丸めの
  幅)、survfitCoxph を共変量の厳密な縮尺の当てはめで (×1e±300 の SE のアンダーフロー、1e15 の桁落ち) と timefix の時点のまとめ、
  Greenwood を (d/n)/(n−d) に、svyglm の SE・t・p を縮めた当てはめから (x ×1e±300、y ×1e300)。**balTab の分母 (ユーザーの決定):**
  cobalt と同じく、元の単位の SD が sqrt(eps) 未満なら全体の SD に切り替える (絶対の閾値。1.12.0 の 1e-300 での不変性のテストを
  この規則に合わせて直した)。テスト `test/iptwEdge.test.ts` に 18 件
- **1.13.0 を公開した (2026-11-24):** 版 1.13.0 (package.json・lock・README・API の CDN・demo の VERSION・CHANGELOG の日付)、
  main `80e803fc` (作業ブランチを squash、中身は同じ)、CI・Pages 緑 → タグ `v1.13.0` → Release の stage (id `0d91daed-...`) を
  ユーザーが承認。npm latest = 1.13.0、jsDelivr の `dist/causal.js`・`dist/rstats.js`、`/api/`・`/ja/api/` の weightit などのページ、
  デモ v1.13.0 を確かめた。Issue #563 を閉じた。途中のコミットはタグ `archive/iptw-1.13` (`06a4ddd0`) で残した。作業ブランチ
  `dev/iptw-1.13` はユーザーの指示で削除 (手元だけにあった。GitHub には push していない)。HANDOFF のこの更新は手元のコミットだけ (次の作業とまとめて push)
- (公開前の記録) **残り:** (1) 版 1.13.0 (package.json・lock・README・API の CDN・demo の VERSION・CHANGELOG の日付) (2) main に squash の 1 コミット +
  タグ → `npm stage approve` → `archive/iptw-1.13` のタグ

## セッション 31 でしたこと (2026-11-24): 1.13.0 の準備

- 作業ブランチ **`dev/iptw-1.13`** (push していない、main の未 push の HANDOFF の 3 コミットを含む)。**Issue #563**、実験の記録の
  コメント 1 件
- イメージ: `oracle/Dockerfile.r46` と `oracle/Dockerfile.experiments` に WeightIt 2.1.0・CBPS 0.24・sandwich 3.1.3 の層
  (`oracle/Dockerfile` は R 4.5.2 用で据え置き)。3 つのイメージを作り直し、match と acf の fixture が変わらないことを確かめた。
  チェッカーに WeightIt・CBPS・survey・sandwich の export と S3 メソッド、survival の coxph・survfit (survey の `cv`・`SE` は
  過去の実験の変数名とぶつかるので外した)
- R の実験 `experiments/iptw113.{R,json}` (x86_64)。分かったことは `oracle/weightit-behaviour.md` の Settled: ps/glm は教科書の
  重み、stabilize は ATE だけで群の割合を掛ける、cbps は just-identified の釣り合い、ipt・ebal は群ごとに目標の平均へ (ATO は
  不可)、trim は type 3 の分位点で正規化なし、summary の各量、bal.tab の ATO の分母は ATO で重み付けた全体の SD、svyglm は
  HC0 × n/(n−1) と t (df = n − p)、survfit(coxph) の SE は robust に依らない
- **Choices (ユーザー 2026-11-24、全部推奨どおり):** 置き場所は案のとおり、cbps・ipt・ebal は厳密に解いて許容 (相対 1e-6 程度)
  で比べる、共変量は文字列の列を factor として受ける、収束しないときは `converged: false` と警告で返す
- **未解明 (fixture で):** 重み付きの survfit.coxph の SE と rmean、svyglm の表示する dispersion
- **次:** fixture `oracle/weightit.R` (x86_64) → 実装 → 端のケース (分離に近いデータ、極端な尺度) → 文書・訳・デモ → 公開

## 次のセッションで最初にやること: 1.13.0 (IPTW) の準備 (セッション 30 の終わり、2026-11-24 に作成)

### 1.13.0 の範囲 (ユーザーの決定 2026-11-24、全部推奨どおり)
- **重み:** WeightIt 2.1.0 の `weightit(tr ~ 共変量, method, link, estimand)` のうち **ps (logit・probit・cauchit・cloglog)・glm
  (logit)・cbps (logit・probit、CBPS 0.24)・ipt (logit)・ebal**。energy・optweight・gbm・bart は外す (ソルバーや乱数しだいで R と
  同じ値にならない)。ReactiveStat (`scripts/傾向スコア/逆確率重み付け.php`) の選択肢に合わせる
- **推定対象:** ATE・ATT・ATC・ATO、`stabilize`、`trim(at, lower = TRUE)` (ReactiveStat は at = 0.9・0.95・0.98・0.99)
- **バランス:** 既存の `balTab` に weightit の結果を渡せるようにし、ATO (両群をまとめた SD) を足す。群ごとの有効サンプル
  サイズ (Kish) と重みの要約 (WeightIt の `summary`) も返す
- **下流 (新しく):** `svyglm` (survey 4.5、`svydesign(ids = ~1, weights)` だけ、t 分布の p 値)、Cox からの調整生存曲線
  (`survfit(coxph, newdata)`)。既存: `lm` の weights + `vcovHC(type = "HC3")`、`coxph(weights, robust = TRUE)`、重み付きの `survfit`
- 置き場所の案 (始めに確かめる): weightit・trim・重みの要約は `/causal`、svyglm と調整生存曲線は glm・coxph と同じ `/tests`

### 手順 (1.12.0 と同じ。教訓: 端のケースと極端な尺度は実装の直後に必ず点検する、作業ブランチは消す前に `archive/` のタグ)
1. Issue を作る。作業ブランチ (`dev/iptw-1.13`)。手元の未 push の HANDOFF のコミットを最初に含める
2. WeightIt・CBPS (と依存) をイメージ 3 つとチェッカーに足す (survey・sandwich は入っている)
3. R の実験 (x86_64、17 桁) → 仕様書 `oracle/weightit-behaviour.md` → Decisions → fixture → 実装 → 端のケース → 文書・訳 (私)・
   デモ → main に 1 コミット + タグ → `npm stage approve`

## セッション 30 でしたこと (2026-11-24): 1.12.0 の準備

- **token の節約 (ユーザー 2026-11-24):** 私が実装する方針のまま、Actions を動かさない作業 (日本語 API の訳・文書の下書き・
  デモの文言) は ChatGPT に頼む。些細な点は深追いしない (実験 2 回で決着しなければ未解明として書き、推奨つきで聞く)。
  記憶 `feedback-rstats-self-implement-and-record` に追記済み
- 作業ブランチ **`dev/psm-1.12`** (push していない): `b4034f63` (ROADMAP・HANDOFF の持ち越し)、`ac4de840` (準備)。
  **Issue #562** (範囲・照合先・クリーンルーム・記録の仕方)、実験の記録のコメント 1 件
- イメージ 3 つを作り直した (Matching 4.10.15・cobalt 5.0.0・tableone 0.13.2、依存の survey など)。acf と ca の oracle を流して
  既存の fixture が変わらないことを確かめた。チェッカーに 3 パッケージの export と S3 メソッド、`clogit`
- R の実験 (x86_64): `experiments/psm112.{R,json}`・`psm112-ties.{R,json}`・`psm112-sample.{R,txt}`。分かったことと未解明の点は
  `oracle/match-behaviour.md`: caliper の幅 = caliper × X の SD (n で割る)、同点が無ければ乱数を引かない、ATT・replace = FALSE
  は処置群をデータの順に処理し M 本そろわない処置は落とす、bal.tab の SMD は照合前の処置群の SD で割る、分散比は重み付き分散
  (割る数 sum(w) − sum(w²)/sum(w))、tableone の SMD は sqrt((s1² + s0²)/2) (2 水準の factor は p(1−p))、clogit の既定は exact
- **未解明:** ties = FALSE で k ≥ 3 の同点から選ぶ規則 (k = 2 は u < 0.5 で 2 番目)。引く乱数の数が seed で
  揺れ、`sample(k, 1)`・`sample(k, k−1)`・`sample(k)` のどれとも合わない。ほかに distance.tolerance の比べる量、ATE の出力の順
- **同点の決定 (ユーザー 2026-11-24):** ChatGPT (GitHub に連携しない独立のもの、データは Issue #562 のコメント) に数値だけで
  調べさせた → k = 2 の規則は確認、M = 2 は「M 番目に近い距離以内の対照を全部」候補にすると分かったが、k ≥ 3 は解けず。私の
  base R の乱数 8 種の消費数の比較 (`experiments/psm112-rng.{R,txt}`) も合わず。**k ≥ 3 の同点は setSeed で再現できる独自の規則
  にして、R との既知の違いとして文書に書く** (同点が無ければ R と同じ組)。独自の規則の中身は実装のときに決める
- **Decisions (ユーザー 2026-11-24、全部推奨どおり):** 同点の独自の規則は floor(k(1−u)) で 1 個ずつ (k = 2 は R と同じ)、M ≥ 2 の
  候補は R と同じ (M 番目の距離以内を全部)、同点は距離が完全に等しいときだけ、clogit は exact と approximate (efron は外す)。
  ATE の順は実験から決まった (`oracle/match-behaviour.md` の Choices)
- **置き場所 (ユーザー 2026-11-24):** match・matchWeights・balTab・tableOneSmd は新しい `/causal`、clogit は coxph と同じ `/tests`
- **実装済み (私、ブランチ `dev/psm-1.12`):** fixture `test/fixtures/match.json` (`oracle/match.R`、x86_64、178 件)。`src/causal/match.ts`
  (同点の無い sim の 36 case は組・dropped・乱数の後の状態まで R と一致。lalonde・cat は全部 3 つ以上の同点で構造だけ点検)、
  `src/causal/balance.ts` (get.w は「組ごとに両側へ 1/M」、bal.tab は caliper のとき Discarded の行、分母 0 の分散比は NaN。
  R の重みで全 case 一致)、`src/models/clogit.ts` (exact は Gail-Lubin-Rubinstein の漸化式、approximate は coxph。10 case
  全部一致。R の summary は Wald を小数 2 桁に丸める)。R の `index.dropped` は「caliper があるときだけ、どの組にも現れない
  落ちた単位」(ATE で分かった)。配線 (package.json・bundle・size・typedoc・api-reference・docExamples・demo・r-index)、
  英語の文書 (README・API・差異・CHANGELOG の Unreleased・ROADMAP)。手元で型・全テスト (既知の issue179・513 以外)・ビルド・
  ブラウザ 16/16・デモ 1190/1190 が通る
- **日本語の訳 (私、ユーザーの指示で ChatGPT から引き取った 2026-11-24):** ChatGPT (GitHub 連携) は 6 件でインラインコードの
  点検が通らず止まった → 原因は英文 (コードが行をまたぐ、数式がコードでない) なので英文を直し、API の訳 72 件と日本語の文書
  4 つ (README.ja・ROADMAP.ja・docs/ja/api-reference・docs/ja/differences-from-r) を私が書いた。未訳 0、TypeDoc の /causal と
  clogit の警告 0。`dev/psm-1.12` は GitHub に push 済み (`f1fd3dd5` まで、ChatGPT 用。Actions は動かない)
- **端のケースの点検 (ユーザーの指摘で 2026-11-24、`fa6c759b`):** `experiments/psm112-edge*.R`。R は 1e±300 で崩れる (Match が
  止まる・全部 tolerance の同点、bal.tab・tableone が 0/NaN/Inf) → rStats.js は 2 のべき乗で誤差なく尺度をそろえ、先頭の値を
  引いて計算 (`src/causal/scale.ts`、ldexp)。尺度・共通の値に依らないことを `test/causalEdge.test.ts` で確かめる。tableone の
  カテゴリの SMD は一般化逆行列 (R と同じ)。clogit exact: 共線は NaN (coxph の Cholesky を export して共用)、反復を使い切った
  ときは R と同じく iter.max 回・max(1, iter.max − 1) 回分の係数、大きな組は大きさごとの 2 のべき乗。情報の無いデータだけ
  R と違う (NaN、文書に書いた)。match は n = 5000 で 0.7 秒
- **公開の準備は済み (2026-11-24):** デモの例 4 つ (match・balTab と matchWeights・tableOneSmd・clogit、R の結果は既存の 253 件が
  不変)、版 1.12.0 (package.json・lock・README・API の CDN・demo の VERSION・CHANGELOG の日付)
- **1.12.0 を公開した (2026-11-24):** main `f65ba78d` (16 コミットを squash、中身は作業ブランチと同じ)、CI・Pages 緑 → タグ
  `v1.12.0` → Release の stage (id `2cedf6dd-...`) をユーザーが承認。npm latest = 1.12.0、jsDelivr の `dist/causal.js` (purge は不要
  だった)、`/api/` と `/ja/api/` の match のページ、デモ v1.12.0 を確かめた。Issue #562 を閉じた。HANDOFF のこの更新は手元の
  コミットだけ (次の作業とまとめて push)。`dev/psm-1.12` はユーザーの指示で手元と GitHub から削除。途中のコミット (Issue の実験の記録が指す) は
  タグ `archive/psm-1.12` (`e3513ad2`) で残した (クリーンルームの証拠。`v` で始まらないので Actions は動かない)
  (`oracle/match.R` など、x86_64) → 実装 (Match・バランス・clogit の exact) → 点検 → 文書・デモ → 訳は ChatGPT

## 次のセッションで最初にやること: 1.12.0 (傾向スコアのマッチング) の準備 (セッション 29 → 30、2026-11-24 に作成)

- **手元に未コミットの変更がある:** `ROADMAP.md`・`ROADMAP.ja.md` (新しい順) と `HANDOFF.md` (この節と下の決定)。push すると
  CI と Pages が動くので、1.12.0 の作業ブランチの最初のコミットにまとめる
- **進め方が変わった (ユーザー 2026-11-24):** 実装は私が直接 (token は増やしてもらった)。GitHub Actions は節約: 作業ブランチは
  `work/**` 以外の名前 (例 `dev/psm-1.12`。`work/**` に `experiments/*.R` を push すると r-experiments.yml が動く)、draft PR は
  作らない、テストは手元で全部 (型・`npx vitest run`・`npm run build`・`npm run test:browser`)、公開は main に squash の 1 コミット
  + タグ。**R の実験は手元の `rstats-oracle-amd64:4.6.2` で流し、スクリプトと出力を `experiments/` に置いて、Issue に
  `gh issue comment` で記録する (クリーンルームの証拠)**。記憶 `feedback-rstats-self-implement-and-record`
- 範囲は下の「1.12.0 (マッチング) の範囲」(ユーザーの決定)。照合先は ReactiveStat (`numero-uno-jpn/ReactiveStat` の
  `scripts/傾向スコア/`) の呼び方に合わせる
- 手順: (1) Issue を作る (2) Matching・tableone・cobalt を `oracle/Dockerfile.r46` (と experiments) に足してイメージを作り直し、
  `scripts/r-experiment-check.mjs` に関数を足す (3) 最初の R の実験 = `Match` の ties = FALSE の乱数の使い方、caliper の単位、
  estimand ごとの組 (4) 仕様書 (`oracle/match-behaviour.md` など) と choices → fixture → 実装 (`clogit` も) → 数値の点検 → 文書・
  デモ・訳 (訳は Haiku のエージェントか私) → main に 1 コミット + タグ → ユーザーが `npm stage approve`

## 次のセッションで最初にやること: 1.11.0 の始め (セッション 28 → 29、2026-11-23 に作成)

### 計画 (ユーザーの決定 2026-11-23: ROADMAP の残りを 2 つの版に分ける)

ROADMAP の残り (2 番) は isoMDS・sammon、対応分析 (ca)、時系列 (acf・arima)。1 つの版にまとめず、確実に仕上がるものを先にする。
- **1.11.0:** 対応分析 (ca パッケージ) と acf・pacf (stats)、isoMDS・sammon (MASS)。**isoMDS・sammon は「Kruskal の方法
  (sammon は Sammon 1969) で R に届かなければ外して公開する」と最初に決めてから始める** (1.10.0 で isoMDS は届かなかった)
- **1.12.0:** arima だけ (状態空間・カルマンフィルタ・正確な尤度と CSS・最適化・定常性の変換と、一番重い。`predict`・
  `arima.sim` の範囲もそのときに決める)
- 理由: arima は今回届かなかった isoMDS の最適化より重い。token が限られるので範囲を広げると途中で止まる危険が増える。ca と
  acf は手順が決まった計算 (特異値分解・和) で、dist・cmdscale と同じく R とビット単位に近い一致まで持っていきやすい

### 1.11.0 の始めに決めること (推奨つきで AskUserQuestion)
- 置き場所: ca・isoMDS・sammon は `/multivariate`、acf・pacf は新しい分野 (例 `/timeseries`) か既存の分野か
- ca の範囲: `ca` (行・列の主座標と標準座標、慣性、`nd`、補助の行・列 `suprow`・`supcol`) と `mjca` (多重対応分析) を入れるか。
  `MASS::corresp` で済ませる案もある (MASS はイメージにある)
- acf の範囲: `acf` (`type` の correlation・covariance・partial、`lag.max`、`demean`、`na.action`)、`pacf`、`ccf`、
  多変量の系列。符号・信頼区間の線 (図の点線 `qnorm((1 + ci)/2)/sqrt(n)`) を返すか
- isoMDS・sammon の合格の条件 (1.10.0 の choices 7 の形: 厳しく収束させた R との一致。届かなければ外す)

### 決定 (ユーザー 2026-11-23、セッション 29)
- **置き場所:** acf・pacf・ccf は新しい `/timeseries` (1.12.0 の arima も同じ所)。ca・mjca・isoMDS・sammon は `/multivariate`
- **ca の範囲: `ca` と `mjca` の両方** (推奨は ca だけだったが、mjca も入れる)。ca は主座標・標準座標・慣性・`nd`・
  `suprow`・`supcol`。mjca の `lambda` の種類 (indicator・Burt・adjusted・JCA) の細部は指示書で決める
- **acf の範囲:** 単変量 + `ccf`。acf (`type` の correlation・covariance・partial、`lag.max`、`demean`、`na.action`)、`pacf`、
  `ccf`、図の点線の値 `qnorm((1 + ci)/2)/sqrt(n)` も結果に入れる。多変量の系列は後回し
- **isoMDS・sammon:** `work/isomds-next` を作業ブランチに取り込んで続ける。合格は choices 7 の形 (厳しく収束させた R
  `isomds_tight_*` と座標・stress が許容内)。sammon も同じ形で fixture を作る。届かなければ外して公開 (決定済み)

### セッション 29 でしたこと
- **準備の 1 は済み (未コミット):** `oracle/Dockerfile.r46` と `Dockerfile.experiments` に ca の層 (スナップショット
  2026-10-23 で **ca 0.72**、依存なし、GPL。experiments は 0.72 と MASS 7.3.66 に固定)。イメージ 3 つ (rstats-oracle:4.6.2・
  rstats-oracle-amd64:4.6.2・rstats-experiments:4.6.2) を作り直した。`scripts/r-experiment-check.mjs` に ca を許すパッケージに、
  ca の export と S3 メソッド全部、stats の `acf`・`pacf`・`pacf.default`・`ccf`・`print.acf`・`plot.acf` を関数の一覧に。
  ca・mjca・acf・pacf・ccf を呼ぶ小さな実験がチェッカーを通り、experiments のイメージで動いた (main `96103315`)
- **準備の 2 も済み:** `/timeseries` の空の入口と配線 (`package.json`・`scripts/bundle.mjs`・`scripts/size.mjs`・
  `typedoc.json` の "Time series"・`src/api-reference.ts`・`test/docExamples.test.ts`)、私の R の実験 3 本
  (`experiments/{ca111,acf111,sammon111}.{R,json}`、x86_64・17 桁)、指示書 `briefs/ca-acf-mds-1.11.ja.md` と入口
  `briefs/ca-acf-mds-1.11-status.ja.md` (main `85a6ec89`)。作業ブランチ `work/ca-acf-mds-1.11` に `work/isomds-next` から
  `isoMDS.ts`・`isoMDS.test.ts` と export だけ取り込み (145 コミットの枝は 1.10.0 の途中の dist・kmeans を含むのでマージ
  しない)、r-functions を作り直した (`3e708d0f`)。**Issue #560・draft PR #561** (マージしない)、番号を入口に (`b63398a0`)。
  ブランチでは isoMDS のテスト 5 件が落ちる (1.10.0 で届かなかった分。ChatGPT が理由から調べる)
- 実験で分かったこと (詳しくは指示書 1 節): **ca 0.72 の `summary()` は次元が 1 つ以下だと落ちる** (fit は取れる)。
  mjca は小さな表の adjusted・JCA、2 変数で `non-conformable arguments`。**sammon は swiss で既定でも厳しくしても 0 回の
  反復で止まる** (初期値の stress のまま)。厳しく収束させた sammon の case は全部収束 (合格の条件に使える)
- **段階 1 (ChatGPT、`5b83dba5`・追加の調べ `a417c8fd`):** 仕様書 5 つと補助ファイル方式の oracle。最初の報告は未解明が
  多く (na.pass・mjca の adjusted の全慣性・JCA・sammon の止め方・isoMDS)、**私がヒント** (R の出力から突き止めた
  na.pass の割る数 = 使えた対 + k、Greenacre の調整した全慣性の式 (ビット一致)、ca の地図の定義、sammon の magic の
  係数の読み方、isoMDS の評価の誤りの指摘) を出して再依頼 → JCA の収束の量と isoMDS の p = 2 の歩幅以外は解けた
- **isoMDS の訂正:** ChatGPT は「primary を続ける」を推奨したが、その表で R の stress は全 case で「固定の順」の評価と
  一致し、primary は grid・eurodist で R より低い → R は primary ではない。1.10.0 で届かなかった原因の 1 つ
- **Decisions (ユーザー 2026-11-23、全部推奨どおり):** isoMDS の同点は R と同じ固定の順 (choices 8、choices 1 を置き換え)、
  mjca の JCA は外す、acf の naAction は fail と pass、sammon は R に合わせる (4 回失敗で打ち切りも)。ほかは ChatGPT の
  推奨 (ca は行列入力・補助は番号・caSummary と caCoord・軸の符号は行と列で共通、ccf は同じ長さ・整数のラグ など)
- **私がしたこと (ブランチ `40aa5d94`):** oracle 4 本の `source` を `/oracle/` の絶対パスに (コンテナで読めなかった)、
  fixture `test/fixtures/{acf,ca,mjca,sammon}.json` (91・32・27・45 case、amd64)、5 つの仕様書の choices、段階 2 の指示
  `briefs/ca-acf-mds-1.11-stage2.ja.md`、入口の進み具合
- **段階 2 (2026-11-23〜24):** ChatGPT が acf・ca・mjca・sammon を実装 (全 fixture case)。私が生成物・sammon のテストの許容
  (choices 4 の尺度、発散する scale_y)・`SammonInputTable` への改名 (`91d02023`)。isoMDS は一度外した (`work/isomds-next` の
  `62cff8b9` に保存)
- **isoMDS を戻した (ユーザーの決定 2026-11-24):** 私が R の公開の出力だけから **R の反復 = 教科書の BFGS** を突き止めた
  (`maxit = k` の点と数値微分の勾配の比較 → BFGS を自分で書いて R の k + 1 回目と一致、swiss 1.6e-14・eurodist 2.2e-11。
  `experiments/isomds111-{iterates,bfgs}.{R,txt}`)。choices 11・12、経過を書いた指示書 `briefs/isomds-1.11-bfgs.ja.md`
  (ブランチ `a41caa5d`)。次は ChatGPT: 歩幅を縮める係数・数え方・止め方・p ≠ 2 を決めて実装 → 仕上げ
  (`briefs/ca-acf-mds-1.11-finish.ja.md`、isoMDS 込み)
- **isoMDS は R と一致 (2026-11-24、私が直接。ユーザーの判断で往復を減らすため):** ChatGPT が BFGS・tol の追加の一歩
  (前の点の勾配)・同点の順を直し、私が「追加の一歩は行列が単位行列でないときだけ」「止まる回は iter の行を出さない」
  「配置の距離 0 なら動かない」を R の出力から決めて直した (`40b0f0b7`)。R が最小でない所で止まる 6 case は stress が
  R 以下を確かめる (choices 14、差異の文書)。デモ (ca は smoke、sammon は 3 次元) と R の結果、TypeDoc の警告、日本語の
  API の訳 (ChatGPT、164 件、検査済み) も済み。作業ブランチ `c9cff598` で手元の全テストが通る (既知の issue179・513 を除く)
- **止まっている理由: GitHub Actions がアカウントの支払いの問題でロック** (2026-11-24 の注記 "The job was not started
  because your account is locked due to a billing issue")。CI も release.yml (npm の公開) も動かない。ユーザーが GitHub の
  Billing を直したら: PR #561 の CI を確かめる → 取り込みの PR (squash) → 版の PR → タグ → `npm stage approve`
- **1.11.0 を公開した (2026-11-24):** ユーザーが GitHub の支払いを直した後、**Actions を節約する形**で: 作業ブランチを手元で
  全部確かめ (型・全テスト・ビルド・ブラウザ)、main に squash の 1 コミット (`3be13f48`、版の更新込み) を直接 push → CI 緑
  → タグ `v1.11.0` → release.yml の stage (id `2a0b846d-...`) をユーザーが承認。PR #561 は push せずに閉じ、Issue #560 も
  閉じた。jsDelivr は承認前に覗いた 404 を覚えていたので purge した (`purge.jsdelivr.net/npm/...`)。デモは `/timeseries`
  を読み込むよう `demo/app.js` に足した (無い版でも止まらない)
- **ROADMAP を並べ直した (ユーザー 2026-11-24、手元で直して未 push。次の push とまとめる):** EZR・HAD・エクセル統計
  (BellCurve の搭載機能一覧、HAD の更新履歴、EZR の CRAN の索引) と ReactiveStat (`numero-uno-jpn/ReactiveStat` の
  `dokuwiki_pages`・`scripts`) の手法を突き合わせた。順: 1 傾向スコア (マッチングと IPTW、下流の解析まで。2 つの版に
  分けるかも)、2 条件付きロジスティック (1 と一緒)、3 多項ロジスティック、4 ステップワイズ、5 媒介・調整分析、6 tobit・
  対数線形・ガンマ/ベータ回帰、7 その後に検討 (時間依存 ROC、ネットワークメタ、Bradley-Terry、管理図、arima・auto.arima)。
  arima は一度「対象外」にしたが、ReactiveStat の時系列のページが `auto.arima` を使うので 7 に戻した。作業ブランチ 2 本は
  ユーザーの指示で削除済み
- **傾向スコアの決定 (ユーザー 2026-11-24):** マッチング (1.12.0) と IPTW (その次) は別の版。照合先は ReactiveStat に合わせる
  (`scripts/傾向スコア/*.php`): マッチングは Matching `Match` (X = logit(PS)、PS は `glm(binomial)`、ties = FALSE、M = 1〜10、
  caliper は logit(PS) の SD の倍数 0.1〜0.5、replace = FALSE)、バランスは cobalt `bal.tab`・tableone `CreateTableOne`、
  下流は `clogit(+ strata(pairmatch))`・`coxph(+ strata(pairmatch), method = "breslow")`・`mantelhaen.test`。IPTW は WeightIt
  `weightit` (ps の 4 つの link・glm・cbps・ipt・ebal・energy・optweight・gbm・bart、ATE・ATT・ATC・ATO、stabilize、trim)、
  cobalt `bal.tab`、survey `svydesign`+`svyglm`、`lm`+`vcovHC(HC3)`、`coxph(weights, robust = TRUE)` と調整生存曲線
- **1.12.0 (マッチング) の範囲 (ユーザー 2026-11-24):** estimand は **ATT・ATE・ATC** (ReactiveStat は ATT だけ)、ties = FALSE は
  **R と同じ乱数の割り振り** (setSeed の後で R と同じ組)、バランスは**標準化差と分散比** (bal.tab の中心と tableone の前後の
  SMD。表の体裁は使う側)、下流は **clogit (新しく)・組で層にした Cox (既存の coxph)・Mantel-Haenszel (既存)**。次は準備:
  Matching・tableone・cobalt をイメージとチェッカーに足す、R の実験は手元で (Actions を節約)
- **これからの Actions の使い方 (ユーザー 2026-11-24):** 無料枠を使い切った。ChatGPT に Actions を制限なく使わせない
  (PR への push ごとの CI、`work/**` の R の実験)。テストと R の実験は手元で。私が動かす分は必要なら可。公開は「main に
  1 回 + タグ」の形 (Actions は 3 回ほど)
- 残り: 作業ブランチ `work/ca-acf-mds-1.11` (手元に未 push の 2 コミット、中身は main と同じ) と `work/isomds-next` の扱いは
  ユーザーに聞く
- **この Mac (Node 24.19) では main でも `test/issue179.test.ts`・`issue513.test.ts` が最後の桁で落ちる** (CI は緑。
  今回の変更とは無関係。未調査)

### 準備 (私、1.10.0 と同じ。教訓は「セッション 28 の教訓」と feedback-chatgpt-write-scope-and-tokens)
1. **ca パッケージはイメージに無い:** `oracle/Dockerfile.r46` と `Dockerfile.experiments` に足す (版は CRAN の日付
   2026-10-23)。`scripts/r-experiment-check.mjs` に ca の関数と stats の `acf`・`pacf`・`ccf`、MASS の `sammon` が一覧にあるか
2. 私が流す R の実験 (`experiments/<名前>111-*.R`、**x86_64 の R・17 桁** `digits = I(17)`)、指示書と入口 (入口の先頭に
   「書き込んでよい場所」)、作業ブランチ・Issue・draft PR
3. isoMDS は `work/isomds-next` (ChatGPT の実装、届かなかったもの) と main の `oracle/isomds-behaviour.md`・`isomds_tight_*` から
   始める。作業ブランチに取り込むかは始めに決める
- 進め方は 1.10.0 と同じ: ChatGPT の段階 1 (仕様書 + oracle) → Decisions → 私が choices と fixture → 段階 2 (実装) → 数値の
  点検 → 文書・デモ・訳 → 取り込み・版・タグ・ユーザーが `npm stage approve`。ChatGPT が収められない数値のずれは、私が
  R の出力から規則を突き止めて直す (1.10.0 の kmeans の形)

## 1.10.0 を公開した (セッション 28 の終わり、2026-11-23)

- npm latest = **1.10.0** (stage id `d73558c1-...` をユーザーが承認)。tag `v1.10.0`、main = `e46d4172` (#558 本体、#559 版)。
  確かめたもの: jsDelivr の `dist/multivariate.js` (6 関数)、デモ v1.10.0、`/api/` と `/ja/api/` の kmeans のページ
- 中身: `/multivariate` に `dist`・`asDist`・`hclust`・`cutree`・`kmeans`・`cmdscale`。全 fixture case で R と一致 (dist はビット
  単位、kmeans は乱数の後の状態まで)。cmdscale は k 本だけの固有ベクトル (`src/linalg/symmetricLeading.ts`、私が書いた。
  n = 2000 で Mac 7.5 秒、R は約 1 秒)
- **次の版の候補:** isoMDS (`work/isomds-next` に実装、仕様書・oracle・`isomds_tight_*` の fixture は main にある。Kruskal の
  方法でも厳しく収束させた R にも届かなかった)、sammon、対応分析 (ca)、cmdscale をさらに速く。未確かめ: kmeans の数百回の
  反復での誤差の積み重なり
- 片付け済み (ユーザーの指示): ブランチ 3 本 (work/cluster-mds-1.10・release/1.10.0-cluster・release/1.10.0) を手元と GitHub から削除 (中身が main と同じことを確かめた)、PR #557 と Issue #556 を閉じた。`work/isomds-next` は残す
- **セッション 28 の教訓:** ChatGPT に書き込んでよい場所を列挙する (main に push する事故)。fixture は 17 桁 (`digits = I(17)`)・
  ビット単位の照合は x86_64 の R (arm64 は FMA)。ChatGPT のテストは誤りが多い (警告を value の中から読む、R と違う入力、例外で
  途中で止まって不一致が出ない) → 点検では不一致の数だけでなくテストが最後まで走ったかを見る。ChatGPT が収められない数値の
  ずれは、私が R の出力 (後の乱数の状態など) から規則を突き止めて直す方が速い

## 次のセッションで最初にやること: 1.10.0 の始め (セッション 27 → 28、2026-11-22 夜に作成)

### 1.10.0 の計画 (ユーザーの決定 2026-11-22: 「多変量のつながり」= クラスタ分析と多次元尺度法を 1.10.0 に)

ROADMAP の「残っていること」の 2 (順不同) のうち、1.9.0 の `/multivariate` に続く 2 つ。**範囲の細部は新しいセッションの
最初にユーザーと決める** (1.9.0 と同じく推奨つきで AskUserQuestion)。今あるもの: `eigen`・`svd`・`prcomp` (`src/linalg/`)、
R に合わせた乱数 `setSeed`・`sample` (`src/random/`)。`dist` はまだない。照合用のイメージには cluster 2.1.8.3 と MASS 7.3.66
が入っていて、ca は入っていない (`oracle/Dockerfile.r46`・`Dockerfile.experiments` の両方を確かめる)。

私の案 (推奨つきで聞く):
- **置き場所:** 全部 `/multivariate` (推奨)。`dist` も同じ所 (ほかの分野から使うなら後で移す)
- **距離:** `dist` の method 6 つ (euclidean・maximum・manhattan・canberra・binary・minkowski と `p`)、`diag`・`upper` は
  表示だけなので返す形で決める。NA の扱い (R は対ごとに除いて尺度を直す) を R の出力で確かめる
- **階層クラスタ:** `hclust` の method 8 つ (ward.D・ward.D2・single・complete・average・mcquitty・median・centroid) と
  `members`、`cutree` (`k`・`h`)。**同じ高さの併合の順 (同点) と `merge`・`order` の向きを R と全く同じにするのが最大の
  難所** (R の出力から規則を決める。ソースは読まない)。median・centroid の高さの逆転も R どおりに
- **k-means:** `kmeans` の algorithm 4 つ (Hartigan-Wong (既定)・Lloyd・Forgy・MacQueen)、`iter.max`、`nstart`。初期の中心は
  R の乱数で選ぶので、**`setSeed` + `sample` が R の `sample.int` と同じ列を出すか最初に確かめる** (x86_64 の R で。
  乱数の fixture は `rstats-oracle-amd64:4.6.2`)。centers に行列を与えた場合は乱数なしで比べる。Hartigan-Wong の
  「empty cluster」「did not converge」の警告とエラー
- **多次元尺度法:** `cmdscale` (`k`・`eig`・`add` (Cailliez の定数)・`x.ret`)。固有ベクトルの符号は 1.9.0 の lda・cancor と
  同じく決まった規則で、R との既知の違いにするか聞く。MASS の `isoMDS` (非計量、`y` の初期値・`maxit`・`tol`・`p`) と
  `sammon` は入れるか聞く (推奨: `isoMDS` は入れる、`sammon` は後回し)。isoMDS の配置は回転・反転で R と比べる
- **対応分析 (ca パッケージ):** 1.10.0 では外すのを推奨 (イメージに ca を足す手間と、多変量の範囲が広がりすぎるため)。
  入れるなら照合先の版を CRAN の日付 2026-10-23 で決める
- 照合先: R 4.6.2 の stats と MASS 7.3.66 (と cluster は照合に使わない見込み)。どれも GPL なのでクリーンルーム

### セッション 28 でしたこと (2026-11-22 夜)

- **範囲の決定 (ユーザー、全部推奨どおり):** 全部 `/multivariate` (dist も)、MDS は `cmdscale` + `isoMDS` (`sammon` は
  後回し)、対応分析 (ca) は外す、cmdscale・isoMDS の符号は決まった規則 (列の絶対値最大の成分を正) で R との既知の違い。
  聞かなかった細部 (dist の 6 method、hclust の 8 method と members、cutree の k・h、kmeans の 4 algorithm・nstart、
  cmdscale の k・eig・add・x.ret、isoMDS の y・k・maxit・tol・p) は上の案のまま
- **準備 (main、`694320f3`):** `scripts/r-experiment-check.mjs` に stats の `dist`・`as.dist`・`hclust`・
  `cutree`・`kmeans`・`cmdscale` など (isoMDS・sammon は MASS の一覧に前からある)。R の実験 `experiments/cluster110.{R,json}`
  (x86_64 の `rstats-oracle-amd64:4.6.2`。エミュレーションで数分) と `experiments/mds110.{R,json}` (arm64)。指示書
  `briefs/cluster-mds-1.10.ja.md` と入口 `briefs/cluster-mds-1.10-status.ja.md` (Issue・PR は `#ISSUE`・`#PR` の仮置き)。
  `/multivariate` の配線は 1.9.0 で済んでいるので今回は不要
- 分かったこと (詳しくは指示書 1 節): **rStats.js の `setSeed` + `sampleInt` は R の `sample.int` と同じ列**、kmeans は
  `nstart` 回だけ `sample.int(nrow, k)` を引き、centers が行列なら乱数を使わない (後の `runif` で確かめた)。hclust の
  median・centroid は距離を二乗しない。**R 4.6.2 自身が `hclust(d * 1e200, method = "ward.D2")` で落ちる** (arm64 で
  segfault、x86_64 で止まらない → 実験から外した)。isoMDS は 1e150 倍で収束の判定がすぐ成り立つ (尺度に依存)。
  チェッカーは `methods`・`hc`・`trace` (引数名でも) を止める → isoMDS は `capture.output` で表示を受ける
- ユーザーの許可で main をコミット・push (`694320f3`)、作業ブランチ `work/cluster-mds-1.10`、**Issue #556**、**draft PR #557**
  (マージしない) を作り、番号を入口に入れた (ブランチの `fede7b7c`)。PR の CI は動いている
- **段階 1 は完了 (ChatGPT `a4a09187`、私 `ff327c4f`):** 仕様書 5 つ (`oracle/{dist,hclust,kmeans,cmdscale,isomds}-behaviour.md`)
  と補助ファイル方式の oracle。ChatGPT の Issue の最終報告は fixture の依頼だけで、Decisions の要約が無かった (仕様書を直接
  読んだ)。私の点検: **hclust の同点の規則は 82 ケース全部で R と一致** (独立の計算。三角形の complete は R の d(1,3) が
  1.9999999999999998 で同点でなかった → dist は R と同じ素朴な式でビット一致が要る)、**binary の全部 0 の対は R で 0**
  (仕様書の 1 は誤り、根拠のケースに無かった)。probe のケースを oracle に移し、kmeans の oracle を amd64 に
- **Decisions (ユーザー、全部推奨どおり):** kmeans の Hartigan-Wong は論文から組み全 case で R と一致が合格、isoMDS は
  Kruskal (1964b) の方法で R の途中の stress と最終の座標を合わせる (届かなければ厳しく収束させた R と)、Cailliez の定数は
  0 に丸めず同じ量を計算、dist は R と同じ式 + 溢れた対だけ直す。残りの細部は ChatGPT の推奨 (警告は `warnings: string[]`)
- fixture 5 つ (54・120・114・37・29 case、kmeans は x86_64)、段階 2 の指示 `briefs/cluster-mds-1.10-stage2.ja.md`
- **段階 2 (dist) の点検 (2026-11-22 夜):** (1) **fixture は 17 桁に** (`jsonlite::toJSON(digits = NA)` は 15 桁に丸める。
  プロジェクトの「17 桁」の注記は誤りだった。1.10.0 の oracle 5 つは `digits = I(17)`)。(2) **ビット単位の照合は x86_64 の
  R で:** arm64 の R は積和を FMA でまとめ、`dist` の最後の桁が x86_64 の R・素朴な JS と違う (USArrests の 1 対で R arm64
  …208、x86_64 と JS …194)。dist・hclust・cmdscale・isomds の oracle も `# oracle-platform: amd64` にした (hclust の高さの
  69 個が arm64 と違った。merge・order は同じ)。(3) NA の尺度の直し方は `sum / (使えた数 / m)` の形で R とビット一致。
  (4) 結果の型を `DistResult` に改めた (option-keys.mjs は `*Result` をデータとして扱う)。dist は全 case でビット一致
  (`6076f5bb`)
- **事故: ChatGPT が dist の直しを main に直接 push した** (`faa56636`・`76d20b32`。作業ブランチには中身の無いコミット
  `fe401abd` だけ)。PR #557 が衝突して CI が動かず、main の CI も赤。中身は作業ブランチに取り込み、main では 2 つを revert
  (ユーザーの許可で push)。ChatGPT は「push した」と報告したが、届いた先を確かめていなかった → 依頼文に「push の後、
  `work/cluster-mds-1.10` の HEAD が自分のコミットか確かめる」を入れる
- **段階 2 は完了 (2026-11-23、作業ブランチ `f6f18e89`、CI 緑):** ChatGPT が hclust・cutree・kmeans・cmdscale・isoMDS を
  実装 (約 90 コミット)。kmeans と cmdscale は ChatGPT が収められず、**ユーザーの「token が限られる」の指示で私が直した:**
  - kmeans: Lloyd の最初の割り当て、MacQueen の空のクラスタと iter、k = 1、空の中心 NaN、**Hartigan-Wong の
    quick-transfer の段と「2 クラスタなら quick-transfer の後で止める」(論文)**、**R の初期値の規則** (nstart = 1 は行から
    引き、重複したら重複のない行から 1 回引き直す。nstart >= 2 は全部の start を重複のない行から。後の乱数の状態で確定、
    `experiments/cluster110-nstart-rng.*`)。全 fixture case が一致 (choices 7)
  - cmdscale: テストの警告の読み方、固有値の同点が k をまたぐ case は直交の解であることを確かめる、共線の add は √ε の許容
  - テストの誤りが多かった (警告を value の中から読む、R と違う入力、fixture に無い case)。点検では「テストが例外で途中で
    止まって不一致が出ない」ことに注意 (私も一度「全部通った」と誤って報告した)
- **isoMDS は次の版へ (ユーザーの決定 2026-11-23):** Kruskal の方法でも、厳しく収束させた R (`isomds_tight_*`) にも届かな
  かった。実装は `work/isomds-next` に残し、1.10.0 の作業ブランチから外した (仕様書・oracle・fixture は残す)
- 1.10.0 = dist・asDist・hclust・cutree・kmeans・cmdscale。次: 数値の点検 (`briefs/numerics-1.9.ja.md` の形) → 文書・デモ・訳
  → 取り込み。指示書は「書き込んでよい場所」を先頭に (`feedback-chatgpt-write-scope-and-tokens`)
  (許容の大きさ・export・全 case)。option keys と r-functions は私が作り直す

### 進め方 (1.9.0 と同じ。教訓は下の「1.9.0 の教訓」を最初から指示書に入れる)

1. 準備 (私): チェッカーの関数の一覧 (`hclust`・`cutree`・`kmeans`・`dist`・`cmdscale` は stats、`isoMDS`・`sammon` は MASS で
   一覧にあるか確かめる)、私が流す R の実験 `experiments/cluster110-*.R`/`.json`・`mds110-*.R`/`.json`、指示書
   `briefs/cluster-mds-1.10.ja.md` と入口 `briefs/cluster-mds-1.10-status.ja.md` (手本は `briefs/tests-multivariate-1.9*.ja.md`)、
   作業ブランチ `work/cluster-mds-1.10`・Issue・draft PR (マージしない)
2. ChatGPT: 段階 1 (仕様書 + oracle。**oracle は `oracle/_<名前>cases.R` の補助ファイル方式**) → Decisions をユーザーに →
   私が choices と fixture → 段階 2 (実装、途中で止まらない) → **数値の点検 (`briefs/numerics-1.9.ja.md` の形)** →
   文書・デモ・訳 (`briefs/release-1.9.ja.md` の形)
3. 取り込みの前に私が点検する: 許容の大きさ (1e-8 などは締める)、export 漏れ、戻り値がいつも配列か (auto_unbox を写して
   いないか)、デモを R で流す。取り込み (squash の PR) → 版の PR → タグ → ユーザーが `npm stage approve`
- 指示書に最初から書くこと: 作業ブランチで HANDOFF を触らない、戻り値はいつも配列、群・ラベルは R の `factor()` の順
  (`labelledGroups`)、名前は前例 (`hclust`・`cutree`・`kmeans`・`cmdscale`・`isoMDS` は R と同じ名前で、付属の関数は
  `manovaSummary`・`ldaPredict` の形)、ウェブ検索禁止、R の実験の変数名に関数名を使わない (`dist`・`order`・`sample` などに注意)

## 1.9.0 の後 (セッション 27 の終わり、2026-11-22 夜)

### 1.9.0 を公開した (2026-11-22)

- npm latest = **1.9.0** (stage id `063d0c29-...` をユーザーが承認)。tag `v1.9.0`、main = `01378e79` (#552 本体、#554 数値の
  点検、#555 版)。確かめたもの: jsDelivr の `dist/rstats.js` (T2・Page・Grubbs の 5 関数) と `dist/multivariate.js` (5 関数)、
  デモ v1.9.0、`/api/` と `/ja/api/` の cancor のページ、Pages・Release・CI
- 中身: `/tests` に `tamhaneT2Test` (T2・T2')・`pageTest`・`grubbsTest`/`pgrubbs`/`qgrubbs` (type 10 だけ)、新しい分野
  `/multivariate` に `manova`/`manovaSummary`・`lda`/`ldaPredict` (moment・plug-in・CV)・`cancor`。カテゴリ「Multivariate
  analysis」。サイズ: `/mixed`・`/regression`・`/multivariate` 以外の全部入り 323.7 KB gzip (+1.5)、`/multivariate` 50 KB
- 1.9.0 に入れなかったもの: Grubbs の type 11・20 (R の p 値が近似で出力から再現できない)、lda の mle・mve・t と predict の
  predictive・debiased
- 片付け済み (ユーザーの指示): ブランチ 5 本 (work/multivariate-1.9・work/numerics-1.9・release/1.9.0-multivariate・
  release/1.9.0-numerics・release/1.9.0) を手元と GitHub から削除 (中身が取り込みのコミットと同じことを確かめた)、PR #550・
  #553 と Issue #549 を閉じた
- 次: ROADMAP の次の項目 (未定)。1.9.0 で外したもの (上) は後の版の候補

### 1.9.0 の教訓 (次の版の指示書に最初から入れる)

- **作業ブランチで HANDOFF を触らない。** 作業ブランチと main の両方で HANDOFF を直すと PR が衝突し、衝突した PR では
  `pull_request` の CI が動かない (ChatGPT は気づかずに 80 コミット進めた)。直すときは main を作業ブランチにマージする
- ChatGPT の oracle が `experiments/` を `sys.source` して標準出力に出していた → `scripts/oracle.sh` は `oracle/` だけを
  マウントし `/out/<名前>.json` に書く。ケースは `oracle/_<名前>cases.R` の補助ファイルに置く形にした (今回の手本)
- ChatGPT は CI が緑でも「済んだ」と言いがち・テストの期待値を `1 − p` に書き換えた・許容を 1e-8 にしていた・`pageTest` を
  export し忘れた (テストは内部のファイルから import)。**取り込みの前に私が許容の大きさ・export・デモを点検する**
- 戻り値が R の JSON の auto_unbox (長さ 1 でスカラー) を写していた → いつも配列に直した (ユーザーの決定)。指示書に書く
- **包括的な数値の点検を段階として必ず入れる** (1.9.0 では一度飛ばし、ユーザーの指摘で `briefs/numerics-1.9.ja.md` を追加)。
  ずらしの誤差は「ずらしたデータ」と「正確に引き戻したデータ」で比べ、計算の手順の誤差と入力の丸めを分ける (lda で私が
  見誤った: 9.1e-7 は入力の丸め、手順の誤差は 1e-12)
- 極端なテストのデータは double で正確に表せるものにする (整数・2 の冪・Walsh 関数)。群は数値でなく文字列のラベルに
- BSD の sed は `\b` を解釈しない (perl を使う)。zsh では `set -- $var` で分割されない

## 次のセッションで最初にやること: 1.9.0 の始め (セッション 26 → 27、2026-11-22 に作成)

### 1.9.0 の計画 (ユーザーの決定 2026-11-22: 「小さな検定 3 つ + 多変量 3 つ」をまとめて 1.9.0)

ROADMAP の「残っていること」の 2 (順不同の一覧) から選んだ。
**範囲の決定 (ユーザー、2026-11-22 セッション 27 の始め、全部推奨どおり):**
- 小さな検定 3 つは既存の `/tests` に足す (T2 は `src/htest/multipleComparisons.ts`、Page は `rankTests.ts` の隣)。ルートと
  `dist/rstats.js` にも入る
- 多変量 3 つは新しい `/multivariate` (ルートと `dist/rstats.js` には入れない)
- lda は `method = "moment"`・`prior`・`predict` (事後確率・判別得点・クラス)・`CV = TRUE`。mle・mve・t は後回し。判別得点の
  符号は R に合わせる
- Page の検定の p 値は PMCMRplus `pageTest` の既定に合わせる (正確な分布か近似か・同順位の扱いを R の出力で確かめる)
- 聞かなかった細部 (Grubbs の type 10/11/20 と `opposite`、MANOVA の 4 統計量、cancor の `xcenter`・`ycenter`) は下の案のまま

私の案 (推奨つきで聞いたもの):
- **小さな検定** (外の分野の検定と同じく `/tests` 相当の既存の分野に足すか、新しい分野にするかも決める)
  - Tamhane の T2 (PMCMRplus `tamhaneT2Test`): 等分散を仮定しない多重比較。p 値の調整の種類、`welchANOVA` との組み合わせ
  - Page の検定 (PMCMRplus `pageTest`): 順序のある対立仮説の Friedman 型。正確な分布か正規近似か、同順位の扱い
  - Grubbs の検定 (outliers `grubbs.test`): 外れ値 1 つ・両端・2 つの type 10/11/20、`opposite`、p 値の求め方 (outliers の
    分布関数 `pgrubbs` に合わせる)
- **多変量** (`/multivariate` のような新しい分野を推奨。mixed・regression と同じくルートと `dist/rstats.js` に入れない)
  - MANOVA (`manova` + `summary.manova`): Pillai・Wilks・Hotelling-Lawley・Roy の 4 つ、F 近似、`intercept`、型 I の順の項
  - 判別分析 (MASS `lda`): `prior`、`method = "moment"` (mle・mve・t は後回しを推奨)、`predict` (事後確率・判別得点・クラス)、
    `CV = TRUE` (一つ抜き)。判別得点の符号の向きは R に合わせるか決める
  - 正準相関 (`cancor`): `xcenter`・`ycenter`、係数の符号と尺度は R の定義に合わせる
- 照合先: R 4.6.2 の stats と MASS 7.3.66 (既にある)、**PMCMRplus と outliers を `oracle/Dockerfile.r46` と
  `oracle/Dockerfile.experiments` に足す** (版は CRAN の日付 2026-10-23 のもの。`scripts/r-experiment-check.mjs` に
  関数の一覧も)。どれも GPL なのでクリーンルーム (論文と出力だけ)

### セッション 27 でしたこと (2026-11-22)

- 範囲をユーザーが決めた (上)。**準備 (main にコミット、未 push):** `oracle/Dockerfile.r46` に outliers 0.15 の層
  (PMCMRplus 1.9.12 は前から)、`oracle/Dockerfile.experiments` に PMCMRplus・outliers (と依存 7 つ、libgmp・libmpfr) の層。
  手元の `rstats-oracle:4.6.2`・`rstats-oracle-amd64:4.6.2`・`rstats-experiments:4.6.2` は作り直し済み。
  `scripts/r-experiment-check.mjs` に PMCMRplus (export と S3 メソッド 277)・outliers (10)・stats の `manova`・
  `summary.manova`・`cancor`。**r-experiments.yml は main の Dockerfile とチェッカーを使うので、作業ブランチより先に main を push**
- 私が流した R の実験 `experiments/tests19-small.{R,json}`・`experiments/multivariate19.{R,json}`。分かったこと: T2 は
  `alternative`・`p.adjust.method` を無視 (両側・Šidák)、Page は小標本でも正規近似の z だけ、`pgrubbs`・`qgrubbs` は
  スカラーだけ・type 20 は Grubbs (1950) の表の補間 (n 3〜30)・type 11 は `uniroot` で q により失敗。詳しくは指示書 1 節
- 指示書 `briefs/tests-multivariate-1.9.ja.md` と入口 `briefs/tests-multivariate-1.9-status.ja.md` (Issue・PR の番号は
  `#ISSUE`・`#PR` の仮置き)。作業ブランチは `work/multivariate-1.9` の予定。`/multivariate` の配線 (package.json・
  scripts・typedoc.json) は段階 2 で私がする
- ユーザーの許可で main を push (`7bd3b074`)、作業ブランチ `work/multivariate-1.9`、**Issue #549**、**draft PR #550**
  (マージしない) を作り、番号を入口に入れた
- **段階 1 の 1 回目 (`1b670c13`) は差し戻し:** 仕様書は各 30〜40 行で式が「未確認」のまま、Grubbs はほぼ手つかず、oracle は
  1 本 3〜6 case。確かめの実験はチェッカーに止められていた (`ranks`・`page`) のに ChatGPT は queued と報告。私が名前を
  変えて流した (`experiments/multivariate19-stage1-check-local.*`): T2 (Welch + Šidák)、**T2' は自由度 n_i + n_j − 2**
  (chickwts で確認)、Pillai、lda の svd² = λ(N − g)/(g − 1)、cancor の相関は R と一致。差し戻しは作業ブランチの
  `briefs/tests-multivariate-1.9-stage1-review.ja.md` (`6b208bee`)
- **段階 1 は完了 (2026-11-22、ChatGPT `5ba63b6f`、私 `acc261cf`):** ChatGPT は 1 回タイムアウトの後、式を全部 R と照合した
  (T2・T2'・Page は完全一致、MANOVA の F 4 つ・lda・cancor は 1e-9〜1e-15)。**Decisions (ユーザー、全部推奨どおり):** T2 と
  T2' の両方 (Welch の自由度は溢れない計算)、Page の NA はエラー、**Grubbs は type 10 だけ** (type 11 は R が近似を uniroot で
  逆に解き 1e-5 揺れる、type 20 は表の補間の曲線が出力から特定できない → 既知の未対応)、lda・cancor の符号は決まった規則
  (列の絶対値最大の成分を正) で R との既知の違い (R の符号は LAPACK の SVD で決まり、rStats.js の SVD は符号が違いうる)。
  choices は私が書いた。ChatGPT の oracle は `experiments/` を読み標準出力に出していて動かなかったので、ケースを
  `oracle/_tests19cases.R`・`_multivariate19cases.R` に移して直した。fixture 6 つ (実験の JSON と全件同じ)。段階 2 の指示は
  `briefs/tests-multivariate-1.9-stage2.ja.md`
- **PR の CI が動かなかった本当の原因: PR #550 が main と `HANDOFF.md` で衝突していた** (衝突した PR では `pull_request` の
  CI が動かない。「briefs だけでは動かない」という前の見立ては誤り。ci.yml にパスの絞り込みはない)。作業ブランチでも HANDOFF を
  直し、その後 main だけを直したため。作業ブランチの HANDOFF を main と同じにして直した (`41c95c28`)。**以後、作業ブランチで
  HANDOFF を触らない** (HANDOFF は main だけ)
- 段階 2 (T2、`dadef527`): **群の順の choice をユーザーが変更** (2026-11-22): 「初出の順」→ R の `factor()` の順 (既存の
  `labelledGroups`)。T2・Page の choices 3 と段階 2 の指示を直した (`d8655271`)。T2 の点検: 既存の `layout`・`allPairs`・
  `PMCMRResult` を使っていない、T2' の `pAdjustMethod` が R (`"T2' (Sidak)"`) と違う、`@category`・R の名前の 1 文・
  `NOT_IN_DEMO_YET` がない。option keys と r-functions は私が作る
- 次: ChatGPT が段階 2 (T2 → Page → Grubbs → manova → lda → cancor)。「配線の依頼」が来たら `/multivariate` を配線
  (`package.json`・`scripts/bundle.mjs`・`scripts/size.mjs`・`typedoc.json`・`src/api-reference.ts`・テストの一覧。1.7.0 の
  `8778e17c` が手本)。1 つずつ CI 緑の報告が来たら私が数値を点検
- (以前) 次: ユーザーが ChatGPT に差し戻しの依頼文を貼る → 段階 1 の報告 (仕様書 6 つ + Decisions) を Issue #549 で点検 →
  Decisions をユーザーに聞いて choices を書く → fixture を作る (x86_64 の版も)

### 進め方 (1.8.0 の経験から。ガイド「ChatGPT を外注先に使う開発の進め方」https://claude.ai/artifact/XeAnCSwZUrejZhzx5a7BxV)

1. 準備 (私): Docker の 2 つのイメージ (fixture 用は x86_64 版 `rstats-oracle-amd64:4.6.2` も)、チェッカーの関数の一覧、私が流す
   R の実験 `experiments/<版>-*.R`/`.json`、指示書 `briefs/<名前>-1.9.ja.md` と入口 `briefs/<名前>-1.9-status.ja.md`、
   作業ブランチ `work/<名前>-1.9`・Issue・draft PR (マージしない)。1.8.0 の `briefs/regression-1.8*.ja.md` が手本
2. ChatGPT: 段階 1 (仕様書 + oracle、**R の実験は Actions で自分で流す**) → Decisions をユーザーに → 私が choices と fixture →
   段階 2 (実装) → 包括的な点検 (端の入力と全要素の R との比較) → 文書・デモ・訳 (`briefs/release-1.8.ja.md` が手本)
3. 取り込み (squash の PR) → 版の PR → タグ → ユーザーが `npm stage approve`
- **1.8.0 の教訓 (最初から指示書に入れる):**
  - 段階 1 の仕様書は式のレベルで、R の出力と数値で突き合わせたものだけ書かせる (1 回目は薄くて差し戻した)
  - テストは返す値の**全要素**を R と比べる。R の既定が収束していないことがある (反復の手法) → R の厳しい当て直しを 2 つの閾値で
  - 許容誤差を広げない、期待値を実装に合わせて書き換えない (1.8.0 で両方あった)
  - **デモは私が R で流して照らし合わせる** (1.8.0 では不具合が 4 つ出た)。ChatGPT は R を流せず、デモの R のコードを外しがち
  - oracle で R のオブジェクト (当てはめ・summary) をそのまま JSON に入れない (3 回起きた)。数値だけを取り出す
  - 検索結果にソースの抜粋が 5 回出た → **ChatGPT にはウェブ検索を使わせない** (論文の方法は知っている範囲で)
  - ChatGPT の会話は毎回タイムアウトする → 区切りごとに Issue に途中経過。こちらはブランチ・CI・Issue を見て再開の依頼文を書く
  - 「手元の環境がない」で止まったら、GitHub への直接の push・Actions の R・PR の CI を使うよう伝える
  - 数値のずれが具体的に出たら、往復を重ねず私が手元で R を流して直す (その方が速く確か)。ユーザーは token の節約を望む
- `docs/ja/api/TRANSLATING.md` の 0 節は削除済み。ROADMAP の「残っていること」は番号 2 だけになっている (1.9.0 の後に整理)

## 1.8.0 の後 (セッション 26 の終わり、2026-11-22)

### 1.8.0 を公開した (2026-11-22)

- npm latest = **1.8.0** (stage id `e09bc0c7-...` をユーザーが承認)。tag `v1.8.0`、main = `69b29dac` (#547 本体、#548 版)。
  確かめたもの: jsDelivr の `dist/rstats.js`・`dist/regression.js` (rq・gee・glmnet の 15 関数を export)、デモ v1.8.0、
  `/api/` と `/ja/api/` の rq・geeglm・cvGlmnet のページ、Pages の CI
- 中身: rq (br・fn、rank・nid、予測区間、Wald)、geeglm (作業相関 6 種、サンドイッチ、Wald、QIC)、glmnet (4 族、CV は foldid)。
  1.8.0 に入れなかったもの: rq の se = iid・ker・boot と rank の iid = FALSE、geeglm の jackknife (R と合わせられなかった)。
  サイズ: `/regression` 123 KB gzip、`/mixed` と `/regression` 以外は 322 KB のまま
- **教訓:** ChatGPT は R を流せず、デモの R のコード・テストの期待値・許容を外しがち。**デモを R で流して照らし合わせると本物の
  不具合が出る** (今回 4 つ)。R の既定も厳しい当て直し (1e-14) も収束していないことがある → 閾値を 2 つ出して比べる。
  ChatGPT の会話は毎回タイムアウトする → Issue に途中経過を書かせ、こちらが状態を見て再開の依頼文を書く
- `docs/ja/api/TRANSLATING.md` の 0 節 (Haiku 5.5 以外は止まる) は古い条件だったので削除した (ユーザーの決定)
- 片付け済み (ユーザーの指示): `work/regression-1.8`・`release/1.8.0-regression`・`release/1.8.0` を手元と GitHub から削除 (中身が main と同じことを確かめた)、PR #546・Issue #545 を閉じた
- 次: ROADMAP の次の項目 (未定)。1.8.0 で外した推論 (rq の iid・ker・boot、geeglm の jackknife) は後の版の候補

## 1.8.0 の途中の記録: 段階 1 の報告を待つ (セッション 26、2026-11-20 夜に作成)

### セッション 26 でしたこと (2026-11-20 夜)

- **範囲をユーザーが決めた** (下の「1.8.0 の計画」の「範囲」。rq に boot、GEE に userdefined/fixed と jackknife、glmnet に
  multinomial、置き場所は `/regression`)
- **準備 (main `f689659a`):** `oracle/Dockerfile.r46` と `oracle/Dockerfile.experiments` に quantreg 6.1・geepack 1.3.13・
  glmnet 5.1 (SparseM 1.84.2・MatrixModels 0.5.4) の層、手元の `rstats-oracle:4.6.2` と `rstats-experiments:4.6.2` は
  作り直し済み。`scripts/r-experiment-check.mjs` に 3 パッケージの export を足し、**引数名 (`se = "nid"`) を関数の参照と
  誤判定していたのを直した** (metafor の `se` 以来の誤検出)
- **作業ブランチ `work/regression-1.8`** (`d41e2029`)、**Issue #545**、**draft PR #546** (マージしない)。指示書
  `briefs/regression-1.8.ja.md` と入口 `briefs/regression-1.8-status.ja.md`、私が流した R の出力 `experiments/regression18-{rq,gee,glmnet}.{R,json}`
- **1.7.0 からの変更:** R の実験は ChatGPT が `r-experiments.yml` で自分で流す (`# issue: 545`。私の往復を減らす。x86_64
  なので boot の乱数も見られる)。仕様書 3 つを 1 回の報告に。段階 2 は 1 パッケージごとに止まらず進み、私が並行して点検。
  端の入力は指示書 5 節で最初から合格の条件
- **R で見つけたこと:** geeglm の `corstr = "fixed"` で `anova(fit)` が 40 秒以上終わらない。`scale.fix = TRUE,
  scale.value = 4` がエラー (`variable lengths differ`)。glmnet 5.1 は `thresh` を直接渡すと非推奨の警告 (`control = list(...)`)。
  rq の nonunique の警告は `summary` が出す
- **段階 1 の 1 回目 (`312d9169`、2026-11-21) は差し戻し:** 仕様書が各 100 行ほどで式がない、R の実験を 1 本も流して
  いない、`oracle/gee.R` が `No method asJSON S3 class: lm` で止まる、rq の boot の推奨がユーザーの決定と違う。
  差し戻しの中身は作業ブランチの `briefs/regression-1.8-stage1-review.ja.md` (`6c52d520`)
- **段階 1 のやり直しは済み (`9013bd5a`):** 式を R の出力と独立の計算で突き合わせた (rq の iid・nid・ker の共分散と帯域、
  boot の乱数の引き方 4 種、GEE の共分散・相関・尺度 (分母 N)・QIC、glmnet の gaussian の λ_max と経路)。残りの未解明
  (rq の iid の $\hat f_0$・rank の端点・boot の変換、GEE の jack・j1s、glmnet の binomial などの λ_max) は段階 2 で R と
  合わせながら決める。検索結果にソースの抜粋が 3 回出た (quantreg・geepack・statsmodels)。ChatGPT は使わずに隔離したと報告
- **Decisions はユーザーが全部推奨どおりに決めた (2026-11-21)。** choices は私が書いた。fixture `rq` (x86_64、
  `rstats-oracle-amd64:4.6.2` も作り直した)・`gee`・`glmnet` を作った。oracle の出力先を `/out/<名前>.json` に直した。
  作業ブランチ `a183864d`。段階 2 の指示は `briefs/regression-1.8-stage2.ja.md` (oracle に足す case の一覧つき)
- 次: ChatGPT が段階 2 (rq → geeglm → glmnet)。fixture の依頼が Issue に来たら `npm run oracle -- <名前>` で作って push。
  1 つずつ CI 緑の報告が来たら、私が数値を独立に点検する
- **段階 2 の途中 (2026-11-21 朝、作業ブランチ `d5b3c834`):** rq の当てはめ (br・fn) は完了。総当たりの回避策を
  差し戻し、指示 `briefs/regression-1.8-rq-lp.ja.md` で作り直させた (br 1 万件 846 ms、fn 10 万件 796 ms)。rq の nid・
  predict・anova (Wald)・複数 τ も済み。**rq の未解明 4 件** (iid の密度、rank の端点、ker の帯域、boot の pwy・mcmb・wxy) は
  `it.todo`。ユーザーの判断で ChatGPT にもう一度やらせたが、実験 `regression18-rq-final-probe.R` が R のエラーで止まり、
  ChatGPT は先に geeglm へ進んだ。geeglm は大半を実装、テスト 1 件 (`zcor must be a matrix`) が落ちる。
  私がした直し: `oracle/rq.R` の JSON にできない 2 か所、`oracle/gee.R` の poisson 無構造の厳しい当て直し (geepack が
  maxit = 200 でも 60 秒で終わらない) を外した。fixture rq・gee は作り直し済み。生成物 (option keys・R の索引) は最後に私が作る
- **段階 2 は実質済み、R と合わない残りを私が引き取った (ユーザーの判断、2026-11-21 夕):** ChatGPT は止めた。作業ブランチで:
  - **rq の rank (済み、`7e006d65`):** パラメトリックな線形計画で T(b) を追い、event ごとに記録、$t_{n-p,1-\alpha/2}$ を横切る
    2 つの event の線形補間。同点のないデータで R と 1e-14 (n = 1000 の 4 端点、stackloss 8 端点中 7)。整数データで event が
    同点になり双対が退化する所だけ R と違う (stackloss の Air.Flow 下限、既知の違い)。iid = FALSE は未対応。既定の level は 0.9。
    証拠 `experiments/regression18-rank-path.*`
  - **glmnet の multinomial (済み、`731e46ce`・`a41a5a42`):** 返す lambda がクラスの数 (3) に切られていた不具合を直した。R の
    既定は iris で厳しい当て直しから最大 2.3 離れていて参照にならない (ChatGPT の「0.002 のずれ」はこれ)。R の 1e-14 と 1e-16
    の当て直しの差の範囲で比べるテストにした。rStats.js は 1e-12 で KKT 1e-10 以下。ただし **厳しい閾値では遅い** (1e-12 で
    4〜7 秒、1e-14 で 25 秒。FISTA)。既定 (1e-7) は 0.5 秒
  - **文書での書き方 (ユーザーの決定 2026-11-21):** どちらも R の不具合とは書かない。glmnet は「R の既定 (thresh 1e-7) は
    収束していない (iris で厳しい当て直しから最大 2.3)」、rank は「退化した (同点の) データでの既知の違い」として
    `docs/differences-from-r.md` (と ja) に。R 側の不具合と見ているのは geepack の 3 件 (scale.fix のエラー、fixed の anova が
    終わらない、poisson 無構造の厳しい当て直しが終わらない) だけ
  - 以後は再び token を節約する (ユーザーの指示 2026-11-21)。残りは ChatGPT に戻した
  - **1.8.0 に入れないもの (ユーザーの決定 2026-11-21):** rq の se = iid・ker・boot と rank の iid = FALSE、geeglm の jackknife
    3 種。R と合わせられなかった。エラーにして既知の未対応に (choices に記録済み `6ee8442f`)。仕上げと文書は
    `briefs/release-1.8.ja.md` で ChatGPT に。glmnet の CV は R の厳しい当て直しの fixture を入れた (`64d30930`)
  - **仕上げ (2026-11-22、作業ブランチ `b4ed6632`):** ChatGPT が F・R0〜R3 (未対応のエラー、TSDoc、size、文書、デモ 6 例) を済ませた。
    生成物は私 (option keys に geeAnova の条件、日本語の索引に 15 関数の説明、r-results.json)。**デモを R で流して不具合が
    3 つ見つかり、私が直した:** glmnet の gaussian で alpha < 1 の ridge が y の標準化を欠いていた (2〜4%)、経路の早い終わり
    (fdev × dev.ratio)、rq の τ をまたぐ検定の残差の自由度 (n m − q。ChatGPT が誤った式にテストを合わせていた)、geeglm の QIC
    (準尤度は −RSS/2、CIC の向き)。R の厳しい当て直しも閾値 1e-14 では収束していなかった (CV は 1e-20 に)。全テスト通過
    (Mac 専用の 2 件を除く)。**次: ChatGPT に包括的な点検 (端の入力・桁落ち) → 私が要点を点検 → 取り込みと公開**
  - (以前の残り、今は 1.8.0 の外) rq の iid の密度・ker の帯域・boot (pwy・mcmb・wxy)、geeglm の jack・j1s。
    最後に生成物 (option keys・R の索引)、文書・訳・デモは ChatGPT に
- ChatGPT は返答のたびに「メッセージの配信がタイムアウト」になりやすい。そのたびに Issue #545 とブランチを見て再開の依頼文を書く
- (以前) 次: ユーザーが ChatGPT に依頼文を貼る → 段階 1 の報告 (仕様書 3 つ + Decisions) を Issue #545 で点検 → Decisions を
  ユーザーに聞いて choices を書く → fixture を作る

## 1.8.0 の始め (セッション 25 → 26、2026-11-20 夕に作成)

### 1.7.0 を公開した (2026-11-20)

- npm latest = **1.7.0** (stage id `2ed4f176-...` をユーザーが `npm stage approve` で承認)。tag `v1.7.0` = `4dca465d`
  (release がビルドの結果入りに付け替えた)、main = `bd5b29c8` (#544)。確かめたもの: jsDelivr の `dist/rstats.js`・
  `dist/regression.js` (18 関数を export)・`dist/mixed.js`、デモ v1.7.0、`/api/` と `/ja/api/` の nls・polr・rlm の
  ページ (日本語の訳つき)
- 取り込みの順: #542 (回帰の本体、`experiments/regression-*` 33 ファイルを含む。テストが 1 つ読むため、ユーザーの決定)、
  #543 (公開前の数値の点検の直し)、#544 (版)。作業ブランチ `work/regression`・`release/1.7.0-regression`・
  `fix/regression-numerics`・`release/1.7.0` は、中身が main と同じことを確かめてユーザーの指示で消した (手元と GitHub)。
  PR #541 は閉じた
- **公開前の数値の点検** (`experiments/regression-numerics-*`): polr の縮退 (choices 10 は決めてあったのに未実装だった)・
  重みの定数倍で係数がずれる (スコアの許容に 1 の下限)・Infinity のエラー、nls の Infinity を黙って除いていた、を直した。
  polr の確率は 5 つのリンクで ±800 まで 1e-13 以内。**点検の教訓:** 参照の式の側の桁落ち (cauchit の 0.5 + atan) と、
  分離に近いつもりで完全に分離した例を作った、の 2 回、私の側の誤りがあった。不具合と言う前に参照を疑う
- **MASS の `predict.polr` が newdata の offset を落とす件:** 当てはめは offset を使い、lm・glm は newdata の offset を
  使うので、MASS の不具合と判断 (`experiments/regression-polr-offset-predict.*`、polr choices 13、differences-from-r)。
  報告はユーザーが自分でする (Gmail の下書きは断られた)
- **ChatGPT の使い方の文書** (汎用、他の repo にも): Claude Docs の「ChatGPT を外注先に使う開発の進め方」
  https://claude.ai/artifact/XeAnCSwZUrejZhzx5a7BxV 。1.8.0 の外注もこれに沿う
- 次: ROADMAP の 2 (1.8.0: quantreg の `rq`・geepack・glmnet)

### 1.8.0 の計画 (ユーザーの決定 2026-11-20: rq・GEE・glmnet を**まとめて 1.8.0**)

- **範囲 (ユーザーの決定 2026-11-20 夜、セッション 26):** 私の案より広く
  - rq: 私の案 + **summary の boot** (R の乱数列まで合わせる)
  - GEE: 私の案 + **ユーザー定義の作業相関 (`zcor`/`fixed`)・jackknife 分散** (「広く」)
  - glmnet: 私の案 + **multinomial** (grouped を含む)。cox は後回し
  - 置き場所: **`/regression` に足す**
- **順:** rq → GEE → glmnet (私の推奨。rq は他に依存せず線形計画法の基盤を先に固める、GEE は `glm` の部品で進めやすい、
  glmnet は R との合わせ込みが一番重い)。**範囲は新しいセッションの最初にユーザーと決める。** 私の案:
  - rq: `br`・`fn`、複数の τ、`summary` の rank・iid・nid・ker、`predict`、`anova` (boot は乱数まで合わせるのが重く後回し)。
    解が一意でない場合にどの解を返すかを決める
  - GEE (`geeglm`): gaussian・binomial・poisson・Gamma、作業相関 4 種 (独立・交換可能・AR(1)・無構造)、サンドイッチ分散、
    `summary`・`anova` (Wald)・`predict`
  - glmnet: gaussian・binomial・poisson (multinomial・cox は後回し)、λ の経路、`coef`・`predict`、`cv.glmnet` は `foldid`
    固定で比べる。既定の収束がゆるい (1e-7) ので fitTight と同じ工夫
  - 3 つとも GPL: これまでどおりクリーンルーム (公開の論文 (Koenker、Liang と Zeger、Friedman ら 2010) と出力だけ)
- **進め方** (1.7.0 の経験と Claude Docs の「ChatGPT を外注先に使う開発の進め方」に沿う):
  1. 準備 (私): `oracle/Dockerfile.experiments` に quantreg・geepack・glmnet、`scripts/r-experiment-check.mjs` に関数の
     一覧。R の実験・oracle・fixture を先に多めに作る。指示書に推奨つきの決定
  2. 実装 (ChatGPT、1 パッケージずつ): 仕様書 → 実装 → CI 緑。数値の点検は私が独立の計算で
  3. **端の入力と桁落ちの点検を最初から指示書の受け入れの条件に入れる** (尺度 1e±100、10 万件、NaN と Infinity、縮退、
     重みの定数倍、配列を引数に展開しない)。1.7.0 では最後にまとめてやって不具合が 4 つ見つかった
  4. 文書・デモ・日本語の訳 (ChatGPT)、取り込みと公開 (私)。1.7.0 と同じ
- 分野は `/regression` に足すか新しい分野にするかも、最初に決める (私の案: `/regression` に足す)

## 次のセッションで最初にやること: 1.7.0 の段階 3 (セッション 25 → 26、2026-11-20 朝に作成)

### セッション 25 でしたこと (2026-11-20)

- **nls の段階 1・2 は完了** (ChatGPT、`work/regression` の `1ce40ac0`〜`d36a5cf7`、Issue #540 に報告)。ChatGPT は途中で
  会話がタイムアウトし、新しい会話で再開した (入口は `briefs/regression-1.7-status.ja.md` と `briefs/nls-1.7.ja.md`、
  途中経過は Issue #540)。新しい会話で一度「手元の環境がない」と止まった → 「GitHub に直接 push し、PR #541 の CI を
  テストの代わりに」と伝えれば進む
- **私の数値の点検:** 収束する 19 case で係数は fitTight と相対 1e-8、標準誤差 5e-8、anova は 1e-9。プロファイル区間は
  rStats.js が正確な根 (独立の数値微分 LM + 二分法と 2.6e-11)、R は補間で最大 4.7e-3 ずれる
  (`experiments/regression-nls-profile-check.mjs` と `.out.txt`)
- **ユーザーの決定:** Decisions は推奨どおり。choices 9 項目を私が書いた (`43a90e2e`)
- **テストを私が直した** (`b8d9110f`): ChatGPT の SE の許容幅は「R の既定と fitTight の差 × 1.05」で緩すぎた → fitTight と
  相対で厳しく。根の条件を確かめるテストが `8519433a` で消えていた → 端ごとに port の上下限を等しくして当て直し、
  逸脱度の増分が $\hat\sigma^2 F$ と 1e-6 以内、R とは 1e-2 以内
- 生成物は済み (`fc7a6e38`)。生成物の検査の 4 件の失敗はこれで消える
- **見つけた不具合 (ChatGPT に頼む、ユーザーの決定。段階 3 の結果とまとめて 1 つの依頼に):** `scaleOffset: 1` だと残差 0 の
  データ (`exact-scaleOffset`、`error-exact-fit` と同じデータ) で 1 回早く止まり、完全一致と判定されず SE 1e-12 を返す。
  勾配の判定の尺度 $\sqrt{RSS} + \text{scaleOffset}$ (`src/models/nls.ts:449-451`) が原因。直ったら choices 6 の
  scaleOffset の文と、`test/nls.test.ts` の `exact-scaleOffset` の除外を私が書き直す

### 段階 3 の結果 (2026-11-20 昼、`work/regression` の `aded7c0e`)

- ChatGPT が A〜C の大半をした (polr 284 秒 → 3.3 秒、rlm MM の尺度の同変性、rlm の直線、nls の負の底の冪・atan・pi・
  左辺の式・NIST の fixture `test/fixtures/nls-stage3.json`)。ただ **nls の収束判定は CI だけを頼りに閾値を行き来して
  壊した** (既存のテストが 18 件落ちた)。**ユーザーの指示で私が引き継いだ** (`43bb4c64`): 「小さな段 + (勾配が小さい
  または予測される下がりが目的関数の丸め以下)」で収束、止まるときに最後の全段を 1 回試す。目的関数の差だけで止めると
  係数が $\sqrt\varepsilon$ 程度しか合わない (Puromycin が 1.6e-6 ずれた) ので不可。ChatGPT の NIST の転記の誤り 2 つ
  (Lanczos1 の y[22]、Roszman1 の b4) を直した
- 私が見つけて直した回帰: ChatGPT の rlm の直しが `Math.max(...列)` で n ≈ 1e5 からスタックあふれ (nls の自己開始にも
  以前から同じ形)。`aded7c0e`、15 万件のテストつき
- choices (`4f10581f`): nls 6 を改め (scaleOffset は判定だけ、2 つの完全一致の case は同じ答え)、nls 10 (残差ほぼ 0)・
  11 (atan・asin・acos・pi・左辺の式)、rlm 12 (過半数が直線上)
- NIST StRD: R が解ける題は全部、既定の設定で 8.6 桁以上 (Lanczos1 は 10.6、R は失敗)
- **残り (直していない、記録だけ):** nls で x × 1e100 と y × 1e-100 を同時に、SSlogis で x × 1e-100 (1e±20 までは通る)。
  rlm の x × 1e-200 (正規方程式の下位桁あふれ)。rlm M の 1000 水準の因子 (n = 3000) が 136 秒。rlm MM の外れ値 49% は
  n = 100・p = 2 の崩壊点ちょうどで外れる (全数探索でも)。Issue #540 には私の引き継ぎをまだ書いていない
- 次: 下の「nls の後」の配線と文書。ChatGPT に頼むなら、入口は `briefs/regression-1.7-status.ja.md` と HANDOFF のこの節

### 段階 3 の端の入力の点検 (セッション 25 で済み)。ChatGPT に新しい会話で依頼した

- 指示書 `work/regression` の `briefs/regression-1.7-stage3.ja.md` (`7f7e40b8`)。証拠は `experiments/regression-stage3-edge.*`、
  `regression-nls-strd.*` (NIST StRD 26 題、データは NIST から取る)、`regression-polr-scale.*`、`regression-edge-r.*`
- 直す 10 項目: nls の底が負の冪の微分 (`x^2` で x < 0 が落ちる、重い)、残差ほぼ 0 の収束判定 (scaleOffset の不具合と
  Lanczos1)、rlm MM の S の尺度の絶対閾値 (y × 1e-8 から崩れる)、polr が R の 100〜300 倍遅い、rlm の直線上の点、
  nls・polr の尺度への強さ、rlm MM の探索の予算、nls に atan・asin・acos・pi、nls の左辺の式
- **ユーザーの決定 (2026-11-20):** rlm で過半数がまったく直線上 → 直線・尺度 0・収束の扱い・推論は NaN と警告。
  nls に逆三角関数と左辺の式を足す。**この 2 つと nls の `scaleOffset` の直しは、報告が来たら私が choices に書く**
  (rlm の choices と nls の choices 6 と 10 以降)
- 報告が来たら: pull、型チェック、テスト、端の入力のスクリプトを流し直して前後を比べる、choices の差分を見出しから比べる、
  生成物 (atan などでオプションは増えないはず)。次は「nls の後」の配線と文書

## 次のセッションで最初にやること: 1.7.0 の続き (セッション 24 → 25、2026-11-19 深夜に作成)

### 今の状態

- **作業ブランチ `work/regression`** (main から分岐、`891dbdb6` 以降)。**draft の PR #541** (`work/regression` → main、
  **マージしない**。CI を回すためだけ)。**Issue #540** (`ROADMAP 1: 回帰 (polr・rlm・nls)`)。main は `d4d23168` 以降
- **polr は完了** (`polr`・`polrSummary`・`polrVcov`・`polrPredict`・`polrConfint`・`polrAnova`)。仕様書
  `oracle/polr-behaviour.md` の choices 13 項目。R との既知の違い: choices 12 (MASS の cauchit は標準コーシーのモデルで
  ない)、13 (MASS の `predict` は newdata の offset を無視する)、空の水準と入れ子でない anova はエラー
- **rlm は完了** (`rlm`・`rlmSummary`・`rlmVcov`・`psiHuber`・`psiHampel`・`psiBisquare`)。仕様書
  `oracle/rlm-behaviour.md` の choices 11 項目。公開の出力から突き止めて R に合わせたもの: 共分散は Huber (1981) の
  式 (§7.1、重みつきも)、MAD の定数 0.6745、Proposal 2 の $n-p$、S の尺度 ($n-p$、$c = 1.548$)、LTS の
  $h = \lfloor n/2\rfloor + \lfloor (p+1)/2\rfloor$。R の exact の S (`lqs(nsamp = "exact")`) は、係数が改善前・
  残差と尺度が改善後で、改善後は rStats.js の S と同じ。`rlm(method = "MM")` は `nsamp` を使わない (乱数しだい)。
  MM と LTS は決定的 (既知の違い)、MM とケースの重みはエラー (既知の違い)。証拠は `experiments/regression-rlm-*`
- **nls は ChatGPT が作業中** (新しい会話、2026-11-19 深夜に依頼)。指示書 `work/regression` の
  `briefs/nls-1.7.ja.md` の 6 節 1〜7 を 1 つの依頼で: 仕様書 → 式の解析と微分 → 当てはめ (既定・plinear・port) →
  付属の関数 → エラーと境界 → CI が通るまで。**oracle `oracle/nls.R` と fixture `test/fixtures/nls.json` は私が書いた**
  (29 case、`fitTight`、anova、自己開始モデル 10 個の値と勾配)。ユーザーの決定: 式は文字列で渡す、範囲は全部
  (添字つきのパラメータは除く)。小さな判断は指示書 3 節の推奨で進めさせている
- CI は (Mac だけで落ちる `test/issue179.test.ts`・`test/issue513.test.ts` を除き) 緑の状態にしてある。新しい関数や
  オプションが入ると、生成物の検査 (`test/unknownOptions.test.ts`・`test/rIndexDoc.test.ts`) が落ちる → 私が作り直す
- 未追跡の `oracle/extreme-parameters-behaviour.md` は以前からあるもので、触らない

### ChatGPT から報告が来たら (nls)

1. pull して、**型チェックを省かずに** `npm run -s typecheck` と `npx vitest run test/nls*.test.ts`。CI は
   `gh pr checks 541`
2. **数値の点検** (私にしかできない。いちばん価値が高い): テストが同じ物差しで比べているか、R と違う所はどちらが
   正しいか。手の確かめは、`npx esbuild src/entries/regression.ts --bundle --format=esm --platform=node --outfile=<tmp>`
   で一時的にバンドルし、普通の JS で fixture と比べる (前のセッションの補助スクリプトはジョブの tmp にあり、消えている)。
   R で確かめたいときは、公開の関数だけの R を `scripts/r-experiment-check.mjs` に通して
   `docker run --rm -v "$PWD":/w -w /w rstats-oracle-amd64:4.6.2 Rscript --vanilla <file>.R`。証拠は
   `experiments/` に `.R` と出力を残してコミットする
3. 仕様書の Decisions をユーザーに聞き、`oracle/nls-behaviour.md` の「rStats.js's choices」を**私が**書く
4. 生成物を作る: `node scripts/option-keys.mjs --write`、`node scripts/r-index.mjs > docs/r-functions.md`、
   `docs/ja/r-functions.json` に新しい関数の日本語の説明を足し (**キーの順の位置に 1 行ずつ差し込む。整形し直さない**)、
   `node scripts/r-index.mjs --ja > docs/ja/r-functions.md`。ChatGPT が手で書いた `import { checkOptions }` や `*_KEYS`
   が生成のブロックと二重になっていたら消す

### nls の後 (1.7.0 の公開まで。手本は `briefs/release-1.6.ja.md`)

- **分野 `/regression` の配線:** package.json の `exports` に `./regression`、`scripts/bundle.mjs` と
  `scripts/size.mjs` の分野の一覧に `regression`、デモ (`demo/app.js` が `dist/regression.js` も読む)、
  `test/demo.test.ts` の scope (`docExamples.test.ts` とカテゴリの一覧は済み)。ルートの export と `dist/rstats.js` には
  入れない (`/mixed` と同じ)
- **文書:** `docs/differences-from-r.md` (英・日) に既知の違いをまとめる (polr の cauchit・offset・空の水準・入れ子で
  ない anova、rlm の MM と LTS の決定性・MM とケースの重み、nls の分)、CHANGELOG、ROADMAP (英・日) の項目 1 を済みに、
  README (英・日) の Status、`llms.txt`、API リファレンスと日本語版 (`docs/ja/api/*.json`: extract → stale を訳す)、
  デモの例 (`demo/examples.json` は**詰めた書式を崩さない**)、`docs/performance.md` の大きさ
- **段階 3 の端の入力の点検** (私が手元で一括): 尺度 1e±100、水準 2 つ・数千、外れ値の割合が 50% 近く、完全分離に近い
  順序データ、nls の悪条件の問題。直しは ChatGPT にまとめて頼む
- **取り込み:** `experiments/` を含めない PR を別に作って main へ (PR #541 は閉じる)。バージョン、タグ、npm の公開
  (公開の前にユーザーに確認する)

### 保留 (ユーザーの判断待ち)

- MASS の `predict` が newdata の offset を無視するのが意図か不具合か: **ユーザーが別の repo で調べている** (私はソースを
  見ないので、渡した文書の結果だけを聞く)。結果で `docs/differences-from-r.md` の書き方を決める
- MASS に報告するか (cauchit、offset、`rlm` の MM が `nsamp` を使わない、exact の S の係数と残差の食い違い): 未定

### 進め方 (ユーザーの指示、2026-11-19。記憶の feedback-chatgpt-fewer-round-trips)

- トークンと往復を減らす。ChatGPT は PR #541 の CI を自分で読んで直す。依頼はまとめる (並行できる作業は 1 つの依頼に)、
  依頼文は短く (規則の全文は `briefs/regression-1.7-status.ja.md`、依頼文には要点 2〜3 行。毎回の要点は省かない)
- R の実験と oracle は私が先に多めに作る (ChatGPT の oracle の誤りの直しで往復が増えたため)
- ChatGPT の会話が長くなったら新しい会話に移す。入口は `briefs/regression-1.7-status.ja.md` と指示書
- **ChatGPT が choices を書き換えることがある** (rlm で 1 回、根拠の記録が消えた)。報告のたびに choices の節の差分を
  見出しから全部比べる: `diff <(git show <前>:oracle/X-behaviour.md | sed -n "/^## rStats.js.s choices/,\$p") <(sed -n "/^## rStats.js.s choices/,\$p" oracle/X-behaviour.md)`
- ChatGPT は検索で GPL のソースの抜粋を計 2 回見た (ユーザーはそのまま進めると判断)。報告に出たらユーザーに聞く
- 私の誤った指示が 3 回あった (cauchit を「誤り」と言った、S の係数の一致を求めた、R の残差から計算した値を係数の値と
  言った)。**R の値を「正しい参照」と思い込まず、独立の計算で確かめてから指示する**

## 以前の「最初にやること」: 1.7.0 の回帰の始め (2026-11-19 に作成、セッション 23 → 24。セッション 24 で準備は済み)


ユーザーの決定 (2026-11-19): ROADMAP の「その後」から回帰を選び、2 つの版に分ける。
- **1.7.0:** 順序ロジスティック回帰 [MASS `polr`]、非線形回帰 [`nls` と自己開始モデル]、ロバスト回帰 [MASS `rlm`]
- **1.8.0:** 分位点回帰 [quantreg `rq`]、GEE [geepack]、正則化回帰 [glmnet]
- 理由: 1.7.0 の 3 つは最尤法・反復重み付き最小二乗法の延長で `glm` の仕組みを生かせ、照合先が R 本体と MASS (推奨
  パッケージ) に収まる。1.8.0 の 3 つは線形計画法・座標降下法・作業相関で、R との合わせ込みが重い

### セッション 24 で決めたこと・したこと (2026-11-19)

- **ユーザーの決定:** R の実行は (b) (私が手元でまとめて流し、ChatGPT は R を実行しない)。範囲は下の「最初に
  ユーザーと決めること」の 2 の案を全部。入口は新しい分野 `/regression` (`/mixed` と同じくルートと `dist/rstats.js` に
  入れない。package.json・bundle.mjs・size.mjs・デモ・demo.test/docExamples.test の scope の配線は段階 2 の後に私がする)
- ROADMAP (en, ja) の Remaining を 1 = 1.7.0、2 = 1.8.0、3 = その後 に書き換えた
- `oracle/Dockerfile.experiments` に MASS 7.3.66 の版の確認 (手元で build 済み)。`scripts/r-experiment-check.mjs` に
  MASS と stats の nls・自己開始モデルの呼ぶだけの一覧、`fit$psi`・`fit$m`・`unclass` の禁止、`psi = psi.huber` の
  形だけの例外
- 指示書 `briefs/regression-1.7.ja.md` (R を実行しない形の 3 節、1.6.0 の誤りを足した 4 節)
- 最初の R の出力: `experiments/regression-{polr,rlm,nls}.R` と `.json` (`rstats-oracle-amd64:4.6.2` で実行。
  `docker run --rm -v "$PWD":/w -w /w rstats-oracle-amd64:4.6.2 Rscript --vanilla <file>.R > <file>.json`)。
  main ではなく作業ブランチ `work/regression` に置く予定
- 分かったこと: housing の cauchit は R の既定の初期値が失敗する。`rlm` の MM は乱数の種で係数が変わる (S 推定の抽出)
- **済み:** main `35cb10c5` (準備、CI 通過)、`work/regression` `9303c499` (最初の R の出力)、Issue #540
  `ROADMAP 1: 回帰 (polr・rlm・nls)`。ChatGPT への最初の依頼文 (`polr` の仕様書と `oracle/polr.R` だけ) をユーザーに
  渡した。**次:** ChatGPT の段階 1 の報告を待つ。「実験の依頼」が来たら、検査を通して `rstats-oracle-amd64:4.6.2` で
  まとめて流し、`experiments/<名前>.out.txt` を push する。Decisions はユーザーに聞く
- **polr の段階 1 (2026-11-19):** ChatGPT が `oracle/polr-behaviour.md` (`42ebe17d`) を書いた。数値は R の出力と照合して
  合っていた。数式が `$` でない (直しを依頼)。検索結果に MASS のソースの抜粋が出たと報告 → ユーザーはそのまま進めると
  判断。追加の実験 6 件は私が `experiments/regression-polr-2.R`・`.json` で流した。Decisions は全部推奨どおり +
  「観測 0 件の応答の水準はエラー」(R は意味のない有限値を返す)。choices を書いて push (`1ead80e7`)。ChatGPT に
  数式の直しと `oracle/polr.R` を依頼した → 来たら `npm run oracle -- polr` で fixture を作って push
- **polr の段階 2 の途中 (2026-11-19 夕):** `work/regression` に当てはめ・`polrSummary`・`polrVcov`・テストの最初の区切り。
  分かったこと:
  - MASS の cauchit は標準コーシーのモデルではない (choices 12、ユーザーの決定で既知の違い)
  - R の既定の当てはめは止まるのが早い (fixture に `fitTight`)
  - rStats.js は解析的な微分と Newton の仕上げで、`fitTight` と 8e-8 以内
  - Newton の Armijo の条件が丸めで止まる不具合は、私が見つけて直させた

  ChatGPT は**新しい会話**に移る。入口は `work/regression` の `briefs/regression-1.7-status.ja.md` (次の手順・手元の
  結果・規則)。手元の比べ方のスクリプトはジョブの tmp にあり、消える。fixture と比べるなら書き直すか、
  `test/polr.test.ts` を流す
- **2026-11-19 夜の状態 (`work/regression` `0f60b75f`):**
  - **polr の段階 2 は完了** (6 関数、テスト 55 件)。照合で見つけた MASS の不具合 2 つは、R との既知の違いにした
    (choices 12 cauchit・13 newdata の offset、ユーザーの決定)。offset の件は、ユーザーが別の repo で
    意図か不具合かを調べている (私はソースを見ない)
  - **rlm は段階 1 が完了** (choices 11 項目: MM と LTS は決定的、共分散は Huber (1981) の式で R と全桁一致。
    これは私が公開の出力から突き止めた)。**段階 2 は区切り 1 の途中:** MAD の定数 0.6745 と収束の判定を直させた。
    `test/rlm.test.ts` は二重の宣言で今はコンパイルできない
  - ChatGPT は再び新しい会話に移る。入口は `briefs/regression-1.7-status.ja.md` (`0f60b75f` で更新済み)
  - ChatGPT は今回の 2 つの会話で計 2 回、検索結果に MASS のソースの抜粋を見た。ユーザーはどちらもそのまま進めると
    判断した。依頼文では、関数名・パッケージ名を検索語に入れないよう指示している
- **2026-11-19 深夜の状態 (`work/regression` `891dbdb6`):**
  - **rlm も完了。** 公開の出力から突き止めて R に合わせたもの: MAD の定数 0.6745、Proposal 2 の $n-p$、S の尺度
    ($n-p$、$c=1.548$)、LTS の $h=\lfloor n/2\rfloor+\lfloor (p+1)/2\rfloor$。R の exact の S は、係数が改善前・残差と
    尺度が改善後で、その改善後は rStats.js の S と同じ。`rlm` の MM は `nsamp` を使わない。どれも choices 1・11 と
    `experiments/regression-rlm-*`
  - **進め方を変えた** (記憶の feedback-chatgpt-fewer-round-trips): draft の PR #541 で CI を回し、ChatGPT が自分で
    結果を読む。生成物は私が作って CI を緑にしてある。nls は oracle と fixture を**私が書いた** (`oracle/nls.R`)。
    ChatGPT には `briefs/nls-1.7.ja.md` の 1 つの依頼で、仕様書から CI が通るまで頼む (新しい会話)
  - ユーザーの決定 (nls): 式は文字列で渡す、範囲は全部 (添字つきのパラメータは除く)
  - 残り: nls、配線 (exports・bundle・size・デモ)、文書 (differences-from-r ほか)、取り込みの PR (`experiments/`
    を除く)、公開
- **注意:** 新しい `work/**` ブランチの最初の push では、R の実験のワークフローが追跡中の `experiments/*.R` を全部
  流す (比べる前のコミットがないため)。今回は main にある `mcnemar-siglevel-boundaries.R` が閉じた #527 にコメントを
  書いた (ユーザーの許可で削除済み)。ワークフローは直していない (頼まれていない)

### 状態

- npm latest = 1.6.0。main = `a52306bb` 以降、CI 通過。ブランチは main だけ (ユーザーの許可で全部消した)。開いている
  Issue はない。未追跡の `oracle/extreme-parameters-behaviour.md` は以前からあるもので、触らない
- ROADMAP の Remaining はまだ「その後 (順不同)」の一覧のまま。1.7.0/1.8.0 の分け方を書くのは次のセッションの最初でよい

### 進め方 (ユーザーの指示: トークン節約、ChatGPT を最大限使う)

- **仕様と実装は ChatGPT** (照合先はどれも GPL。クリーンルーム。依頼文に毎回規則の要点を書く: 記憶の
  feedback-chatgpt-request-cleanroom)。私は仕組み・fixture・テストの実行・点検・文書・取り込み・公開
- **R の実行はまとめて行う** (ChatGPT の Actions の R は 1 本ごとの待ちが長く、R 自身の不具合を追い始める)。次の
  どちらかにする。最初にユーザーと決める
  - (a) ChatGPT に「必要な R の実験を全部 1 本のスクリプトに」まとめさせ、1 回だけ流す (Actions か私の手元)
  - (b) 私が手元で、仕様を書くのに要る R の出力をまとめて作り、ChatGPT に渡す (公開の関数だけの R を
    `scripts/r-experiment-check.mjs` に通し、`rstats-oracle-amd64:4.6.2` で流して JSON に)
- 段階 3 (数値の点検) と端の入力の点検は私が手元で一括でする (1.6.0 の手順: HANDOFF のセッション 23 の
  「1.6.0 で分かったこと」)。見つかった直しは R の要らない小さな依頼にして ChatGPT に 1 回 1 項目で
- ChatGPT は長い返答でストリームのエラーが出る。依頼は「1 回の返答で 1 項目、数行で報告して止まる」と書く。新しい会話に
  引き継ぐときは、現状の要約のファイル (`briefs/<名前>-status.ja.md` の形) をリポジトリに置き、依頼文を短くする

### 最初にユーザーと決めること

1. R の実行のまとめ方 ((a) か (b))
2. 範囲: `polr` (method の logistic・probit・cloglog・loglog・cauchit、`summary`・`predict`・`confint` (profile)・
   `anova`)、`nls` (アルゴリズムの default・plinear・port、自己開始モデル `SSlogis`・`SSmicmen`・`SSasymp` など
   どこまで、`summary`・`predict`・`confint` (MASS の profile))、`rlm` (Huber・Hampel・bisquare の psi、M 推定と
   MM 推定、`summary`)
3. 入口: 新しい分野 (`/regression` など) にするか、`glm` と同じ入口 (`src/entries/tests.ts`) に入れるか。全部入りの
   大きさ (322 KB) に効く。名前は `polr`・`nls`・`rlm` と付属の関数 (前例: `confintRma`、`predictCrr`)

### 外注の準備 (決まったら)

- `scripts/r-experiment-check.mjs` の `ALLOWED_PACKAGES` に MASS、`REFERENCE_FUNCTIONS` に MASS の公開関数
  (`getNamespaceExports("MASS")` から、R 本体と名前が重ならないもの。1.6.0 の lme4 と同じ作り方、`13e8d1f5`)。
  `nls` は stats なので許可済み。`print(nls)` などで本体が見えないよう、stats の `nls`・`selfStart` 系も
  「呼ぶだけ」の一覧に入れるか検討する
- `oracle/Dockerfile.experiments` は MASS が推奨パッケージで入っているはず。版を確かめる層を足す
- 指示書 `briefs/regression-1.7.ja.md`。手本は `briefs/mixed-1.6.ja.md` (4 節の直しが入った点に、1.6.0 の
  「ChatGPT の誤り」を足す)

## 以前の「最初にやること」: 混合モデルの続き (2026-11-17 に作成。1.6.0 で済み)

ユーザーの指示: 次のセッションで ROADMAP の 1 番「混合モデルの続き」を始める (1.6.0 の予定)。

### 状態

- npm latest = **1.5.0** (2026-11-17 公開)。main = `03a8bb9f` 以降、CI 通過。作業ブランチは 1 本もない。未追跡の
  `oracle/extreme-parameters-behaviour.md` は以前からあるもので、触らない
- 1.5.0 の後に main に入った変更は、この HANDOFF だけ (CHANGELOG の Unreleased は空)

### 中身 (ROADMAP の 1 番)

- `lmer` と `glmer` の当てはめの `confint` (profile likelihood) と `simulate` [lme4]
- 照合先: **lme4 2.0-6** (GPL ≥ 2。oracle のイメージ `rstats-oracle:4.6.2` に入っている。CRAN の日付 2026-10-23)。
  `lmerTest` 3.2-1 も入っている
- 混合モデルの分野 (`/mixed`、`src/entries/mixed.ts`) は、引き続きルートの export と `dist/rstats.js` に入れない
  (2026-11-05 の決定)。新しい関数も `/mixed` から export する
- 今あるもの: `lmer`・`lmerSummary`・`lmerContest`・`lmerAnova` などと `glmer`・`glmerSummary`・`glmerAnova`・
  `glmerPredict`。仕様書は `oracle/lmer-behaviour.md`・`glmer-behaviour.md`・`lmertest-behaviour.md`。fixture の
  oracle は `oracle/lmer*.R`・`glmer*.R`・`mixedpredict.R`。プロファイル化した逸脱度は `src/models/mixedDeviance.ts`

### 最初にユーザーと決めること (着手の前に聞く)

1. 範囲: `confint` の方法 (lme4 の `method` の `"profile"` だけか、`"Wald"`・`"boot"` も入れるか)、`profile()` そのもの
   (プロファイルの表) を公開するか、`lmer` と `glmer` の両方か、glmer の AGQ (`nAGQ > 1`) の当てはめにも対応するか
2. `simulate`: R の乱数の流れまで lme4 と同じにするか (rStats.js は R の乱数を再現している。`setSeed`・`rnorm` など)。
   `newdata`・`re.form`・`use.u` などのどこまでを入れるか
3. 名前: 方法の関数は `predictCrr`・`confintRma` の前例どおり `confintLmer`・`simulateLmer`・`confintGlmer`・
   `simulateGlmer` などにするか

### クリーンルーム (重要)

- lmer・glmer は 2026-10 末〜11 月初め、「R のソースを読んでよい」とされていた時期 (2026-10-24〜11-09) に作った。
  そのころの私 (Claude のセッション) が lme4 のソースを見た可能性がある。**今回の仕様と実装はすべて ChatGPT に任せ**、
  私は仕組みの面倒・fixture の生成・テストの実行・独立の検算・文書・取り込みだけをする
- 誰も lme4・Matrix・lmerTest と R のソースを読まない。ChatGPT への依頼文には、**毎回クリーンルームの規則の要点を書く**
  (ユーザーの指示。記憶の feedback-chatgpt-request-cleanroom)
- ChatGPT は 1.5.0 の作業中に 2 回、ウェブ検索の結果一覧で照合先のソースの抜粋を目にした (使っていない。ユーザーは
  そのまま進めると判断した)。報告に出たら、ユーザーに判断を仰ぐ

### 進め方 (1.5.0 のサンプルサイズ・メタアナリシスと同じ)

1. ユーザーと上の 1〜3 を決める
2. 外注の準備 (main に push。ワークフローは main の版の検査と Dockerfile を使う):
   - `oracle/Dockerfile.experiments` に lme4 の層を足す (版の確認つき: lme4 2.0.6、Matrix 1.7.6)。lme4 が要る
     システムのライブラリがあれば足す (epiR のときは GDAL などが要った)
   - `scripts/r-experiment-check.mjs` の `ALLOWED_PACKAGES` に lme4 (と Matrix)、`REFERENCE_FUNCTIONS` に lme4 の公開
     関数 (`getNamespaceExports` から、英数字と `.`・`_` だけの名前)。`print(lmer)` が止まり、`lmer(...)` が通ることを
     手元で試す
   - 指示書 `briefs/mixed-1.6.ja.md`。`briefs/meta-analysis.ja.md` を手本にし、その 4 節 (直しが入った点) に下の
     「1.5.0 で分かったこと」を足す
3. ChatGPT に段階 1 (仕様書 `oracle/<名前>-behaviour.md` と `oracle/<名前>.R`) → 私が `npm run oracle` で fixture を
   作って push → Decisions をユーザーに聞いて choices を書く → (範囲が広がれば段階 1 の追加) → 段階 2 (実装・PR) →
   私が手元で全テスト → 段階 3 (数値の点検。**忘れない**) → 取り込み → 公開の準備 (`briefs/release-1.5.ja.md` が手本)
4. 依頼文は毎回、基準のコミットを書き、`git log -1` で確かめさせ、クリーンルームの要点を入れる

### 1.5.0 で分かったこと (指示書と点検に生かす)

- **ChatGPT はテストを実行できない。** 各段階の後に私が手元で型チェックと全テストを流し、失敗の一覧を返すと早い
  (Issue へのコメントはユーザーに確認してから)。テストを実行できないことを理由に止まったら「push して CI と私の
  結果で確かめればよい」と伝える
- **ChatGPT がよくする誤り:** oracle の記録する引数と呼び出しの食い違い、rStats.js を自分自身と比べるだけのテスト、
  表の先頭と末尾だけの比較、許容誤差を広げて通す (2% や 0.0012。反復の止め方の違いなら真の根を高精度で求めて
  比べさせる)、`@category` を既存の合わないものにする (新しい分野ならカテゴリの一覧に足させる)、JSON ファイルを
  丸ごと整形し直す (`demo/examples.json` の詰めた書式が崩れた。元の書式に新しい例だけを足し直した)、文字列の `\n` を
  本物の改行にする、触らない約束の文書 (`docs/differences-from-r.md`・CHANGELOG) を書き換える、デモに R との違いと
  決めた所を使う、R の誤りを「異常」としながら正しい値を疑う (exact2x2 の `errbound = 0`)
- **私が独立に確かめると効く:** 正確な値を有理数 (`fractions`) で計算する (McNemar)。桁落ちの説明 (lgamma の差の ulp)
- **oracle の注意:** R がメモリを使い果たす入力は外す (metafor の `vi = 1e300` の REML)。モデルのオブジェクトを JSON に
  書くと C のスタックがあふれるので入力だけを書く。npm run oracle はエラーで止まっても 0 で終わることがある
  (出力された fixture の数を確かめる)
- **並行の push:** 私が直している間に ChatGPT が同じブランチに push することがある。ChatGPT を止めてもらってから直す
- **CI の時間の上限:** `test/distributionProperties.test.ts` の `dsignrank(302775, 1100)` が遅い機械で 1 秒を超えて
  落ちることがある。再実行で通る
- **用語:** sample size は「標本サイズ」(用語集)。訳の後に用語集と照らす
- **サイズの測り方:** 表は `npm run size`。本文の分野ごとの転送量は、`dist/<分野>.js` から import をたどった chunk の
  gzip (level 9) の合計 (1.5.0: special 39 KB、tests 288 KB)。単一ファイルは表の「すべて」の値
- **公開:** タグ (注釈なし) の push → release.yml が npm に stage → ユーザーが SSH の対話端末で
  `npm stage approve <stage id>` (2FA はセキュリティキー。Claude の Bash からは EOTP で失敗)。デモ・Pages はタグから作る
- **Bash の自動の許可:** ブランチの削除は、ユーザーがその場で頼んだときだけ (まとめて実行すると止められる)

## セッション 23 の記録 (2026-11-17〜19、Mac mini): 混合モデルの confint と simulate (1.6.0、公開済み)

### 1.6.0 を公開した (2026-11-19)

- npm latest = **1.6.0** (stage id `7ee53283-...` をユーザーが `npm stage approve` で承認)。tag `v1.6.0` = `a37b38a2`
  (release がビルドの結果入りに付け替えた)、main = `34a9908f`。確かめたもの: jsDelivr (npm と gh の `dist/rstats.js`・
  `dist/mixed.js`)、デモ (VERSION v1.6.0)、`/api/` と `/ja/api/` の新しい関数のページ (日本語の訳が出る)
- 中身: PR #537 (実装)、PR #539 (文書・デモ・日本語の API)。Issue #535・#538・#522 (1.4.0 の閉じ忘れ) は閉じた。
  開いている Issue はない
- **次の作業は未定。** ROADMAP の Remaining は「その後 (順不同)」の一覧だけ。ユーザーと決める
- **消してよいか未確認のブランチ:** `work/mixed` (実験のスクリプト入り)、`work/mixed-pr`、`work/mixed-stage2-pr`、
  `release/1.6.0-docs` (取り込み済み)、前からの `work/samplesize`・`work/samplesize-pr`。消す前にユーザーに確認する
- release.yml の `npm test` が `dsignrank(302775, 1100)` の時間 (1086 ms) で落ちた。`gh run rerun <id> --failed` で通った

### 1.6.0 で分かったこと

- **ChatGPT の R の実験は遅い** (Actions の待ちが長く、R 自身の不具合の原因を追い始める)。段階 3 と端の点検は私が手元で
  行った: 公開の関数だけの R のスクリプトを `scripts/r-experiment-check.mjs` に通し、`rstats-oracle-amd64:4.6.2` で
  流して JSON に書き、`npm run build` の `dist/mixed.js` を読む普通の JS で比べる (`npx -y tsx` は自動の許可で止められる)。
  ChatGPT には R の要らないコードの直しだけを頼むと速い
- **ChatGPT の誤り (今回も):** oracle で指定しない引数を `NULL` で明示的に渡す (`use.u` だけのつもりが `re.form = NULL`
  も渡り、R がエラー)、`demo/examples.json` の整形し直し、テストの型エラー・`describe` の中の `await`、REML の推定値を
  profile の中心と思い込むテスト
- **lme4 2.0-6 の不具合:** 部分的な `re.form` で、選ばれなかった先頭以外の項に 1 つ前の項の θ を使う。rStats.js は各項
  自身の θ (ユーザーの決定)。`docs/differences-from-r.md` の「Mixed models: confint and simulate」
- **R より正しい所 (ユーザーの方針「あえてエラーにする理由がなければ統計学的に正しい値」):** 尺度 1e±100 の profile、
  Gamma の profile (R は断る)、Gamma の当てはめ (対数尤度が R より大きい)、1e12 の offset
- **独立の検算:** profile の端は、パラメータを `offset` で固定した当て直しの `logLik` から $\zeta$ を計算して確かめられる
  (公開の関数だけ)

### 状態 (2026-11-18、記録)

- Issue #535、PR #537 (`work/mixed-pr`、実装)。R の実験は `work/mixed`。PR #536 は閉じた。現状の要約は
  `work/mixed-pr` の `briefs/mixed-1.6-status.ja.md` (ChatGPT の新しい会話の入口)、指示書は main の
  `briefs/mixed-1.6.ja.md`
- 決めたこと (choices は `oracle/mixedconfint-behaviour.md`・`mixedsimulate-behaviour.md` の末尾): `confintLmer`・
  `confintGlmer` (profile と Wald、`{ names, lower, upper }`、`level`・`parm`・`signames`、glmer の profile は
  `nAGQ = 1` だけ)、`simulateLmer`・`simulateGlmer` (`nsim`・`seed`・`useU`・`reForm`、R と同じ乱数の流れ、配列の
  配列、inverse Gaussian は未対応のエラー)
- 2026-11-18 時点: 型チェック通過、confint のテストは全部通過、simulate は glmer の部分的な `re.form` の 3 件だけ失敗。
  ChatGPT の実験で、**lme4 2.0-6 の `simulate` は部分的な `re.form` で選ばれなかった項に 1 つ前の項の θ を使う**
  (`work/mixed` の `experiments/mixed-partial-glmer-report.md`)。ユーザーの決定: rStats.js は各項自身の θ で正しい
  値にし (乱数の個数と順は R と同じ)、R との既知の違いとして記録する。lme4 へのバグ報告は今は出さない。この方針の
  依頼を ChatGPT の新しい会話に渡したところ (テストで「θ を 1 つずらすと R の値になる」ことも確かめさせる)
- 残り: 段階 2 の完了 → 私が全テスト → 段階 3 (数値の点検) → 私が `docs/differences-from-r.md`・CHANGELOG・
  ROADMAP・デモ・日本語の API → 1.6.0 の公開
- 手元で `test/issue179.test.ts`・`test/issue513.test.ts` が落ちるが main でも同じ (Mac の浮動小数点。CI では通る)
- 外注の仕組み: `oracle/Dockerfile.experiments` に lme4 2.0.6・Matrix 1.7.6、検査は lme4・Matrix の公開関数と
  `@resp`・`@pp`・`devFunOnly`・`mk*Devfun` を止める (`13e8d1f5`)

### クリーンルームの露出 (2026-11-18、記録)

- ユーザーが別の独立エージェントに lme4 のこの挙動を調べさせ、そのレポート (ReactiveStat の
  `docs/lme4_simulate_reform_bug_report_2026-11-18.md`) の URL が渡された。私 (Claude) は開く前にキーワードで調べ、
  **全文は読んでいない**。目に入ったのは当たった 3 行だけ: そのエージェントが lme4 1.1-37 のソース (CRAN の
  tarball) を読んだという記述、`lme4:::mkNewReTrms(fit, NULL, ~(1 | b))` を補集合の項に使う 1 行、こちらの
  スクリプトと同じ形の関数 1 行
- このレポートは ChatGPT に渡さない。rStats.js の対応と文書は、ChatGPT の公開の出力だけの実験 (上のレポート) を
  根拠にし、このレポートの内容 (「1.1-37 から続く」など) は使わない
- 目に入った手がかり (内部の関数で補集合の項を作る) から、実装に何も足していない

## セッション 22 の記録 (2026-11-16〜17、Mac mini)

- **1.5.0 を公開した (2026-11-17):** npm latest = 1.5.0 (stage id `8573ab61-...` をユーザーが `npm stage approve` で
  承認)、tag `v1.5.0` = `5b4e37b4` (release がビルドの結果入りに付け替えた)、main = `f785b785`。確かめたもの: jsDelivr
  (npm と gh の dist/rstats.js・tests.js・mixed.js)、デモ (VERSION v1.5.0)、/api/ と /ja/api/ の新しい関数のページ
  (日本語の訳が出る)。中身: サンプルサイズ (PR #528)、メタアナリシス (PR #530)、数値の点検 (PR #532)、文書・デモ・
  日本語の API リファレンス (PR #534)、1.4.1 の分 (Gray の検定)。次は ROADMAP の 1 番 (混合モデルの続き [lme4]) の
  予定 (1.6.0、未着手)
- **トークン節約のため、外注できることはなるべく ChatGPT に外注する** (ユーザーの指示)。私は外注の仕組み、fixture の
  生成 (`npm run oracle`)、手元でのテスト、独立の検算、文書 (R との違い・CHANGELOG・ROADMAP・索引の訳)、取り込みをする
- **メタアナリシス:** PR #530 (`work/meta-pr`、Issue #529)。照合先は metafor 5.2.1 (metadat 1.6.0)、GPL。範囲は
  `escalc` (6 指標)、`rma` (11 の推定法、メタ回帰、z・t・Knapp-Hartung)、`confintRma`、`predictRma`、`regtest`
  (choices は `oracle/meta-behaviour.md`)。fixture は私が作った (R がメモリを使い果たす REML の case を外し、`rma`
  オブジェクトを入力だけで書くよう oracle を直した)。ChatGPT は 2 回ともウェブ検索で metafor のソースの抜粋を目に
  した (使っていない。ユーザーはそのまま進めると判断)。EB・PM の `se.tau2` は R の式が分からず既知の違い。PM・EB・
  区間の端は真の根と 1e-12 で比べ、R とは R の止め方の範囲で比べる
- **サンプルサイズの作業で分かったこと:** ChatGPT はテストを実行できないので、各段階の後に私が手元で全テストを流して
  返すと早い。exact2x2 の `errbound = 0` の値は不正確 (有理数の計算で確かめた)。ChatGPT はウェブ検索の結果一覧で
  exact2x2 のソースの抜粋を目にした (使っていない。ユーザーはそのまま取り込むと判断)
- **消してよいか未確認のブランチ:** `work/samplesize` (実験のスクリプト入り)、`work/samplesize-pr` (取り込み済み)。
  消す前にユーザーに確認する
- **CI の時間の上限:** `test/distributionProperties.test.ts` の `dsignrank(302775, 1100)` が遅い機械で 1 秒を超えて
  落ちることがある (2026-11-17 に 1058 ms。再実行で通った)

## 次のセッションで最初にやること (2026-11-16 に作成、セッション 21、Mac mini)

以後は **Mac mini だけで作業する** (ユーザーの指示)。

- **状態:** npm latest = 1.4.0 (2026-11-16 公開)。main = `44dc5409` 以降、CI 通過。作業ブランチは残っていない (ユーザーの許可を得て全部消した)。未追跡の `oracle/extreme-parameters-behaviour.md` は以前からあるもので、触っていない
- **未公開の変更 (1.4.1 に入る):** CHANGELOG の Unreleased。同時刻の Gray の検定の分散 (Issue #525、PR #526) と、それに伴う 2 つの Changed。**1.4.1 はほかの変更がたまってから出す** (ユーザーの判断)。出すときは下の節の 11 番 (デモのデータを戻す) を忘れない
- **次にやること: ROADMAP の Remaining の 1 番「試験デザインのサンプルサイズと検出力」** (ユーザーの指示)
  - 中身 (ROADMAP.md): 平均と比率の同等性・非劣性・優越性、McNemar 検定、生存時間 (Schoenfeld、Freedman)、Simon の 2 段階デザイン (clinfun の `ph2simon`)。**照合先の R のパッケージは着手するときに決める**ので、最初にユーザーと決める
  - 既にあるもの: `powerTTest`・`powerPropTest`・`powerAnovaTest` (R の `power.*.test`)、pwr の `pwr*` 関数。新しい関数は、これらの名前・引数・結果の形 (解く量を 1 つ未指定にする方式など) に合わせる
  - 進め方の前例は 1.4.0: 先に仕様書 (`oracle/<分野>-behaviour.md`。論文・ヘルプ・R の実行結果から書く。末尾に「Decisions for the user」と「rStats.js's choices」)、fixture (`oracle/<name>.R` → `test/fixtures/<name>.json`、`npm run oracle -- <name>`)、指示書 (`briefs/*.ja.md`) を作り、実装を外注するか自分でするかを決める。照合先のパッケージを `oracle/Dockerfile.r46` に足すときは、新しい層にする (前の層のキャッシュを保つ)。足したら arm64 と amd64 の両方のイメージを作り直す
- **外注するときの道具 (このセッションで作った):** 下の節の 10 番の R の実験の仕組み。ChatGPT が `experiments/*.R` を push すれば自分で R の出力を読める。照合先のパッケージを使うなら、`oracle/Dockerfile.experiments` と `scripts/r-experiment-check.mjs` の `ALLOWED_PACKAGES`・`REFERENCE_FUNCTIONS` に足す (main に入れてから使わせる。ワークフローは main の版の検査と Dockerfile を使う)。指示書の書き方は `briefs/gray-ties.ja.md` が最新の例
- **クリーンルーム:** 私 (このセッション) は cmprsk のソースを見てしまった (2026-11-16、Gray の検定の件。修正は取り消し、ChatGPT が出力だけから同じ式に到達した)。それ以外のパッケージのソースは見ていない。**R・GPL のパッケージのソースは読まない** (2026-11-09 からの規則。古いメモ「読んでよい」は置き換え済み)。照合先の候補 (clinfun など) が GPL なら同じ扱い
- **残っている小さな点:** 下の節の 8 番 (この Mac だけで issue179・issue513 のテストが最後の 1 ビットで落ちる。Node v24.19.0 の疑い、未調査)

## 前回 (セッション 20) の「次のセッションで最初にやること」 (2026-11-16 に作成、Windows の PC。1〜7 と 9〜11 は Mac のセッション 21 で処理)

このセッションは Windows の PC で行い、ここで終了した。以後は **Mac mini だけで作業する** (2 台で同時に作業すると混乱するため、ユーザーの指示)。Windows の側のメモリ (`~/.claude/projects/.../memory/`) は Mac にないので、必要な内容はこの節に書いた。

- **状態:** 1.4.0 を公開済み (2026-11-16、npm latest = 1.4.0)。HANDOFF の 1〜7 はすべて済み。

- **すぐにやること (順に):**
  1. **済み (Mac、2026-11-16):** PR #524 の `demo/r-results.json` を R 4.6.2 で作り直した (エラー 0)。competing-incidence-gray は Gray の検定の統計量が R と合わなかった (原因 1 のイベントが 2 群で同時刻 = 文書にある同順位の近似の場面) ので、群 B の時刻 6 を 6.5 にずらした。**このとき私 (Mac のセッション) はクリーンルームを破り、cmprsk の R 関数と crstm.f を読んで修正を書いた。修正は取り消し、ソースも消した。同順位の Gray の分散を直すなら、私以外のソースを見ていない者が論文と R の結果だけから行うこと**
  2. **済み:** equivalence-tost の R の結果は変わっていなかった (21 個の値が文字列で一致。差分は行末のカンマだけ)。イメージの TOSTER は 0.8.6
  3. **済み:** PR #524 を点検して main に squash で取り込んだ (`5361ca0`)。Issue #523 と PR #524 は閉じた。直したもの: 訳 4 件の段落の空行、ROADMAP (ja の段落、en の折り返し)、infinitesimal jackknife を「無限小ジャックナイフ」に、API リファレンスで `predictCrr` をモデル名の接頭辞の例外と明記、用語集に 7 語
  4. **済み:** 区切りの時刻の空の行は survival 3.8.3 のバグで、3.8-12 で直った (NEWS に記載)。R 4.6.2 (survival 3.8.12) は survfit にも summary にもその行を出さず、仕様書と rStats.js はそれに合っている。`oracle/coxph2-behaviour.md` の Part C と differences-from-r (en・ja) に版の違いを書いた
  5. **済み:** survreg の極端な尺度。R は `ovarian` の `age * 2^k` で 2^508 まで同じ値、2^509 から列を黙って落とし、2^-541 から収束せずエラー。rStats.js は 2^-1000〜2^1010 で同じ値、非正規化数 (2^-1050) で NaN と警告。differences-from-r (en・ja) に記載
  6. **済み (2026-11-16):** 1.4.0 を公開。main = `d6f077b` (版上げ、CHANGELOG を書き直し、サイズ: すべて gzip 312.6 KB、dist/rstats.js 312 KB、tests の分野 278 KB)、tag `v1.4.0` = `f30466d` (release が dist 入りに移した)。stage id `0cc14512-...` を、自動審査が終わるのを待って (初回は 409) ユーザーが承認。npm latest = 1.4.0、jsDelivr の dist/rstats.js・mixed.js・tests.js、デモ v1.4.0、/api/ と /ja/api/ の新しい関数のページを確認
  7. **済み:** 生存時間解析とリリース準備の作業ブランチは、ユーザーの許可を得てすべて消した (2026-11-16)
  8. **未解決 (Mac だけ):** この Mac (Node v24.19.0) で `test/issue179.test.ts` と `test/issue513.test.ts` が最後の 1 ビットの違いで落ちる (0.915656532053725 と …257、0.5000000000000001 と 0.5)。変更のない main でも同じで、CI (Ubuntu) では通る。Node の更新で数学関数の結果が変わった疑い (未確認)
  9. **済み (2026-11-16): 同時刻の Gray の検定の分散 (1.4.1 に入る、未公開)。** ChatGPT がクリーンルームで、cmprsk の公開の出力だけから式を突き止めた (Issue #525、PR #526 を `a11683d7` で取り込み)。指示書は `briefs/gray-ties.ja.md`。式は `oracle/competing-behaviour.md` 1.6 節、CHANGELOG の Unreleased に記載。fixture の case 17〜22 は 1e-12 で比較に戻った。私 (Mac のセッション) はこの件の cmprsk のソースを見ているので、仕様にも実装にも関わらず、数値の確認とテストだけをした。ChatGPT の式は、私が前に書いて取り消した修正と同じ形だった
  10. **R の実験の仕組み:** `.github/workflows/r-experiments.yml`。`work/**` のブランチに `experiments/<名前>.R` を push すると、main の `scripts/r-experiment-check.mjs` (クリーンルームの検査) を通したうえで、`oracle/Dockerfile.experiments` (R 4.6.2・cmprsk 2.2.12・survival 3.8.12、ネットワークなし) で実行し、先頭の `# issue: N` の Issue に出力をコメントする。1 本ごとにコメントが付くので、Issue の通知のメールが大量に来る (ユーザーは #525 の購読をブラウザで外した)。外注で R を使うときはこれを使う
  11. **1.4.1 を公開するとき:** デモの competing-incidence-gray を元のデータ (群 B の時刻 6) に戻して `npm run demo:r` (公開のデモは jsDelivr の公開版を読むので、公開と同時に)。作業ブランチ `work/gray-ties` はユーザーの許可を得て消した (2026-11-16)。1.4.1 はほかの変更を待ってから出す (ユーザーの判断)

- **1.4.0 の中身 (main に取り込み済み):** ROADMAP の Remaining の 1 (生存時間解析の続き)。
  - 作業 A `cfab03f4`: survfit の拡張 (weights・ctype・stype・robust・rmean・confType の logit・arcsin・none、cumhaz・stdChaz) と `rmst2`
  - 作業 C `46c85938`: `cuminc`・`timepoints`・`crr`・`predictCrr`
  - A と C の数値の点検 `f98feb8c`
  - 作業 B `dca40233`: coxph の (start, stop] データ (start・id)、survfit の start・id、`coxZph`
  - 作業 D `21066390`: `survreg`・`survregPredict`・`survregResiduals`
  - B と D の数値の点検 `7b995cbd` (survreg だけ変更。B は問題なし)

- **進め方 (このセッションで始めたもの、ユーザーの指示):** token を節約するため、実装は ChatGPT に外注した。
  - 指示書は `briefs/survival-1.4.ja.md` (1 節 クリーンルーム、3 節 検証済みの関数を使う、7 節 数値の点検、8 節 何度も直しが入った点) と `briefs/release-1.4.ja.md`。作業ごとに 1 つの Issue と 1 つのブランチ (`work/survival-1.4-<x>`)。ChatGPT はブランチに直接 push でき、PR を作れば CI の結果も自分で読める。テストは実行できない
  - こちらの役目: ブランチを別の worktree に取り出し (node_modules は本体へのジャンクション)、`node scripts/option-keys.mjs --write`・`npx tsc --noEmit -p tsconfig.json`・`npx vitest run`。結果を Issue のコメントに書く (**投稿はユーザーの承認を毎回得る**)。小さな残りは自分で直し、main に squash で取り込み (コミットのメッセージに「Written by ChatGPT ... (issue #, branch)」)、R の関数の索引 (`node scripts/r-index.mjs > docs/r-functions.md`、`--ja`、新しい関数の日本語の説明は `docs/ja/r-functions.json`) を生成し、push (ユーザーの承認) して Issue を閉じる
  - ChatGPT が繰り返した誤り: fixture・oracle・仕様書・`test/helpers/` の書き換え (各 case に `reference` を足す、ファイルの書式の変更)、生成ブロックの手書き、`@category` や R の関数名の文の抜け、収束した点の勾配や丸めの残りを相対誤差で比べるテスト、既存の関数 (作業 A の survfit) を壊す変更、静的な照合だけで「誤りなし」と報告すること
  - こちらで直した典型: 差の形の値 (区間の限界、対数尤度の差) は |a| + |b| の尺度で測る。反復の値が R とずれたら、反復を続けた値 (真の根) と比べる。crr #17、survreg #23、rmst2 #39 は rStats.js の方が真の根に近く、R が根から 1e-12〜1e-11 ずれていた
  - **ChatGPT の仕様の質問に答える前に、関係する `oracle/*-behaviour.md` の「Decisions for the user」と「rStats.js's choices」を読む。** このセッションでは、同時刻の統合について読まずに「尺度不変性を優先」と答えてしまい、判断 12 (a) (R の絶対の許容幅のまま) に反する変更を後で戻した

- **survival パッケージの誤り (ユーザーが報告済み):** https://github.com/therneau/survival/issues/353 (2026-11-15)。coxph の全体の Wald 検定 (と robust の Wald 検定・robust スコア検定) は、単位の大きな共変量 (係数の分散が別の係数の約 1e-12 倍。例: `lung` の `age * 1e5` と `sex`) の列を黙って落とし、自由度は k のまま、警告もない。13.47 が 9.39 に、robust の Wald は 13.59 が 10.27、robscore は 13.24 が 3.82 になる。尤度比検定は正しい。survival 3.8-3 と 3.8-12 で再現。rStats.js の coxph は尺度に依らない値を返す (differences-from-r に記載済み)。返事が来たら、内容によって differences-from-r を直す

- **環境のメモ (Windows の PC):** `scripts/api-ja-extract.mjs` は Windows では `npx` を shell なしで起動できずに失敗する (`spawnSync` に `shell: true` が要る)。全体のテストの実行では、時間の上限のテスト (signrank・tukey・wilcox46) が負荷で落ちることがある (単独では通る)。Windows の R は 10 進の最後の桁を誤るので、fixture は作らない (このセッションでは使っていない)

## 前回 (セッション 19) の「次のセッションで最初にやること」 (2026-11-09 に作成)

- **状態:** 1.3.0 を公開済み (2026-11-09、npm latest = 1.3.0。staged をユーザーが `npm stage approve fcb628a8-...` で承認。1 回目は通っておらず `npm stage view <id>` で status: staged と分かり、やり直して通った)。tag `v1.3.0` = `3d3fb65` (release が dist 入りに移した)、main = `4382006` を push 済みで CI・Pages 通過、デモ v1.3.0、jsDelivr の dist/rstats.js・dist/mixed.js を確認 (rstats.js は承認後しばらく 404)、/api/ と /ja/api/ に新しい関数のページ。
- **1.3.0 の中身:** ROADMAP の旧 1 (頑健な標準誤差: `vcovHC`・`vcovCL`・`coeftest`・`coefci`、coxph の `robust`・`cluster`・非整数の重み) と旧 2 (`roc`・`auc`・`ciAuc`・`rocTest`・`coords`・`diagnosticTests`・`blandAltman`・`mcreg`・`ICC`・`tTOST`・`tsumTOST`) をまとめて 1 つの版に (ユーザーの判断)。仕様は `oracle/robust-behaviour.md`・`oracle/roc-behaviour.md`・`oracle/methodcomparison-behaviour.md` (どれも末尾の「rStats.js's choices」にユーザーの判断)。計画は `~/.claude/plans/cheerful-bouncing-flute.md`。
- **進め方の変更 (ユーザーの指示、メモリ `feedback-rstats-parallel-agents`):** 今後はエージェントを立てず、私が自分で処理する。クリーンルームは「私は R・GPL のソースを読まない。仕様も実装も論文・ヘルプ・R の実行結果 (fixture) から書く」。1.3.0 までの仕様の文書はソースを読んだエージェントが書いたもの。
- **精度の点検:** 新しい関数はどれも、overflow・underflow・桁落ち・端の場合の点検 → 修正 → 再点検を 2〜3 回くり返した (2^±1000 の尺度、厳密な有理数・BigInt との照合)。主な直したもの: coxph のスコア残差 (リスク集合ごとのずらし)、sandwich の 2 の冪の単位での再計算と coeftest の指数の記録 (WeakMap。行列を写すと消える、TSDoc に記載)、ROC の McClish 補正と AUC の差を BigInt で厳密に、ICC の平均平方ごとの指数、mcreg の x・y を別々の尺度で、tTOST の尺度、`RNGkind` が種類を指定したときだけ乱数の状態を作る (R で確認)。点検の報告は残っていない (ジョブの一時領域)。
- **残った小さな点 (直していない):** coxph の素朴な分散の E[x²] − x̄² の桁落ち (直すと issue367 のテストが崩れる)、vcovCL の `fix` で負の固有値を本当に 0 にするときは R と同じ共通の単位 (2^537 以上小さい係数の分散は 0)、Gamma の glm で作業重みが非正規化数のときは当てはめの精度まで、tsumTOST の SD が非正規化数 (1e-320) のとき相対 1e-4、`tTest` の丸めた平均からの効果 (前から)、ICC の F 分位点の極限の挙動、既訳の API の訳 13 件で改行の数が英文と違う (glm・survival・random)。
- **oracle:** Dockerfile.r46 に pROC・BlandAltmanLeh・mcr・TOSTER の層を足し、arm64 と amd64 の両方を作り直した (sandwich・lmtest・survival は前から入っている)。
- **作業ブランチ・worktree が残っている:** `.claude/worktrees/` に robust-integration・diag-integration・release・docs13・demo13・fix-*・ja1〜3・agent-* など。消すのはユーザーに確認してから。
- **次の作業:** ROADMAP の Remaining の 1 (生存時間解析の続き: Nelson-Aalen、RMST、cox.zph、時間依存性変数、競合リスク、survreg)。エージェントなしで、上のクリーンルームの方式で。

## 前回 (セッション 18 まで) の「次のセッションで最初にやること」 (2026-11-07 に作成)

- **状態:** 1.2.0 を公開済み (2026-11-07、npm latest = 1.2.0、staged をユーザーが `npm stage approve <id>` で承認。2FA のため SSH の対話端末で)。tag `v1.2.0` = `9bc931a` (release のワークフローが dist 入りに移した)、main = `833c0a5` を push 済みで CI・Pages 通過、デモは v1.2.0、jsDelivr の dist/rstats.js・dist/mixed.js を確認 (mixed.js は公開直後の約 30 秒 404)。この HANDOFF の更新はコミットだけで未 push (ユーザーの指示)。作業ツリーは未追跡の `oracle/extreme-parameters-behaviour.md` だけ (触らない)。
  - 公開の経過: release の初回は test/boschloo.test.ts の時間のテスト (上限 3 秒、実行機で 3.5 秒) で止まった。上限を設計上の約 10 秒にして (`833c0a5`)、tag を付け直してユーザーが `push -f` した。Pages は GitHub 側のデプロイのタイムアウト (10 分、`256a64b` でも起きた) で失敗し、`gh run rerun` で通った。時間を測るテストの上限は実行機の速さでなく設計上の上限で決める
- **日本語版 API リファレンス (セッション 18、2026-11-08):** https://numero-uno-jpn.github.io/rStats.js/ja/api/ を公開。main = `7980669` を push 済みで Pages 通過。計画は `~/.claude/plans/valiant-enchanting-lemon.md` (最後の版だけ残る)。
  - 訳は `docs/ja/api/*.json` (3,260 件、`{hash, en, ja, stale}`)。src の TSDoc は英語のまま。`scripts/api-ja-extract.mjs` (キーの計算は `scripts/api-ja-keys.mjs`) が抽出し、英文が変わった項目に `stale` を付ける。訳し直しの依頼文の雛形は `docs/ja/api/TRANSLATING.md`、用語集は `docs/ja/api-glossary.md` (翻訳中に決めた語を末尾に追記してある)。トップページは `docs/ja/api-reference.md`。
  - `scripts/typedoc-ja-plugin.mjs` が生成時に訳を差し替える。hash が合わない項目は英語のまま出す。継承メンバーは親の訳を使う (親が export されていないものは子の名前で収録)。見出しの TypeScript の用語 (Interface、Function、Properties、Parameters、Index、Optional など) は、HTML の後処理で英語に戻している (h1 の種類名、h2〜h5 の文字、`tsd-tag` だけ)。
  - Pages は英語版・日本語版とも最新のリリースタグから API を作る。main で英文を直すと、その項目は次のリリースまで日本語版でも英語で出る (正常)。**リリースの前に `node scripts/api-ja-extract.mjs` を実行し、stale があれば訳し直す。**
  - `scripts/link-r-functions.mjs` が Pages の生成時に r-functions の表 (en、ja) の関数名へ API のリンクを付ける (リリースにある関数だけ。`Anova` は `Anova-1.html`)。
  - 英文の修正 (`0e09dc2`、次のリリースで API に出る): `GlmSummary.statisticName` に dispersion 指定時、`KappaResult` は Conger の正確な κ、`qrSolve` の LAPACK の条件、Jonckheere の例は 216 個ずつ、KS の例は m 783。トップページの Conventions を小見出しと表に分けた (`69e78aa`、英語版は次のリリースで反映)。
  - 翻訳の進め方: Haiku 5.5 のエージェントに分野ごとに 1 体ずつ (同時に走らせると抽出スクリプトが他の分野の訳を上書きする)。抜き取りで、条件の掛かり先 ("X or Y without Z" など) と人名の表記 (英字。ただしヘッセ行列・ヤコビ行列・ベッセル関数・分布名はカタカナ) を確かめる。
- **次の作業 (公開の後):** ROADMAP の Remaining の 1 番 (頑健な標準誤差: sandwich の vcovHC・vcovCL、lmtest の coeftest、coxph の robust)。進め方は 1.2.0 と同じ (下)。
- **1.2.0 でしたこと (セッション 17、2026-11-06〜07):** 計画は `~/.claude/plans/idempotent-swinging-lerdorf.md`。
  - ユーザーの判断: Boschloo は 1.2.0 に含める。比率の区間は 7 方法 (wilson・wilsoncc・clopper-pearson・wald・agresti-coull・jeffreys・midp)。2×2 の効果指標は epiR (ReactiveStat が使う) と DescTools・epitools の両方に照合。線形連関は漸近版だけ。ReactiveStat の menu.yaml にある N-1 カイ二乗・リスク差の同等性検定・Freeman-Tukey 残差も入れる。仕様の判断 1〜16 は `oracle/contingency-behaviour.md` の「rStats.js's choices」(要点: 1 件ずつの API、fisherTest の midp、mee・ac・オッズ比の score も、既定はパッケージの既定、不正確な根は真の根、Boschloo は真の上限で既定 square、tost とスコア法の比率の同等性検定の両方、G 検定は上側の p 値、Stuart-Maxwell の df は除いた後、N-1 は chisqTest のオプション、FT 残差は結果の欄、線形連関は全部 1..k の得点、γ は推定・区間・ASE、意味のない入力はエラー)。
  - oracle: Dockerfile.r46 に exact2x2 1.7.0・Exact 3.3・epitools 0.5.10.1・coin 1.4.6・epiR 3.0.0・equivalence 0.8.2 の層 (epiR のため GDAL・GEOS・PROJ・udunits・libwebpmux も)。oracle スクリプト 6 本 (binomci・twobytwo・exact2x2・boschloo・ordinaltable・equivalence)、fixture 14 本。
  - 追加した関数: binomCI・binomDiffCI・binomRatioCI・oddsRatio、fisherTest の midp、boschlooTest、gTest・stuartMaxwellTest・goodmanKruskalGamma・lblTest、chisqTest の nMinus1 と ftResiduals、tost・binomDiffEquivalenceTest。仕様のエージェント 1 体 → 実装のエージェント 4 体 (A+B、C、D、E。worktree、1 体ずつ) → 点検のエージェント (読み取りだけ、16 件) → 修正のエージェント 1 体。
  - pgamma の精度 (ユーザーの指示で調べた): 上側の連分数を a < 4・x < 64 で double-double に (pchisq の df 1 で最大 75 → 8 eps、qchisq の df 1 は約 2.8 倍遅い)、Temme の領域を double-double の逸脱度から (35 → 4 eps)、a < 0.01 のポアソン因子 (50 → 1 eps)。値をビットで固定していたテスト 5 本を更新 (4 本は真の値の丸めと確認)。
  - R (パッケージ) が誤る所は differences-from-r に (uniroot の許容で止めた区間、epiR のオッズ比のスコア区間が大きな表で est×1.1、exact2x2 の Boschloo が 98 点の格子、Exact の square の棄却域、DescTools の GTest の 1 − pchisq と Williams の空の行、Stuart-Maxwell の df、coin の 2 水準の符号、Wilson の下端の桁落ちなど)。
  - 未解決の小さな点: 同等性検定の文書の例の区間は真の値から 1 ulp (統計量の変化が δ の 1 ulp あたり 1.3 eps しかなく決めきれない)。binomDiffCI.json の参照値 1 件が mpmath と 6 ulp (許容内)。oddsRatio の p 値は件数約 1e13 で phyper の上限 (performance に記載)。
  - 依頼文: `~/.claude/plans/rstats-1.2.0-briefs/` (spec_brief.md・impl_brief.md・audit_findings.md。この Mac のローカルだけ)。次も同じ形で進めるなら、impl_brief.md を写して土台のコミットと担当を直して使う。点検のスクリプトはジョブの一時領域にあり、残らない。

- **残り (急がない):**
  - fisher の fixture は R 4.5.2 のまま。oracle が colima の VM (4 GB) をほぼ使い切るので、cloud-r を止めてよいときに `npm run oracle -- fisher`。
  - R 4.6 は x^2〜x^4 を pow でなく掛け算で計算する (NEWS にない)。rStats.js の `**` を使う R 由来の式が最後のビットでずれうる。今は落ちるテストはない。
  - 手法の対応表 (外部の統計ウェブアプリの手法 159 項目と rStats.js 1.0.0 の対応、◎37・○25・△41・×31・−25) は `~/.claude/plans/rstats-coverage-vs-menu-2026-11-06.md` (リポジトリの外、Mac mini のローカルだけ)。
  - ディスク: Mac 本体の空きは約 20 GB (Android を消した)。Docker のイメージは 4.5.2 と 4.6.2 の 2 組。

- **1.1.0 を公開 (2026-11-06):** R 4.6.2 への移行 (下の項目)。npm latest = 1.1.0 (staged をユーザーが承認)、tag `v1.1.0` = `a310c7c` (dist 入り)、main = `bb366e8`、CI・Pages 通過、デモは v1.1.0、jsDelivr の dist/rstats.js・dist/mixed.js を確認 (公開直後の数十秒は rstats.js が 404 だった)。作業ブランチ r46 は削除済み。次は ROADMAP の 1 (分割表と比率)
- **1.0.0 を公開 (2026-11-06):** npm latest = 1.0.0 (staged をユーザーが承認)。tag `v1.0.0` は release のワークフローが dist 入りのコミット `df7a602` に移した。main は `1405d4e` (デモの例 `deda702` と版のコミット)、CI・Pages 通過、デモの VERSION は v1.0.0、jsDelivr の `dist/rstats.js`・`dist/mixed.js` と npm から入れた `/mixed` の glmer が動くことを確かめた。以後は Semantic Versioning に従う。1.0.0 の後の優先順は ROADMAP の Remaining (2026-11-06 に改訂: 外部の統計ウェブアプリの手法 159 項目との対応表から、医療・心理統計で正しい手法を使える観点で並べた): 1 分割表と比率 (Fisher mid-p・Boschloo・比率と 2×2 の効果指標の区間など) → 2 頑健な標準誤差 (sandwich) → 3 診断・測定の一致 (ROC・Bland-Altman など) → 4 生存の続き → 5 試験デザインの検出力 → 6 メタアナリシス → 7 混合モデルの confint・simulate。lavaan・IRT・LCA・mice・mclust は範囲外。README に glmer の数値例も候補
- **R 4.6 への移行の準備 (2026-11-06):** `oracle/Dockerfile.r46` (R 4.6.2、Ubuntu 26.04 resolute、スナップショットは同じ 2026-10-23、パッケージも同じ層) でイメージ `rstats-oracle:4.6.2` と `rstats-oracle-amd64:4.6.2` を作った。`oracle/Dockerfile` (4.5.2) は cloud-r への影響を避けるため変えない (ユーザー判断)。4.6 で回すには `RSTATS_ORACLE_IMAGE=rstats-oracle:4.6.2 RSTATS_ORACLE_AMD64_IMAGE=rstats-oracle-amd64:4.6.2 npm run oracle -- <name>`。R 同梱の推奨パッケージだけ版が違う (MASS 7.3-65→66、Matrix 1.7-4→6、survival 3.8-3→3.8-12)。試しの pnorm は 3420 値が 4.5.2 と一致。移行 (NEWS の確認 → 全 oracle を作り直して差を分類 → 1.x.0 で公開) は新機能 (分割表と比率) の前に行う予定
- **R 4.6.2 への移行 (2026-11-06、1.1.0 の予定、ユーザー判断):** 全 oracle を Dockerfile.r46 で作り直した (fisher だけ 4.5.2 のまま: fisher.test は 4.6 で不変、oracle が VM の 4 GB をほぼ使い cloud-r を巻き込むため。cloud-r を止められるときに作り直す)。scripts/oracle.sh・reference.sh の既定のイメージは rstats-oracle:4.6.2 と -amd64:4.6.2。R 4.6 に合わせたもの: wilcoxTest (同順位・0 の条件付き正確検定 (Pratt)、達成した信頼水準、correct 0..3 の Edgeworth、時間の上限)、pairwiseWilcoxTest、glmRstandard (既定 pearson、type オプションを追加)、ansariTest (同順位の分散)、moodTest (R が rStats に一致)、corTest・aovSummary の警告、survfit の log-log、chol(pivot) の末尾 0、qr(lapack) を LAPACK 3.12.1 (dlarf1f) に。R 4.6.2 が誤るので正しい値を返すもの (differences-from-r、ユーザー判断): 1 標本の条件付き区間の下端、端が最初・最後の Walsh 平均・差のときの水準 (1・2 標本)、正規近似の小さな両側 p 値。DescTools の JT の正確な p 値が R 4.6.2 で負 (デモは clinfun に替えた)。仕様は oracle/wilcox46-behaviour.md。未対応の発見: R 4.6 は x^2〜x^4 を pow でなく掛け算で計算する (NEWS にない。rStats の ** を使う R 由来の式が最後のビットでずれうるが、落ちるテストはない)。OpenBLAS は 0.3.26→0.3.32
- **今の状態 (0.17.0 の時点):** すべて push 済み (origin/main = `84ecbd0`)、CI (Node 22・24・browser) は通過。**npm の公開版は 0.17.0 (2026-11-05)**: 手順 1〜3 (API の整理・知らないキーのエラー・検定の warnings) を glmer の前に公開した。tag `v0.17.0` (release のワークフローが dist 入りのコミットに移した)、jsDelivr とデモ (VERSION v0.17.0) で読めることを確かめた。公開の手順は「版のコミットを作る → tag だけ先にユーザーが push → npm でユーザーが approve → jsDelivr を確かめてから main を push」(デモが未公開の版を読みに行かない)。open の Issue は 0 件。外部レビュー (ChatGPT) は終了
- **glmer は完成 (セッション 16、Mac mini、2026-11-05):** 計画は `~/.claude/plans/smooth-juggling-jellyfish.md`。`802a077`〜`4beaf1a` の 16 コミット: 2a 仕様と逸脱度の oracle、2b 内部の逸脱度、2c+2d 全分布族の nAGQ 0・1 の当てはめ (glmer を mixed から公開)、2e nAGQ > 1 (`6e3dcd7`・`f927bb9`)、3 glmerSummary・glmerAnova (glm との比較も、`985fa8e`・`b1f2586`・`7702995`)、4 glmerPredict・lmerPredict (`fd3489d`)、仕上げ (differences-from-r・README・ROADMAP・llms.txt・サイズ、`25912f0`〜`4beaf1a`)。fixture との誤差は glmer 由来の値で 1e-8 前後 (許容 1e-7、vcov 1e-6)。手順 5 は済み (2026-11-05、ユーザー判断): mixed はルートと dist/rstats.js に入れず `/mixed` のまま (後で足しても互換性は崩れない。ROADMAP en・ja に記載)。次は手順 6 の 1.0.0 のリリース。1.0.0 の後: glmer の confint (profile)・simulate、README に glmer の数値例。
- **glmer 系の監査と修正は済み (2026-11-05):** 自前の監査 (scratchpad の audit/findings_A.txt・findings_B.txt、この Mac のセッション限り) で A1〜A11・B1〜B5・F1〜F4。修正 1 `bbc97f9`〜`5b0056a` (解析的な勾配と頑健な最小化。n = 20000 で 69 秒 → 2.3 秒、許容誤差は lmer なみの 1e-9・logLik 1e-12)、修正 2 `0fee9b7`〜`c45d1f4` (offset の初期値、μ'² の溢れ、PIRLS の相対の判定、B1〜B4、logLik −0)、修正 3 `c2b73ae`・`7cef02a`・`cb2dc9d` (lmer の X が 2^±500 を超える列を 2 の冪で割る。fixture の 155 件はバイト単位で不変。glmer の基準が丸めの水準で平らなら RangeError (G21))。直さないもの: B5 (reForm の重複は R と同じ)、A11 (分離は R と同じ文言)。判断 G19〜G21: 解析的な勾配、非整数のポアソンは nAGQ 0・1 で RangeError、平らな基準はエラー。lme4 が誤る所: F4 の Gamma の標準誤差は differences-from-r に、gaussian-log の ×1e4 で lme4 が非大域の点に止まる件は回帰テストだけ (lme4 の基準は gaussian の非恒等リンクで尺度に不変でない)。push 後に Linux x86_64 の CI で F1 と G21 のテストが落ちた (arm64 と最後のビットが違い、際どい所にあった) ので `ee9abc0` で直した: glmer だけの収束の判定 (勾配が小さく、ヘッセ行列が正定値で、ニュートン法の 1 歩が相対 1e-8 未満) と、G21 で情報量が 2^40 を超えれば最初に RangeError。これで対応範囲が狭まった (ポアソンのカウントは約 1e11 まで、重みは約 2^34 まで、gaussian-log は約 5e4 倍まで)。CI は通過 (origin/main = `ee9abc0`)。Linux での確かめ方は Docker の node:22・node:24 (`--platform linux/amd64`、エミュレーションで約 20 倍遅い)。ChatGPT に glmer 系の監査を頼む依頼文は作ったが、ユーザーが見送った仕様は `oracle/glmer-behaviour.md` (lme4 は GPL なので、ソースを読むのは仕様を書くエージェントだけ。実装のエージェントは文書から書く)。ユーザーの判断 G0〜G11 は文書の「rStats.js's choices」と scratchpad の glmer/user_decisions.md (この Mac のセッション限り) にある。要点: 全分布族と nAGQ > 1、cbind は左辺だけ、文字列の応答は因子、gaussian 恒等は RangeError、mustart なし、vcov は真のヘッセ行列、lme4 のモデル警告は出さない、許容誤差は母数 1e-7・vcov 1e-6。token を抑えるため、エージェントは 1 段 1 体で順に。この Mac では test/issue179・issue513 が最後のビットで落ちる (arm64、glmer とは無関係)
- **残りの手順:** なし (手順 1〜6 はすべて済み、1.0.0 を 2026-11-06 に公開)
- **別件 (後で直す):** cronbachAlpha で分散 0 の項目があると、R (psych::alpha) はその項目を除いて計算するが、rStats.js は除かずに rawAlpha 0.72・G6 NaN を返す (警告 "Item =  had no variance…" は付けた)
- **進め方 (セッション 15 で定着):**
  - 大きな作業は、読み取り専用のエージェントで洗い出し → 判断の要る点をユーザーに聞く → Plan モード → 修正用のエージェントを順に (並行にしない) → 私が差分を確かめて報告 → push はユーザーの指示があってから → CI を `gh run watch` で確かめる
  - **判断はユーザーに 1 つずつ、説明 (何か・なぜ・何が変わるか) を付けて、推奨を先頭にした選択肢で AskUserQuestion で聞く** (memory の decision-presentation)。答えは scratchpad の api_review/user_decisions.md に追記する
  - 修正用のエージェントの共通ブリーフは `C:/Users/numer/AppData/Local/Temp/claude/C--Users-numer-dev-EMUYN-rStats-js/c7edd535-1b24-4263-9ce0-8e1cbe771144/scratchpad/api_fix/brief.md` (禁止事項: サブエージェント・裏のシェル・1 分を超えるスクリプト・amend・PowerShell・push・HANDOFF の編集。LF を保つ。CHANGELOG の Unreleased。報告は .txt。サブエージェントは .md の報告ファイルを書けない)。新しいセッションでは scratchpad に複製してパスを直す
  - 前のエージェントを続けさせるときは SendMessage (文脈が残る)
  - **R:** 手元の Windows の R 4.5.2 (Rscript) が使える。値の fixture は Linux の Docker (oracle/、Docker Desktop はインストール済みだが止まっている) で作ったもので、Windows の R は 10 進の読み書きで最後の桁を誤るので作り直しに使わない。警告の文字列だけなら手元の R で足せる (`node scripts/fixture-warnings.mjs`)
  - **Node 22:** Math.pow などの最後のビットが違う。値を固定するテストは toBe でなく相対 4e-15 で。手元で `npx -y -p node@22 node node_modules/vitest/vitest.mjs run` で確かめられる
  - **新しい公開の関数を足したら** `node scripts/option-keys.mjs --write` を流す (知らないキーの検査の生成。`--dry-run` で差分がないこと)。警告は `reported(...)` で handler に渡す (src/internal/warnings.ts の先頭の規則)
  - ブラウザのテスト (test/browser) は手元に Playwright の chromium がないので CI で確かめる

## 1.0.0 までの計画と結果 (2026-11-04〜05、ユーザー判断)

公開 API の見直しは `C:/Users/numer/AppData/Local/Temp/claude/C--Users-numer-dev-EMUYN-rStats-js/c7edd535-1b24-4263-9ce0-8e1cbe771144/scratchpad/api_review/result.md`、判断は同じフォルダの user_decisions.md (D1〜D8、手順 2・3 の判断 1〜13・A〜I まで)。1.0.0 からは Semantic Versioning に従うので (README の Versioning)、互換性を崩す変更は 1.0.0 の前にまとめて行う。CHANGELOG の `## Unreleased` に Breaking・Added・Changed・Fixed をまとめてある。

- **手順 1 API の整理 (済み、`b1f37b7`〜`e5e7b98`):** svd の内部の `s` を落とした、exports に default と package.json、サブパスの型の再 export、引数の誤りを TypeError・RangeError に (「2 水準でない」など結果が定義されない入力は Error のまま)、steelTest を削除、`aov(x, g)` はモデルを返す (表は aovSummary)、aov・anova の残差が丸めの水準なら 0 として F = Inf・NaN (rssWithinRounding、R は丸めの残りから F = 3.4e64 など)、p 値などの別名 (`pValue`・`stdError` など)、省略できる位置引数をオプションでも (optimHess は位置だけ)、README に Versioning、CDN の注意、名前の規則
- **手順 2 知らないオプションのキー (済み、`ffadf9b`〜`766bf64`):** 全関数で RangeError (`unknown option 'x' for f (known: …)`)、入れ子 (optim・coxph・factanal の control、glm の family・link) も。生成スクリプト scripts/option-keys.mjs (typescript 7 の `typescript/unstable/sync`)。lmer 系も RangeError (R にあって対応しない引数は先に Error)、distSummary は d 関数の引数名で検査し ncp は RangeError、デモは ncp のとき要約の表を出さない
- **手順 3 検定の warnings (済み、`800bd89`〜`30fc5e9`):** 検定・効果量・検出力・一致度の 71 関数と factanal に必須の `warnings: string[]` (R の文言、同じものは 1 回、R の順)。新たに警告を出す 12 関数 (wilcoxTest・ansariTest・pairwiseWilcoxTest・fisherTest・chisqTest・propTest・pairwisePropTest・ksTest・corTest・cohensD・hedgesG・cronbachAlpha)。`setWarningHandler(handler | null)` (既定は出さない、状態は globalThis の Symbol.for、入れ子は外側だけ、fit の警告は当てはめたときの 1 回だけ)。分布関数の精度の警告と R の型の警告は入れない (NaN の理由の警告は入れる)。fixture 29 本に手元の R で warnings の欄だけを足し (数値は不変)、場面ごとの fixture htestWarnings.json (120 場面)。R と違う扱いは differences-from-r に (corTest の 1e-300・1e308、wilcoxTest の #502、ansariTest の absigma)
- **順番:** 1〜6 すべて済み (6 の 1.0.0 は 2026-11-06 に公開)

## セッション 15 の結果 (2026-11-04)

- **Issue #503〜#513 (11 件) を処理・push・close 済み (origin/main = `2230cbb`)。** 標準の進め方で、B (ユーザーの判断が要るもの) は 0 件。分類は scratchpad (`C:/Users/numer/AppData/Local/Temp/claude/C--Users-numer-dev-EMUYN-rStats-js/c7edd535-1b24-4263-9ce0-8e1cbe771144/scratchpad/`) の triage/result_503-510.md・result_511-512.md・result_513.md、close comment は close5/
  - 修正 (completed 6): #506 `ab83128` (ansariTest の正規近似の区間で、探索範囲が空なら RangeError でなく NaN。R はエラー、docs)、#509 `b69c96b` (重み付き lm のモデル比較で、入れ子の判定を重みが正の行だけで。glmAnova と同じ形、R と同じ値)、#508 `8ab3e49` (aovEz の 2 の冪の倍率を、不完全な被験者を除いた後の行で決める。afex と同じ値)、#503 `a493b1e` (optimHess の差分商の溢れ。R は 0・Inf、docs)、#504 `67ea294` (hessian の 2 階差分の分子の溢れ。numDeriv は NaN、docs)、#507 `71037ea` (ansariTest の x/s の溢れ・0 への潰れで、順序を保つ比較で順位を付ける。推定値 0.6364 → 1.3182。潰れの例 x = (±1e-160, ±2e-160, 1e140)、y = ±5e-150 の区間は R と同じ [2e-11, 4e-11] から NaN に変わった。docs)
  - not planned 5: #505 `9ba16e4` (merge の数値キー。再現せず)、#510 `6d99c41` (survdiff の一般化逆行列。回 15 のユーザー判断)、#511 `e3b958e` (qexp の rate = Inf。R と同じく NaN、再現せず)、#512 `29f7829` (pbeta の形状 0 と q < 0。回 17 のユーザー判断)、#513 `e0c8865` (qtukey の Brent の逐次代入は Brent (1973)・R の zeroin.c と同じ形で正しい)
  - 範囲外として記録 (各ログ): optimHess で勾配を渡さないと #503 の例の一部がエラーで止まる、ansariTest で候補の比 x_i/y_j そのものが溢れる場合は従来どおり、lmerAnova も nestedColumns に全行を渡す (lmer は weights を受け付けないので影響なし)、oracle/survival-behaviour.md:14 の文言、R の qtukey(1e-10, 3, 20) が 9.27e-10 で R が誤る (rStats.js は正しい。docs には書いていない)
  - 全体テスト (#503〜#510 の後): 3320 passed、38 skipped。tsc エラーなし
- **close の手順の注意:** ログだけのコミットの Issue (C) で close comment にハッシュのプレースホルダがあると、close_prep5.py は MISSING HASH で止まる (#512)。手でログのコミットのハッシュに置き換えた。C の判定のブリーフには「プレースホルダを書かない」と書くとよい (#513 で実施)
- **push の注意:** merge から push までの間にレビュアーが push して拒否されることがある (#503〜#510 のとき)。そのときはもう一度 fetch して同じ確認をして merge する
- **次にやること (セッション 16 から):** 外部レビューは終了したので、新しい Issue は届かない見込み。届いたら、新しい open の Issue を「標準の進め方」で処理する (`gh issue list --state open --limit 500`)。ブリーフはこのセッションの scratchpad の triage_brief.md・brief_issue.md・prep_brief.md・criteria.md・close_prep5.py を複製してパスを直して使う
- **文書の更新 (0.16.0、push 済み、origin/main = `236232e`):** 見直しは scratchpad の docs_review/result.md、判断は docs_review/user_decisions.md (D1〜D7、すべて推奨案)。CHANGELOG を 0.16.0 に (Breaking に新しいエラー・計算量の上限・通常範囲で値が変わるもの)、版 0.16.0 (package.json・README・demo)、README・llms.txt にエラーと RangeError、CONTRIBUTING に Design rules (K1〜K10 の公開版)、performance に Limits、accuracy・differences-from-r の整理、サイズを測り直し (`6e23895`〜`b1aedf5`)。steelTest は README の一覧から外した (`236232e`)。npm の publish とタグ付けはしていない
- **0.16.0 を publish 済み (2026-11-04):** tag `v0.16.0` (release のワークフローが dist 入りの `ad8ddf6` に移した)、npm の latest = 0.16.0、デモが動くことをユーザーが確認。経過: 版を上げて push した時点で、デモ (demo/app.js の VERSION) と README の CDN の URL が未 publish の 0.16.0 を指して 404 になった。Linux で issue249 のビット一致のテストが落ちた (libm の差、相対 4e-15 に `f342cd4`)。tag を移す push で GitHub の 500 が出たので rerun。CI (ci.yml) は 11-02 から止めていたが、2026-11-04 に再開した (止めたときの失敗は Node 22 の review47 の besselY(1e-310, 0.5) で、参照値の誤り。`dd93b9b` で直してあるが、Linux の Node 22 ではまだ流していない)。CI は `2063cad` で Node 22・24・browser とも通った。tag の push は権限で止められるので、ユーザーに `!` で実行してもらう
- **pt・pbeta の最後のビット (範囲外として記録、ユーザー判断で直さない):** pt(2, 10, 上側, log) は R と 2 ulp、README の tTest の p は R と 6 ulp 違う (p は rStats.js が正しく丸めた値で R が誤り)。根は pbeta (incbet) が toms708 と別の実装であること (qt の最後のビットと同じ根)。440 点で真の値との平均誤差は R 2.28 ulp・rStats.js 0.98 ulp、fixture pt.json の通常範囲で R と同じビットは 900 件中 476 件。toms708 の移植 (約 2,000 行) はしない。調査は scratchpad の ulp/result.md
- **外部レビューは終了 (2026-11-04、ユーザーの指示):** ChatGPT の外部レビューはここで終える。レビュアーが作ったファイル (`docs/audit-ledger.md`・`docs/Audit ledger 2.md`・`docs/review-logs/review_audit_*.md` 46 件) とレビュアー向けの指示書 `docs/review-prompt.md` を削除した (`80e97a2`、ユーザー判断。履歴には残る)。修正のログ `review_fix_log_*.md` は残す。この文書の監査台帳・review-prompt・レビュアーへの連絡に関する記述は過去の記録

## セッション 14 の結果 (2026-11-04)

- **再修正は完了 (下の「初期の修正の再修正」の手順で実施):** 基準 K1〜K10 (scratchpad の criteria.md。下に要点) で、Issue #8〜#124 (エージェント) と外部レビューの回 1〜68 (メインのセッションが全ログを確認。#1〜#7 は PR で Issue はない) を洗い出し、B はすべて推奨案で決定 (D1〜D17)。6 グループ・16 コミット
  - G1 `c5118dc`〜`1badf9b`: uniroot の tol = 0、qr の tol = Inf、lmerContest の NaN、pairwiseTTest (pooled)・onewayTest (等分散) の群内分散 0 をエラー (内部用に `unirootCore`、`checkPooledVariance`)
  - G2 `0f3166f`〜`7067884`: qbinom の小数の size を偶数への丸め (knownDifference 1372 件を外した)、Laplace の sigma = Inf を極限、carAnova の rss = 0 を rss < 1e-24 Σwy²
  - G3 `a37c67e`・`1bcf059`: tTest の区間と Welch の stdErr・df を R の式に (桁落ち・溢れのときだけ以前の形)。gamesHowell は PMCMRplus の式。R と同じビットの区間の端 335 → 452/911、Welch の df 22 → 165/176
  - G4 `79bf61d`〜`1036c68`: expm の order × (n³ + 64) ≤ 2^31、grad 系の r ≤ 512、phyper の項数 2^26・qhyper の σ 2^21 (rhyper からの呼び出しは検査なし)
  - G5 `84ed31c`〜`fe29cf2`: Bessel の連分数 (x − ν で判定)・漸化式の回数、wilcox の d・p・q の min(m, n) × 表の長さ ≤ 2^29、rwilcox は m + n > 2^24 で Map (8 GB の確保をなくす)・n ≤ 2^24
  - G6 `8747800`: 記録だけ (出力の長さと optim の maxit は上限なし、例外として残す issue 10・11・15・30・49 と回 34 の Hedges の J)
  - ログは `docs/review-logs/review_fix_log_issueNN_rev.md`・`review_fix_log_20261031_NN_rev.md`、テストは `test/issueNN_rev.test.ts`・`test/revNN.test.ts`
- **今の判断基準 (K1〜K10、ユーザー確認済み):** 意味のない入力はエラー (分布の d・p・q・r の NaN は別)、R が正しい範囲は R と同じビット・誤る範囲だけ正しい値、受け皿の形、確保 2^24・時間 10 秒前後 (分布・乱数でも計算量の上限は RangeError)、乱数は R と同じ数・q にそろえる、無限の尺度は極限、2^53 超は NaN、長さ 0 は R、整数への変換は R、信頼水準・警告・2 の冪の方針。例外 (ユーザー了承): K3 は #243・#382・#351・issue 10・11・15、K5 は BTPE・issue 30、K1 は issue 49 (wilcox の全同順位 p = 1)、K2 で今のまま: Hedges の J
- **範囲外として記録 (各 _rev ログ):** psignrank の時間の上限がない、kruskalTest・moodTest・flignerTest の全同順位が NaN (R と同じ)、qt・variance の最後のビットの R との差、rhyper の巨大な σ で 1 回約 5 秒、rwilcox の n = 2^24 で m が大きいと 12.8 秒、grad の値が numDeriv と最後の桁で違う (r = 20 の hessian で 4e-8)、Windows R の pow の丸め
- **監査台帳 (ユーザーの指示):** `docs/audit-ledger.md` が 1.06 MB で外部エージェントに読めなくなった。回ごとの節を削除し、根拠の列を 150 字程度に要約、Issue を `#NN` に (95 KB、`f1608f4`)。レビュアーが作った `docs/Audit ledger 2.md` (回ごとの短い記録) と `docs/review-logs/review_audit_967〜970_*.md` は残す (ユーザー判断)。`docs/review-prompt.md` に大きさの決まり (表は 1 ファイル 1 行・根拠 200 字まで、台帳 2 は 1 回 10 行まで、詳細は Issue、新しい記録ファイルは作らない) を足した (`6a89d88`)。台帳 2 の冒頭の「従来の docs/audit-ledger.md は変更せず」は新しい決まりと食い違うが、レビュアーのファイルなので触れていない。縮める道具は scratchpad の ledger_slim/ (build.mjs・verify.mjs・summaries.json)
- **コミット:** すべて push 済み (2026-11-04、origin/main = `53ee5d7`)。レビュアーは review-prompt の新しい決まりの後も `docs/review-logs/review_audit_981_*.md` を足していた (決まりを読む前の回の可能性)。続くなら伝える
- **open の Issue #487〜#502 (14 件) は処理・push・close 済み (2026-11-04、origin/main = `53ee5d7`。completed 11、not planned 3: #487 #496 #501。close comment は scratchpad/close5/):** 標準の進め方で A 5・B 6・C 3 (分類は scratchpad/triage/result_487-502.md、B の下準備は prep/b_issue.md、決定は user_decisions.md の E1〜E6、すべて推奨案)
  - 修正: #499 `45616ce` (負の eps)、#500 `6ec0e64` (サロゲートペア。R の tidyr は誤り、stringr と同じ値)、#494 `72faf79` (mantelhaen exact の合計 2^53)、#498 `92ab878` (optimHess の溢れ)、#491 `dd1a023` (pbeta の a + b の溢れ、受け皿 `betaIncOverflowSum`)、#488 `86e6209`・#489 `c9017d1` (B = 0 はエラー)、#502 `414503b` (wilcox の復元が 2^-26 を超えてずれるときだけ x)、#493 `5865c49` (df の x = Inf は 0、log から作る。fixture 155 件、E6)、#490 `3c9b9a1` (besselJ・Y の比の形、v ≥ 2^52 の位相、v²/(2x) > 2^26 は RangeError)、#492 `10323ab` (besselI・K の Debye 展開。scaled の黙った誤りも)
  - not planned: #487 `c90b106`、#496 `b7b55d4`、#501 `b58d8ab`
  - 範囲外として記録 (各ログ): R 4.5.2 (Windows) が besselI・K(1e308, 1e154, TRUE) で segfault、pbeta の受け皿の入力は約 50 ms、#502 の 1e-200 規模で区間が [min, max] に潰れる (R と同じ)、oracle/dataframes-behaviour.md:40 の文言
  - 全体テスト: 3307 passed、失敗は実行時間の signrank・tukey だけ (単独で 33/33)。tsc エラーなし
- **次にやること (セッション 15 から、済み):** 新しく届いた open の Issue #503〜#510 (8 件: optimHess・hessian の溢れ、merge の数値キーの書式、ansariTest の区間 2 件、aovEz の不完全な被験者の縮小、モデル比較の重み 0 の行、survdiff の一般化逆行列) を「標準の進め方」で処理する (`gh issue list --state open --limit 500`)
- **レビュアーへの連絡 (未):** review-prompt の新しい決まりのあとも、レビュアーは `docs/review-logs/review_audit_982〜994_*.md` を作り続けている (台帳 1 は表の行の上書きで 97 KB を保っている)。記録ファイルを作らないよう伝えるか、ユーザーに確かめる

## 初期の修正の再修正 (セッション 14 で完了。手順の記録)

- **背景 (2026-11-04、ユーザー):** Issue の後半 (セッション 10〜13) は判断基準が固まって安定したが、初期の 100 件程度は判断がぶれ、最終的な基準とずれた形で修正したものがある。それらを今の基準に合わせて直す
- **進め方:**
  1. **基準を書き出す (メインのセッション):** この文書の「方針」と、セッション 10〜13 の「ユーザーの判断」から、今の判断基準を一覧にし、ユーザーに確かめてもらう。候補は次のとおり
     - 意味のない入力はエラーにする
     - R (やパッケージ) が誤る範囲だけ正しい値にし、それ以外は R と同じビットにする (#83・#59・#468)
     - 受け皿の形 (元の結果が有限でない・範囲外のときだけ動く) にして、通常範囲のビットを変えない
     - 確保量は配列 1 本 2^24 個まで、時間はこの PC で 10 秒前後まで (超えたら RangeError で "use exact: false" を案内)
     - 乱数は q にそろえ、R・extraDistr が引く乱数は引く (#92)
     - 無限の尺度は極限として扱う (24 回目)
     - 2^53 を超えて厳密でない入力は NaN
     - 長さ 0 は R に合わせる (#55)
  2. **洗い出し (読み取り専用のエージェント 1〜2 つ):** 初期の Issue (#1〜#124 前後。必要なら外部レビューの回 1〜68 の `review_fix_log_20261031_NN.md` なども) のログと今のコードを読み、基準とずれている修正を一覧にする。各件について、ずれ方、今の基準ならどうするか、直すと何が変わるか (通常範囲のビット・fixture の件数・R との一致)、関係するテストを書かせる
  3. **分類と判断:** 以降は下の「標準の進め方」と同じ (A は順に修正、B は下準備してからまとめて AskUserQuestion)。ログは `docs/review-logs/` に英語で書く。再修正のログの名前は、元の Issue に合わせて `review_fix_log_issueNN_rev.md` などにする (決める)
- **注意:**
  - 初期の判断のうち、ユーザーが明示的に決めたもの (各ログの「ユーザー判断」、例: #27・#30 の「直す」、#28・#40・#47 の「変えない」) は、基準と違っても機械的に直さず、必ず聞き直す
  - 再修正は Issue がないので、close の手順は要らない。コミットのメッセージには元の Issue 番号を `#NN` で書かない (close のスクリプトが拾う。「issue NN」と書く)
  - エージェントのブリーフには、サブエージェント・fork を起動しない、シェルを裏で動かさない (run_in_background を使わない)、1 分を超えそうなスクリプトを流さない、`git commit --amend` をしない、を必ず書く (auto memory の agent-no-background-work)。前のセッションの brief.md は `C:/Users/numer/AppData/Local/Temp/claude/C--Users-numer-dev-EMUYN-rStats-js/72aaf470-6fce-44bd-9e4a-2ba8972ce934/scratchpad/` にある (triage_brief.md・prep_brief.md も)。新しいセッションの scratchpad に複製して、パスを直して使う

## GitHub Issue の処理 (セッション 6 から。今は保留)

- **運用:** 外部レビュアー (ChatGPT) は GitHub Issue を立てるだけ。Claude が検証・修正・テスト・close まで行う。レビュアーへの報告や返信は不要。古い番号から順に処理する
- **次にやること:** 新しい open の Issue を「標準の進め方」で (上の「セッション 15 の結果」)。ブリーフはセッション 15 の scratchpad (`C:/Users/numer/AppData/Local/Temp/claude/C--Users-numer-dev-EMUYN-rStats-js/c7edd535-1b24-4263-9ce0-8e1cbe771144/scratchpad/` の triage_brief.md・brief_issue.md・prep_brief_rev.md・criteria.md・close_prep5.py) を複製してパスを直して使う
  - レビュアーは close 後に本文へ再現を追記して再オープンすることがある (#120)。再オープンされた Issue は、コメントでなく本文の追記を読む
  - レビュアーには、セッション 11 で Issue の立て方の追加依頼 (docs/review-logs の検索、公開 API から再現、期待値は実際の double から厳密計算して 16 進でも、「R では未確認」と明記、通常範囲でも起きるか、同じ根は 1 件に) を送った。`docs/review-prompt.md` への反映はまだ (案は下の「セッション 11」)
- **コミット:** すべて push 済み (2026-11-04、origin/main = `2230cbb`)。#513 まで close 済み。未コミットは HANDOFF.md だけ (ユーザーの指示でコミットしない)。push はユーザーの指示があるときだけ
  - リモートには、レビュアーが `docs/audit-ledger.md` だけを更新するコミットを直接 push してくる (毎回数十〜200)。push の前に `git fetch` し、`git diff --stat HEAD...origin/main` が audit-ledger だけであること、`git log --oneline origin/main..HEAD -- docs/audit-ledger.md` が空 (ローカルの変更がない) こと、`git merge-tree --write-tree HEAD origin/main` で衝突がないことを確かめて merge する (rebase しない。close のコメントに書いたハッシュが切れる)

## 標準の進め方 (セッション 10 で確立。ユーザーの指示で今後の標準)

Issue を 1 件ずつ対話で処理するのではなく、まとめて分類し、判断の要らないものはエージェントに順に処理させ、判断の要るものは下準備してから一度に聞く。ユーザーが不在 (就寝中など) でも進められる。

### 1. 分類 (読み取り専用のエージェント 1 つ)
- open の Issue をすべて読み、今の main とローカルの R で確かめて分類させる
  - **A:** 判断不要の単純な修正 (R が正しい範囲は R と一致、または正しい値が明白で、通常範囲の値を 1 ビットも変えずに直せる局所的な修正)
  - **B:** ユーザーの判断が必要 (R と違う値にする方針、以前の判断・この文書の方針と衝突、通常範囲のビットが変わる、複数の妥当な案、範囲が大きい)
  - **C:** 再現しない・修正済み・既存の not planned の方針に該当 (判定だけ)
- 出力: Issue ごとの表 (分類・根拠・ファイル)、A の処理順 (簡単で独立なものから)、B のまとめ方 (同じ根の Issue を 1 つの質問に)。止まりうる呼び出しは実行させない

### 2. A の修正 (修正用のエージェントを 1 つずつ順に。同じ作業ツリーなので並行にしない)
- 1 エージェントに 3〜5 件 (同じファイル・手法のものをまとめる)。共通のブリーフ (下の「エージェントのブリーフ」) を scratchpad に書き、各エージェントに読ませる
- 各エージェントは 1 Issue 1 ローカルコミット。push・Issue への書き込みはしない
- 途中で判断が要ると分かったら、コードを変えずにログに案を書いて次へ進む (→ B に回す)
- 報告を受けたら、私 (メインのセッション) が「計画と違う点」「エージェント自身の判断で足したこと」を拾ってユーザーに伝える

### 3. B の下準備 (読み取り専用のエージェント。修正用と並行してよい)
- リポジトリの編集・git stash・checkout を禁じ、試作は scratchpad の src の複製で行わせる (同時に動く修正用のエージェントの stash に巻き込まれないため)
- グループごとに、再現・R の値・真の値 (Rmpfr)・案 2〜3 個 (利点・欠点・通常範囲のビットが変わるか・fixture で変わる件数・作業量)・推奨を scratchpad のファイルに書かせる。AskUserQuestion の質問の案まで作らせる
- 並行は 1〜2 個まで (CPU 負荷で実行時間のテストが落ちやすくなる)

### 4. C の判定 (エージェント 1 つ)
- 判定とログ (`docs/review-logs/review_fix_log_issueNN.md`、英語) を 1 件 1 コミット。必要なら再現しないことを確かめるテスト

### 5. ユーザーの判断 (ユーザーがいるとき)
- B を AskUserQuestion でまとめて聞く (1 回 4 問まで、2〜3 回に分ける)。推奨を先頭に、下準備の数値を説明に入れる
- 答えを scratchpad の user_decisions.md に記録する
- **Plan モード** (EnterPlanMode → ExitPlanMode) で実装の計画 (グループと順番) の承認を得てから、2. と同じ形で実装させる。計画で承認したローカルコミットは、その都度コミットしてよい。計画の外のコミットは提案して待つ
- 実装中に下準備で見落とした判断が出たら、その場で AskUserQuestion で聞く (セッション 10 の #145 の 1e-9 の幅)。エージェントが動いている間は src を直接編集しない (stash に巻き込まれる)

### 6. push と close (ユーザーの指示があるとき)
- push は上の「コミット」の手順で
- **close は push の後だけ。** push 前に close すると、レビュアーが push 前のソースを見て再オープンする (#109〜#111)
- close comment は各ログの末尾の下書き (英語) を使う。スクリプトで「## close comment」の節を抜き出し、`<commit of #NN …>` を `git log --grep='#NN'` の修正のコミットのハッシュに置き換え (ログだけのコミットは除く)、"(Not pushed yet.)" を消して `gh issue close N --reason completed|"not planned" --comment "$(cat file)"`。先に一覧を出して確かめてから流す

### エージェントのブリーフ (scratchpad に置き、修正用・判定用のエージェントに読ませる)
- **「サブエージェント・fork を起動しない (手分けせず自分で順に進める)」を必ず書く** (CLAUDE.md)
- 最初にこの文書の「1 件ごとの手順」「方針」「共通基盤」「教訓」「R や rStats.js をその場で動かすとき」「注意点」を読む。HANDOFF.md 自体は編集・コミットしない
- ユーザーが不在のときは Plan モードに入らない。代わりにログの冒頭に「計画」(意図と選んだ理由) を書く
- テスト: `test/issueNN.test.ts`、`git stash push -- src` で修正前に落ちることを確認 (止まるテストは流さない、stash pop を忘れない)、Issue ごとは新しいテストと関係するテストファイルだけ、全体 `npx vitest run` はエージェントの最後に 1 回 (実行時間のテストの偶発的な失敗は単独で流し直す)、`npx tsc --noEmit -p . > scratchpad のファイル` の終了コード。受け皿の形 (元の結果が有限でない・範囲外のときだけ動く) なら、既存のテストと fixture が通ればビット不変の確認として足りる (大きな前後比較のスイープは作らない)。参照値は数点、ログは短く (セッション 11 のユーザーの指示)
- R と違う値なら docs (英語と ja)。ログは `docs/review-logs/review_fix_log_issueNN.md` に英語で、末尾に「## close comment」(英語、"(Not pushed yet.)" で終える、ハッシュはプレースホルダ `<commit of #NN, see git log --grep='#NN'>`)
- 1 Issue 1 ローカルコミット (`git commit -F - <<'EOF'`、`git add` はファイルを指定。メッセージは `git log --oneline -20` の形、末尾に (#NN))。push・Issue への書き込みはしない
- 範囲外で見つけたことはログの「範囲外として記録」に書く。ついでの修正はしない。止まりうる呼び出しは評価回数の上限で止め、node が残ったら報告する (自分で kill しない)
- 最後の報告は短く: Issue ごとに「修正 (ハッシュ)」「判断待ち (要点)」「再現せず」、全体テストの結果
- (セッション 12 で追加) tsc は各 Issue のコミット前に流す (型エラーの追いコミットを作らない)。止まりうる呼び出しを `timeout npx tsx` で流さない (timeout は node を止めず、修正前の pretty で node が残った)。R の値を期待する既存の fixture が 5 件を超えて変わる修正は、コードを変えずに判断待ちにする (#314 で 43 件が黙って substitute になった。結果的に了承)。コミットのメッセージに対象以外の Issue 番号を `#NNN` で書かない (close のスクリプトが `git log --grep` で拾う。`issue NNN` と書く)
- B の実装のブリーフには、ユーザーの決定 (scratchpad の user_decisions.md の番号) と下準備のファイル (prep/<グループ>.md) を読ませる。下準備の前提が実装で崩れたら (#351 の「15 水準以下は R と同じビット」)、その場で聞き直す

### 1 件ごとの手順 (エージェントが従う。ユーザーと対話で 1 件だけ処理するときも同じ)
1. `gh issue view N` を読み、今の main とローカルの R 4.5.2 (Rmpfr あり) で再現する。レビュアーには R の環境がない。指摘が誤りのこともある
2. R と違う値にする、以前の判断を覆すなど、方針が要るときはユーザーの判断を仰ぐ (不在なら判断待ちとしてログに案を書く)
3. **コードを変える前に Plan モード** (ユーザーがいるとき。#9・#21 で飛ばして指摘された)
4. 修正し、`test/issueNN.test.ts` を足す。stash で修正前に失敗することを確かめる。全体テストと tsc
5. R と違うときは docs (`docs/differences-from-r.md` と `docs/ja/`) に書く
6. `docs/review-logs/review_fix_log_issueNN.md` を**英語で**書く (コードを変えないときも判定を書いてコミットする)。ログはすべて `docs/review-logs/` にある (2026-11-03 に直下から移した。それより前のログは日本語のまま)
7. コミット (上の進め方の範囲で)
8. push の後に close

## これまでの Issue の結果

- **Issue #21〜#35 の結果:**
  - 修正: #21 varimax の 0 の行、#23 pbvnorm の相関 −1、#24 dbinom・dmultinom の分母の溢れ (と、確認中に見つけた n − x が double でない dbinom の厳密な偏差 `272eb5a`)、#25 dcauchy、#26 chisq の負のサブノーマル df、#27 pexp の log (ユーザー判断で直す)、#30 rbeta (ユーザー判断で直す。乱数列は R とずれる)、#31 rbinom (q が 1 に丸まるときだけ)、#33 pnorm の log の裾、#34 distSummary pareto、#35 データフレームの `__proto__` 列
  - 変えない: #22 hist (R と同じエラー、テストだけ)、#28 survdiff の閾値 (ユーザー判断)、#29 rgamma の NaN (以前の判断どおり)
  - #32 は再現しない (df1 < 2 は log の密度を通る)。ユーザーの指示で、通らない枝を削除した
- **#35 の残り (記録だけ):** `src/models/aovEz.ts` 287 行目の `bdata[b] = ...` も列名をブラケットで書いている (被験者間の因子名が `__proto__` だと消える)。列名はモデル式の変数名にも使うので範囲外にした。必要なら別に直す
- **Issue #36〜#62 の結果 (セッション 7):** 各 `review_fix_log_issueNN.md` に判定と R の値
  - 修正: #36 cov・cor と #38 scale の行の長さがそろわない行列、#37 wilcox の厳密な mn と signrank の上限 (n ≥ 2^27 で NaN、ユーザー判断)、#39 pivotWider の受け継いだプロパティ、#41 pkolmogorovLimit のサブノーマル、#42 chisqTest の水準のコードポイント順、#44 混ざった群のラベル (`factorLabels`・`compareLabels`、groups.ts) と #45 mcnemarTest、#46 pearsonTest (ユーザー判断、nortest と違う)、#49 wilcoxTest のすべて同順位で p = 1 (ユーザー判断、R 4.6 と同じ)、#50 propTrendTest の NaN の score、#51 integrate の中点の溢れ、#52 mulDD、#53 firstTrue (終わらない場合も見つけた)、#54 logAddExp、#55 diag と cbind・rbind の長さ 0 (ユーザー判断で cbind・rbind も)、#56 kappa・ginv (`svdScaled`)、#57 qr の LINPACK のノルムの更新 (R の t < 1e-6、ユーザー判断。規則は issue の説明と R の出力から。R のソースは読まない方針を保つ)、#58 lmerContest の対比の大きさ、#61 optimize の非有限値の置き換え (ユーザー判断、R と同じ)、#62 prodErrScaled
  - 変えない (not planned): #40 corTest のほぼ完全な相関 (double-double の精度の限界、ユーザー判断)、#43 fisherTest の confLevel 0・1 (R も拒否)、#47 propTest の小数の計数 (R も受け付ける、ユーザー判断)
  - issue の主張が R と違った例: #43、#46 (nortest は cut でなく tabulate)、#49 (R 4.5.2 は NaN)、#47。issue の再現例が成り立たなかった例: #40 (2 + EPSILON は 2)、#41 (1e-200 は正しい)、#61 (終わらない例はない)。必ず R と実行して確かめる
- **Issue #63〜#66 の結果 (セッション 8):** 各 `review_fix_log_issueNN.md`
  - #63 修正: 非心ベータの ncp/2 がアンダーフローして 0 (ncp = 5e-324) のとき `leftTailLog` が 0 × −Inf で NaN。j = 0 の項だけを返す
  - #64 再現しない (not planned): 非心 χ² の mixture の添字が 2^53 を超えて止まる、という主張。`sumLower` はピーク (j ≈ z/2、z ≤ 1e6) の近くから始まる。3400 件の掃引で確認
  - #65 変えない (not planned、ユーザー判断で以前の判断を保つ): dnbinom の size + x が溢れると NaN (22・55 回目と同じ)
  - #66 修正 (ユーザー判断で全範囲): 非心 t の遠い裾の log が δ ≳ 1e7 で広く壊れていた (NaN・+Inf・log Φ(−δ))。下の共通基盤「非心 t の遠い裾」。手法の教訓は auto memory の numerical-accuracy-lessons
  - 範囲外として記録 (#66): `pgamma(1.5, 1.5, 上側, log)` が R と 3e-15 違う (gammaInc)。L 大でない修正前の経路の極小の df の dt (`dt(1e-152, 1e-310, ncp = 1e5, log)` が −4.99e9、見積もり約 −5363)。#64 の log の lower が 1 ulp 小さい (−5.000000000000001e307、正しく丸めると −5e307)
- **Issue #67〜#78 の結果 (セッション 8 の後半):** 各 `review_fix_log_issueNN.md`
  - #67 再現しない (not planned): pbvnorm の相関 −1 は #23 で修正済み (レビュアーは古いソースを見ていた)
  - #68 修正: dmultinom で割合 q_k か 1 − q_k が 2^-1022 未満だと log が −Inf (R も −Inf)。その項を割合の log から作る。途中で、和が溢れて縮めた重みが 0 になると確率 1 の打ち切りが早まる不具合も直した (review23 のテストの期待値を真値に)
  - #70 修正: seq で端点の差が溢れる (lengthOut の中間が NaN、by はエラー)。半分の座標で計算して 2 倍
  - #71 修正 (ユーザー判断で R と違う): qrSolve が解の NaN を 0 にしていた (R の qr.solve も同じ)。使わない列だけ 0
  - #72 修正: expm の order の上限を R の整数の範囲 (2147483647) に (2^53 超で止まらなかった。R もエラー)
  - #73 修正: kappa の 1e308 規模の行列 (直接の三角・QR・exact の 1/∞ ノルムが Inf・NaN)。rcond と同じく 2 の冪で割る。ただし割ると 0 でない要素が正規化数の下に落ちる行列は割らない (diag(1e-200, 1, 1e200) は R と同じエラーのまま)
  - #74 修正: optimize の tol = 0 を R と同じく拒否。localMin はステップで点が動かなければ終える (tol = 5e-324 では R も止まらない)
  - #76 修正: optim の maxit を R の as.integer と同じに (範囲外・NaN はエラー、小数は切り捨て)
  - #78 修正 (ユーザー判断で #16 の判断を覆す): cor の対角で、自己相関が定義されない列 (定数、everything で NaN を含む) は NaN。R は 1 (issue の「R は NA」は誤り)
  - 範囲外として記録: dmultinom の線形の値のサブノーマルの最下位 1 単位 (#68)、2 億個の seq は JS の配列の長さの制限 (#70)、expm の巨大でも範囲内の order は遅い (#72)、uniroot は tol = 0 を受け付ける (R は拒否。maxiter で止まる、#74)
- **Issue #81〜#124 の結果 (セッション 9):** 各 `review_fix_log_issueNN.md` に判定と R の値
  - 修正: #81 pretty の溢れる範囲 (seqLength を使う)、#82 merge の型の違うキー (ユーザー判断で R の match と同じ共通の型に。docs の意図的な違いを消した)、#83 omega の minres が下限 0.005 に張り付くときだけ真の勾配で仕上げる (ユーザー判断、案 C。内点は psych と同じビット)、#87 coxph の 1e308 規模・サブノーマルの共変量、#89 review47 の besselY の参照値 (Windows R の sprintf の誤り)、#90 MT の位置 0 は R と同じく作り直す・2^31 以上は拒否、#92 extraDistr の乱数の無限のパラメータ (ユーザー判断: r を q にそろえる)、#93・#94 r2dtable・sample の n・size を切り捨ててから判定 (R と同じ)、#95 dnbinom (mu) で p か q が double で 0 になる (比を 2^1100 倍で持ち dbinomRawDD に shift、ユーザー判断で dnbinom だけ)、#96 dnbeta の x = 1 の log、#98 seqLength・approx・spline・seq の長さ、#99 isSymmetric・checkCovmat (R の all.equal と同じく等しい要素を除く。ユーザー判断で checkCovmat は元の単位)、#101 roundR の 10^k を二乗の繰り返しで (R と 2000 例一致)、#103 pnbinom・qnbinom (mu) の同じ比 (betaIncTinyX に正確な log を渡す。ユーザー判断は「級数の範囲だけ」だが、その範囲が全域だった)、#105 ddDiv の極小の被除数、#106 log1pmx の x² = 0 (計算量だけ)、#107 lchoose の 0 に落ちる係数、#109 dlogis の巨大な尺度、#110 dlaplace の 2 回の丸め、#111 dweibull の log(shape/scale) (差が 2^-20 以内だけ log1p)、#112 dlnorm の halfSquare、#114 dnbeta のサブノーマルの形状、#115 nchisq の 0 × Inf、#116 F の m x ≥ 1e290 で n がさらに大きい場合、#118 超幾何の m + n が厳密でないとき台の中は NaN (方針「2^53 超は NaN」)、#119 pbvnorm の ±40 を超える境界を無限に、#120 distSummary lnorm の小さな sdlog、#121 qtriang の端の最頻値、#122 integrate の半分にした absTol、#124 ode rk4 の極小の h と巨大な傾き
  - 変えない (not planned): #86 rhyper (R も同じく乱数を引く)、#88 lmer の閾値 (#12 で修正済み)、#91 rweibull の NaN (19 回目の判断)、#97 `__proto__` (#35 で修正済み)、#100 zapsmall の digits = Inf (内部関数、R 4.6 の変更)、#102 qbinom の小数の size (ユーザー判断で NaN を保ち、docs の R の説明を直した)、#104 dnbinom size = 0 (R も 0)、#108 無限の尺度の中央値 (24 回目の方針)、#113 dgamma の log 密度が 0 に近いときの相対精度 (ユーザー判断で記録だけ)、#117 pbinom の n − x の丸め (1 ulp、R と同じ)、#123 grad の大きな r (ユーザー判断で記録だけ、numDeriv と同じ値)
  - issue の主張が R と違った・誇張だった例: #86・#104 (R を実行していない)、#102 (docs の R の説明も誤っていた)、#117 (「大きく失う」は 1 ulp)、#122・#124 (期待値が 10 進数で、double の真値でない)。修正済みの古いソースを見ていた例: #88・#97
  - 範囲外として記録: #103 の size < 1e-305 の上側の log (betaIncTinyX のサブノーマルの lt、相対 2e-6)、#105 incbet の sDiv、#115 R の dnchisq の log が 900 ずれる (未調査)、#87 サブノーマルの共変量の係数が ±Inf で linearPredictors が NaN
- **セッション 10 (2026-11-03 の夜〜朝、Issue #125〜#171):** ユーザーの就寝中に、判断の要らない Issue をエージェントに 1 グループずつ順に修正・ローカルコミットさせ、判断の要るものは下準備 (案と推奨) だけした。朝にまとめて AskUserQuestion で判断をもらい (すべて推奨案)、Plan モードの承認のあとで実装した。各 Issue の判定・R の値・範囲外はログに
  - **ログの場所 (ユーザーの指示):** レビューのログはすべて `docs/review-logs/` に移した (`9de95ea`)。**今後のログは英語で書く** (既存は日本語のまま)
  - #109〜#111 はレビュアーが push 前に再オープンしていた。修正が origin にあることを書いて再度 close した
  - 修正: #125 splinefun・splinefunH の節点の範囲の溢れ (spline も範囲で判定)、#127・#131・#132 分解の全体の縮小を 2^256 まで (`decompositionExponent`。`rangeExponent` は lmerTest のため変えない。kappa の LINPACK の推定は従来の縮小のまま)、eigen だけ 2^459 (dgeev と同じ) と固有ベクトルの正規化 (`a82962b`)、#128 solve、#130 QR (結果が有限でないときだけ分解し直す)、#134 Kendall n = 2、#135 #158 非心 F、#136 #138 非心 qt の上端、#139 #140 #141 検定の総数の溢れ、#143 cohensD の探索、#144 triang の歪度、#145 #146 離散分布の整数判定 (下の方針)、#147 dnchisq、#148 pbeta のサブノーマルの形状、#149 perm、#152 dmultinom (合計の溢れは NaN)、#153 ptukey、#154 pAdjust、#155 pwr2p2n、#156 power リンク、#157 非心 qchisq、#159 #165〜#168 glm の作業重み、#160 binomial の 2 列応答の溢れはエラー、#161〜#163 deviance の bd0 型、#164 inverse.gaussian の deviance、#169 Cook の距離
  - 変えない (not planned): #126 #129 #133 #137 #142 (issue の主張が誤り) #150 (再現しない、テストだけ) #151 #170 #171
  - 夜の作業の手順は scratchpad の brief.md の形 (Plan モードの代わりにログの冒頭に「計画」、1 Issue 1 ローカルコミット、push・Issue 操作なし、判断が要ればコードを変えずにログに案を書いて次へ)
- **セッション 11 (2026-11-03、Issue #172〜#272 の 91 件):** 標準の進め方で処理。分類は 2 つのエージェントに分けた (A 52・B 17・C 21)。B は 12 問をまとめて聞き (すべて推奨案)、Plan モードで A の列に B を挟む順番の承認を得て実装。実装中・C の判定中に出た判断も、その都度 AskUserQuestion で聞いた (すべて推奨案)。判断の一覧はこの節の末尾。close は 90 件 (completed 78、not planned 12: #177 #204 #205 #220 #222 #233 #234 #251 #252 #253 #257 #267)。#221 は method と rule の 2 コミット
  - **ユーザーの判断 (詳細は各ログ):** #195・#208 内積の和が有限でないときだけ BigInt の厳密な内積 (`src/linalg/dot.ts` の `rescaledDot`。matMul・crossprod・tcrossprod・lm と glm の predict・fitLm の重み 0 の行、#174 も)、#207 expm Higham08 は非零が 2^-1022 未満に落ちるときだけ内部で平衡化 (サブノーマルのビットが変わるのも了承)・#205 eigen は記録だけ、#200・#202・#272 巨大な自由度の power は両方の自由度 > 1e16 で F の正規近似 (閾値は最初 1e20、ユーザー判断で 1e16 に)、非心 F の pf と df は df2 巨大で χ² の極限、#179 glmConfint の level < 約 1.6e-3 は級数の cutoff + 逆プロファイルの補間、#227 cut の breaks 2 個未満・#229 hist の有限でない breaks・#221 approx の rule 1・2 以外・#213・#246 数値微分の正で有限でない刻み・#248 optim の fnscale ±Inf はエラー (方針「意味のない入力はエラー」)、#232 mantelhaenTest exact と fisherTest 2×2 の台が 2^24 超は確保前に RangeError、#243 triang は常に差の形 (通常範囲のビットも変わる)、#240・#249 weibull・kumar の形状 > 100 は T = k·expm1(log e/k) の座標で積分、#263 pwr の正規系は α/2 < 1e-8 だけ上側の分位点、#260 nonEstimableRows は 2 の冪で正規化、#268 mcnemar の補正を 0 で止める、#254 survfit の中央値は survival の minmin、#236 distSummary nbinom の mu/size < 2^-26 は mu と size から直接 (と、最頻値の探索の始点・BigInt の判定)、#172・#173・#175・#212 は受け皿で直す、#194 の重み 1e±308 の誤った有限値は記録だけ (行のピボットが要る)、docs の AIC の古い記述 (#177) を直した
  - **教訓:** (1) メインのセッションが Plan モードに入ると、動いているエージェントも編集できなくなって止まる (hist のエージェントが途中で止まり、SendMessage で再開した)。修正用のエージェントが動いている間は Plan モードに入らない。(2) テストが過剰で 1 エージェント 10〜47 分かかった。ユーザーの指示で、Issue ごとは関係するテストだけ、全体テストは最後に 1 回、受け皿の形の修正では大きな前後比較のスイープをしない、参照値は数点、に変えた (memory の batch-issue-workflow と scratchpad の brief.md の書き方)。変えた後は 5〜14 分。(3) エージェントのスイープが止まる呼び出し (nbinom の最頻値の探索) で node を残した。`timeout` は npx を止めても node を止めない。(4) 分類で C とした 20 件のうち 7 件は、今の main で改めて確かめると公開 API から再現した (内部関数だけ、issue の例は正しい、など)。C も判定のエージェントで必ず確かめ直す
  - **レビュアーへの追加依頼の docs/review-prompt.md への反映案:** 「監査の前に」に docs/review-logs の検索と differences-from-r の方針の確認、「判定の基準」に公開 API (src/index.ts の export) から再現できないものは対象外・期待値は実際に渡る double から mpmath か有理数で求め 16 進でも・再現は数秒で終わるもの・別の原因で起きていないか、「Issue の書き方」に R の実行 (未確認と明記)・通常範囲でも起きるか・直すと何が変わりそうか、と 1 件にまとめる例 (hist の各規則、distSummary の 1 分布)
  - **範囲外として記録 (各ログ):** #230・#231 hist FD の MAX_VALUE は 5 桁の丸めで Infinity、#226 2×2×K で度数よりはるかに小さい差は丸めで消える (R も)、#210 対応のある検定の x − y の溢れ・正規近似の区間、#232 2^24 の上限内でも層 2 つ n = 4e6 で約 20 分、#270 onewayTest の不等分散・flignerTest・Games-Howell の極小の分散、#195 系の残り (glm の重み 1e±308 など)、#236 prob 指定で size > 2^53 の最頻値の判定の丸め、#202 χ² の極限の条件が ncp ≈ n/1e8 で相対 1e-9、#249 kumar の b = 1e-300 と平均が 1 を 1〜2 ulp 超える、#269 sigLevel 0 は NaN (R と同じ、他の pwr は 0)、#173 で見つけた gaussian glm の y = [0, 1e-10, 0]・重み 1e308 が "no valid set of coefficients"、#213 grad の d 0.5 at 1e308 がサブノーマルの真の値を誤る、#267 expm の 1e200 の冪零行列が NaN
- **セッション 12 (2026-11-03、Issue #120・#273〜#394 の 118 件):** 標準の進め方で処理。分類は 2 つのエージェント (A 60・B 26・C 32)。B の下準備も 2 つ。B は 23 問を 5 回に分けて聞き、実装中に 2 問 (gamesHowell、contr.poly の前提) を追加 (すべて推奨案)。Plan モードで 14 手順 + C の判定の順番の承認を得て実装。close は 118 件 (completed 91、not planned 27)。各 Issue の判定・R の値・範囲外はログに
  - **ユーザーの判断 (詳細は各ログ):**
    - 確保量・作業量の上限: 配列 1 本は 2^24 個 (#232 と同じ)、時間はこの PC で 10 秒前後を目安に関数ごと。exact の超過は RangeError で "use exact: false" を案内。ks (計算量 2^33、#307)、ansari (配列 2^24・手数 2^32、#308)、Kendall n ≤ 1290 (#316)、Jonckheere (配列 2^24・手数 2^32、#321)、Hommel n ≤ 65536 (#391)。r2dtable・chisqTest・fisherTest のシミュレーションは総数 2^24 (#336・#285・#286。r2dtable の n = 0 は R と同じく 2147483647 まで)。確保をなくせるものはなくす (integrate の作業配列を伸ばす #369、pearsonTest #305、適合度のシミュレーションを列ごとに・B·n ≤ 2^27 #287)
    - エラーにしたもの (方針「意味のない入力はエラー」): tTest の標準誤差 0 (#314、R の NaN・±Inf の fixture 43 件を substitute)、propTrendTest の全群 0 か 1 (#319) と異なる score が 2 個未満 (#318、#50 の NaN を覆す)、TukeyHSD・tukeyTest の df < 2 (#315)、seq の逆向きの無限の by (#274。同じ向きは [from] のまま)、aovEz の重複した因子名 (#296)、lu の非有限 (#343)、optim の gr の非有限成分 (#355)。gamesHowellTest の対の df 1〜2 は NaN のまま (記録だけ)
    - R に合わせたもの: svd の小数・Inf の nu・nv は切り捨ててから次元で切る (#273)
    - 値を正しくしたもの: jonckheereTest は 1 − pnorm < 1e-8 だけ上側を直接 (#280)、Welch は定数の群 1 つなら極限・2 つ以上はエラー (#313)、chisqTest の stdres は常に 2 倍長 (#382、fixture 212 セルが許容内で変わる)、ICC two-way の MSE は桁落ち (ssTotal の 2^-20 未満) のときだけ残差から (#392)、onewayTest (Welch)・varTest・leveneTest の群の縮小に受け皿 (#393。Welch は仮数と 2 の冪の組、`ldexpWide`)、contr.poly はすべての水準で 3 項漸化式 + 再直交化 (#351。今の QR も R と最終桁が違っていた)、coxph は exp(η) が溢れるときだけ log-sum-exp のずらし (#367)、sum は 2 倍長が落ちうるときだけ BigInt で厳密 (#374)、distSummary の pois λ = 0・nbinom size = 0 は点質量 (#379)、plaplace・dlaplace の q = μ = ±Inf は NaN (#338、R・extraDistr と同じ)、qgamma・pgamma の巨大な shape で誤る範囲は NaN (#368)
  - **教訓:** (1) 下準備の前提 (「通常範囲は R と同じビット」) が誤っていることがある。実装のエージェントが前提を確かめて報告した (#351)。(2) エージェントが fixture を大量に substitute にした (#314)。以後のブリーフで「5 件超は判断待ち」にした。(3) C の 32 件は確かめ直しても再現しなかった (セッション 11 と違い、分類のエージェントが今の main で流していた)。(4) 修正用のエージェント 1 つは 2.5〜18 分。分類 10〜14 分、下準備 15〜22 分
  - **範囲外として記録 (各ログ):** #321 wilcox の分布の表 (`dwilcox1`) は長さの制限だけで、2 群が数千ずつだと数分 (見積もり。wilcoxTest・dwilcox 系に時間の上限を置くかは別の判断)、#340 interp.ts 449・626 行の中点 `>> 1` (利用者のノット、2^31 超)、#374 mean (meanDD)・cumsum も sum と同じく誤る (5 × mean([1e20, 1e3, 1e-10, −1e20, −1e3]) = 1.0004e-10)、#299 aov の処置側の共変量の Inf で NaN の表 (R はエラー)、#363 aggregate も 2^31 セルでエラー (R は観測された組だけ)、#343 chol の Inf・NaN (R はエラー)、#274 seq(0, 1e-300, by = −1e300)、#380 monoH.FC と節点 3 個以上の y の差の溢れ、#394 rk4 の加重和の溢れ、#393 定数の群と縮小で落ちる群が同時の Welch、#347 anova(f) の "essentially perfect fit" の警告 (未調査)、#311 powerAnovaTest の betweenVar 0 で groups、glm (#371〜#375) の平均から離れた binomial の溢れ・y = 0 の poisson 行の 2w·mu・AIC の Inf・NaN・Gamma の重み 1e308 × 2、#385・#386 distSummary の比の形の歪度と kumar の平均 8 ulp、#362 L-BFGS-B の Rosenbrock が R と相対 2e-8
- **セッション 13 (2026-11-03〜04、Issue #395〜#486 の 80 件):** 標準の進め方で 4 バッチ (#395〜#434 の 34 件、#436〜#462 の 22 件、#463〜#468 の 6 件、#469〜#486 の 18 件) を処理。分類は各 1 エージェント (A 15・B 3・C 16、A 13・B 4・C 5)。B と実装中の判断 (#461、#427 の docs) はすべて推奨案。close は 56 件 (completed 32、not planned 24)。各 Issue の判定・R の値・範囲外はログに
  - **ユーザーの判断 (詳細は各ログ):** #407 rsignrank は n ≥ 2^27 で RangeError、#395 内積は |和| < 2^-969 で 0 でない因子の積が 2^-1022 未満に落ちたときだけ rescaledDot (`checkDot`・`checkedDot`、6 か所)、#404 expm は縮めると要素が 2^-1022 未満に落ちるときだけ p の下限 5 を外す (Pade の 2^-1074 は記録だけ)、#437・#445 pivotWider は tidyr と同じく値の列 1 本の全セルで共通の型・valuesFill はその型に変換、#441 namesSep は R の gregexpr と同じ分け方 (tidyr を再現)、#458 qrX は ncol > max(行数, 列数) だけ RangeError (ncol 0 は R どおり空)、#461 式の変数名は先頭 `[\p{L}\p{Nl}.]` か ASCII 以外の `\p{Nd}`・2 文字目以降は `[\p{L}\p{Nl}\p{Nd}\p{M}._]` (Windows 版 R より広い)、#427 docs の rhyper の行に乱数を 1 個引くことを追記
  - **エージェントの判断で R・extraDistr と違う値にしたもの (docs に記録):** #425 rlaplace の sigma = Inf と #428 rtriang の無限の端点は q にそろえて NaN (#92 の方針)。#396 rnorm・#408 rweibull・#409 rgamma/rinvgamma・#397〜#402 の interp.ts は R も誤る (Inf・0・NaN) 範囲の受け皿
  - **教訓:** (1) 分類の R の値が誤っていたことがある (#455 の係数、#402 の「R は正しい」は pracma も NaN)。実装のエージェントが R で確かめ直して気づいた。(2) 下準備が分類の「tidyr は不規則」を覆した (#441、gregexpr の決まったループ)。(3) 修正用のエージェント 1 つは 7〜77 分 (#424〜#409 の乱数の 5 件が最長)、分類 7〜9 分、下準備 12〜14 分
  - **範囲外として記録 (各ログ):** sampleInt に 2^24 の上限がない (#414)、laplace の sigma = Inf の d・p・q が NaN で 24 回目の方針と合わない (#425)、extraDistr の qtriang(p, −Inf, 0, −1) は −Inf (#428)、rweibull の冪のアンダーフロー・rinvgamma の 1/beta の溢れ (#408・#409)、rwilcox は最大 8 GB の確保 (#407 の下準備)、expm Pade の 2^-1074 (#404)、glmPredict のサブノーマルの 2 回の丸め (#395)、splinefunH の 2 階微分の割線の溢れ・barylag の 2^-300 の恒等関数 (#399〜#402、レビュアーが #466・#467 で報告済み)、lmerHypotheses.ts 123 行目の contrasts の継承プロパティ (#452・#454)、aggregate の式と `Pair(a, b)` は ASCII の名前だけ (#461)、valuesFn の結果がすべて null のとき fill を変換しない (#437)、サロゲートペアを `""` で分ける (#441)、pivotLonger のマッチしない任意のグループは null (tidyr は ""、#446)
  - **3 バッチ目 (#463〜#468) の判断:** #467 barylag は第 2 形の分母が打ち消して失われ (|den| < 2^-100 Σ|t_j|)、分子が残る (|num| ≥ 2^-26 Σ|t_j y_j|) ときだけ第 1 形 (pracma と違う)、#468 cronbachAlpha は相関行列が特異なときだけ SMC を lm(x_i ~ x_-i) の R² から (psych の Pinv と違う。項目数 ≥ 被験者数では G6 は常に 1)、#464 で見つけた mean([1, NaN], { trim: NaN }) を R と同じくエラーに (`29f9122`、#464 自体は not planned)。#465 は 2^-1022 に丸め上がる積だけ厳密に比べる (丸め下がる対の場合は記録だけ)、#463・#466 は A
  - **教訓 (3 バッチ目):** #467 の実装のエージェントが、数分かかる検証スクリプト (b7_check.ts、ランダム 400 組 + BigInt の厳密計算) を流し、シェルの時間切れで裏に回って、その終了を待って止まった。ユーザーの許可で node を止め、SendMessage で再開させた。ユーザーの指示で、ブリーフに「シェルを裏で動かさない (run_in_background を使わない)」「1 分を超えそうな検証スクリプトは流さない」を足した (auto memory の agent-no-background-work)。同時に、前のセッションの npx tsx の node が 12 時間 39 分 CPU を使い続けていたのを見つけて止めた。エージェントが止まったら `ps -ef | grep tsx` と tasklist で CPU 時間の長い node を探す
  - **4 バッチ目 (#469〜#486) の判断:** #483 ksTest は上の共通基盤のとおり (R の fixture 5 件・SciPy 9 件が真の値に近づく)。docs の GLM の Links の項が「R のクリップを持つ」と 62・63 回目の判断と矛盾していたのを直した (`6462ec8`、#477・#478 は not planned)。#473 meanDD に #374 の失った量の上界と BigInt の厳密和 (`boundedSum` を sum と共用)、#472 coxph の事象 0 件は survival の zero-event の枝と同じ値、#479 inverse.gaussian の AIC は dev/sw も溢れるとき log(dev) − log(sw) (エージェントの判断)。C の #470・#475・#476・#485・#486 は R 4.5.2 と一致 (レビュアーの主張は R trunk や誤った R の値)
  - **教訓 (4 バッチ目):** 修正用のエージェントの 1 つが 131 分かかった (#481〜#469 の 6 件)。また push 前のコミットを `git commit --amend` で書き換え、別のログのハッシュが切れた (`9b687f8` で直した)。以後のブリーフには「amend しない」を明記した。close のスクリプトは src・test を変えたコミットだけをハッシュに使うので、docs だけのコミットを参照する close comment (#477・#478) は手で置き換えた
- **環境 (セッション 9):** ユーザーの許可で、ローカルの R に extraDistr 1.10.0.5 を入れた (#92)。deSolve は入っていない (#124 で R の値は確かめていない)
- **教訓 (セッション 9):**
  - R の値を double で受け取るときは、16 進の浮動小数点リテラル (`0x1.…p…`) で入れ、`sprintf("%a")` で出す (Windows R の 10 進の変換を避ける、#101)。R の `writeLines` は CRLF で書くので、JS で読むときは行ごとに trim する
  - Rmpfr の参照値の級数は、打ち切りを結果に必要な絶対精度で決める (1 − 1e-137 から上側を作るなら 2^-2900。#103 で 2^-200 にして参照値を誤った)
  - テストの期待値を推測で書かない。変えない値は修正前の実装 (`git stash push -- src` 中に流す) の値を書く (#111・#118・#119 で推測値が 1 ulp 違って落ちた)。exp(log) を参照にすると log ≈ −700 で 30 目盛りずれる (#109)。「16 で割る」参照も丸めが 2 回入る (#110、BigInt で厳密に 1 回丸めた)
  - GNU sed の正規表現で縦棒を逃がすと「または」の意味になる。表のセルの置換は Python か Edit で行う (#112 でログを壊して書き直した)。Bash のヒアドキュメントにバックスラッシュ 2 個を書くとフックに拒否されるので、スクリプトは Write でファイルに書く
  - 全体テストで落ちうる実行時間のテストに、tukey (distributionProperties)、qtukey・ptukey (extremeAccuracy、extremeParameters) も加わった。ファイル単独なら通る
- **止まる呼び出しの確かめ方 (セッション 8):** src の複製 (scratchpad) の該当ループに評価回数の上限 (超えたら例外) を入れて流す。修正前に止まるテストは stash の確認で流さない (#72・#74・#76)
- **issue の主張が R と違った例 (セッション 8):** #67 (修正済みの古いコード)、#78 (R は NA でなく 1)。必ず R で確かめる
- **範囲外として記録したもの (セッション 7):** 列数を 1 行目で決める箇所 (`rankTests.ts`・`polycor.ts`・`linalg/ops.ts` など、#38)、混ざったラベルの扱い (`table.ts`・`polycor.ts`・`grouping.ts`・`agreement.ts`、#44・#45)、`distributions/summary.ts` の dqagse の大きな端点 (#51)、nt.ts の内部の logAddExp (#54)、optimize の (x − 0.2)² で R と 1 ulp 違う (#61)
- **テストの実行時間の上限:** `test/distributionProperties.test.ts` の signrank (`dsignrank(302775, 1100)` が 1 秒以内) は、全体テストのたびに半分以上落ちる。`test/extremeAccuracy.test.ts` の qf・qtukey、nchisq の qchisq も時々落ちる。どれもファイル単独なら通る。上限の見直しは未着手 (必要なら別に扱うとユーザーに伝えた)
- **止まるテストに注意:** #53 の確認で、終わらない firstTrue を npx tsx で流して node のプロセスが残った (ユーザーが終了)。止まりうる呼び出しは評価の回数を数えて例外で止め、stash 中は `-t` で除く
- レビュアー向けのプロンプトは `docs/review-prompt.md`、監査の台帳は `docs/audit-ledger.md`

## 以前の状態 (セッション 5 まで。外部レビューの回 1〜68)

- **コミット:** 回 1〜68 のコミットは、すべて push 済み (2026-11-01)
  - push は、必ずユーザーの指示を待つ
  - 外部レビュアーは添付の zip (`src(3).zip` など) を見ている。未 push のコミットがあるので、レビュアーのコードに 42〜67 回目の修正が入っていないことがある。指摘が修正済みでないかは、必ず今のコードで実行して確かめる。65・66 回目は多くが修正済みの指摘の繰り返しだった。66 回目の MOD-039 のように、R と照らすと指摘そのものが誤りのこともある (zip を新しくするには push が必要。push はユーザーの指示があるときだけ)
- **未コミット:** `HANDOFF.md` (この文書) だけ。ユーザーの指示でコミットしない
- **テスト:**
  - `npx vitest run`: 約 518 files、失敗は実行時間のテスト (signrank・tukey) だけでファイル単独なら通る (2026-11-04、セッション 13 の終わり)
  - `npx tsc --noEmit -p .` (テストも含めた型検査): エラーなし
  - `test/distributionProperties.test.ts` の signrank は、実行時間の上限 (`dsignrank(302775, 1100)` が 1 秒以内) で、マシンの負荷によりときどき失敗する。修正前のコードでも起き、ファイル単独なら通る (23・31・36 回目)
- **セッション 3 で対応した回 (22〜41 回目):** 各回のログ `review_fix_log_20261031_NN.md` に、判定・R で確かめた値・修正を書いてある。コードを変えなかった回 (22・37・40・41) は判定だけ
- **セッション 4 で対応した回 (42〜46 回目):**
  - 42: aovEz の特異性の判定 (HANDOFF の判断待ちだった R13・154)
  - 43: coxph の共変量の尺度 (1 回目の No.33)
  - 44: 判定だけ
  - 45: 外部レビュー (確率分布 DIST-001〜008)
  - 46: 45 回目の範囲外で見つけた wilcox・nbinom
- **セッション 5 で対応した回 (47〜68 回目):**
  - 47: 外部レビュー (特殊関数 SPEC-001〜009)。Bessel の極小の x (x/2 のアンダーフロー、連分数の b_1 = Inf)、gamma の境界と負のサブノーマル、lbeta、erfcinv、大きな Bessel の次数の判定
  - 48: 外部レビュー (MOD-001・002、SURV-001、RNG-001・002、HTEST-001〜004、DESC-001)。glmAnova の offset、glm の重みがすべて 0、survival の timefix、BTPE の符号、rexp の極小の rate、binomTest([0, 0])、shapiro・polyserial の溢れ、kappa2、covmat の検査
  - 49: 外部レビュー (LINALG-001〜004、NUM-001・002)。三角方程式の 0 × Inf、prcomp の sdev、determinant の積、matMul の打ち消し、optimize の中点、数値微分の刻みの検査。追加 (ユーザーの質問から): 中心化した値が溢れる場合の sd・scale・prcomp
  - 50: 外部レビュー (13 件のうち 5 件は修正済み)。seq・approx・spline の溢れ、gammainc の 0 の裾、qgamma の逆関数 (二分法)、rbeta の非心・rgeom・rnbinom の溢れる尺度、rmultinom の末尾の区分
  - 51: 判定だけ (新しい指摘なし。再確認された既報は修正済み)
  - 52: 外部レビュー (SPEC-006・007・008)。Bessel の巨大な有限の x (平方根を因子ごとに)、`mulExp` の範囲外の判定 (修正中に見つかった、もとからある停止)。SPEC-008 (転回点の近くで時間が次数に比例) は記録だけ
  - 53: 外部レビュー (SPEC-009・010・011、DIST-003)。choose の積の途中の溢れ (R より正確な値)、bd0dd(0)、dinvgamma の alpha = Inf。SPEC-011 は 47 回目に修正済み (レビュアーの参照値は 10 進数の 1e-323)
  - 54: 外部レビュー (DIST-004・005)。2^53 を超える x で x + 1 が丸めで消える ppois・qpois・pbinom
  - 55: 外部レビュー (DIST-006・007・008)。pnbinom の 2^53 超、dnbinom の size + x の溢れを NaN にそろえる、dhyper は記録だけ。54 回目の穴 (x + 1 の切り上がり、極端な上側の裾の退行) も直した
  - 56: 外部レビュー (DIST-009)。`discreteQuantile` の上への探索のステップが溢れたとき、最大の有限値を確かめる (内部関数。公開関数で届く入力は見つからない)。DIST-010 は修正済み
  - 57: 外部レビュー (HTEST-005〜010)。firstTrue・lastTrue が止まらない、カウントの合計の溢れ・T = 0 はエラー (ユーザー判断)、poissonTest の T の溢れ、信頼水準が 1 に近い上限 (α < 1e-8 だけ上側確率、ユーザー判断)
  - 58: 外部レビュー (HTEST-011〜017) と、確認中に見つけた Fisher の根の精度 (R の uniroot の慣習を再現していた。ユーザー判断で正確な根に)。信頼水準が 1 に近い区間を htest とモデルの全箇所に、chisq のシミュレーションと mantelhaen の正確検定の入力、mantelhaen の溢れ
  - 59: 外部レビュー (HTEST-018〜030。025・027 は修正済み、028 は記録だけ)。KS の極小の正確な p 値、McNemar の不一致ゼロの組、JT の同順位の分散 (ユーザー判断で補正)、quade・fligner の尺度、pAdjust の n = Inf、NaN の 4 件はエラー (ユーザー判断)
  - 60: 外部レビュー (HTEST-031・032、MOD-003・004。MOD-003 はレビュアーが撤回)。dunnTest の同順位の調整値 (ユーザー判断で同順位だけ直す)、dunnett・tukey・glht の群内分散 0 はエラー、anova の比較表に完全適合の警告
  - 61: 外部レビュー (MOD-005〜008。005 は 58 回目に修正済み、008 は記録だけ)。lm の極小の重みでの標準誤差、glm の IRLS の偽の収束 (ユーザー判断で glm2 の規則のステップ半減)
  - 62: 外部レビュー (MOD-009〜013。010 は問題なし、011 は今のまま)。logit・log リンクのクリップをやめて厳密な値に、分離した当てはめに警告 (どちらもユーザー判断)
  - 63: 外部レビュー (MOD-014〜022。015 は R が正しい、021 は修正済み)。probit・cauchit・cloglog・power のリンクも 62 回目と同じ方針で厳密に (ユーザー判断)、cloglog の link を log1p、glmPredict の標準誤差の溢れ、dispersion 指定時の "z value" (R との不一致)
  - 64: 外部レビュー (MOD-023〜028。024 は対応済み)。glm のハット値の行のずれ、Rao の切片 (R との不一致)、glm と lm の標準誤差の説明変数の尺度 (ユーザー判断で lm も)、null deviance の重みの溢れと重み 0 の Inf、glmAnova の入れ子の判定を正の重みの行で
  - 65: 外部レビュー (MOD-029〜038。6 件は修正済みの繰り返し、036 は撤回、032 は記録だけ)。AIC から重み 0 の行を除く、自由度 0 の deviance 残差を計算する (どちらもユーザー判断)、重み Inf のエラーの文言
  - 66: 外部レビュー (繰り返しが多い。MOD-039 は誤り、041 は撤回)。確認中に見つけた glmConfint のプロファイルの NaN (制約つき当てはめが最後の ulp で周期) を修正、glmAnova の未収束の警告 (どちらもユーザー判断)
  - 67: 外部レビュー (MOD-042・044 は修正済み、037・039・041・044 は撤回)。rank 0 の rstandard で小さな残差を 0 にしない (R の lm.influence と同じ)
  - 68: 外部レビュー。新しい確定バグなし、コードの変更なし (ログだけコミット)
- **外部レビュアーの次の予定:** 68 回目のレポートによると、次は GLM の分布・尤度・逸脱度 (binomial の逸脱度と二項係数の定数項、Poisson の y = 0、Gamma・inverse.gaussian の逸脱度と対数尤度、AIC と deviance の関係、整数でない prior weights)

## 方針 (ユーザー判断で確定したもの)

- **数学的・統計学的に正しい値を、R との一致より優先する。** R と違う場合は理由を記録する。R が正しい範囲では R と一致させる (通常の範囲の値は 1 ビットも変えない)
- **R 互換の確認には、ローカルの R を実行する。** R 4.5.2 があり、`Rscript` は PATH にある。pwr・effectsize・afex・lmerTest・lme4・Matrix・expm・survival も入っている。記憶で答えない。スクリプトを scratchpad に書いて `Rscript file.R` で実行する (`Rscript -e` は Windows の引数の扱いで壊れることがある)
- **乱数:** R と同じ乱数を同じ数だけ引き、乱数の状態をそろえる。値を変える場合も、R が引く乱数は引く。テストでは次の `runif(1)` が R と一致することを確かめる
  - 例外 (48 回目、ユーザー判断): BTPE の `rbinom` (n min(p, 1 − p) ≥ 30)。R の rbinom.c は最終判定の Stirling 補正 2 項の符号が逆で、rStats.js は正しい符号にした。受理・棄却が変わると、そこから R と乱数列がずれる。fixture では `streamDifference` (`test/helpers/random.ts`) に BTPE の引数に限って記録する
  - `rexp` の極小の rate (1/rate が溢れる): R は乱数を引かずに NaN。rStats.js は `expRand() / rate` で、1 個につき指数乱数を 1 個引く (48 回目)
  - 同じく R が NaN・NA を返すところで値を返し、必要な乱数を引くもの (50 回目): `rgeom`・`rnbinom` の溢れる尺度 ((1 − p)/p、mu/size。乱数を引いてから掛ける)、`rbeta` の非心で 2 shape が溢れる場合 (χ² の半分を R と同じ乱数で作る)。`rmultinom` は、確率の和の丸めで後ろの区分が引かれなくなる場合だけ R と乱数列がずれる
- **検定の警告は出さない。** htest の結果に警告を返す仕組みがない (P-02、K-01、F-02、SF-03、CH-01)。結果に `warnings` 配列がある関数は別
- **当てはめの警告は結果に引き継ぐ (39 回目):** `lm`・`aov` (誤差層の有無によらない) の `fit.warnings` を、`anova`・car の `Anova`・`aovSummary`・効果量の結果にも、重複を除いて載せる (R は当てはめ時に表示するだけ)
- **2^53 を超える整数の領域:** 誤った値の代わりに NaN を返す (例: `pnbinom(1e308, size = 1e308, …)`、台が 2^53 を超える `phyper`・`qhyper`)
  - 例外 (54・55 回目): ppois・pbinom・pnbinom で x + 1 が正確でない場合 (x に丸められるか、x + 2 に切り上がる。判定は `(x + 1) − x === 1`) は、恒等式で x + 1 を作らずに正しく計算する (P[X ≤ x] = Q(x, λ) + dpois(x, λ)、I_p(x + 1, n − x) = I_p(x, n − x) − ((n − x)/n) dbinom(x))。R は ppois を正しく返すので、R と一致させる方針を優先した。pbinom で n − x も正確でない場合だけ NaN。qpois の探索は ppois1 を通る。pnbinom は I_p(size, x + 1) = I_p(size, x) + dnbinom(x)。上側は「裾 − 項」の差で作るので、極端な裾で 2 つの log が同じ値に丸まって差が分解できない場合 (log で有限でない、線形で 0 以下) は、丸めた x + 1 の従来の計算に戻す (そこでは x の 1 の違いは分解能より小さい)。項が NaN のときだけ NaN
- **無限の尺度は極限として扱う (24 回目):** d/p が極限の値を返す分布では、q も極限の値 (中央値より下で −Inf、中央値で位置パラメータ、上で Inf)
- **尺度 0 は R どおり (24 回目):** ロジスティック・コーシーは d・p が NaN、q が location。正規分布は点質量
- **意味のない入力はエラー:** NaN・範囲外のパラメータ、非有限の許容誤差、検定が定義されない自由度など (33・38 回目ほか)。ただし予測の新データの NaN は、R と同じく行ごとに NaN を返す (40 回目)
  - 57 回目: poissonTest の T = 0 (R は NaN・Inf を返す)、binomTest・poissonTest でカウントの合計が溢れるもの (R は NaN かエラー)。R の fixture は `substitute` に記録
  - 58 回目: chisqTest のシミュレーションで整数でない B と、合計が整数でない適合度検定の度数 (R の p 値は 1 を超えうる)、mantelhaenTest の正確検定の小数の度数 (R は結果を返す)
  - 59 回目: mcnemarTest で不一致の組がない表、符号付き順位の wilcoxTest で差がすべて 0、varTest で両群とも定数、chisqTest の分割表のシミュレーションで小数の度数 (R は NaN を返すか周辺度数を切り捨てる)
  - 60 回目: dunnettTest・tukeyTest・glhtDunnett でプールした群内分散が 0 か残差自由度が 0 (R は p 0、glht は p 1)。群内平方和は double-double なので、厳密に 0 で判定する (相対的な閾値は、分散がごく小さい正当なデータを弾く)
- **信頼水準が 1 に極めて近い区間 (57・58 回目、ユーザー判断):** 両側区間で 1 − α/2 や (1 + level)/2 を作る箇所は、α/2 < 1e-8 のときだけ上側確率 α/2 の分位点で求める (1 − α は桁が落ち、1.1e-16 未満で 1 になる)。それ以外は R と同じ式 (同じビット)。対象: binomTest・poissonTest (57 回目)、varTest・propTest・mantelhaenTest・agreement (ICC)・aov (対比)・cor・tTest・lm (`tQuantile`)・glmConfint・coxph・survival (58 回目)。効果量の非心度の根、qansari、pwr は対象外 (記録だけ)
- **Fisher・mantelhaen の正確検定の根 (58 回目、ユーザー判断):** 条件付き最尤推定値と信頼限界は、R の uniroot の慣習 (ψ か 1/ψ で絶対許容誤差 ε^0.25。推定値で 1e-6、95% 限界で 0.7%、99% で 6%、極端な水準で区間の端 1/ε) ではなく、log ψ の座標で double の精度まで求めた根 (`logScaleRoot`)。R の fixture は `knownDifference`、正しさは `test/review58.test.ts` が非心超幾何分布を独立に計算して確かめる
- **R のパッケージが統計学的に不正確な場合 (59 回目、ユーザー判断):** jonckheereTest の正規近似で同順位があるときは、Hollander & Wolfe の同順位を入れた並べ替え分散を使う (clinfun・DescTools は同順位のない分散。p が大きめに出る)。同順位がなければパッケージと同じ。fixture は `knownDifference`、正しさは `test/review59.test.ts` が並べ替えの全列挙で確かめる
- **dunnTest の段階的な調整 (60 回目、ユーザー判断):** dunn.test の「単調にしない、停止規則つきで棄却」の値はそのまま再現する。同順位の p 値だけは、組の最初の順位 (停止規則が判定に使う位置) をそろえて付ける (dunn.test は比較の順に順位を付け、並び順で値が変わる)。fixture の同順位の 10 件は、dunn.test の組の最初の比較の値を期待値にしている
- **glm の IRLS のステップ半減 (61 回目、ユーザー判断):** R の glm.fit は deviance が増えるステップも受け入れ、偽の収束をする (binomial で重み 1000: 係数 1e15、deviance 144175、正しくは 4956)。glm2 の glm.fit2 と同じく、2 反復目以降に (dev − devold)/(0.1 + |dev|) ≥ max(epsilon, 1e-10) なら前の係数との中点に戻す。maxit 回で戻らなければ "inner loop 3; cannot correct step size" で未収束。下限 1e-10 は、glmConfint のプロファイル (epsilon 1e-300) で最大近くの丸めを増加と見なさないため (下限なしでは 95% 区間まで NaN になった)
- **glm のリンクと分離 (62・63 回目、ユーザー判断):** R の make.link の eps のクリップ (logit・log・probit・cauchit・cloglog・power) は誤りとして、厳密な値にする。sqrt リンクで η < 0 を拒否するのは R が正しい (値域の外、逆関数にならない) ので変えない。分離した当てはめ (R は converged と報告) には警告を出し、converged は R のまま
- **glm の重み 0 の行と自由度 0 (65 回目、ユーザー判断):** 重み 0 の行は尤度に入れない。AIC もその行を除いて計算し、その行を除いた当てはめと同じ値にする (R の gaussian の AIC は log(0) を取って Inf)。deviance 残差は自由度 0 でも各行の寄与から計算する (R の residuals.glm は 0)。62 回目の MOD-011 では「全点を通るので真の値は 0」として今のままにしたが、未収束の当てはめ (maxit 1 で deviance 0.337) ではこの理由が成り立たないので改めた。67 回目にレビュアーは MOD-037 (自由度 0 の残差) と MOD-044 (重み 0 の行の Poisson の AIC) を「R の仕様どおり」として撤回したが、この判断のまま変えない (R と違うのは承知のうえ。docs の「R が不正確な場合」に記録済み)
- **glmAnova と未収束・自由度 0 (66 回目、ユーザー判断):** 比較に未収束のモデルがあれば警告するが、表の値は R のまま。自由度 0 の行の Rao 統計量も R と同じく計算した値を出す (丸めの残りで負になりうる。p は NaN)
- **merge の型の違うキー (#82、ユーザー判断):** R の match と同じく、x と y のキー列を共通の型 (文字、数と論理値なら数) にそろえて比べる。y だけの行があるときは出力のキー列も共通の型
- **omega の minres (#83、ユーザー判断):** psych と同じ疑似勾配の反復のあと、独自因子分散が下限 0.005 に張り付いたときだけ真の勾配 (固有値の摂動) で L-BFGS-B を続ける (factr 1e3)
- **extraDistr の乱数の無限のパラメータ (#92、ユーザー判断):** 形状 a・alpha = Inf は q と同じ極限。b・beta = Inf は d・p・q と同じく NaN で、extraDistr が引く乱数は引く
- **isSymmetric・checkCovmat (#99、ユーザー判断):** R の all.equal と同じく、転置と等しい要素を平均から除く。checkCovmat は元の単位で判定 (R と同じ)。eigen の自動判定の正規化は意図した違いのまま
- **qbinom の小数の size (#102、ユーザー判断):** R の qbinom は size を丸めるが、rStats.js は d・p と同じく NaN のまま
- **離散分布の分布関数の q (#145・#146、セッション 10 のユーザー判断で 25 回目の判断を覆す):** P[X ≤ q] は q 以下の最大の整数 k の P[X ≤ k]。整数から min(1e-7, 1e-9·max(1, abs(q))) 以内の q はその整数、それ以外は floor(q) (`countAtMost`、`src/internal/integer.ts`)。R の floor(q + 1e-7) (psignrank は round(q + 1e-7)) はやめた。q ≥ 100 では R と同じ幅 (1e-9 の相対幅だけだと R より広く、ppois(1000 − 5e-7, 1000) が誤った)。対象は pgeom・pnbinom・ppois・pbinom・phyper・pwilcox・psignrank・ansari の正確分布。psignrank の fixture は `knownDifference`
- **glm の作業重み (#159・#165〜#168、セッション 10):** muEta² や V、w·muEta² が正規化数の範囲の外か有限でないときだけ、muEta = c·mu^a と V = mu^p から √W = √w·|c|·mu^((2a − p)/2) で作る (作業残差、Pearson 残差、"0s in V(mu)"、null の加重平均も)。binomial 系のリンクは R の形のまま。fixture 154 件のビットは不変
- **glm の deviance (#161〜#163、セッション 10):** abs(y − mu) < 0.1 mu のときだけ bd0 型 (poisson 2 bd0(y, mu)、binomial 2 (bd0(y, mu) + bd0(1 − y, 1 − mu))、Gamma −2 log1pmx(t)、対応する quasi)。R の dpois_raw の切り替えとほぼ同じ条件。fixture 69 件が許容内で変わる
- **qrSolve の NaN (#71、ユーザー判断):** 解の NaN は残し、分解で使わない列だけ 0 (R の qr.solve は NA・NaN をすべて 0)
- **cor の対角 (#78、ユーザー判断で #16 を覆す):** 自己相関が定義されない列 (定数、everything で NaN を含む) の対角は NaN。それ以外は R と同じく 1
- **入れ子でない比較は検定しない (32 回目):** `anova` (lm)・`glmAnova`・`lmerAnova` で、入れ子でない隣どうしの比較の F・p (検定の列) は NaN。入れ子は列空間の包含を QR のランクで判定する (`nestedColumns`)
- **効果量・平均の定義は effectsize・afex に合わせる:** 偏 ω² の分母 (N = 全自由度 + 1)、非偏 η² などの信頼区間、aovEz の MSE (GG/HF 補正後の自由度で割る) は、R のパッケージと同じ定義 (32・34・35 回目)
- **確保量・作業量の上限 (セッション 12、ユーザー判断):** 配列 1 本は 2^24 個 (128 MB) まで、時間はこの PC で 10 秒前後を目安に関数ごとに上限を置き、超えたら確保の前に RangeError (exact なら "use exact: false" を案内)。値と乱数列を変えずに確保をなくせるものはなくす。R が受け付ける大きさでも拒否するので docs に記録する。関数ごとの値はセッション 12 の節
- **将来の R への追従は記録だけ:** wilcox の同順位ありの正確検定 (R 4.6)、ansari (No.93)、`chol(pivot)` のランク超過の行を 0 にする変更 (R-devel)

## 作業の進め方

- **レビューが来たら:**
  - まず読み取りだけで検討する (CLAUDE.md: 質問には答えるだけ)
  - R と rStats.js を実行して比べ、表で報告する。レビュアーの指摘には誤検出や撤回も多い (行のずれ、QR のピボット順など)。必ず実行して確かめる
  - ユーザーの指示があってから直す
- **ひとまとまりの直し方:**
  - 修正する
  - テストを `test/reviewNN.test.ts` に足す
  - src を `git stash push -- src` で戻し、新しいテストが失敗することを確かめる
  - 全体テストと `npx tsc --noEmit -p .` を流す。テスト (fixture の記録など) を直したあとも、型検査をもう一度流す (57 回目は流し直さず、型エラーのままコミットした)
  - docs (`docs/differences-from-r.md` と `docs/ja/` の両方) に R との違いを書く。R が正しく rStats.js 側の誤りを直しただけの場合は書かない
  - `docs/review-logs/review_fix_log_20261031_NN.md` を英語で書く (コードを変えない回も、判定だけ書いてコミットする)
  - コミットを提案する (`git commit -F - <<'EOF'`)
- **3 ステップ以上の作業は Plan モード** (CLAUDE.md)
- **R の fixture と意図的に違う値にしたとき:**
  - `fixtureSuite` では、値の差なら `knownDifference`、R がエラーになる・ならないの差なら `substitute` に、理由を付けて記録する
  - `checkFixture` を直接使うテスト (`test/qnorm.test.ts` など) は、`result.mismatches` を filter して記録する
  - anovaLm・carAnova などの `Comparison` (test/helpers/anova.ts) では、`KnownDifference` に `value` (意図的な値、NaN など) を付けて記録できる (32 回目)
  - 乱数の fixture では `test/helpers/random.ts` の `knownDifference` を使う。次の一様乱数が R と一致することが条件
  - 1e±200 規模のデータで R の分散が溢れる・アンダーフローするケース (sd・skewness・kurtosis・cv) は、`test/descriptive.test.ts` の `overflow`・`underflow` に記録する。新しい値は、データを 2 の冪倍して通常の規模で計算した値と一致することを確かめてから記録する (49 回目の追加)
- **R や rStats.js をその場で動かすとき:**
  - **vitest ではなく `npx tsx` (単一のプロセス) を `timeout` 付きで使う。** スクリプトは scratchpad に置き、import は絶対パス (`C:/Users/numer/dev/EMUYN/rStats.js/src/index.ts`、lmer などは `src/entries/mixed.ts`)
  - 結果は 1 件ごとに `appendFileSync` でファイルに書く。止まったときに、どこで止まったかが分かる (パイプへの出力は、強制終了で失われる)
  - **止まる可能性がある呼び出しを vitest で流さない。** `timeout` は npx だけを止め、子の vitest ワーカーや tsx の node が残って CPU を使い続ける (25・26 回目)。残ったら `j tasklist /FI "IMAGENAME eq node.exe" /V /FO LIST` で CPU 時間を見て特定し、終了はユーザーに頼む (auto モードでは終了が拒否される。Git Bash では `j taskkill /PID n /F`)
  - **修正前に止まるテストを `git stash` 中に流さない。** バックグラウンドに回ると src が退避されたままになる (25 回目に発生)。stash の確認では、止まるテストを `-t` で除いて流す
  - PID 13832 の node (CPU 時間が長い) は、作業とは関係のないプロセス。ユーザーの指示で放置している
- **注意点:**
  - Bash のヒアドキュメントに `\\` を含めるとフックに拒否される。スクリプトは Write ツールでファイルに書いてから実行する
  - Bash で `cat > ファイル` を引数なしで書くと、標準入力を待って止まる (23 回目)
  - 長い編集用の Python スクリプト (`'''` を含むもの) は、Bash のヒアドキュメントに入れると解釈に失敗することがある。Write ツールで scratchpad に書いてから実行する (45 回目)
  - tsx はプロジェクトに入っていない。`node --import tsx` は使えないので、`npx tsx` を使う (45 回目)
  - 厳密な値の検証には BigInt が使える (wilcox は m = n = 700 の中央まで 17 秒。46 回目のログ)
  - **Windows 版 R は数値リテラルを正しく丸めない (52 回目):** R の `1e100`・`1e307`・`1e308` は JS の同じリテラルと数 ulp 違う double になる (`mpfr(1e308)`、`sprintf("%.0f")` も同じ)。単調な関数ではほとんど影響しないが、sin・cos・Bessel の振動では R 側の参照値が使えない。JS で double を仮数 (2^53 未満の整数) と指数に分け、文字列で `mpfr("仮数", 1400) * mpfr(2, 1400)^指数` として渡す。`sin(1e100)` = −0.380637731005… で確かめる
  - 外部レビュアーの参照値も、double ではなく厳密な 10 進数 (10^308 など) で計算していることがある (52 回目)。既存のテストの mpmath の参照値にもあった (55 回目: `test/nbinom.test.ts` の q = 100020289663207340 は、double では …344)。2^53 を超える整数や巨大な値の参照値は、double の値で計算されているかを確かめる
  - テストの期待値の計算 (`Math.PI * 1e308`、`Math.log(1.9e308)` など) も溢れる。期待値も溢れない形で書く
  - Markdown の表のセルに `|x|` を書くと表が壊れる。`abs(x)` と書く

## 共通基盤 (再発防止のため、新しい修正はここに載せる)

**原則:** 先に 2 の冪で正規化してから計算する。無次元量 (比・検定統計量・効果量・逆条件数など) は正規化した座標で計算し、単位のある量は出力の直前に戻す。2 の冪の掛け算は厳密なので、溢れない範囲では値が 1 ビットも変わらない。正規化は、必要なとき (溢れるとき) だけにするか、元の式と同じビットになる形で行う

**`src/internal/summary.ts`** (冒頭のコメントに原則を書いてある)
- 関数: `scaleToUnit`、`centered`、`standardize`、`groupMoments`、`pairedDifferences`、`satterthwaiteDf`、`squareOver`、`productOver`、`norm2`、`ldexp`、`wideSum*`
- `standardDeviation` (49 回目の追加): 2^-k の座標の偏差から ldexp(sqrt(和 / (n − 1)), k)。分散が正規の範囲なら `Math.sqrt(variance)` と同じビットで、分散が溢れる・アンダーフローしても正しい。`sd()` が使う
- `scale()` (`src/descriptive/moments.ts`): 入力と中心が有限なのに偏差が溢れた列だけ、2^-k の座標で偏差・尺度を作り直す (49 回目の追加)
- テスト: `test/scaleInvarianceAll.test.ts`、`test/scaleInvarianceModels.test.ts` (`expectScaleInvariant`、`test/helpers/scaleInvariance.ts`)

**`src/internal/ddexp.ts`**
- `standardizeDD`、`locationScale`、`standardizeValue`、`affine`: 位置・尺度の計算が溢れても、結果が範囲内なら正しい値を返す
- `locationScale`、`affine` は、t = 0 かつ scale = Inf のとき位置パラメータを返す (24 回目)

**区間・重み・幅の溢れ** (幅や合計だけが溢れる場合に、2 の冪でそろえてから計算する)
- 一様分布: `halfIfOverflow` (`src/distributions/uniform.ts`)
- arcsine: b − a が溢れるときだけ、半分にした尺度で計算する (24 回目)
- dmultinom: 重みの合計が溢れるときだけ、2^s (2^s ≥ K) で割る (23 回目)。rmultinom は最大の重みで割る
- dbeta: a + b が溢れるときだけ、半分の形状で指数を求めて 2 倍する (25 回目)
- pbeta・qbeta (Temme 展開): a + b が溢れるときだけ、半分の形状で r x − a・偏差・m を作って 2 倍する (45 回目)
- distSummary: `make()` の sdDirect。分散が [2^-1022, Inf) の外なら、尺度から直接作った sd を使う (45 回目)
- wilcox: 表の最大の項が 2^760 を下回ったら 2^200 倍し、scale を持つ。signrank と同じ「主の表 → 低位テーブル → 作り直し」(45 回目)
- integrate・optimize・uniroot: upper − lower が溢れるときだけ、x/2 の座標で解く (26 回目)。optimize は upper + lower が溢れるときも (localMin の中点、49 回目)
- seqLength・approx (`linearAt`)・spline: 有限な値の差が溢れるときだけ、半分の座標で取る。spline は x / 2^k で作って評価する (50 回目。splinefun は未対応)

**逆関数** (`src/internal/invert.ts`、50 回目): 仕上げの `bisectX` は double のビット表現の中点 (`bitMidpoint`) で割る。どんな区間でも約 64 回で隣り合う double まで縮む (log x の座標の始点が数百 ulp ずれ、密度がアンダーフローして Newton 法が進まない場合の受け皿)
- gamma の反射公式: 分母が溢れるときだけ Γ(q) = Γ(q − 10) ∏(q − i) に分ける。lbetaHuge: a + b が溢れるときだけ a L + (b − 0.5) L (47 回目)

**巨大な有限の引数** (52 回目)
- `logAddExp`・`logSubExp` (`src/internal/ddexp.ts`、54 回目): log(e^a ± e^b)
- choose (k < 30): double-double の積が途中で溢れたら、n − j を 2^-s で割った座標で積を取り、ldexp(結果, s k) で戻す (`fallingRatioScaled`、53 回目)
- Bessel の漸近形 (`asymAmplitude`、iPos・kPos) と Wronskian: `Math.PI * x`、`2 * x` が溢れるときだけ、平方根を因子ごとに取る
- `mulExp` (besselIK.ts、m 2^e2 e^y): 結果の log2 が ±1100 の外なら、ループに入らずに 0 か Inf を返す

**サブノーマルの引数** (47 回目)
- Bessel: `logHalf`・`powHalf` (`src/special/besselSeries.ts`)。x < 2^-1021 では x/2 を作らない。x < 2^-1000 では I の級数、I_1/2・K_1/2 は x の積・商を作らない式
- 連分数 (cf1JY、cf1IK): b_1 が Inf なら、すぐに 1/b_1 を返す (NaN のまま上限まで回っていた)
- erfcinv: z < 2^-1021 では log 確率の qnorm

**大きな Bessel の次数** (47 回目): ν > 1000 で、結果の log の厳密な上界・下界 (`logISeriesBounds`・`certainRange`、besselIK の `logKBounds`、besselJY の `largeOrder`) が範囲外を示せば、漸化式の前に Inf / 0 を返す

**線形代数** (`src/linalg/`)
- 三角方程式の代入 (getrs・trsv・trsm): 厳密に 0 の係数の更新は飛ばす。溢れた成分は有限の値の代わりで、0 × Inf = NaN を関係のない成分に入れない (49 回目。26 回目の expm と同じ考え方)
- determinant (logarithm = false): 積の 2 の冪の指数を別に持つ。matMul: `rescaledDot` (49 回目)
- prcomp: 入力が有限で、中心化・尺度化した行列が有限でない、または特異値が Inf なら、入力全体 (与えられた center・scale も) を 2^-e で割ってやり直す。尺度化しないときは sdev とスコアを 2^e 倍で戻す (49 回目と追加)
- eigen・svd・schur: 要素の最大値が [2^-256, 2^256] の外なら `rangeExponent` と `ldexp` で正規化してから分解する (schur は 29 回目)
- rcond と solve の条件数の検査: 同じく正規化した複製で計算する。複製の LU が厳密に特異なら逆条件数 0 (31 回目)

**モデル**
- glm のリンク (62 回目): μ を厳密に 0・1 にしない (分散 0 のエラーを避ける)。logit は η > 30 で min(1/(1 + e^-η), 1 − 2^-53)、それ以外は R の式に下限 Number.MIN_VALUE。log は max(e^η, Number.MIN_VALUE)。R の範囲内は同じビット。probit・cauchit・cloglog の逆リンクは厳密な値を `inUnit` (`src/models/glmFamily.ts`、[Number.MIN_VALUE, 1 − 2^-53] に収める) に通す。微分と power の逆リンクは下限 Number.MIN_VALUE。cloglog の link は log(−log1p(−m)) (63 回目)
- glmPredict の標準誤差 (63 回目): 前進代入の z の二乗和が溢れるか正規化数の下に落ちたときだけ、最大の |z| で割って計算し直す。glmSummary の `statisticName` は `zTest` (dispersion を推定しない) で決める (R と同じ)
- **`chol2invColumns` (`src/internal/scaledInverse.ts`、64 回目):** R の列の最大の |R_ij| が [2^-400, 2^400] の外なら、その列を 2^e_j で割ってから chol2inv。標準誤差は ldexp(√(inv_jj × 分散), −e_j)、共分散は ldexp(inv_jk, −e_j − e_k) (範囲外なら Inf か 0)。glmSummary と lm の標準誤差が使う。範囲内の列では計算は以前と同じ
- glm の `USED_ROWS` (64 回目): irls の `used` (最後の QR に入れた行) を結果をキーにした WeakMap に記録し、glmHatvalues が使う (作業重み = √w の二乗は 0 に落ちうるので、weights > 0 では行が対応しない)。fitModel と unscaledResult の結果の両方に入れる
- glm の null deviance の加重平均 (64 回目): 重みを最大の重みの 2 の冪で割り、重み 0 の行を除く。glmAnova の入れ子の判定 (64 回目): 両方のモデルで priorWeights > 0 の行だけで `nestedColumns` (offset の差も)。Rao は小さい方のモデルの切片 (R の anova.glmlist と同じ)
- glm の AIC (65 回目): `familyAic` はすべての family で重み 0 の行を和から除く。gaussian は応答を 2^-k 倍して当てはめるので、`unscaledResult` の補正 2 n k log 2 の n も正の重みの行の数にする (familyAic の n と合わせる)
- irls の周期の検出 (66 回目): `untilCoefficients` (glmConfint のプロファイルが使う、係数が止まるまでの反復) で、今の係数が直前 16 回のどれかと全成分で厳密に一致したら収束とする。係数が 0 に近いと、作業応答の丸め (〜4e-16) が 8 ε × max|係数| を超え、2〜5 個の値を回り続けて maxit で未収束 (区間の端が NaN) になっていた
- glm の分離の警告 (62 回目): irls で収束と判定した反復の max|Δη| (使った行) が `SEPARATION_STEP` = 0.1 を超えたら警告する (η は単位なし。分離では約 1〜5、最大の近くでは 1e-5〜0.014)。fixture の分離した 3 件 (glm #119・#121、glmAnova #48) は substitute で警告を足している
- glm: `scaledView` (`src/models/glm.ts`)。gaussian・identity では応答を正規化して当てはめる
- lm: `fitLm` は応答を正規化する。重みも偶数の 2 の冪で正規化して平方和を作る。QR は元の重みのまま (27 回目)。(R'R)^-1 は R を 2^-kw/2 倍してから作る (重みを 2^-kw 倍した尺度。重み 1e-308 未満で溢れていた、61 回目)
- aov (誤差層): 処置と誤差モデルの各列を、列ごとの 2 の冪で割る (35・36 回目)
- **`src/models/scaledTables.ts` (34 回目):** 結果オブジェクトをキーにした WeakMap に、当てはめたときの平方和 (応答を正規化した単位) の表を保存する。anova・aovSummary・aov (誤差層)・aovEz が登録し、効果量が使う
- lmer: 適合時のデータの複製 (`snapshot`) を内部情報に保存し、lmerAnova の仮説と再当てはめはそこから作る (28 回目)
- coxph: 係数・分散・スコアを各共変量の尺度の 2 の冪 (2^e_j) を単位として作り、z・Wald 検定・無限の係数の判定はその単位で計算する。係数・分散・se は出力の直前に `ldexp` で戻す (43 回目)

**非心 t の遠い裾** (`src/distributions/nt.ts`、#66)
- 判定 `farLogEstimate` (log P の鞍点の見積もり δ²/2 / (1 + t²/(2a))、t δ ≤ 0 は δ²/2) > `LOG_LARGE` = 2^30、または |δ| > `D_LARGE` = 2^32。それ以外は修正前と同じビット
- 順: `zTail` (t δ > 0 かつ |t|/√(2a) ≥ `T_Z` = 2^12、Z の座標の 2 次展開の閉じた式、両側と密度) → 元の `laplace` (a > 1e5。ピークが w = 50 の外なら undefined) → `laplaceWide` (区間 [−1400, 1418]、rtsafe 型、2^(2k) の尺度、u を double-double で) → 鋭いピークの double-double の台形和 (`integrateCore` の `ddOffset`) → `integrateShifted` (Φ(−δ)・φ(δ) を外に出した比、`bracketedPeak` の二分法、|tδ| > e^690 は S → 0 の Laplace 変換、a < 1e-5 の分布関数は補数 1 ∓ E|ρ − 1|)
- 参照値: Rmpfr の log-sum-exp の積分。`scripts/nt-reference/` の `ntref.R` (w = log(χ²/df) の格子) と `ntrefz.R` (t ≫ √df 用の z = Z の格子)、入力は `mkcases.mjs` で仮数と指数に変換。使い方と死角 (出力の 2 列目が −50 程度より小さくなければ無効) は各ファイルの冒頭

**入れ子の判定:** `nestedColumns` (`src/models/estimable.ts`、32 回目)。glmAnova は offset の差も列空間に入るときだけ入れ子 (48 回目)

**入力の検査・共通処理** (48 回目)
- `src/models/tiedTimes.ts` `mergeTiedTimes`: R の timefix (aeqSurv)。coxph・survfit・survdiff
- `src/internal/covmat.ts` `checkCovmat`: covmat の正方・有限・対称 (R の isSymmetric)・対角が正。factanal・omega
- `src/htest/binomTest.ts` `binomTestCounts`: 試行数 0 の検査なしの本体。poissonTest の [0, 0] は R どおり p = 1

**`src/internal/uniroot.ts`** `logScaleRoot` (58 回目): オッズ比のような正の量の根を、log の座標で区間を倍々に広げて探し、許容誤差 2^-50 で解く。符号が変わらなければ 0 か Infinity

**検定の溢れ・桁落ち** (59 回目)
- ksTest の 1 標本の正確な両側: D ≥ 1/2 なら 2 × `pkolmogorovOneSidedUpper` (両側の超過は同時に起きない。正の項の和で極小の p 値も正確)。D < 1/2 で 2 P(D+ ≥ d) < 1e-2 なら `pkolmogorovExactUpper` (二項分布の遷移の連鎖で上側確率を直接、項数 2^28 を超えたら従来の 1 − P(D < d) に戻す。#483、ユーザー判断)
- quadeTest の範囲・flignerTest の偏差: Inf になるとき (データは有限) だけ、全体を `scaleToUnit` で割ってから計算する (常に割ると極小の値が 0 に潰れて順位が変わりうる)

**`src/internal/discrete.ts`**
- `discreteQuantile`: 上への探索のステップが溢れ、hi が Infinity なら、`Number.MAX_VALUE` で条件を確かめてから二分法に進む (満たさなければ Infinity)。hi が有限なら hi までを二分法で探す (56 回目)
- `firstTrue`、`lastTrue`: 単峰な分布の境界を探す (binomTest、poissonTest)。二分法の中点が端点と一致したら抜ける (2^53 を超えると止まらなかった、57 回目)
- `FUZZ_LINEAR`・`FUZZ_LOG`: 離散分布の量子関数の許容幅。qgeom も使う (1 段の半分未満のときだけ、25 回目)

## 残っている課題

**1 回目のレビュー (2026-10-30) の残り**
- No.31/120/121 lmer の尺度依存 (応答や説明変数の単位で収束しない、Satterthwaite の自由度が Inf)。lme4 との突合をやり直す必要があり、規模が大きい。27・28 回目の lmer の溢れの指摘 (prss・log の前の積・Jacobi の固有値・Satterthwaite の分子・結合 F・VarCorr) もここに含める
- 詳しくは `review_fix_log_20261031.md` の末尾

**判断待ち**
- なし (45 回目の distSummary の pois λ = 0 は #379 で点質量にした)

**記録だけにしたもの (誤答の具体例が見つかれば検討する)**
- 59 回目: ansariTest の正確な区間が高い信頼水準で NaN (HTEST-028。R も NA。端を 0 か Inf にする向きの判定が単純でない)。KS の D < 1/2 で極小の p 値 (1 − P(D < d) の桁落ち。#483 で直した)。propTrendTest の全群の成功率が 0 か 1、gamesHowellTest の全群 1 例 (NaN を返す。tukeyTest・dunnettTest は 60 回目にエラーになった)、ansariTest の大きな標本の正確な計算の時間
- 60 回目: pairwiseTTest (pooled)・onewayTest (等分散) で群内が定数だと p 0 (R も 0。ユーザー判断の範囲外)。MOD-003 の aovEz の ID 1 と "1" の統合 (R と同じ)
- 61 回目: MOD-008 glmConfint の level = 1 − 1e-16 で [NaN, NaN] (分位点は有限。制約つき当てはめが切片 −160 前後より遠くで 1 反復目に外れ、前の係数がないので半減できず未収束。初期値を全体の係数にすれば届く見込みがあるが、経路が変わる)。大きなオフセットの glm (y ~ x − 1、offset 64 など) も 1 反復目で外れて偽の収束をすることがある (R も同じ)
- 62 回目: 分離の判定は経験的 (detectseparation の線形計画法は入れていない)
- 63 回目: power リンクの名前の丸め (`power: 0.0004` が "mu^0"。R の round(lambda, 3) と同じ表示)
- 65 回目: MOD-032 irls の `etastart` の長さを確かめていない (内部の `refit` だけが渡す。公開 API にはない)
- 信頼水準が 1 に近い場合の同じ種類の書き方のうち、効果量の非心度の根 (`effectSize.ts`)、qansari、pwr の `1 − sig` (58 回目)。mantelhaenTest の漸近検定で度数が 1e200 規模のときの信頼区間の分散の項 (sR² など) の溢れ (58 回目)
- Issue #40: corTest で 1 − r が 1e-32 程度 (double-double の丸めの誤差より小さい) だと、r = 1、t = Inf、p = 0 (R も同じ。正しくは例えば p = 8.2e-17)。クランプを外すだけでは桁の合わない値になる。平均を使わない Gram 行列式 (O(n³)) か多倍長が要る (`review_fix_log_issue40.md`)
- 2^53 を超える n の binomTest・poissonTest の両側 p 値: 観測値の確率がアンダーフローすると、反対側の境界をアンダーフローの位置に取り、3e-316 程度の値を返す (真の値は double で 0)。検定の判断は変わらない (57 回目)
- 反復の未収束を通知しない設計: incbet、igam、invert、nt、nchisq、nbeta、Bessel、Dunnett の内側の積分、expm の CGS (30 回目)、効果量の ncpOfT・ncpOfF (33 回目)
- `dnbinom` などの、試行回数 (size + x) が溢れる場合の密度 (22 回目、(a) で見送り)。55 回目に、log の有無によらず NaN にそろえた (log なしが誤った 0 だった)。`dhyper` の m + n の溢れも NaN のまま (55 回目、記録だけ。phyper・qhyper の 2^53 の方針とそろう)。`dmultinom` のカウントの合計の溢れ (23 回目) も同じ性質
- 離散分布の量子関数が 2^53 を超える整数を区別できない制約 (23 回目)
- 内部関数の前提: ddLeastSquaresMulti のゼロ対角、DD と倍精度の QR のランクの不一致 (32・35・37 回目)、ddMatrix の LU のピボット (37 回目)
- 1e308 近くの積和: セッション 11 で、matMul・crossprod・tcrossprod・lm と glm の predict は和が有限でないときだけ BigInt の厳密な内積に (#208・#195・#174)、nonEstimableRows は 2 の冪で正規化 (#260)。lm の重み 1e±308 で重い行に残差があると軽い行が失われる (Householder、R も。#194、行のピボットが要る、ユーザー判断で記録だけ)
- 重み 1e308 の lm の anova (逐次平方和) (27 回目)

**記録だけ (セッション 10)**
- #158: 両方の形状が巨大な非心ベータ (`pf(1e200, 1e100, 1e300, ncp = 1e300)`、`pf(1, 1e290, 1e290, ncp = 1)`) はまだ誤る。計算の流れを変える必要がある (ユーザー判断で close して記録)。#135 のログ: 小さい q の級数が初項だけで、df2 が巨大か df1 が極小だと誤る (`pf(50, 2, 1.7e308, ncp = 1)` が 1 を超える)
- 論点 E (ユーザー判断で記録だけ): 値が巨大で完全に当てはまる glm で、61 回目の半減の判定が丸めの雑音に反応して "inner loop 3" で未収束 (Poisson y = (1e20, 2e20) ~ x、R は収束)。#161 の修正で、収束する・しない尺度が変わった (k = 40 は修正前は負の deviance で収束、今は未収束)。#161 のログ
- #159 Gamma inverse で mu > 1.34e154 の se が NaN (W = mu² が double で表せない)。#130: poisson・Gamma の glm で x が 1e308 規模だと √W·x が QR の前に溢れる。#169 の Poisson の例は start なしでは当てはまらない (R も)
- #161 のログの binomial の y = 0 で mu が極小の deviance: ユーザー判断で mu < 0.1 だけ log1p (review_fix_log_binomial_y0.md)
- #145 のログ: docs の「dpois・dbinom は 1e-7 の閾値」の文が古い (今は nonInt)
- #153 ptukey の巨大な nmeans のほかの例、#155 pwr の h の探索区間、#140 の chisqTest の分割表で総数が溢れる、#144 triang の分散、#147 df = 2^-1074 の df/2、#128 determinant の NaN・#164 inverse.gaussian の AIC の 2π dev の溢れ (各ログ)

**将来の課題 (余裕があるとき)**
- `Math.sqrt(variance(...))` の形が、`sd()` 以外 (検定・効果量など) に残っている。分散が溢れる・アンダーフローする規模で sd が誤る。外部レビュアーの次の対象 (`src/internal/` の mean・variance・sum) と合わせて見る (49 回目の追加)
- 大きな Bessel の次数で、判定できない範囲 (例: `besselY(0.9e8, 1e8)` は 2.4 秒) は時間が次数に比例する。I・K の Debye 展開、J・Y の Airy 型の一様展開 (47 回目のログ)
- gamma の x > 33 の相対誤差が約 1e-14 (R は 1e-13)。`stirf` の −n + stirlerr(n) を double で丸めているためと思われる。直すと通常の範囲の値が変わる (47 回目)
- 大きな m, n (m = n ≥ 約 510) で、wilcox の中央付近まで安定に計算できる別の算法を探す。今は RangeError (46 回目)。候補・使えなかった方法・BigInt による検証方法は `review_fix_log_20261031_46.md`

**R 突合の残り**
- 各ログの「R 突合が必要」の節。多くはローカルの R で確認済みだが、初期のログ (2〜4 回目) の項目は未確認のものがある

## 読む順番

1. この文書
2. `docs/review-logs/` のログ。1 回目のレビューは `review_20261030_report.md` (指摘の一覧、英語) と `review_fix_log_20261031.md`、2〜68 回目は `review_fix_log_20261031_NN.md`、Issue は `review_fix_log_issueNN.md`。直近ほど、上の方針の背景が書いてある
3. `docs/differences-from-r.md` の「Where R fails and rStats.js returns a value」と「Deliberate differences」
4. `review_fix_log_20261031.md` (1 回目のレビューと、その残課題)
