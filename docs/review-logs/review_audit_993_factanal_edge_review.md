# Audit #993 — factanal のML推定・回転・factor scoresを再確認

- 対象: `src/descriptive/factanal.ts`
- 監査時 HEAD: `61ec53024a32b811d2f8566374fce25313fcc44b`
- 対象ソース blob: `78015f198496bfd2c28321c541ff970a5cea7b96`
- 判定: 今回確認した範囲で新規不具合なし

## 確認内容

covmatとデータ入力の分岐、p/q/dofの検証、相関行列への標準化、uniquenessのstart/lower/upper、ML objective/gradient、L-BFGS-B収束時のエラー、loadingsの順序・符号、varimaxの零行Kaiser正規化、promaxのleast-squares変換、回転後のrotmat同期、likelihood ratio statistic、regression/Bartlett factor scoresを確認した。

covmat入力時のscores拒否、nObs未指定時のSTATISTIC/PVAL NaN、dof<=0時の統計量NaNはAPI/Oracleと整合。scoresはdata入力に限られ、列平均・標準偏差を用いた標準化と回帰/Bartlett式の行列次元も整合している。

## 検証範囲・制約

- `src/descriptive/factanal.ts`、`test/factanal.test.ts`、`oracle/factanal-behaviour.md`、`src/internal/covmat.ts` を確認。
- 関連Issue検索で同一原因の未解決報告は確認できなかった。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし.
