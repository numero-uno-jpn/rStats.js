# 外部レビュー (26 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (共通基盤、数値積分、Brent 法 (optimize・uniroot)、optim、coxph、glm)。

## 判定

| ID | R 4.5.2 | 修正前 | 判定 |
|---|---|---|---|
| 共通基盤 (dpq・discrete・vectorize など) | ― | ― | レビュアーも問題なしと判定 |
| INTEGRATE-INFINITE-BOUNDS-01 (`integrate(exp(−x²), 0, -Inf)`) | 0.886 | 0.886 | **修正 (B)。** 正しくは −0.886。R も誤り |
| INTEGRATE-TOL-VALID-01 (rel.tol = Inf) | 粗い値を返す | エラー | 既に対応済み |
| QUAD-MIDPOINT-OVERFLOW-01 ((1e308, 1.1e308) で 1e-300 の積分) | 1e7 | 1e7 | 誤検出。正しい値を返す |
| QUAD-WIDTH-OVERFLOW-01 ((−1e308, 1e308) で正規密度の積分) | エラー (roundoff) | エラー (roundoff) | **修正 (A)。** 正しくは 1 |
| QUAD-ERROR-OVERFLOW-01 | ― | ― | 具体例なし。記録だけ |
| LOCALMIN-WIDTH-OVERFLOW-01 (`optimize((x/1e308)², -1e308, 1e308)`) | 警告を出して返る | **終わらない** | **修正 (A)** |
| UNIROOT-WIDTH-OVERFLOW-01 (`uniroot(x, -1e308, 1e308)`) | 警告 | **−Infinity** | **修正 (A)。** 正しくは 0 |
| UNIROOT-EXTEND-UNDERFLOW-01 (`uniroot(1e-300 (x−5), 1, 2, extendInt = "yes")`) | エラー | エラー | **修正 (C)。** 正しくは 5 |
| LOCALMIN-VALIDATION-01 | ― | ― | 内部関数。公開 API (optimize) は検証している。記録だけ |
| CG-PARABOLA-01 (補間の前に基準の関数値を上書きする) | ― | ― | **R の cgmin と同じ挙動。** CG の R fixture 11 件が評価回数まで完全に一致する。探索経路の効率の問題で、値の誤りではない。記録だけ |
| SANN-TEMP-VALID-01 (temp = 0 / −1) | エラー / 値を返す | **[1] を黙って返す** / 値を返す | **修正 (F)。** 正の有限値以外はエラー |
| OPT-PARSCALE / FNSCALE / NDEPS-VALID-01 (0) | エラー | エラー | 既に止まる (メッセージは R と同様) |
| SANN-TMAX-VALID-01 (1.5 を切り捨て) | `as.integer` | 同じ | R と同じ |
| COX-TIME-MERGE-OVERFLOW-01 (時刻 1e308 と 1.1e308) | ― | ― | 修正済み (オーバーフローしない mean) |
| GLM-BINOMIAL-SIZE / MUSTART-OVERFLOW-01 (`cbind(1e308, 1e308)`) | エラー | エラー | 2^53 を超える整数の領域。記録だけ |
| COX-CONVERGENCE-ZERO-01 (`coxph([1], [1], [[0]])`) | 「Ran out of iterations」 | 同じ | **修正 (E)** |
| COX-WEIGHT-SCALE-OVERFLOW-01、COX-EFRON-WEIGHT-01 | ― | ― | 2^53 を超える重みの領域、または具体例なし。記録だけ |
| GLM-ZERO-WEIGHT-DEVIANCE-01 (重み 0 の観測が y = 1e308 の poisson) | 逸脱度 NaN | NaN | **修正 (D)** |

## A. 区間の幅 b − a が溢れる場合 (integrate・optimize・uniroot)

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| (−1e308, 1e308) での N(0, (1e307)²) の密度の積分 | エラー (roundoff) | 0.99999999999 |
| `optimize((x/1e308)², -1e308, 1e308)` | 終わらない | objective 0 |
| `optimize(−(x/1e308 − 0.5)², -1e308, 1e308, maximum)` | 終わらない | 5.000000008e307 |
| `uniroot(x, -1e308, 1e308)` | −Infinity | 0 |
| `uniroot(x/1e308 − 0.25, -1e308, 1e308, tol = 1e-300)` | ― | 2.5e307 |

- **修正:** b − a が溢れるときだけ、u = x/2 の座標で、半分にした区間で解く (arcsine と同じ方法)
  - integrate: f(2u) を積分し、結果と誤差を 2 倍する (absTol は半分にして渡す)
  - optimize・uniroot: tol を半分にして、答えを 2 倍する
- 幅が範囲内なら、これまでと同じ計算 (値は変わらない)
- uniroot は、区間を拡張した後の幅で判定する

## B. integrate の無限大の端点の向き

| 呼び出し | R 4.5.2 | 修正後 |
|---|---|---|
| `integrate(exp(−x²), 0, -Inf)` | 0.886 | −0.886 |
| `integrate(…, Inf, 1)` | 1.633 ((−Inf, 1) の積分) | −0.1394 (= −∫₁^∞) |
| `integrate(…, Inf, -Inf)` | 1.772 | −1.772 |
| `integrate(…, Inf, Inf)` | 全実数での積分 | 0 |

- **修正:** lower が +Inf か upper が −Inf のときは、端点を入れ替えて符号を反転する。等しい無限大の端点は 0

## C. uniroot の extendInt = "yes"

- 同符号の判定を、積 `fLo * fUp > 0` から符号の積 `sign(fLo) · sign(fUp) > 0` に変えた (拡張の判定とループの両方)
- 1e-300 × 2e-300 が 0 にアンダーフローして、拡張されなかった
- 積が正規化数の範囲にあるときは、判定は変わらない

## D. glm の重み 0 の観測

- `totalDeviance` で重み 0 の観測を除いた (0 × Inf = NaN を避ける)
- 逸脱度残差も、重み 0 の観測は 0 にした
- 重み 0 の行を含む当てはめの逸脱度は、その行を除いた当てはめと一致する (テストで確認)

## E. coxph の収束判定

- 対数尤度が前回と等しいとき (両方 0 を含む) も収束とした。R と同じ判定 |1 − best/loglik| ≤ eps は、両方 0 で 0/0 = NaN になり、反復の上限まで進んでいた
- 等しくて 0 でない場合、R の判定でも 0 なので、それ以外の当てはめは変わらない

## F. SANN の温度

- `temp` が正の有限値でなければエラー ("'temp' must be a positive finite number")
- R は 0 で "non-finite value supplied by optim" で止まり、負の値は受け付ける (受理確率 exp(−Δ/T) が上り坂を好む)。修正前のこちらは、0 で初期値を黙って返していた

## テスト

- `test/review26.test.ts` を追加した
  - src を `git stash` で戻すと、5 件が失敗する
  - 幅の溢れの 1 件は、修正前の optimize が終わらないので、stash 中は除いた (止まることは別に確認済み)
- 全体テスト: 2144 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に B・A・C・D・E を、「Input that has no meaning is an error」に F を書いた

## 作業中の注意

- 比較に `npx tsx` を `timeout` 付きで使ったが、`timeout` が止めるのは npx だけで、子の node は残った (PID 7124・24872)。ユーザーに終了を依頼した
- 出力をパイプに流すと、強制終了されたときに失われる。1 件ごとに `appendFileSync` でファイルへ書くと、どこで止まったかが分かる
