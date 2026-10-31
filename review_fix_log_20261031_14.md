# 外部レビュー (14 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (lmer、lmerTest の検定、lm・anova・QR、多重比較・効果量)。

## R 4.5.2 で実行して確かめた結果

| 項目 | R 4.5.2 | rStats.js (修正前) | 判定・対応 |
|---|---|---|---|
| lmerTest の type I、`y ~ x1 + x2s + (1 \| g)`、x2 を 1e-6 倍 | x1 の F が 13.9621 から 14.4471 (type II の値) に変わる | R と同じ | **lmerTest のバグ。修正**: Doolittle 分解を、対角を 1 に正規化した行列で行う (L = D^1/2 L_n D^-1/2)。1e-10〜1e6 倍しても 13.9621 |
| 説明変数 1 つの type I を 1e-4、1e-6 倍 | 変わらない | 変わらない | 一致 |
| `anova(lm(y ~ x + z))`、z = 2x | x と Residuals のみ | 同じ | LM-NEW-02: R と一致。変更なし |
| `anova(f2, f3)` (使った行が違う 2 つの当てはめ) | 比較表を返す (行数だけ確認) | 同じ | **修正**: 行・応答の値・重みが同じことを求める (lmerAnova と同じ)。glmAnova も応答と事前の重みを比べる (以前からの残り No.113 も解消) |
| `confint(fit, level = 1.5)` | NaN (警告あり) | NaN | **修正**: (0, 1) の外はエラー |
| `predict(..., level = -0.2)` | 狭い区間を黙って返す | 同じ | **修正**: エラー |
| effectsize の `cohens_d(ci = 1.5)` | エラー "ci must be a single numeric value between (0, 1)" | 受け付ける | **修正**: 同じ文言のエラー (cohensD、hedgesG、etaSquared、omegaSquared、epsilonSquared) |
| `qr(tol = -1)` | 受け付ける | 受け付ける | **修正**: 負の tol はエラー (tol = Inf は rank 0 のまま) |

## そのほかの修正

- **`norm2` (`src/internal/summary.ts`、新設):** 通常の範囲では √Σx² と同じ値。溢れるときは最大値で正規化する。lm の predict の seFit と、lmer の信頼領域法 (`norm`、`lengthAt`) で使う
- **BY の調和級数:** 配列を作らず、`wideSumAdd` で 1 項ずつ足す (`sum()` と同じ値)

## 対応しなかったもの

| ID | 理由 |
|---|---|
| LMER-NEW-01 (Jacobi 法の未収束) | 具体例なし |
| LMER-NEW-04/05/09 | lmer の尺度依存。既知の残作業 (No.31/120/121) に含まれる。Hessian の閾値 1e-8 は lmerTest と同じ |
| LMER-NEW-08 (分散成分の境界での LRT) | lme4 と同じくカイ二乗 (保守的)。docs に注記した |
| LMER-NEW-10、LM-NEW-04、MC-NEW-02/03/05 | 具体的な誤答の例なし |

## テスト

`test/reviewModels14.test.ts` を追加した。src を修正前に戻すと 8 件中 6 件が失敗する (残り 2 件は修正前から同じ値になる、回帰を防ぐためのテスト)。
