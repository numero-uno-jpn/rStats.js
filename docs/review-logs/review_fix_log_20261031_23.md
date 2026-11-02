# 外部レビュー (23 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (二項・ポアソン・幾何分布、多項分布の重み、乱数生成と確率関数の比較、非心分布の検証順序、一様分布)。レビュアーは push 済みのコード (`a423f98` 以前) を見ているので、未 push のコミットで修正済みの指摘が含まれる。

## 判定

| ID | 判定 |
|---|---|
| discreteQuantile (2^53 を超える整数を区別できない) | 数値表現の制約。2^53 を超える領域は既存の方針で扱い、docs に `qnbinom` の例がある。記録だけ |
| binomial / poisson / geometric | レビュアーも問題なしと判定 |
| **MULTINOM-OVERFLOW-01** | **修正** (下記) |
| MULTINOM-COUNT-01 (カウントの合計が溢れる) | 22 回目の NB-DENS-OVERFLOW-01 と同じ性質。記録だけ (下記) |
| RWILCOX-INT32-01 | 修正済み (`6f45046`)。`rwilcox(1, 2^31, 1)` は RangeError |
| R2DTABLE-MEMORY-01 | 修正済み (`b727064`)。総計が 2^31 − 1 を超えると RangeError |
| NBETA-VALIDATION-02 (`pnbeta1` の検証順序) | 修正済み (`cf1f7a9`)。`pbeta(0, -1, 2, ncp = 1)` などは NaN (R 4.5.2 は 0 / 1 / 0) |
| NT-INF-ORDER-01 (`qnt1` の ncp = ±Inf) | 修正済み (`2514938`)。df によらず ±Inf (df = Inf と同じ)。ただし docs に古い記述が残っていた (下記) |
| UNIF-INF-01 (`dunif` が無限の端点を受け付ける) | R と一致 (`dunif(0, 0, Inf)` は 0、`punif`・`qunif` は NaN)。密度 0 は max → ∞ の極限で、`dnorm(sd = Inf)` と同じ考え方。対応不要 |
| UNIF-DEGENERATE-01 (min = max) | R と一致 (`dunif` は NaN、`punif` と `qunif` は 1)。点質量には密度がない。対応不要 |
| WILCOX-REVIEW-01、SIGNRANK-REVIEW-01 | レビュアーも問題なしと判定 |

## MULTINOM-OVERFLOW-01 (重みは有限だが、合計が溢れる dmultinom)

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| `dmultinom(c(1,1), prob = c(1e308,1e308))` | 0 | 0 | 0.5 |
| 同 `log = TRUE` | −Inf | −Inf | −0.6931471805599454 (log 0.5 との差は 1 ulp) |
| `dmultinom(c(2,1,3), prob = c(2,1,3) * 2^1022)` | 0 | 0 | `dmultinom(c(2,1,3), prob = c(2,1,3))` と同じ値 (60/432、R は 0.13888888888888893) |
| `dmultinom(c(1,1,0), prob = c(1e308,1e308,5e-324))` | 0 | 0 | 0.5 |
| `dmultinom(c(1,1), prob = c(1e308,1e307))` | 0.16528925619834709 | 同じ | 同じ (合計が範囲内なので変わらない) |

- **原因:** 重みの後ろからの累積和 (double-double) が Infinity になり、q_k = p_k / Σ が 0 や NaN になる
- **修正:**
  - 累積和の上位が Infinity のときだけ、重みを 2^s (2^s ≥ K) で割って累積和を作り直す
  - 2 の冪なので、非正規化数にならない限り割り算は厳密。比だけで決まる確率は変わらない
  - 合計が範囲内なら重みはそのまま使うので、通常の範囲の値は 1 ビットも変わらない
- **0 になる重み:** 割った結果が 0 になる重み (最大の重みの 1e-600 未満) は、確率 0 のカテゴリとして扱う。カウントが正なら 0 (log は −Inf) を返す。そのため、確率 0 のカテゴリの判定をスケーリングの後へ移した
- `rmultinom` には、以前から最大の重みで割る対策がある

## MULTINOM-COUNT-01 (記録だけ)

| 呼び出し | R 4.5.2 | rStats.js | 正しい値 |
|---|---|---|---|
| `dmultinom(c(1e308,1e308), prob = c(1,1))` | NA (整数への変換の警告) | 0 | 0 (アンダーフロー) |
| 同 `log = TRUE` | NA | NaN | 約 −355 |
| `dmultinom(c(2^53,1), prob = c(1,1), log = TRUE)` | NA | −6243314768165323 | ulp の範囲で一致 |

N = Σx が溢れる場合は、NB-DENS-OVERFLOW-01 と同じく、2^53 を超える整数の領域として NaN のままにする。

## docs の古い記述 (今回の確認で見つけたもの)

- `docs/differences-from-r.md` と `docs/ja/differences-from-r.md` の「Where R fails」の表に、「ncp = ±Inf の `qt` は端点以外は NaN」という行が残っていた
- `2514938` で ±Inf に変えた際の行 (`qt(0.5, 10, ncp = Inf)` → Inf) と矛盾するので、古い行を削除した

## テスト

- `test/review23.test.ts` を追加した。src を `git stash` で戻すと、3 件中 2 件が失敗することを確かめた
- 全体テスト: 2127 passed / 34 skipped、失敗 0
  - 途中の 2 回の実行では、`distributionProperties.test.ts` の signrank が実行時間の上限 (`dsignrank(302775, 1100)` が 1 秒超) で失敗した
  - 修正前の src でも同じく失敗し、ファイル単独では通るので、マシンの負荷による一時的なもの
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) に `dmultinom` の行を追加した
