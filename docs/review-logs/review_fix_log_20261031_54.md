# 外部レビュー (54 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (非心分布 nchisq・非心 F・非心 t、離散分布の共通経路)。非心分布は SciPy との照合で「新規不具合なし」。新しい指摘は DIST-004・005 の 2 件で、どちらも確定した。ユーザーが計画を承認して直した。

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| DIST-004 | `ppois(1e16, 1e16)` | 0.50000000265961519 | 0.4999999986701924 (< 1/2) | 0.5000000026596152 |
| | `ppois(1e17, 1e17)`、`ppois(1e20, 1e20)` | 0.50000000084104412、0.50000000002659615 | 0.49999999957947794、0.4999999999867019 | 0.5000000008410442、0.5000000000265962 |
| | `qpois(0.5, λ) − λ`、λ = 2^53、1e16、1e17、1e20 | 0 | 2、2、16、16384 | 0 |
| DIST-005 | `pbinom(1e16, 2e16, 0.5)` | 0.5 | 0.5 | 0.5000000028209479 (= 1/2 + dbinom/2) |
| | `qbinom(0.5, 2e16, 0.5)` | 1e16 | 1e16 | 同じ |

## 原因

- 2^53 を超える x では x + 1 が丸めで x になる。ppois の P[X ≤ x] = Q(x + 1, λ) が Q(x, λ) に、pbinom の 1 − I_p(x + 1, n − x) が 1 − I_p(x, n − x) になり、どちらも 1 項 (dpois(x)、dbinom の一部) が抜けた
- qpois の探索は、ppois1 を通さずに `gammaInc(y + 1, …)` を直接呼んでいたので、ppois1 を直しただけでは中央値がずれたままだった

## 方針の判断

HANDOFF の方針「2^53 を超える整数の領域では、誤った値の代わりに NaN を返す」(pnbinom・phyper など) がある。ただし ppois は R が正しい値を返すので、方針「R が正しい範囲では R と一致させる」を優先し、恒等式で正しく計算した。pbinom も同じ恒等式で計算できるので直し、n − x も丸めで正確でない場合 (正しい引数で計算できない場合) だけ方針どおり NaN にした

## 修正の内容

- `src/distributions/poisson.ts`
  - `ppois1`: x + 1 === x のときだけ、P[X ≤ x] = Q(x, λ) + dpois(x, λ)、P[X > x] = P(x, λ) − dpois(x, λ)。logP では対数で足し引きする
  - `qpois1` の探索の分布関数を `ppois1` にした (2^53 未満では同じビット)
- `src/distributions/binomial.ts` `pbinomRaw`: x + 1 === x のときだけ、I_p(x + 1, n − x) = I_p(x, n − x) − ((n − x)/n) dbinom(x; n, p)。n − x が正確でなければ NaN。qbinom の探索は pbinomRaw を通るので、そのまま直る
- `src/internal/ddexp.ts`: `logAddExp`、`logSubExp` (log(e^a ± e^b)) を足した

## テスト

- `test/review54.test.ts`: ppois(λ, λ) を R の値と比べる、qpois(0.5, λ) = λ、上側・logP との整合、pbinom の対称性。2^53 未満は修正前と同じ値
- stash で 2 件とも失敗することを確かめた
- 全体テスト `npx vitest run`: 2234 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md` の Where R fails: pbinom の 2^53 を超える x (R は 0.5)。ppois は R が正しいので、同じ行に「同じ恒等式を使う」と書き添えただけ

## 外部レビュアーの次の予定

hypergeometric・negbinomial を同じ観点 (x + 1、n − x、size + x などの整数演算) で確かめる
