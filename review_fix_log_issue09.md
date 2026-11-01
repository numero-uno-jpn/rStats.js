# Issue #9 対応ログ: lmer の応答の尺度 (1e200 倍で当てはめが失敗する)

GitHub Issue #9 (監査ラウンド #69、外部レビュアーが起票)。以前からの残課題 No.31 と同じ。オーナーの判断: #9〜#11 を順に直す。

## 再現 (main `9b33273`)

`lmer("y ~ 1 + (1 | g)", ...)`、y = 9.8, 10.4, 10.1, 12.3, 12.9, 12.0, 8.1, 7.6, 8.4、3 群。

| 応答の倍率 | rStats.js (修正前) | R 4.5.2 + lme4 2.0.6 | 修正後 |
|---|---|---|---|
| 1、1e100、1e150 | 正しい | 正しい | 同じ |
| 1e200、1e300 | エラー "the minimisation of the criterion over theta did not converge" (REML・ML とも) | 1e200 で切片は正しいが sigma Inf | 切片 1.0177777777777777e201、σ 3.929942040850554e199 |
| 1e-200 | ― | ― | 正しい (結果は倍率どおり) |

## 原因と修正

罰則つき二乗和 prss = Σ (y − Xβ − Zb)² が、|y| ≈ 1e200 で溢れて Inf になる。そのため基準が −∞ や NaN になり、最適化が失敗していた。

`src/models/lmer.ts` (`lmerWithCriterion`):
- y − X β₀ の最大の絶対値が 2^500 を超えるか 2^-500 を下回るときだけ、応答を 2^ky で割ってから当てはめる (2 の冪の倍率なので正確)。
- θ は応答の尺度によらない。β・b・σ・残差は 2^ky 倍で戻し、分散 (vcov・VarCorr の共分散) は 4^ky 倍で戻す。基準 (deviance・REML 基準) は 2 n ky log 2 だけずらす。
- 標準誤差と標準偏差は、尺度を戻す前の分散の平方根から作る。分散そのものが表せない範囲 (1e400 など) でも有限になる。
- ky = 0 のとき (ふつうのデータ) は計算が今までと同じで、同じビット。

## 残り

- lmerSummary・lmerAnova・lmerContest は、1e±200 倍で "the matrix contains NaN or infinite values" のエラーになる (修正前は当てはめ自体が失敗していた)。内部の構造 (`lmerInternals`) は割る前の応答のままで、σ を含むヘッセ行列が溢れるため。Satterthwaite の自由度の尺度依存 (#10) と同じ箇所なので、#10 でまとめて扱う。

## テスト

- `test/issue09.test.ts`: 倍率 1e-200・1e200・1e300、REML と ML で、θ・固定効果・σ・VarCorr の標準偏差・標準誤差・t 値・残差・当てはめ値・ランダム効果が倍率どおり、対数尤度が −(n または n − p) log c だけずれる。ふつうのデータの σ と固定効果はビット一致
- stash で、修正前に失敗することを確かめた
- lmer 関係のテスト (lme4 の fixture を含む) はそのまま通った
- 全体テスト `npx vitest run`: 2283 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし (終了コード 0)

## docs

- Where R fails: 応答が 1e200 倍の lmer
