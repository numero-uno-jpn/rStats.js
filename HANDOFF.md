# 引継ぎ: rStats.js (外部レビュー対応 2026-10-30〜11-04、1.0.0 への準備 11-04〜)

最終更新: 2026-11-06 (セッション 16、R 4.6.2 への移行をブランチ r46 で実装)

## まず読むこと (セッション 16 から)

- **1.0.0 を公開 (2026-11-06):** npm latest = 1.0.0 (staged をユーザーが承認)。tag `v1.0.0` は release のワークフローが dist 入りのコミット `df7a602` に移した。main は `1405d4e` (デモの例 `deda702` と版のコミット)、CI・Pages 通過、デモの VERSION は v1.0.0、jsDelivr の `dist/rstats.js`・`dist/mixed.js` と npm から入れた `/mixed` の glmer が動くことを確かめた。以後は Semantic Versioning に従う。1.0.0 の後の優先順は ROADMAP の Remaining (2026-11-06 に改訂: ReactiveStat の menu.yaml 159 項目との対応表から、医療・心理統計で正しい手法を使える観点で並べた): 1 分割表と比率 (Fisher mid-p・Boschloo・比率と 2×2 の効果指標の区間など) → 2 頑健な標準誤差 (sandwich) → 3 診断・測定の一致 (ROC・Bland-Altman など) → 4 生存の続き → 5 試験デザインの検出力 → 6 メタアナリシス → 7 混合モデルの confint・simulate。lavaan・IRT・LCA・mice・mclust は範囲外。README に glmer の数値例も候補
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
