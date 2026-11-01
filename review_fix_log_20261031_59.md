# 外部レビュー (59 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (htest: ksTest・mcnemarTest・chisqTest・rankTests・wilcoxTest・tTest・varTest・corTest・ansariTest・jonckheereTest・pAdjust)。13 件 (HTEST-018〜030) を今のコード (`9473dca`) と R 4.5.2 で確かめた。HTEST-025 (tTest)・027 (corTest) は 58 回目に修正済み。残る 11 件は再現した (R もほぼ同じく誤る)。ユーザーが計画を承認し、10 件を直した。

ユーザーの判断:
- 検定が定義できない入力で R も NaN を返す 4 件 (mcnemar の不一致の組なし、wilcox の差がすべて 0、varTest の両群定数、chisq の分割表のシミュレーションの小数の度数) はエラー
- HTEST-029: 同順位を入れた分散にする (統計学的に正しいのは補正した方。clinfun・DescTools の簡略化は不正確)
- HTEST-028: 記録だけ

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| HTEST-018 | 1 標本 KS の正確な両側、D = 0.9、n = 10・20・50・99 | 2.0e-10、0、8.9e-16、2.0e-15 | 2.0e-10、0、0、3.0e-15 | 2.0e-10、2.0007e-20、2.0161e-50、2.0526e-99 (SciPy と一致) |
| HTEST-019 | `mcnemarTest([[10, 0], [0, 10]])` | NaN | NaN | RangeError |
| HTEST-020 | `chisqTest([[1.5, 2.5], [3.5, 4.5]], sim)` | 1 | 1 | RangeError |
| HTEST-021 | `mcnemarTest(3 × 3、不一致は (1, 2) だけ)` | NaN | NaN | 統計量 1、df 3 |
| HTEST-022 | quadeTest、±1e308 のブロック | 18.75 (2^-1022 倍で 16.67) | 同じ | 16.67 (どの尺度でも) |
| HTEST-023 | `wilcoxTest([0, 0, 0])` | NaN (警告) | NaN | RangeError |
| HTEST-024 | flignerTest、±1e308 | 5e-32 (2^-1022 倍で 0.140) | 0 (同 0.140) | 0.140 (どの尺度でも) |
| HTEST-025 | `tTest([1, 2, 3], confLevel = 0.9999999999999999)` | ― | ― | 修正済み (58 回目) |
| HTEST-026 | `varTest([1, 1, 1], [2, 2, 2])` | NaN | NaN | RangeError |
| HTEST-027 | corTest の信頼水準 1 − 1e-16 | ― | ― | 修正済み (58 回目) |
| HTEST-028 | ansariTest の正確な区間、confLevel 0.99 | NA (警告 "samples differ in location") | [NaN, NaN] | 変えない (記録だけ) |
| HTEST-029 | `jonckheereTest(c(1, 1, 2, 2, 3, 3), 3 群, increasing)` | clinfun・DescTools とも 0.0085591 | 0.0085591 | 0.0061086 |
| HTEST-030 | `pAdjust([0.01, 0.02], BY, n = Inf)`、holm | エラー "too long a vector"、[1, 1] | 終わらない、[1, 1] | RangeError (どちらも) |

### HTEST-029 の判断の根拠

帰無仮説の下での JT の分布は、観測値を群のあいだで並べ替えた分布で、同順位があるとその分散は小さくなる。Hollander & Wolfe の同順位を入れた分散 V = [N(N−1)(2N+5) − Σn_i(n_i−1)(2n_i+5) − Σt_j(t_j−1)(2t_j+5)]/72 + [Σn_i(n_i−1)(n_i−2)][Σt_j(t_j−1)(t_j−2)]/(36N(N−1)(N−2)) + [Σn_i(n_i−1)][Σt_j(t_j−1)]/(8N(N−1)) が正しい。例 (N = 6、各群 2、同順位の組 3 つ) では 5.7333 で、補正なしの 6.3333 より小さい。テストで、小さな例のすべての並べ替えを数えた分散と一致することを確かめた

## 修正の内容

- `src/htest/ksTest.ts`: 1 標本の正確な両側で D ≥ 1/2 なら 2 × `pkolmogorovOneSidedUpper` (Birnbaum–Tingey、正の項の和)。D ≥ 1/2 では両側の超過が同時に起きないので厳密。D < 1/2 は今のまま
- `src/htest/mcnemarTest.ts`: n_ij + n_ji = 0 の組は足さない。足す組がなければ RangeError
- `src/htest/chisqTest.ts`: 分割表のシミュレーションで度数が整数でなければ RangeError
- `src/htest/rankTests.ts`: quadeTest の範囲と flignerTest の偏差が Inf になるとき (データは有限) だけ、全体を `scaleToUnit` で割ってから計算する (常に割ると極小の値が 0 に潰れて順位が変わりうる)
- `src/htest/wilcoxTest.ts`: 0 を除いた n が 0 なら RangeError
- `src/htest/varTest.ts`: 両群の分散が 0 なら RangeError
- `src/htest/trendTests.ts`: 同順位があるときの正規近似の分散を `tiedVariance` (Hollander & Wolfe) に。同順位がなければ今の式
- `src/htest/pAdjust.ts`: n = Inf は RangeError。BY の調和数は n > 1e6 で漸近展開 ln n + γ + 1/(2n) − 1/(12n²) + 1/(120n⁴)

## 記録だけ

- HTEST-028: ansariTest の正確な区間は、分位点を超える候補がない側を 0 か Inf にする向きの判定が単純でない (AB は尺度について単調とは限らない)。R も NA
- KS の D < 1/2 で p 値が極小の場合 (n が大きいとき) は、今も 1 − P(D < d) で桁が落ちる
- レビュアーが確定に入れなかったもの: propTrendTest で全群の成功率が 0 か 1、gamesHowellTest・tukeyTest・dunnettTest で全群が 1 例 (NaN を返す)、ansariTest の正確な計算の大きな標本での時間

## テスト

- `test/review59.test.ts`: 各件。jonckheere は並べ替えの全列挙の分散と比べる
- stash で、修正前に止まる HTEST-030 を除く 5 件が失敗することを確かめた
- fixture: `test/moreTests.test.ts` の jonckheere の同順位のケースを `knownDifference`、`test/wilcox.test.ts` の差がすべて 0 のケースを `substitute` に記録。58 回目のテスト (分割表のシミュレーションの小数の度数) をエラーの確認に書き換えた
- 全体テスト `npx vitest run`: 2256 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし
- 確認中に `timeout` で打ち切った tsx の子の node が残った (1 つ)。ユーザーに終了を頼んだ

## docs

- 「R が不正確な場合」: clinfun・DescTools の jonckheere の同順位
- Where R fails: KS の極小の正確な p 値、quade・fligner の尺度、mcnemar の不一致ゼロの組、pAdjust の n = Inf
- 「意味のない入力はエラー」: 4 件

## 外部レビュアーの次の予定

分布関数を使う検定の裾確率、数値積分を使う多重比較 (極端な p 値の桁落ち、大きな自由度の近似精度、積分が収束しない場合)
