# 外部レビュー (24 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた追加監査 (正規・対数正規・ロジスティック・Laplace・コーシーの無限尺度と尺度 0、無限の位置パラメータ、arcsine の区間幅の溢れ)。

## 判定

| ID | 判定 |
|---|---|
| NORMAL-INF-SD-01、NORMAL-INF-MEDIAN-01 | **修正** (B)。R と同じく NaN だったが、ほかの p では極限の値を返しているので、中央値も極限の値にした |
| LOGNORMAL-INF-SD-01、LOGNORMAL-INF-MEDIAN-01 | **修正** (B)。qnorm の修正で exp(meanlog) になる |
| LOGISTIC-INF-SCALE-01、LOGISTIC-INF-MEDIAN-01 | **修正** (B) |
| CAUCHY-INF-SCALE-01 | **修正** (C)。qcauchy は scale = Inf ですべての p が NaN だった (R も同じ)。qnorm、qlogis と同じく極限の値を返す |
| LAPLACE-INF-SCALE-01 | σ = Inf は d/p/q のすべてで NaN。一貫しているので対応不要 |
| LOGISTIC-ZERO-SCALE-01、CAUCHY-ZERO-SCALE-01 | R と一致 (d と p は NaN、q は location)。NaN は「定義されない」の意味で、誤った値ではない。記録だけ |
| 無限の位置パラメータ (正規・コーシー・ロジスティック・対数正規) | 同じ符号の無限大どうしは NaN で、R と一致。対応不要 |
| Laplace の無限の位置パラメータ | `plaplace(Inf, mu = Inf)` は 0 で、正規分布 (NaN) と揃っていないが、極限の取り方による。記録だけ |
| **ARCSINE-WIDTH-01、ARCSINE-QUANTILE-01、ARCSINE-DENSITY-01、ARCSINE-LOGDENSITY-01** | **修正** (A) |

## A. Arcsine で区間幅 b − a が溢れる場合

区間は (−1e308, 1e308)。arcsine は R にないので、数学的な値と比べた。

| 呼び出し | 修正前 | 修正後 | 正しい値 |
|---|---|---|---|
| `parcsine(0)` | 0 | 0.5 | 0.5 |
| `parcsine(5e307)` | 1 | 2/3 | 2/3 |
| `parcsine(-9e307)` | 0 | 0.14357… | (2/π) asin(√0.05) |
| `parcsine(0, logP)` | −Inf | −log 2 | −log 2 |
| `qarcsine(0.5)` | Inf | −2e292 (端点の 1 ulp) | 0 |
| `qarcsine(0.25)` / `qarcsine(0.75)` | Inf / −Inf | ∓1e308/√2 | ∓1e308/√2 |
| `qarcsine(1e-100)` | **+1e308** (反対側の端) | −1e308 | −1e308 |
| `darcsine(0)` | 0 | 3.18e-309 | 1/(π·1e308) |
| `darcsine(9e307, log)` | −Inf | 有限 | −log π − (log 1.9e308 + log 1e307)/2 |
| `darcsine(8.5e307, a = 0, b = 1.7e308)` | 0 | 3.74e-309 | 1/(π·8.5e307) (幅は範囲内) |

- **修正:**
  - b − a が溢れるときだけ、x・a・b を半分にした区間で計算する (半分にするのは厳密)
  - p はそのまま、q は 2 倍、密度は 1/2 倍 (log では −log 2) にして戻す
  - 線形の密度は、π √(x − a) √(b − x) が溢れるときだけ、割り算を 2 回に分ける (幅が範囲内の (0, 1.7e308) でも中央で 0 だった)
  - 通常の範囲の値は変わらない
- **`qarcsine(0.5)`:** −2e292 は端点の 1 ulp。`qbeta(0.5, 1/2, 1/2)` が 0.5 − 2^-54 なので、通常の尺度でも `qarcsine(0.5, -1, 1)` は −1.1e-16 になる。修正とは別の、既存の丸め

## B と C. 尺度が無限大のときの中央値

| 呼び出し | R 4.5.2 | 修正前 | 修正後 |
|---|---|---|---|
| `qnorm(0.5, 3, Inf)` (log.p も同じ) | NaN | NaN | 3 |
| `qnorm(0.3, 3, Inf)` | −Inf | −Inf | −Inf (変わらない) |
| `qlnorm(0.5, 0, Inf)` | NaN | NaN | 1 |
| `qlogis(0.5, 3, Inf)` | NaN | NaN | 3 |
| `qcauchy(0.5, 3, Inf)` / `qcauchy(0.3, 3, Inf)` | NaN / NaN | NaN / NaN | 3 / −Inf |

- **修正:**
  - `locationScale` と `affine` (`src/internal/ddexp.ts`) で、t = 0 かつ scale = Inf のときは位置パラメータを返す (Inf × 0 = NaN を避ける)
  - scale が有限なら通らないので、通常の値は変わらない
  - `qcauchy1` は scale = Inf を NaN にしていた検査を外した。`tinyTail` と `locationScale` が ±Inf を返す
  - Laplace は σ = Inf を先に NaN にするので影響しない
- **R の fixture:** R の NaN と違うケースを、理由を付けて既知の差にした (`test/qnorm.test.ts` で 2 件、`test/simple.test.ts` の qlnorm 2 件・qlogis 2 件・qcauchy 96 件)。値が位置パラメータか ±Inf の場合だけを除外する

## テスト

- `test/review24.test.ts` を追加した。src を `git stash` で戻すと 6 件すべてが失敗することを確かめた
- 全体テスト: 2133 passed / 34 skipped、失敗 0
- `npx tsc --noEmit -p .`: エラーなし
- docs (英・日) の「Where R fails」の表に qnorm/qlnorm/qlogis と qcauchy の行を、R にない分布の段落に arcsine の幅の溢れを書いた
