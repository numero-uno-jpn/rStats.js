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
