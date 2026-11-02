# Issue #170 対応ログ: 自由度 0 の deviance 残差を 0 にすべき (65 回目のユーザー判断、変えない)

GitHub Issue #170。夜間の自律対応。判定: 意図した R との違い (not planned)。コードの変更なし。

## 計画

- 意図: issue の主張 (残差の自由度 0 の当てはめで deviance 残差が 0 でない。`oracle/glm-behaviour.md` には「df.residual = 0 ならすべて 0」とある) を確かめ、HANDOFF の方針に当たるかを見る
- 方法: issue の例を npx tsx と R 4.5.2 で流す
- 選んだ理由: 65 回目のユーザー判断 (MOD-037) と同じ指摘なら変えない

## 確認 (main `f3e602a`)

`glm([0, 1], [1, 10], { family: "poisson", maxit: 1 })`:

| | R 4.5.2 | rStats.js |
|---|---|---|
| df.residual | 0 | 0 |
| deviance | 1.942238e-05 | 1.9422376010170325e-05 |
| converged | FALSE | false |
| deviance 残差 | 0 0 | −0.004404319528510871、−0.0001560304487851904 (二乗和 1.9422376010170328e-05 = deviance) |

issue の観察どおりだが、これは意図した動作。

## 判定

変えない。HANDOFF の方針「glm の重み 0 の行と自由度 0 (65 回目、ユーザー判断)」:

> deviance 残差は自由度 0 でも各行の寄与から計算する (R の residuals.glm は 0)。62 回目の MOD-011 では「全点を通るので真の値は 0」として今のままにしたが、未収束の当てはめ (maxit 1 で deviance 0.337) ではこの理由が成り立たないので改めた。67 回目にレビュアーは MOD-037 (自由度 0 の残差) と MOD-044 (重み 0 の行の Poisson の AIC) を「R の仕様どおり」として撤回したが、この判断のまま変えない (R と違うのは承知のうえ。docs の「R が不正確な場合」に記録済み)

issue が引く `oracle/glm-behaviour.md` は「R 4.5.2 の glm がすること」を書いた文書 (冒頭: "Behaviour of R 4.5.2's `glm` and its methods … as a description of what R does")。rStats.js の仕様ではなく、R との違いは `docs/differences-from-r.md` 129 行目 (と docs/ja の対応箇所) の表に記録してある: "`residuals(glm, "deviance")` without residual degrees of freedom | 0 for every row, also for a fit that has not converged (deviance 0.34 with residuals 0) | each row's contribution: their squares sum to the deviance"。issue の例でも、残差の二乗和が deviance と一致する (R の 0, 0 は deviance 1.9e-5 と合わない)。

## close comment

Intended, as decided in review 65 (MOD-037): deviance residuals are each row's signed contribution even without residual degrees of freedom, so their squares sum to the deviance. For the issue's example (poisson, maxit 1, not converged, df.residual 0) they are -0.004404319528510871 and -0.0001560304487851904, whose squares sum to the deviance 1.9422376010170325e-05; R 4.5.2 returns 0 0, which does not account for that deviance. oracle/glm-behaviour.md describes what R does (the reference for the fixtures), not rStats.js; this difference is recorded in docs/differences-from-r.md ("Where R is inaccurate and rStats.js is closer to the truth"). See review_fix_log_issue170.md. (Not pushed yet.)
