# 外部レビュー (39 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (Anova・anova の警告、複数モデルの比較の重み・使用行、重み付きの平方和)。

## 判定

| ID | 確認した内容 | 判定 |
|---|---|---|
| CAR-ANOVA-FIT-WARNINGS-DROPPED-01 (161)、LM-ANOVA-FIT-WARNINGS-DROPPED-01 (166) | `Anova(fit)`・`anova(fit)` が `fit.warnings` を引き継がない | car の `Anova` も R の `anova` も引き継がない (R は当てはめ時に表示する)。**ユーザー判断 (b): 引き継ぐ** (下記) |
| LM-ANOVA-WEIGHT-MISMATCH-01 (162) | 重み w1・w2 の 2 モデルの `anova` | **対応済み。** "models were not all fitted with the same weights" でエラー。レビュアーは古いコードを見ている |
| Type II・III の重み (163)、ゼロ重みの行 (164) | ― | レビュアーも問題なしと判定 |
| LM-ANOVA-ROW-IDENTITY-MISMATCH-01 (165) | 1 行目と 8 行目をそれぞれ欠いた、行数が同じ 2 モデル | **対応済み。** "models were not all fitted to the same rows of the data" でエラー (応答の値・入れ子も検査済み) |

## 警告の引き継ぎ (ユーザー判断 (b))

- **経緯:** 35 回目に、誤差層付き aov の要約と効果量には当てはめの警告を引き継いだ。38 回目の C (誤差層なしの `aovSummary` の完全適合の警告) と、今回の 161・166 は記録だけの候補だったが、扱いを揃えるため、すべてで引き継ぐことにした (推奨 (b))
- **修正:**
  - `anova(fit)`: `fit.warnings` と表の警告を、重複を除いて結合する
  - `anova(fit1, fit2, …)`: 比べるすべての当てはめの警告と、比較の警告 (応答の違うモデルを除いた旨など) を、重複を除いて結合する
  - car の `Anova(fit)`: `fit.warnings` を先に、`Anova` 自身の警告 (Type III で代用した旨) を後に
  - `aovSummary` (誤差層なし): `fit.warnings` と表の警告を結合する
  - 効果量 (誤差層なし): 元の表 (`anova(model)` か、与えられた表) の警告を引き継ぐ (誤差層付きは 35 回目から)
- 値は変わらず、`warnings` 配列の中身だけが変わる。R の fixture は、警告を重複なしでまとめて照合している (`collectWarnings`) ので、そのまま通った
- docs: 35 回目の「`Error()` 付きの aov の警告」の段落を、当てはめ全般に広げた

## テスト

- `test/review39.test.ts` を追加した
  - `contrasts` に式にない変数 B を指定した lm の警告 ("variable 'B' is absent, its contrast will be ignored") が、`anova`・`Anova`・`aovSummary`・`etaSquared`・比較の `anova` に 1 回ずつ現れることを確かめる
  - src を `git stash` で戻すと失敗する
- 全体テスト: 2180 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
