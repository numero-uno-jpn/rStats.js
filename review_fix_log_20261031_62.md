# 外部レビュー (62 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (glm・glmFamily・glmSummary・glmResiduals)。5 件 (MOD-009〜013) を今のコード (`10a7888`) と R 4.5.2 で確かめた。どの件も rStats.js は R と同じ動きをしていた。ユーザーが計画を承認し、3 件を直した。

ユーザーの判断:
- MOD-012・013: logit と log のリンクを厳密な値にする (probit・cauchit・cloglog・power は次回のレビューで扱う)
- MOD-009: 警告を足す (converged は R のまま)
- MOD-011: 今のまま

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| MOD-009 | binomial `glm(1:6, c(0, 0, 0, 1, 1, 1))` | 係数 −165.3、47.2、converged、25 反復、警告 "fitted probabilities numerically 0 or 1" | 同じ | converged のまま、警告 "the linear predictor was still changing at convergence: the data may be separated (no finite maximum likelihood estimates)" を足す |
| MOD-010 | 自由度 0 の quasipoisson の summary | cov.scaled NaN | NaN | 問題なし (変えない) |
| MOD-011 | binomial `glm(1:2, c(0, 1))` の deviance 残差 | 0、0 (residuals.glm が自由度 0 で 0 にする) | 同じ | 変えない |
| MOD-012 | logit の逆リンク、η = 30.0001 | 1 − 2.2e-16 (C コードが \|η\| > 30 を eps の値でクリップ) | 同じ | 1 − 9.4e-14 (厳密) |
| MOD-012 | binomial、度数 (1e15, 1)、(1, 2)、x = 1、2 | 係数 55.8、−28.2、deviance 2139、収束しない | 60.69、−30.69、deviance 1.45 (61 回目の半減で収束はした) | 69.779、−35.236、deviance 0.013 (解は 69.771、−35.232) |
| MOD-013 | log の逆リンク、offset −40、−100、−700 の Poisson | 2.2e-16 (`pmax(exp(eta), eps)`) | 同じ | 4.25e-18、3.72e-44、9.86e-305 |

レビュアーの MOD-012 の理論値 (β1 = 34.54、β0 = 2 log 1e15 + log 1/2) は取り違えている。β0 + β1 = log 1e15、β0 + 2 β1 = log(1/2) なので、β1 = −35.232、β0 = 69.771。

### MOD-011 を変えない理由

自由度 0 (行数 = ランク) では、当てはめがすべての点を通るので、最尤推定値が有限ならば μ = y で、deviance 残差の真の値は 0 になる。例の 2.3e-10 は、係数が無限大に向かう途中で反復を打ち切ったときの残り。R が 0 を返すのは正しい値。レビュアーの言う「残差の 2 乗和 = deviance」は満たさないが、その場合は deviance の方が丸めの残りである。

### MOD-012・013 の範囲

R のクリップは、μ が厳密に 0 や 1 になって分散 0 のエラーが出るのを防ぐ安全装置でもある。そこで、double で表せる範囲は厳密な値にし、その先だけ表せる端の値で止めた。

- logit: η > 30 では min(1/(1 + e^-η), 1 − 2^-53)。η ≤ 30 では R の式 e^η/(1 + e^η) を、Number.MIN_VALUE を下限に使う。微分は、|η| > 30 で max(e^-|η|/(1 + e^-|η|)², Number.MIN_VALUE)。|η| ≤ 30 では R と同じ式で、同じビット
- log: max(e^η, Number.MIN_VALUE)。e^η が eps 以上なら R と同じビット
- 1 − μ は double の間隔 (1.1e-16) より細かく表せないので、μ が 1 に近い側の精度には限りがある (例の deviance 0.013 はこのため)

### MOD-009 の判定

分離していると、deviance は落ち着くのに、線形予測子 η は反復ごとに約 1 ずつ (例では 5) 動き続ける。最大の近くでは、最後のステップはずっと小さい (例: 61 回目のデータで 1e-5、MOD-012 の例で 0.014)。収束と判定した反復で、使った行の max|Δη| が 0.1 を超えたら警告する。η は単位を持たないので、x の単位によらない (x を 1e-6 倍しても警告が出ることを確かめた)。厳密な判定 (detectseparation の線形計画法) は入れていない。

## 修正の内容

- `src/models/glmFamily.ts`: logit と log のリンク
- `src/models/glm.ts` (irls): 収束した反復の max|Δη| による分離の警告 (`SEPARATION_STEP = 0.1`)

## テスト

- `test/review62.test.ts`
  - MOD-012: η = ±30.0001、33、35 で厳密な値と比べる。30 以内は R の式とビット一致。2 列応答の例で係数が解と相対 1e-3
  - MOD-013: offset −40、−100、−700 で e^η
  - MOD-009: 分離の例 (x の単位を変えても) で警告が出る。重なりのあるデータ、61 回目の重み 1000 の例、Poisson の例では出ない
- fixture
  - `test/glm.test.ts`: 分離した 2 件 (#119 は完全分離、#121 は 2 列で分離) で警告を足した (`substitute`)。値は反復が止まった位置なので `knownDifference` に記録した (R はクリップした η ≈ 36 で止まり、rStats.js は先まで進む。あてはめ値の一部が 1 に丸まって hat 値が 1 になり、rstandard と Cook の距離が NaN になる)
  - `test/glmAnova.test.ts`: #48 (4 行 4 列の飽和 Poisson で、度数 0 を含む) で警告を足した (`substitute`)。この警告は正しい (平均が 0 に向かい、有限の最尤推定値がない)
  - ほかの R の fixture は変わらなかった (ふつうの当てはめで分離の警告は出ていない)
- stash で、修正前に 3 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2264 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- 「R が不正確な場合」: logit リンクのクリップ、log リンクの下限、分離を収束と報告すること

## 外部レビュアーの次の予定

glmFamily の probit・cloglog・cauchit・inverse・power リンクの近似とクリップ
