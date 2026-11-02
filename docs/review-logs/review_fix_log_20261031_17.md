# 外部レビュー (17 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (gamma・nt・t・weibull、不完全ベータ・ガンマの反復、離散分布の分位点)。

## R 4.5.2 で実行して確かめた結果

指摘の項目は、すべて rStats.js が R と一致していた (pgamma だけは意図的な差として記載済み)。このうち 4 件は R 自身が数学的に誤っているか、一貫していなかったので、ユーザー判断で数学的に正しい値にした。

| 項目 | R 4.5.2 | rStats.js (修正後) |
|---|---|---|
| `pgamma(Inf, 892.4, scale = Inf)` | NaN | 1 (以前から。P[X ≤ ∞] = 1、docs 記載済み) |
| `qt(0.5, 10, ncp = Inf)` | NaN (`qt(0.5, Inf, ncp = Inf)` は Inf、`pt(1, 10, ncp = Inf)` は 0) | **Inf** (ncp = −Inf なら −Inf) |
| `pbeta(-1, 0, 2)`、`pbeta(-1, 0, 0)`、`pbeta(-0.1, 0.5, Inf)` | 1、0.5、1 | **0** (q = 0 では、点質量を含めて従来どおり 1 や 0.5) |
| `qnbinom(0.5, size = -1, mu = 0)` | 0 (dnbinom・pnbinom は NaN) | **NaN** |
| `dweibull(1, 0.5, scale = Inf)` | NaN | **0** (log なら −Inf) |
| `pt(0, 10, ncp = 1e300)`、`pt(1e-300, 1, ncp = 1e300)` | 0、0 | 0、0 (一致。NT-NEW-02 の誤答は起きない) |

## 対応しなかったもの

- INVERT-REVIEW-02/03、IBETA-NEW-01/02、IGAM-NEW-01 (反復の未収束を通知しない): 誤答の具体例なし
- T-REVIEW-02、DISCRETE-REVIEW-01、BINOM/POISSON-REVIEW-01: レビュアー自身が「問題なし」または撤回

## テスト

`test/review17.test.ts` を追加した。R fixture の該当ケースは、`test/beta.test.ts`、`test/nbinom.test.ts`、`test/nt.test.ts`、`test/simple.test.ts` で、理由を付けて knownDifference にした。docs (英・日) に記載した。
