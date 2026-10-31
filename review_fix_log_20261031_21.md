# 外部レビュー (21 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (r2dtable と sample、幾何・負の二項の乱数、超幾何、Gamma・Poisson の端点)。レビュアーは push 前のコードを見ていて、r2dtable の Inf (`a2a3fa8`) と総度数 (`b727064`)、超幾何の巨大母数 (`579e44c`) は修正済み。

## R 4.5.2 で実行して確かめた結果 (set.seed(1) のあと)

| 項目 | R 4.5.2 | rStats.js (修正前) | 対応 |
|---|---|---|---|
| `rgeom(3, 5e-324)` | NA×3、次 0.908207789994776 | NaN、次は同じ | **修正**: Infinity (平均は約 2e323 で、MAX 以下になる確率は約 9e-16)。乱数は R と同じく指数乱数を 1 個引く |
| `rgeom(3, 1e-300)` | 7.55e299 … | 同じ | 一致 |
| `rnbinom(3, Inf, prob = 0.5)` | 8.988e307×3 (size = MAX/2 での値)、次 0.769841419998556 | 同じ | **修正**: Infinity (dnbinom 0、qnbinom Inf と整合)。同じ乱数を引く。R の fixture の prob = 0.2 では R も NA |
| `dnbinom(5, Inf, 0.5)`、`qnbinom(0.5, Inf, 0.5)` | 0、NaN | 0、Inf | 以前から (prob 固定で size → ∞ なら Inf) |

## そのほかの修正

- **SAMPLE-REVIEW-01:** sampleInt の JSDoc を実装に合わせた。重みなしは 4.5e15 (2^52、R と同じ) まで、prob ありと、母集団の半分を超える非復元抽出は 2^31 未満

## 対応しなかったもの

- R2DTABLE-NEW-02/03: R も同じ量を確保する (要求された量を作るのは仕様)
- PGAMMA-REVIEW-02: 意図的な差 (P[X ≤ ∞] = 1)、docs 記載済み
- PNBINOM-REVIEW-01、QPOIS-REVIEW-01、IGAM-REVIEW-01、HYPER-REVIEW-01: 誤答の具体例なし、または 2^53 による制約

## テスト

`test/review21.test.ts` を追加した。`test/random.test.ts` の rnbinom で、size = Inf・prob < 1 のケースを knownDifference にした (次の一様乱数が R と同じことが条件)。docs (英・日) に記載した。
