# 現状: 混合モデルの confint と simulate (Issue #535、PR #537)

作成 2026-11-18。新しい会話で作業を引き継ぐための要約です。指示書は `briefs/mixed-1.6.ja.md` (特に 1 節のクリーンルームと
4 節)。この文書と指示書が食い違ったら、この文書が新しい。

## 決まっていること

- 範囲と API の形は、`oracle/mixedconfint-behaviour.md` と `oracle/mixedsimulate-behaviour.md` の末尾の
  「rStats.js's choices」(ユーザーが決めた)。要点: `confintLmer`・`confintGlmer` (`profile`・`Wald`、結果は
  `{ names, lower, upper }`、引数は `level`・`parm`・`signames`。glmer の profile は `nAGQ = 1` だけ)、
  `simulateLmer`・`simulateGlmer` (`nsim`・`seed`・`useU`・`reForm`、R と同じ乱数の流れ、結果は配列の配列。
  inverse Gaussian は未対応のエラー)
- 段階 1 (仕様書・oracle) は終わり。fixture `test/fixtures/mixedConfint.json`・`mixedSimulate.json` はこちらが
  `fitPublic` 入りで作った。**fixture は書き換えない**

## ブランチ

- `work/mixed-pr`: 実装とテスト。PR #537 (main へ)。**実装はここに push する**
- `work/mixed`: R の実験 (`experiments/*.R`)。**実験はここに push する** (Actions が Issue #535 に結果を書く)
- PR #536 は閉じた。使わない

## 今の状態 (`work/mixed-pr` の `0fbd2c01`、こちらの手元の結果)

- 型チェック: 通る
- `test/mixedConfint.test.ts`: 全部通る
- `test/mixedSimulate.test.ts`: 9 件中 4 件が失敗。**失敗は部分的な `re.form` (項を選ぶ式) の呼び出しだけ**:

| case | 呼び出し | `re.form` | 最初の値 (R / rStats.js) | 呼び出し後の `.Random.seed[2]` (R / rStats.js) |
|---|---|---|---|---|
| `lmer-default-new-effects` | 12 | `~(1 \| Subject)` | 265.53577437958046 / 279.4023106657324 | 一致 (240) |
| `glmer-binomial` | 8 | `~(1 \| herd)` | [2, 12] / [4, 10] | 128 / 188 |
| `glmer-poisson` | 7 | `~(1 \| BROOD)` | 0 / 1 | 418 / 74 |
| `glmer-gamma` | 7 | `~(1 \| batch)` | 46.07447428406078 / 78.72728544628127 | 312 / 353 |

  (前回のこちらの依頼文では `.Random.seed` の R と rStats.js を逆に書いていました。上の表が正しい。テストの
  メッセージ「expected A to deeply equal B」の A が rStats.js、B が R)
- lmer は乱数の数は合っていて、値だけが違う (360 値すべて)。条件付ける項の扱い (どの項に当てはめの値を使うか) の
  誤りと思われる。glmer の 3 件は引く乱数の数も違う
- `lmer-boundary-variance` の呼び出し 7 (`~(1 | g)`) は通っている
- 全テスト: ほかに `test/issue179.test.ts`・`test/issue513.test.ts` が手元で落ちるが、main でも同じ (Mac の
  浮動小数点の違い、CI では通る)。無視してよい

## 分かっていること

- 新しいランダム効果は、全シミュレーション分を先に引き、その後シミュレーションごとに応答 (残差・二項・Poisson・
  Gamma) を引く (LMM・Poisson・Gamma で全値一致を確認済み)
- テストは `fitPublic` (R の推定値) を当てはめに入れてから比べる。当てはめの僅かな違いと方法の違いを分けるため
- oracle の `json_value` は長さ 1 のベクトルを 1 つの値で書く (テストは正規化済み)
- `glmer-binomial` の当てはめは `herd` と `period` の 2 項 (period の SD は約 3.2e-5 で境界)

## 次にやること

1. 部分的な `re.form` で、どの項の乱数を何個、どの順に引くかを R の実験で確かめ、`src/models/mixedSimulate.ts` を
   直す (上の 4 件)。実験は 1 本ずつ `work/mixed` に push し、結果が出てから次へ
2. 直したら `work/mixed-pr` に push し、Issue に数行の途中経過。こちらが全テストを流して返す
3. 全テストが通ったら、段階 2 の完了報告 (指示書 8 節の形) を書いて止まる
4. その後、段階 3 (数値の点検) を別の依頼で行う

## 作業の仕方 (前の会話でストリームのエラーが続いたため)

- 1 回の返答では、実験 1 本の push か、1 つの修正の push までにして、短く報告して止まってよい
- 長いログを返答に貼らない。必要な数値だけを書く
- Issue のコメントも数行に


## 2026-11-18 追加調査記録: LMM 部分指定の既知結果と未解決の矛盾

- Issue #535 のコメント `6944892622` に、`experiments/mixedlmerfull.R` の成功結果が既に記録されている。sleepstudy の default / `re.form=NULL` / `re.form=~(1|Subject)` を各 180×3 セル、合計 1,620 セル比較し、すべて一致。最大絶対誤差は順に `5.68e-14`、`1.14e-13`、`1.14e-13`。
- この成功結果の部分指定は「全ランダム効果ブロックを通常どおり生成し、選択された切片を fitted conditional mode に置換する」再構成。条件付き正規分布から残り成分を生成した結果ではない。
- よって、以前説明した条件付き正規分布の式は理論上の条件付き分布としては正しいが、少なくともこの `lme4::simulate()` の部分 `re.form` の再現根拠にはならない。条件付き正規分布を試した `f902a2df` は切片・傾きの全候補で 360/360 不一致、RNG state index は 240 で一致。
- 無条件の全ブロック再構成は `94a2fda6` で 0/360 mismatch。傾きのみ選択では最良候補でも 324/360 mismatch。切片選択は既知の `6944892622` 成功記録があるため、現在の未解決点は「既に成功した独立再構成」と「PR #537 の fixture-driven 実装テスト」がなぜ食い違うか、である。
- PR fixture の `lmer-default-new-effects` は呼び出し12、`re.form=~(1 | Subject)`。R の先頭値は `265.53577437958046`、現行実装は `279.4023106657324`、呼び出し後 RNG state は両方 240。
- 重要な差分候補: fixture test の `applyReferenceFit()` が public `fitPublic` の `fixef`・`ranef`・`fitted`・`VarCorr` を内部 fit に反映する経路。以前の独立実験は公開 R 出力から再構成した別経路だった。まずこの変換を観測単位・群水準・係数列ごとに照合する。実装の変更はまだ行わない。
- `f902a2df` の R 実験結果は Actions run `44231713980` / Issue #535 comment `6968291985` にも保存された。

- 訂正: `94a2fda6` の layout-search と `f902a2df` の conditional-gaussian は、応答ノイズを `rnorm(n, mean=eta, sd=sigma)` と生成していた。R の `rnorm()` は観測別平均ベクトルをこの形で扱わないため、両実験の mismatch / match 結果は無効。以前の residual-stream で判明した問題を後続スクリプトへ反映し忘れた。正しくは `eta + rnorm(n) * sigma`。次にこの形へ直した同じ layout-search を再実行し、旧結果を判断材料から除外する。

- 修正後の `883284d8` では応答ノイズを `eta + rnorm(n) * sigma` に変更して再実行。clean-room check と R 実行は成功。正しい応答ノイズを使うと、全ブロック生成の無条件ケースは 0/360 mismatch。部分切片は探索した全候補で 360/360 mismatch、部分傾きの最良候補は 324/360 mismatch。したがって `94a2fda6` の「none 0 mismatch」は維持できるが、部分切片についての旧 layout 結果は無効であり、既知の成功記録 `6944892622` との矛盾が残る。
- 次の `08cdbe4b` は、条件付き正規分布を正しい条件付き生成として組み直した実験。切片条件付きでは slope の残差に (z_1)、傾き条件付きでは相関を除いた直交標準正規成分を使い、response は `eta + rnorm(n) * sigma`。Actions の結果待ち。

- 追加の直接照合 `4438cf90`: 公開 API で `simulate(re.form=NA)` と `simulate(re.form=~(1|Subject))` を同じ seed で実行し、各応答ベクトルの差を fitted intercept と比較。2 simulation × 180観測の全360セルで `partial - none = ranef(Subject)[, "(Intercept)"]` が成立し、最大絶対誤差は `8.53e-14`。両方の RNG state index は 240。したがって部分切片の R 挙動は「無条件の全ブロック生成結果に fitted intercept を加える」で直接確認できた。条件付き Gaussian は正しく vectorized response noise を使った `08cdbe4b` でも 360/360 mismatch であり、今回のケースの再現方法ではない。
- 手作業 layout-search の部分切片候補が不一致だった原因候補として、R の `ranef(fit)$Subject` の列を数値 index 1/2 で扱った点がある。次は `colnames(ranef)` と `term.columns` を名前で対応させ、旧 layout-search を再実行する。PR 実装側はすでに列名で選択しているため、fixture test の内部値・baseline の対応を別途診断する。

- 原因をさらに絞り込んだ。R の直接差分 `partial - none = fitted intercept` は、部分指定時に選択成分を新規効果で**置換**するのではなく、新規ランダム効果の全ブロックを保持したまま fitted 成分を**加算**することを意味する。したがって `simulateLmer` の基準 predictor は `fixed + Z b_{new} + Z_{selected} b_{fit}`。現行 `newEffects()` は選択成分を fitted 値で置換しているため誤り。条件付き正規分布でもない。
- 同じ原理から、複数項のうち一部の項だけを選択した場合、選択済み項も新規効果ブロックを消費してから fitted 効果を加算する必要がある。現行の `if (conditioned.size === nc) continue` はその乱数消費を飛ばすため、GLMM の RNG state 不一致も説明できる。全項が選択された `re.form=NULL` / `use.u=TRUE` の場合だけ全新規効果生成を省略する。
- 次の独立 R 再構成では、full-block の新規効果に selected fitted component を置換ではなく加算し、切片・傾きの両方を照合する。その後 `newEffects()` を最小変更で修正する。

- 最終確認 `00acd679` (R 4.6.2): full-block の新規効果を生成した後、選択成分の fitted ranef を**加算**する再構成は none / intercept / slope の全条件で 0/360 mismatch。RNG state index は全条件で 240。ranef と VarCorr の列順も `(Intercept), Days` と確認。これで sleepstudy の部分 `re.form` に対する生成式と乱数配置が確定した。

## 2026-11-18 確定: 部分 `re.form` の線形予測子と実装修正

- ユーザー提示の差分実験を `experiments/mixed-partial-reform-residual-identity.R` (`af5ac405`) として実行。sleepstudy、`(Days | Subject)` に対する `re.form=~(1|Subject)`、seed 123、12 simulation。
- `predict(fit,re.form=~(1|Subject)) - predict(fit,re.form=NA)` は fitted intercept の寄与と一致。
- `simulate(partial)-predict(partial)` と `simulate(NA)-predict(NA)` の差は 2,160/2,160 セルで一致。最大絶対差 `5.6843418860808015e-14`。両方の RNG state は 192 で完全一致。
- この結果から、部分指定の線形予測子は「選択された成分の fitted contribution + 選択されなかった成分の新規ランダム効果」であり、条件付き正規分布を使わない。選択列に対応する新規効果は出力に含めず、相関ブロックの未選択列を正しい周辺分布で生成するためにブロック全体の標準正規乱数を消費した後、選択列を fitted mode で置換する。完全選択された項は新規効果を生成しない。
- 実装を `src/models/mixedSimulate.ts` で修正 (`344797fe`)。部分選択列は fitted mode で置換、完全選択項は乱数を消費せず fitted mode を設定、未選択列のみ新規効果を残す。LMM/GLMM 共通の `newEffects` に適用。
- clean-room の R 実験は成功。実装側の typecheck は成功、GitHub CI の npm test / build / browser test は実行中のため、まだ実装完了とはしない。

- **訂正 (同日、実験結果の解釈を精査):** 上記の残差化実験が示すのは「部分指定した列の新規乱数を捨てる」ことではない。`simulate(partial)-predict(partial) = simulate(NA)-predict(NA)` なので、部分指定された項が fitted model の項と丸ごと一致しない場合、その項の新規ブロック全体は `re.form=NA` と同じように生成され、選択列の fitted contribution がその新規効果に**加算**される。つまり `Z_sel b_hat_sel + Z_rest b_new` の `b_new` は、部分一致項についてはその項全体の新規ブロックであり、選択列の新規成分も残る。条件付き正規分布も選択列の置換も使わない。
- 完全一致する項だけは新規ブロックを生成せず fitted contribution のみを使う。実装 `76c2f491` で、完全選択項は乱数を消費せず fitted mode、部分選択項はブロック全体を生成して選択列に fitted mode を加算する形へ修正。直前の `344797fe` の「部分選択列を置換」は誤りであり、上記 commit で訂正した。

- 追加精査: 「項として丸ごと一致」を選択列の union が全列になることと同一視してはいけない。`(1|g) + (0+x|g)` のように複数の部分項を足して全列を覆っても、fit 側の `(x|g)` と丸ごと一致する項が存在するわけではない。その場合は新規ブロックを生成し、各選択成分の fitted mode を加算する。selection を `columns` と `completeTerms` に分離し、1つの reForm 項がその fit 項の全列を選択した場合のみ `completeTerms` に記録するよう `d019b144` で修正。完全一致項だけは乱数を消費せず、部分項の union は完全一致扱いしない。

- GLMM fixture で追加診断。R の公開 `fitPublic.eta` は `X beta + Z b` と最大誤差 (1.0e-15) 未満で一致し、fitPublic の ranef / Z 対応と固定線形予測子の分解は正しい。残る binomial / Poisson / Gamma の不一致は、選択項以外の新規項に割り当てる乱数の位置が違う可能性を示す。
- 重要な RNG 仮説: 全項が完全選択なら新規乱数を使わない。一方、完全選択項と未選択項が混在する場合、完全選択項の新規乱数は出力には使わないが、`re.form=NA` と同じ項順・位置を保つために消費だけ行う。その後の未選択項に NA と同じストリーム位置の乱数を割り当てる。これを `cb6bed65` で実装し、Actions fixture で検証中。

- R 公開 API 実験 `experiments/mixed-partial-glmer-eta-rng.R` (`699e7d79`) の結果: binomial と Gamma では「完全一致項をスキップして、未選択項だけを seed 123 から生成し、その後 family response を生成」の候補が R の post-call RNG state と完全一致。完全一致項のダミー乱数を消費する候補は一致しない。したがって `cb6bed65` のダミー消費仮説は誤りであり、`f49f84fe` で撤回した。Poisson だけ候補 state が不一致で、eta / term draw layout を追加調査する。
