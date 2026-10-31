# 外部レビュー (33 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (power.ts・pwr.ts・effectSize.ts の入力検証、境界、逆算、非心度)。R 4.5.2 (pwr・effectsize) と比べた。

## 判定

| ID | R 4.5.2 | 修正前 | 判定 |
|---|---|---|---|
| POWER-PROP-N-VALIDATION-01 (76) | n = 0 で 0.021、n = −1 で NaN、Inf で 1 | 同じ | **修正 (A)**: n ≤ 0 と NaN はエラー |
| POWER-PROP-STRICT-* (77・88・92) | p1 = p2 = 0 で NaN (strict も)、p1 = 0・p2 = 1 で 1 | 同じ | 記録だけ。分散 0 の 0/0 で、検出力が定義されない |
| POWER-ANOVA-NCP-OVERFLOW-01 (78) | ― | 積だけが溢れると Inf | **修正 (D)** |
| PWR-EFFECTSIZE-NAN-VALIDATION-01 (79) | f・n1 の NaN はエラー、d の NaN は NaN | NaN | **修正 (A)** |
| PWR-SAMPLE-DF-FINITE-VALIDATION-01 (80) | NaN はエラー、Inf は計算 (n1 = Inf で 0.3526) | NaN、Inf は同じ | **修正 (A)**: NaN はエラー。Inf は従来どおり |
| ESW1-ZERO-EXPECTED-PROBABILITY-01 (81) | p0 = 0 < p1 で Inf、両方 0 で NaN | 同じ | **修正 (E)**: 両方 0 のセルは 0 を足す |
| ESW2-MATRIX-VALIDATION-01 (82) | 空行列で 0 | 0 | **修正 (A)**: 空・不整形はエラー |
| PWR-R-CORRELATION-RANGE-01 (83) | r = 1.5 で NaN (警告) | NaN | **修正 (A)** |
| ESH-PROBABILITY-RANGE-01 (84) | NaN (警告) | NaN | **修正 (A)** |
| PWR-ANOVA-INTEGER-SAMPLE-SIZE-01 (85) | 非整数を受け付ける | 同じ | 記録だけ (計画段階の連続値) |
| POWER-T-NEGATIVE-DELTA-SD-ROOT-01 (86) | delta = −0.5・power 0.2 でエラー | エラー (区間が逆転) | power 0.2 には**解がない** (右片側で delta < 0 なら検出力 ≤ α)。ただし解がある power 0.01 でも区間が逆転していた。**修正 (B)** |
| POWER-T-NEGATIVE-DELTA-ROOT-01 (87) | −0.178 | −0.178 | 誤検出 |
| POWER-SIGLEVEL-ENDPOINT-01 (89) | NaN | エラー | 記録だけ (端点) |
| POWER-ANOVA-WITHINVAR-ZERO-BETWEEN-01 (90) | "lower < upper is not fulfilled" | 同じ | **修正 (B)** |
| POWER-ANOVA-VARIANCE-ROOT-RANGE-01 (91) | ― | ― | 具体例なし。記録だけ |
| 効果量 0 の逆算 (93・94) | f はエラー、r は 0.0127 | 同じ | 記録だけ (端点) |
| PWR-CHISQ-NCP-OVERFLOW-01、PWR-F2-NCP-OVERFLOW-01 (95・96) | NaN | NaN | **修正 (D)** |
| PWR-R-INFINITE-N-01 (97) | 1 | 1 | 誤検出 (極限の値) |
| POWER-T-ZERO-DELTA-SD-IDENTIFIABILITY-01 (98) | "lower < upper is not fulfilled" | 同じ | **修正 (B)** |
| POWER-ANOVA-GROUPS-N-FINITE-01 (99) | groups = NaN はエラー、Inf は NaN | NaN | **修正 (A)**: NaN はエラー。Inf は D により極限の 1 |
| EFFECTSIZE-INFINITE-OBSERVATION-01 (100) | NA | "lower < upper is not fulfilled" | **修正 (C)** |
| EFFECTSIZE-NCP*-UNCONVERGED-ROOT-01 (101・102・106)、BRACKET-OVERFLOW (103) | ― | ― | 具体例なし。反復の未収束を通知しない設計の 1 つとして記録 |
| EFFECTSIZE-INSUFFICIENT-SAMPLE-SIZE-01 (104) | NA | "lower < upper is not fulfilled" | **修正 (C)** |
| EFFECTSIZE-ZERO-SD-01 (105) | Inf、NaN | 同じ | effectsize と同じ。対応不要 |

## 修正

**A. 入力検証**
- pwr.ts: 下限の検査を `!(x >= c)` の形にして、NaN も弾く (n1・n2・n・k・N・u・v・f・f2・w)。効果量を取り出す `effect()` で NaN をエラーにする (d・h・es・r)
- pwrTTest に n ≥ 2 の検査を足した (pwr と同じ。従来は検査がなかった)
- pwrRTest: r が [−1, 1] の外ならエラー
- esH・esW1・esW2: 確率が [0, 1] の外ならエラー。esW2 は空・不整形の行列もエラー
- power.ts: powerTTest の delta の NaN、powerPropTest の n ≤ 0 と NaN、powerAnovaTest の groups・n の NaN をエラーにした
- Inf は従来どおり (検出力の極限になる)

**B. 識別できない逆算と負の delta**
- delta = 0 で sd、betweenVar = 0 で withinVar を求めると、「検出力がそれによらない」ことを伝えるエラー
- powerTTest の片側で delta < 0 のとき、sd の探索区間を |delta| から作り、方向を逆 (upX) にした。power 0.01 で sd = 3.93 を返し、その sd での検出力は 0.01

**C. cohensD**
- Inf を含む標本はエラー (NaN は従来どおり欠損として除き、警告する)
- 1 標本・対応ありで有効な観測が 2 未満、2 標本で各群 2 未満ならエラー

**D. 非心度の溢れ**
- pwrChisqTest・pwrF2Test・pwrAnovaTest・powerAnovaTest で、非心度が Inf なら検出力 1 (極限)
- powerAnovaTest は、元の式 ((groups − 1)·n·between)/within が溢れたときだけ、between/within を先に計算する (通常の範囲の値は変わらない)。betweenVar = withinVar = 1e308 で、1 と 1 の場合と同じ値になる

**E. esW1・esW2 の 0/0 のセル**
- p0 と p がともに 0 のセルは足さない。p0 = 0 < p は R と同じく Inf

## テスト

- `test/review33.test.ts` を追加した。src を `git stash` で戻すと、5 件すべてが失敗する
- 全体テスト: 2169 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日): 入力検証を「Input that has no meaning is an error」の後に、D と E を「Where R fails」の表に書いた
