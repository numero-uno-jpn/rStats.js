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
