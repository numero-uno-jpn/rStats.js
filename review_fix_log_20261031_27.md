# 外部レビュー (27 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (glmConfint・glmAnova、lm・qr・predict・estimable、lmer・mixedDeviance・mixedDerivatives・lmerTest・lmerAnova)。レビュアーは push 済みのコード (`a423f98` 以前) を見ているので、修正済みの指摘が多い。

## 判定

| ID | R 4.5.2 | 修正前 | 判定 |
|---|---|---|---|
| GLM-CONFINT-NOCONV-01 | ― | ― | 対応済み。全モデルと制限モデルの両方で収束を確かめ、収束しなければ NaN |
| GLM-ANOVA-FAMILY-MISMATCH-01 | ― | ― | 対応済み。family・link、応答、事前重みの不一致はエラー |
| GLM-SCORE-OVERFLOW-01 (gaussian、重み 1e308、test = "Rao") | ― | p 値は正しい。表示用の逸脱度・Rao の列が NaN | 記録だけ。真の値は double の範囲を超える (Inf が正しい表示)。p 値は正規化した当てはめで計算している |
| LM-LEVEL-VALID-01、LM-PREDICT-LEVEL-01 | ― | ― | 対応済み (`0 < level < 1`) |
| QR-TOL-NEGATIVE-01 | ― | ― | 対応済み (負の tol はエラー) |
| QR-TOL-INFINITE-01 | ― | ― | Inf は「すべての列が従属 (rank 0)」として受け付ける設計 (コメントあり)。対応不要 |
| ESTIMABLE-DOT-OVERFLOW-01、LM-PREDICT-DOT-PRECISION-01 | ― | ― | 具体的な誤答の例がない。記録だけ |
| **LM-WEIGHT-SUM-OVERFLOW-01** (`lm(y ~ x, weights = rep(1e308, 6))`) | R² NaN、F NaN | 行列の形: R² NaN、F Inf。式の形: sigma も NaN | **修正 (A)** |
| LM-PREDICT-SE-OVERFLOW-01 | ― | ― | 対応済み (`norm2` を使用) |
| LMER-PRSS-SQUARE-OVERFLOW-01、LMER-LOG-LIKELIHOOD-OVERFLOW-01、LMER-EIGEN-CONVERGENCE-OVERFLOW-01、LMER-SATTERTHWAITE-DF-OVERFLOW-01、LMER-JOINT-F-OVERFLOW-01 | ― | ― | 記録だけ。lmer の尺度依存の残課題 (No.31/120/121、lme4 との突合のやり直しが必要) にまとめて扱う |
| LMER-SATTERTHWAITE-ZERO-PRSS-01 | ― | lmer がエラー ("the response is fitted exactly …") | 対応済み (完全に当てはまる場合は lmer 自体が止まる) |
| **LMER-CONTEST-LEVEL-BOUNDARY-01** (`level = 0` / `1`) | エラー (`level > 0 is not TRUE`) | 幅 0 の区間 / NaN の区間 | **修正 (B)** |
| **LMER-CONTEST-INFINITE-CONTRAST-01** (`L = [0, Inf]`) | NaN の行 | **空の表を黙って返す** | **修正 (B)。** エラー |
| **LMER-CONTEST-RHS-NONFINITE-01** (`rhs = Inf`) | Sum Sq Inf、F Inf、p 0 | Sum Sq NaN、F NaN、p 0 | **修正 (B)。** エラー (ユーザー判断) |
| LMER-ANOVA-NESTEDNESS-01 | ― | ― | 対応済み (`cf1f7a9`、入れ子でない比較のカイ二乗は NaN) |

## A. lm の重みの和の溢れ

| 呼び出し | R 4.5.2 | 修正前 (行列 / 式) | 修正後 (行列 / 式) |
|---|---|---|---|
| 重み 1 | R² 0.9824488、F 223.9044、sigma 0.2723793 | 同じ | 同じ |
| 重み 1e308 | R² NaN、F NaN、sigma 2.72e153 | R² NaN、F Inf、sigma 2.72e153 / R² NaN、F NaN、sigma NaN | R² 0.98244877842709、F 223.90436、sigma 2.72e153 (行列・式とも) |

- **修正 (`fitLmUnit`):** 重みを 2^kw (kw は偶数で、最大の重みが [1, 4) に入るもの) で割ってから、rss・mss・重み付き平均を作る
  - R²、F、残差分散の比は、正規化した重みのまま計算する
  - 尺度を持つ量は戻す: sigma = sqrt(rss/df)·2^(kw/2)、標準誤差 = sqrt(covUnscaled·2^kw·rss/df)、rss·2^kw、effects·2^(kw/2)
  - QR は元の重みのまま計算する (結果の `qr` を predict が使うため。√w·x は重み 1e308 でも溢れにくい)
  - precise (式の形) の経路には、正規化した重みを渡す
- 2 の冪の掛け算は厳密なので、溢れない範囲ではどの kw でも同じビットになる。R の fixture を含む全体テストで、値の変化はなかった
- 重みに Inf がある場合は正規化しない (従来どおり)
- **範囲外として残したもの:** 重み 1e308 の anova (逐次平方和は effects の 2 乗を使う) は今回は扱っていない

## B. lmerContest の入力

- `level` は `0 < level < 1` (lmerTest と同じ。0 と 1 はエラー)
- L に ±Inf があればエラー ("L must not contain infinite values")。修正前は空の表を黙って返していた
- rhs に ±Inf があればエラー ("rhs must not contain infinite values")
- **NaN は従来どおり NaN の結果を返す。**
  - ユーザーには「非有限値はエラー」と提案して承認を得たが、既存のテスト (`test/lmerTest.test.ts`) が「NaN のコントラストは NaN を返す」ことを、lmerTest の NA に合わせて確かめていた
  - それを壊さないため、エラーにするのは ±Inf だけにした

## テスト

- `test/review27.test.ts` を追加した。src を `git stash` で戻すと、3 件すべてが失敗する
- 全体テスト: 2147 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日): 「Where R fails」の表に lm の重みを、lmer の節に lmerContest の無限大の L・rhs と level を書いた
