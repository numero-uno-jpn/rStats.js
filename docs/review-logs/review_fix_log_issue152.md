# Issue #152 対応ログ: dmultinom でカウントの合計が溢れる (判断待ち)

GitHub Issue #152。夜間の自律対応。**判断待ち** (コードの変更なし)。再現・R の値・案をまとめた。

## 計画

- 意図: issue の主張 (`dmultinom([1e308, 1e308], [0.5, 0.5])` の合計 2e308 が溢れて NaN になるが、真値は約 5.64e-155) を確かめる
- 方法: npx tsx と R 4.5.2 で流し、23 回目のログ (MULTINOM-COUNT-01) と HANDOFF の方針と照らす
- 判断が要る理由: 今は線形が 0、log が NaN でそろっていない。どちらかにそろえる (NaN か値) のは、22・55 回目と #65・#151 の「size + x が溢れる dnbinom は NaN」の方針にどう合わせるかの選択で、複数の妥当な案がある

## 確認 (main `b716765`)

| 呼び出し | R 4.5.2 | rStats.js 線形 | rStats.js log | 正しい値 |
|---|---|---|---|---|
| dmultinom([1e308, 1e308], [0.5, 0.5]) (issue の例、合計 2e308 が溢れる) | エラー (as.integer で NA になり "missing value where TRUE/FALSE needed"、警告 "NAs introduced by coercion to integer range") | **0** | **NaN** | 5.641895835477563e-155、log −355.17046926400775 (中心二項の漸近 sqrt(2/(π N))、補正 O(1/N)) |
| dmultinom([1e308, 1e308], [0.3, 0.7]) | エラー | 0 | NaN | log 約 −1.74e307 (線形は 0 で正しい) |
| dmultinom([1e308, 1e308, 1], [1, 1, 1]) | エラー | 0 | NaN | |
| dmultinom([1e308, 7e307], [0.5, 0.5]) (合計 1.7e308、溢れない) | エラー | 0 | −2.6609719389104684e306 | R の dbinom(1e308, 1.7e308, 0.5, log) = −2.6609719389104751e306 (相対 3e-15) |
| dmultinom([1e300, 1e300], [0.5, 0.5]) | エラー | 5.641895835477563e-151 | −345.96012889203143 | 一致 |

- 線形が 0 になるのは、`dbinomRawDD(xk, nmx, …, false)` (`src/distributions/multinomial.ts` の逐次の二項の積) が合計の溢れで 0 を返すため。log は NaN。どちらも合計 N を検査していない (N は size の照合にしか使っていない)
- R の dmultinom は x を as.integer にするので、2^31 − 1 を超えるカウントはすべてエラー (この規模の比較対象にならない)
- 23 回目のログ (MULTINOM-COUNT-01) の表は、`dmultinom(c(1e308,1e308), prob = c(1,1))` の正しい値を「0 (アンダーフロー)」としていたが、誤り。真値 5.64e-155 は double で表せる (線形の 0 も誤答)

関係する HANDOFF の記述:

- 「記録だけにしたもの」: 「`dnbinom` などの、試行回数 (size + x) が溢れる場合の密度 (22 回目、(a) で見送り)。55 回目に、log の有無によらず NaN にそろえた (log なしが誤った 0 だった)。`dhyper` の m + n の溢れも NaN のまま (55 回目、記録だけ。phyper・qhyper の 2^53 の方針とそろう)。`dmultinom` のカウントの合計の溢れ (23 回目) も同じ性質」
- 方針「2^53 を超える整数の領域: 誤った値の代わりに NaN を返す」
- 23 回目のログ: 「N = Σx が溢れる場合は、NB-DENS-OVERFLOW-01 と同じく、2^53 を超える整数の領域として NaN のままにする」 (実際には線形は 0 を返していて、NaN にそろっていない)

## 案

### 案 A (推奨): 合計が溢れたら線形・log とも NaN にそろえる

- `dmultinom` で `N` が有限でなければ (カウントはそれぞれ有限) NaN を返す。1 行
- 利点: 55 回目の dnbinom (「log なしが誤った 0 だった」を NaN にそろえた) と同じ扱い。dhyper の m + n の溢れ (NaN) ともそろう。23 回目のログの「NaN のままにする」という意図に実装を合わせるだけで、新しい方針の判断が要らない。合計が範囲内の値は 1 ビットも変わらない
- 欠点: 真値が double で 0 に落ちる場合 ([0.3, 0.7] など) の線形の 0 (正しい値) も NaN になる。issue の例の真値 5.64e-155 は返せないまま

### 案 B: 値を返す (合計を作らずに計算する)

- 逐次の二項 dbinom(x_k; n_k, q_k) の n_k が溢れる因子だけ、鞍点法の各項を n を作らずに書く (22 回目のログの見積もり: log(1/x + 1/(n − x))、bd0 の同次性 bd0(c x, c M) = c bd0(x, M) で半分の値から、stirlerr(n) → 0。n p も (n/2)(2p) で)。20〜40 行
- 利点: issue の例で正しい値 (5.64e-155、log −355.17) を返す。多項分布には p・q がない (rmultinom の size は double の範囲) ので、dnbinom のように「d だけ値、p・q は NaN」の不揃いは生じない
- 欠点: dnbinom (#65・#151 でユーザー判断により NaN を保った) と同じ形の二項密度を、多項分布でだけ値にすることになる。dnbinom と dhyper はそのまま NaN で、密度の関数どうしで扱いが分かれる。新しい経路のテスト (Rmpfr の参照は 1e308 規模の lgamma の打ち消しに 1100 ビット以上が要る) の手間

### 案 C: 今のまま (線形 0、log NaN)

- 利点: 変更なし
- 欠点: 線形と log がそろわない。issue の例の線形 0 は誤答 (真値 5.64e-155)

**推奨: 案 A。** 23 回目の意図 (NaN) と 55 回目の dnbinom の扱いに実装を合わせるだけで、方針の新設がない。テストは issue の 3 例 (線形・log とも NaN) と、合計が範囲内の [1e308, 7e307]・[1e300, 1e300] の修正前と同じビット。docs の「R が失敗する所」には R がエラーなので書かない (R は 2^31 を超えるカウントでエラー)。案 B にするなら、dnbinom・dhyper も合わせて値を返すか (#65・#151 の判断の見直し) を同時に決めるのがよい。

## 範囲外として記録

- 23 回目のログ (`review_fix_log_20261031_23.md`) の MULTINOM-COUNT-01 の表の「正しい値 0 (アンダーフロー)」は誤り (真値 5.64e-155)。ログは過去の記録なので直していない
- R の dmultinom の log は大きなカウントで桁を落とす: dmultinom(c(1e9, 1e9), c(0.5, 0.5), log = TRUE) は −10.934005737304688、dbinom(1e9, 2e9, 0.5, log = TRUE) は −10.933997861522906 (docs の「Where R is inaccurate」に dmultinom の lgamma の桁落ちとして記録済み)

## close comment

(案 A で直す場合の下書き。判断の後、修正のコミットに合わせて書き直す。)

Fixed in <commit of #152, see git log --grep='#152'>: dmultinom now returns NaN, on the linear scale as well as the log, where the total of the counts overflows (each count finite). Before, the issue's example dmultinom([1e308, 1e308], [0.5, 0.5]) gave 0 and its log NaN; the true value is about 5.641895835477563e-155 (log -355.17046926400775). This follows the handling of dnbinom where size + x overflows (reviews 22 and 55, #65, #151) and of dhyper's m + n: NaN rather than an inexact value in the integer range beyond 2^53. R 4.5.2 stops with an error for any count above 2^31 - 1 (as.integer gives NA). Totals in range are unchanged. Test: test/issue152.test.ts. (Not pushed yet.)
