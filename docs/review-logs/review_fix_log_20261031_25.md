# 外部レビュー (25 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (ガンマ分布の検証順序と rate/scale、指数・Weibull、ベータの巨大な shape、二項・ポアソン・負の二項の CDF、幾何の量子関数、超幾何の溢れ)。レビュアーは push 済みのコード (`a423f98` 以前) を見ている。

## 判定

| ID | R 4.5.2 | 修正前 | 判定 |
|---|---|---|---|
| GAMMA-QUANTILE-VALID-01 (`qgamma(0 / 1, shape = -1)`) | 0 / Inf | 0 / Inf | **修正 (D)。** pnbeta (`cf1f7a9`) と同じく、端点より先にパラメータを確かめる |
| GAMMA-SCALE-VALID-01: `rate = 0, scale = 0` | エラー | エラー | レビュアーの誤り。既に throw している |
| 〃: `rate = NaN, scale = 1` / `rate = Inf, scale = 0` / `rate = 0, scale = Inf` | エラー ×3 | 0.3679 / NaN / 0 | **修正 (C)。** R と同じくエラーにする |
| EXP-INF-RATE-01 (`dexp(1, Inf)`、`pexp`、`qexp`) | NaN、1、0 | 同じ | R と一致。尺度 0 は R どおりの方針。対応不要 |
| WEIBULL-INF-PARAM-01 | ― | ― | 具体例なし。対応不要 |
| BETA-DENSITY-OVERFLOW-01 (`dbeta(0.5, 1e308, 1e308)`) | NaN | 0 (log は −Inf) | **修正 (B)** |
| ARCSINE-* | ― | ― | 修正済み (`ba0d7f2`、24 回目) |
| pbinom などの `floor(q + 1e-7)` | `pbinom(0.99999995, 1, 0.5)` は 1 | 1 | レビュアーが撤回。R と同じ処理 |
| NEGBIN-MU-OVERFLOW-01 (`pnbinom(0, 1e308, mu = 1e308, log)`) | エラー (bratio) | −6.93e307 (正しい) | 修正済み (`579e44c`) |
| **GEOM-QUANTILE-01** (`qgeom(0.7500000000000866, 0.5)`) | 1 | 1 | **レビュアーの撤回のほうが誤り。** ceil(2.0000000000004996 − 1 − 1e-12) = ceil(0.9999999999995) = 1。定義どおりの答えは 2。**修正 (E)** |
| HYPER-FORM-OVERFLOW-01 (`dhyper(5e307, 1e308, 1e308, 1e308, log)`) | NaN | NaN | 2^53 を超える整数の方針どおり |
| HYPER-QUANTILE-OVERFLOW-01 (`qhyper(0.5, 1e200, 1e200, 1e200)`) | **1** (誤答) | NaN | 同上 |
| (今回の確認で発見) phyper・qhyper が終わらない | ― | 下記 | **修正 (A)** |

## A. phyper・qhyper が終わらない

| 呼び出し | 修正前 | 修正後 |
|---|---|---|
| `phyper(N/2 − √N, N, N, N)`、N = 1e12 / 1e14 / 1e16 | 0.4 秒 / 4 秒 / 40 秒 | 同じ (変えていない) |
| `phyper(5e16, 1e17, 1e17, 1e17)`、`qhyper(0.3, 1e17, 1e17, 1e17)` | 終わらない | NaN |
| `phyper(5e307, 1e308, 1e308, 1e308)` | 終わらない | NaN |

- **原因:** `tailSum` は y を 1 ずつ動かして和をとる。y が 2^53 を超えると `y += 1` で値が変わらず、m + n が溢れると比が NaN で打ち切りの判定も成り立たない
- **修正:** 台の上端が 2^53 を超えるときは NaN を返す (2^53 を超える整数の方針どおり)。台の外 (0 と 1) はそのまま返す。dhyper は値を返せているので変えていない
- 2^53 未満で時間が √(m + n) に比例するのは R と同じ (R の `qhyper(0.5, 1e15, 1e15, 1e15)` は 1 分以上返らなかった)

## B. dbeta の巨大な shape

| 呼び出し | R 4.5.2 | 修正前 | 修正後 | 正しい値 |
|---|---|---|---|---|
| `dbeta(0.5, 1e308, 1e308)` | NaN | 0 | 1.128e154 | 2/√π · 1e154 |
| 同 log | NaN | −Inf | 354.71888… (相対 1e-15 未満で一致) | log(2/√π) + 154 log 10 |
| `dbeta(0.75, 1.5·2^1023, 0.5·2^1023, log)` | ― | −Inf | 一致 (相対 1e-15 未満) | log(m/2π)/2 − log(x(1−x))、m = ab/(a+b) |
| `dbeta(0.5, 1e300, 1e300)` | 1.1283791670956209e150 | 1.1283791670954887e150 | 変わらない | 1.1283791670955126e150 |

- **原因:** 指数 E を作る `dbinomExponent` が n = a + b を作り、それが溢れて E が Inf になっていた。m = ab/(a+b) と log(a + b) も溢れる
- **修正 (a + b が溢れるときだけ):**
  - bd0 は同次 (bd0(cx, cM) = c·bd0(x, M)) なので、半分の shape で E を求めて 2 倍する。stirlerr の項は 1/(12a) ≈ 1e-309 で無視できる
  - m = lo/(1 + lo/hi)、log(a + b) = log hi + log1p(lo/hi)
- 合計が範囲内なら式は変わらず、通常の値は 1 ビットも変わらない
- `dbeta(0.5, 1e300, 1e300)` の線形の値は、真値と相対 2e-14 ずれる (R は 1e-13)。log 345.5 の丸め (ulp 5.7e-14) が exp で拡大されるもので、今回は変えていない

## C. gammaScale

- 条件を `!(|rate · scale − 1| < 1e-15)` にした。NaN の積 (rate = NaN、Inf × 0) も R と同じくエラーになる
- R は両方が整合するとき警告を出すが、こちらは警告を出さない (検定の警告と同じ方針)

## D. qgamma・qchisq の検証順序

- 負の shape・df、0 以下の scale は、p = 0 と 1 でも NaN (R は 0 と Inf)
- R の fixture では、該当する qgamma 16 件・qchisq 8 件を既知の差にした (`test/gamma.test.ts`)

## E. qgeom

- **R の式:** ceil(log u / log q − 1 − 1e-12) を double で計算する。1e-12 の許容幅のせいで、跳びより相対 1e-12 まで上の p で y − 1 を返す
- **最初の案 (不採用 1):** pgeom で ±1 を確かめる → 丸めた pgeom に合わせることになり、p に対する定義から外れる例が既存のテストにあった
- **最初の案 (不採用 2):** p に discreteQuantile と同じ許容幅 (相対 8ε、log で 2ε) を付ける → 分布関数が平らなとき、8ε が y の何万にも相当する (`qgeom(0.9999999999, 1e-10)` が R の 230258508460 より 18 万小さくなった)
- **採用した修正:**
  - log u / log q を double-double で厳密に求める (u は p から twoSum と ddLog で作る。log 尺度の下側だけ、−expm1 で 1 回丸める)
  - p の許容幅 (8ε・2ε) を比の上に写し、それが 1 段の半分未満のときだけ同点として扱う (qgeom(pgeom(y)) = y)
  - それ以上の場合 (p の丸めが何段にもまたがる場合) は、与えられた p に対する厳密な答えを返す (R と同じ)
  - 比が溢れる (prob が非正規化数) ときは Inf

| 呼び出し | R の qgeom | R の qnbinom(size 1) | 修正後 |
|---|---|---|---|
| `qgeom(0.7500000000000866, 0.5)` | 1 | 2 | 2 |
| `qgeom(0.8757104766401955, 1.1843e-6, lower = FALSE)` (p は pgeom(112064)) | 112065 | 112064 | 112064 |
| `qgeom(0.9999999998246265, 0.14171325019560754)` | 146 | 146 | 146 |
| `qgeom(0.9999999999999999, 0.9999999886719217)` | Inf | Inf | 2 (P[X <= 1] = 1 − 1.28e-16 < p) |
| `qgeom(0.9999999999, 1e-10)` | 230258508460 | ― | 230258508460 |

- ランダムな 2 万件で、ライブラリの `qnbinom(p, 1, prob)` と差は 0
- 往復 q(p(y)) = y は 19094 件中 64 件で崩れる。p が 1 に非常に近く、1 段が数 ulp しかない場合で、qnbinom も同じ
- `test/helpers/distributionKnown.ts` の qgeom の往復の既知の違反 (R の式で 1 つ上になる) は不要になったので削除した
- `test/extremeAccuracy.test.ts` の「qgeom keeps R's closed form」を、新しい答えに書き換えた

## テスト

- `test/review25.test.ts` を追加した
  - src を `git stash` で戻すと、dbeta・gammaScale・qgamma・qgeom の 4 件が失敗する
  - phyper の 1 件は、修正前のコードでは終わらない (修正前に止まることは別に確認済み。stash 中はこのテストを除いて流した)
- 全体テスト: 2138 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Deliberate differences」に qgamma・qchisq、qgeom、phyper・qhyper を、「Where R fails」の表に dbeta を書いた

## 作業中の注意

- 修正前のコードで phyper のテストを流したため、`git stash` 中に処理がバックグラウンドへ回り、src が退避されたままになった (HANDOFF の注意どおり)。タスクを止めて `git stash pop` で戻した
- 止まったテストの vitest ワーカーが node のプロセスとして残り、CPU を使い続けた。ユーザーの許可を得て 3 つを終了した (PID 18548・27796・28716)。stash 中の実行で残った 1 つ (PID 30896) は未処理
