# 外部レビュー (47 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた特殊関数の監査 (`src/special/`、zip は `src(3).zip`)。確定指摘 9 件 (SPEC-001〜009) は、すべて今のコード (`f5b6ffa`) で再現した。正しい値は Rmpfr (200 ビット) で確かめた。ユーザーの指示で全件を直した。同じ原因で誤っていた入力 (レビューにないもの) も合わせて直した。

5 節の DIST-002 (`pbeta(0.5, 1e308, 1e308)` が NaN) は 45 回目に修正済みで、今のコードでは 0.5 を返す。レビュアーの zip に 45 回目の修正が入っていないため。

## 判定と修正

| ID | 入力 | R 4.5.2 | 正しい値 (Rmpfr) | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|---|
| SPEC-001 | `gamma(171.6243769563027)` | Inf | 1.79769313486222987e308 | Inf | 1.7976931348622544e308 (相対誤差 1.4e-14。下の「残したもの」) |
| SPEC-002 | `gamma(-171.5)` | 0 | 1.9316265431711996e-310 | 0 | 1.93162654317119e-310 (サブノーマルの 1 ulp 以内) |
| | `gamma(-172.5)` | 0 | -1.1197835032876519e-312 | 0 | 同上 |
| | `gamma(-177.5)` (追加) | 0 | 6.73e-324 | 0 | 5e-324 |
| SPEC-003 | `lbeta(1e308, 1e308)` | -Inf | -1.3862943611198915e308 | -Inf | -1.3862943611198905e308 |
| | `lbeta(1.7e308, 1e308)` (追加) | -Inf | -1.7797117603220764e308 | -Inf | -1.7797117603220757e308 |
| SPEC-004 | `erfcinv(MIN)` | (関数なし) | 27.213293210812949 | Inf | 27.213293210812949 |
| SPEC-005 | `besselI(1e-310, 0)`、`besselI(MIN, 0)` | 1 | 1 | NaN (連分数 100 万回の後) | 1 |
| SPEC-006 | `besselI(1e-310, 0.5)` | 7.978845608028839e-156 | 7.9788456080286414e-156 | Inf | 7.9788456080286423e-156 |
| | `besselI(MIN, 0.5, scaled)` (追加) | ― | 1.773504888603628e-162 | Inf | 1.7735048886036274e-162 |
| SPEC-007 | `besselY(1e-310, 0)` | -Inf | -454.49387560035389 | 正しい値だが 1.4 秒 (連分数 1 億回) | 同じ値、1 ms 未満 |
| | `besselY(MIN, 0)` (追加) | -Inf | -473.99907342300431 | NaN (1.3 秒) | -473.99907342300423 |
| | `besselY(MIN, 1)` (追加) | -Inf | -Inf | NaN (1.7 秒) | -Inf |
| SPEC-008 | `besselK(MIN, 0)` | 744.55600343703964 | 744.55600343703967 | NaN | 744.55600343703952 |
| | `besselK(MIN, 0.3)`、`besselK(MIN, 0.7)` (追加) | 1.807351518830311e97、2.1743775086913026e226 | 1.807351518830335e97、2.1743775086912542e226 | NaN | 1.8073515188303066e97、2.1743775086913179e226 (1.6e-14、2.9e-14。R も 1e-14 台) |
| | `besselK(MIN, 1)` (追加) | ― | Inf (1/x) | NaN | Inf |
| 同上 (追加) | `besselI(MIN, 0.3)`、`besselJ(MIN, 0.3)` | 警告 "precision lost" | 9.2215966252391492e-98 | 0 | 9.221596625239148e-98 |
| | `besselY(MIN, 0.3)` | -Inf | -1.1505957125059705e97 | NaN | -1.1505957125059704e97 |
| | `besselJ(MIN, -0.3)`、`besselI(MIN, -0.3)` | 警告 "precision lost" | 9.3085148507228119e96 | NaN | 9.308514850722813e96、9.308514850722665e96 |
| | `besselY(1e-310, 0.5)` | ― | -7.9788456080286627e154 | -7.9788456080284695e154 (2.4e-14) | -7.9788456080286648e154 |
| SPEC-009 | `besselK(1, 1e12)` | エラー "cannot allocate vector of size 7450.6 Gb" | Inf | 終わらない (20 秒で打ち切り) | Inf、1 ms 未満 |
| | `besselY(1, 1e12)` | 警告 "nu too large"、NaN | -Inf | 終わらない | -Inf |
| | `besselY(10, 1e8)`、`besselK(1e8, 2e8)` (追加) | NaN (警告)、0 | -Inf、Inf | -Inf (3.9 秒)、Inf (4.6 秒) | 同じ値、1 ms 未満 |
| | `besselI(1e12, 1e12)` ほか (追加) | ― | Inf / scaled 0 | 終わらない | テスト参照 |

## 原因

- **x/2 のアンダーフロー:** サブノーマルの x では x/2 が厳密でなく、x = MIN では 0 になる。`log(x/2)` が -Inf になり、次数 0 で `-a * u` = Inf × 0 = NaN (temmeIK、temmeJY)。`pow(x/2, v)` が 0 になり、I・J の級数の前因子が 0、Y の前因子が -Inf (seriesTimesPrefix、ySmallZ、temmeJY)
- **連分数の b_1 = Inf:** x < 1e-308 で b = 2(v + k)/x が Inf になり、Lentz 法の delta = C × D が Inf × 0 = NaN。収束判定が成り立たず、上限まで回る (cf1JY は 1 億回、cf1IK は 100 万回)
- **I の Wronskian の経路:** 次数 0 は級数の条件 (`v > 0 && x / v < 0.25`) に入らず、Wronskian I = 1/(x (K fv + K_(v+1))) を使う。極小の x では K_(v+1) ≈ 1/x が溢れる
- **I_1/2・K_1/2 の閉じた式:** `2 / (x π)`、`π / (2x)` が溢れる。2x がサブノーマルだと桁も落ちる
- **Gamma:** `stirf` の判定 `x >= MAXGAM` が、MAXGAM の double (Γ が有限な最大の double) で Inf を返していた。負の大きな引数は、反射公式の分母 `abs(z) · Γ(q)` が溢れる
- **lbetaHuge:** `(a + b − 0.5)` が溢れる
- **erfcinv:** `qnorm(z / 2)` の z/2 が 0 になる
- **大きな次数:** K の前進漸化式、Y の前進漸化式、J の後退漸化式が、どれも約 ν 回まわる

## 修正の内容

- `src/special/gamma.ts`
  - `stirf`: `x > MAXGAM` で Inf (MAXGAM の double では有限)
  - `gamma`: 反射公式の分母が Inf になるときだけ、Γ(q) = Γ(q − 10) ∏_{i=1..10}(q − i) に分けて、最後の割り算 1 回でサブノーマルに丸める。q − 10 は厳密。分母が有限なら今と同じビット
- `src/special/beta.ts` `lbetaHuge`: a + b が溢れるときだけ、(a + b − 0.5) L を a L + (b − 0.5) L にする。`stirlerr(Infinity)` は 0
- `src/special/extra.ts` `erfcinv`: z < 2^-1021 だけ `qnorm(log(z) − log 2, logP)`
- `src/special/besselSeries.ts`
  - `logHalf`、`powHalf`: log(x/2)、(x/2)^v。x ≥ 2^-1021 では今の式と同じビット。それより下では x/2 を作らない
  - `seriesTimesPrefix` の v < 10 で `powHalf` を使う
  - 大きな次数の判定: `LARGE_ORDER` (1000)、`logISeriesBounds`、`certainRange` (下の節)
- `src/special/besselIK.ts`
  - `temmeIK` で `logHalf`
  - `cf1IK`: b_1 が Inf なら x/(2(v + 1)) を返す (今の経路では到達しないが、予防)
  - `kScaled` の u = −1/2、`iPos` の v = 1/2: x < 2^-1000 では `sqrt(π/2) / sqrt(x)`、`sqrt(2/π) sqrt(x)` (x の積・商を作らない)
  - `iPos`: x < 2^-1000 では、v によらず級数 (x²/4 < 2^-2000 なので 1 項で正確)
  - `besselI`・`besselK`: 大きな次数の判定 (下の節)
- `src/special/besselJY.ts`
  - `temmeJY`・`ySmallZ` で `logHalf`、`powHalf`
  - `cf1JY`: b_1 が Inf なら fv = x/(2(v + 1))、sign = 1 を返す (残りは (1/b_1)² 以下)
  - `besselJYPos`: 大きな次数の判定 (`largeOrder`)
- JSDoc (besselI、besselK、besselY): 大きな次数で、判定できない範囲では時間が次数に比例すること

## 大きな次数の判定 (SPEC-009)

ν > 1000 のとき、結果の log の上界・下界を作り、上限 log(DBL_MAX) を超える、または下限 log(MIN/2) を下回ることが確実なら、漸化式の前に Inf / 0 を返す。上界・下界は端から余裕 m = 1 + 64ε × (各項の絶対値の和) だけ離れていることを条件にして、丸め誤差を吸収する。どれも厳密な不等式で、近似ではない。

- I (ν ≥ 0): (x/2)^ν / Γ(ν+1) ≤ I_ν(x) ≤ (x/2)^ν / Γ(ν+1) · exp(x²/(4(ν+1)))。級数の項が正で、和が Σ (x²/(4(ν+1)))^k / k! 以下であることによる
- K (ν ≥ 1): Wronskian I_ν K_(ν+1) + I_(ν+1) K_ν = 1/x と、I が次数について減少・K が増加することから、1/(2x I_(ν−1)(x)) ≤ K_ν(x) ≤ 1/(x I_(ν+1)(x))。そこに I の上界・下界を入れる
- J: abs(J_ν(x)) ≤ (x/2)^ν / Γ(ν+1) (DLMF 10.14.4)
- Y (x ≤ ν − 1): abs(Y_ν(x)) ≥ Γ(ν) (2/x)^ν / π、Y_ν(x) < 0。d/dx [x^ν Y_ν(x)] = x^ν Y_(ν−1)(x) は、Y_(ν−1) の最初の零点 (ν − 1 より大きい、DLMF 10.21.3) までは負で、x → 0 で x^ν Y_ν(x) → −Γ(ν) 2^ν / π だから
- 負の次数: 反射公式は Y_ν に sin(πν) か cos(πν) を掛ける。1000 < ν < 2^53 で整数 (余弦では半整数) でない ν では、その絶対値は sin(π 2^-43) = 3.6e-13 = e^-28.7 以上なので、Y の判定に余裕 30 を足した。I_−ν = I_ν + (2/π) sin(πν) K_ν は、片方の項がもう片方の e 倍以上で、差し引いても溢れるときだけ判定する
- 例: `besselI(1e12, 1e12)` = Inf、scaled は 0。`besselK(1e12, 1e12)` = 0、scaled は Inf。`besselI(1, −1e12 − 0.25)` = Inf、`besselY(1, −1e12 − 0.5)` = 0 (cos(πν) = 0 なので sin(πν) J_ν)

**残る制約 (記録だけ):** 上の不等式で判定できない範囲では、今までどおり時間が次数に比例する。たとえば Y の下界は x ≤ 0.74ν 程度までしか効かず、`besselY(0.9e8, 1e8)` (-Inf) は 2.4 秒かかる。x と ν がどちらも大きく、結果が範囲内か境界の近くにあるもの (J・Y の転移点の近くなど) も同じ。大きな次数用の算法 (I・K の Debye 展開、J・Y の Airy 型の一様展開) は将来の課題とする。

判定しない範囲の値は変わらない: `besselY(500, 1001)` = -6.9607110114749359e194、`besselI(500, 1001)` = 1.1025714402933864e-144 (R は -6.9607110114750608e194、1.1025714402933915e-144)。

## 残したもの

- **gamma の x > 33 の精度:** Rmpfr との相対誤差は、x = 40〜171.6 でおよそ 4e-16〜1.4e-14 (R は 2e-15〜1e-13)。SPEC-001 の境界の値の 1.4e-14 もこの範囲。原因は、`stirf` で −n + stirlerr(n) を double で丸めていること (n ≈ 170 で ulp は 2.8e-14) と思われる。直すと通常の範囲の値が変わるので、今回は手を付けていない
- **Temme の級数の exp(u log(x/2)):** x がサブノーマルや 1e-300 程度では log(x/2) ≈ −700 になり、その丸めが K に 1e-14 台の相対誤差として出る (`besselK(MIN, 0.3)`、`besselK(MIN, 0.7)`、`besselI(MIN, −0.3)`)。R も同じ程度で、修正前から極小の x では同じ性質

## テスト

- `test/review47.test.ts`
  - SPEC-001〜008 と追加の入力を、Rmpfr の値と比べる。サブノーマルの結果は、サブノーマルの 1 ulp 以内
  - 2^-1021、2^-1000 の隣の double で値が連続していること (erfcinv、besselK、besselI)
  - describe "review 47 large order": SPEC-007 の時間と、SPEC-009 の判定 (符号を含む)、判定しない範囲の値が変わらないこと
- `git stash push -- src` で、"large order" を除く 7 件が失敗することを確かめた (large order は修正前に止まるので流していない)
- `test/special.test.ts` の gamma の fixture: `gamma(-171.5)` で R は 0 (反射公式の分母の溢れ)。`knownDifference` に記録した
- 全体テスト `npx vitest run`: 2205 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

- `docs/differences-from-r.md`、`docs/ja/differences-from-r.md` の「Where R fails and rStats.js returns a value」に、gamma の境界と負のサブノーマル、lbeta、besselY の極小の x、大きな次数 (besselK・besselY) を足した
- R が正しい項目 (I・K の極小の x) は書いていない
