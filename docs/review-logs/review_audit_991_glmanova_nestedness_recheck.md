# Audit #991 — glmAnova の逐次比較・nestedness 判定を再確認

- 対象: `src/models/glmAnova.ts`
- 監査時 HEAD: `d322bc6660c78ec07f49a645dc615f7da5101906`
- 対象ソース blob: `3d681de41770cd9a354e568927eded47dc2b05c7`
- 判定: 今回確認した範囲で新規不具合なし
- 関連監査: Audit #984 の zero-weight nestedness 候補と比較し、GLM側の処理はpositive-weight行を明示的に使う

## 確認内容

逐次表のNULL/各項 refit、rank差によるDf、dev差の非負化、Rao score、Chisq/LRT/F/Cpの分岐、既知/推定dispersion、family/link比較、モデル比較の応答・prior weight整合性、offset差を含むnestedness判定を確認。

モデル比較のnestedness判定は small/large 両モデルの `priorWeights > 0` 行だけに `nestedColumns()` を適用する。Audit #984 の候補と異なり、zero-weight行は除外されている。Rao比較の方向に応じた符号と、df符号を用いたp値計算も整合。

## 検証範囲・制約

- `src/models/glmAnova.ts`、`src/models/glm.ts`、`src/models/estimable.ts`、`test/glmAnova.test.ts`、`oracle/glm-behaviour.md` を確認。
- 関連Issue検索で同一原因の未解決報告は確認できなかった。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし.