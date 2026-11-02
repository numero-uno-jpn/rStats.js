# 外部レビュー (45 回目) 対応ログ

レポート: ユーザーがチャットに貼り付けた継続監査 (確率分布 `src/distributions/`)。確定指摘 8 件 (DIST-001〜008) は、すべて今のコード (`d7b9b6a`) で再現した。ユーザーの指示で全件を直した。sd の溢れ (追加) は、ユーザーの判断で全分布を直した。

## 判定と修正

| ID | 入力 | R 4.5.2 | rStats.js (修正前) | 修正後 |
|---|---|---|---|---|
| DIST-001 | `ppareto(1, a = Inf, b = 1)` / 上側 | extraDistr が未導入で未確認 | 0 / 1 (qpareto(0.5) は 1、dpareto(1) は Inf) | **1 / 0** (b の点質量、右連続。`pnorm(0, 0, 0)` = 1 と同じ) |
| DIST-002 | `pbeta(0.5, 1e308, 1e308)` | 0.5 | NaN | 0.5 |
| | `qbeta(0.5, 1e308, 1e308)` | NaN ("NaNs produced") | 0.75 | 0.5 |
| | `pbeta(0.4999999999999999, 1e308, 1e308, log)` | −3.98e276 | NaN | −4.93e276 (= −a log(1 − 4δ²)、δ = 2^-53。手計算と一致し、R は不正確) |
| | `pbeta(1e-308, 1, 1.7e308)`、`qbeta(0.5, 1e308, 5e307)` | 0.8173164759472652、NaN | 0.8173164759472653、0.6666666666666666 | 変わらない (非対称な形状は、修正前から連分数の経路で正しい) |
| DIST-003 | `distSummary("beta", 1e308, 1e308)` | ― | mean 0、variance 0、median 0.75、mode 0 | 0.5、1.25e-309、0.5、0.5、尖度 −3e-308 |
| | beta(1e200, 1e200)、beta(1e308, 5e307) | ― | 尖度 NaN、−0 ((s+2)(s+3) の溢れ) | −3e-200、−2e-308 |
| DIST-004 | hyper(1, 1, 1) / hyper(1, 2, 1) | ― | 歪度・尖度 NaN / 尖度 NaN | 0・−2 / 0.7071・−1.5 |
| DIST-005 | binom(10, 0)・binom(10, 1)・binom(0, p)・geom(1)・nbinom(5, 1)・hyper(3, 0, 2) など | ― | 歪度・尖度 ±Inf | NaN (点質量) |
| DIST-006 | arcsine(−1e308, 1e308) | ― | mean Inf、sd Inf、median −2.0e292 | 0、7.07e307、0。arcsine(−1, 3) の median も 0.9999999999999998 → 1 |
| sd (追加) | norm(sd 1e200)、unif(±1e308)、exp(rate 1e-200) など、尺度を持つ分布 | ― | 分散が溢れて sd も Inf。尺度 1e-200 では分散のアンダーフローで sd が 0 | 尺度に比例する sd (相対誤差 2.2e-16 以内) |
| DIST-007 | `dwilcox(0, 1050, 1050, log)` | −1451.5583224637703 | −Inf | −1451.55832246377 (1 ulp) |
| | `pwilcox(x, 1050, 1050, log)`、x = 0〜3000 | −Inf | −Inf | R の dwilcox の和の log と 1〜2 ulp で一致 |
| | `pwilcox(1000, 600, 600, log)` | −Inf | −752.5100416077707 | −752.5100416077709 (R の dwilcox の和は −752.51004160777086) |
| DIST-008 | `dwilcox(0, 1e12, 1e12)` | 実行していない (R は大きな表を確保する) | 外側のループが m 回 (m = 1e7 で 0.03 秒なので、1e12 では約 50 分) | NaN (mn > 2^53)、0.1 ms |

## 修正の内容

- `src/distributions/pareto.ts` `ppareto1`: a = Inf を、q ≤ b の判定より先に処理する
- `src/special/incbetTemme.ts` `betaIncTemme`
  - a + b が溢れるときは、半分の形状で r x − a・偏差 E・m を作り、2 倍する (どれも (a, b) の 1 次の同次式。p、q、τ は変わらない)
  - eD の stirlerr(a + b) は 0 とする (1e-309 未満)。stirlerr(a)・stirlerr(b) は元の形状で計算する (b が小さく m ≥ 25 の場合)
  - 裾の形 (E が大きい) で、`1 − e[1]` が負になり −0 を返していた。E ≥ 1500 では +0 を返し、上側の log は `log1p(−0)` の −0 の代わりに 0 を返す
- `src/distributions/beta.ts` `qbeta1`: 1/2 での分布関数が NaN なら NaN を返す (右半分の探索に進んで 0.75 を返していた)
- `src/distributions/summary.ts`
  - `make()` に sdDirect を足した。分散が [2^-1022, Inf) の外なら、尺度から直接作った sd を使う (範囲内は今と同じビット)
  - beta: s = a + b が溢れるときは、半分の形状から計算する。a·b が範囲外のときは、p = a/s、q = b/s の比で計算し、(s+2)(s+3) を作らない
  - hyper: N ≤ 3 では、台の上で中心モーメントを直接計算する。退化 (k = 0、m = 0、n = 0、k = N) では、歪度・尖度を NaN にする
  - binom・geom・nbinom: 退化 (n = 0、p = 0、p = 1) を明示して NaN にする。「分散 = 0」では判定しない (アンダーフローで 0 になる、退化していない分布を誤って NaN にしないため)
  - arcsine: mean を midpoint、median を mean にした
- `src/distributions/wilcox.ts`
  - `wilcoxParams`: mn > 2^53 は NaN
  - `buildTable`: 各段の最大の項 (中心の項) が 2^760 を下回ったら、表を 2^200 倍して scale に足す (通常の表では起きないので、今と同じビット)。掛け算の段で 2^-969 を下回った項があれば、その段の scale から `minTrusted` を求める
  - `tableValue`: signrank と同じく、「主の表 → 低位テーブル → s までの作り直し」の順に読む
  - `toProb`: 表の scale を使う。log で確率が 1e-300 未満のときは、仮数と指数に分けて log m + (k − scale) ln 2 とする (ln 2 は上位 32 ビットと下位に分ける)

## ビットが変わらないことの確認

修正前後で 2898 項目 (pbeta・qbeta の格子 11 × 11 × 10、Temme を使う pbinom・pf・pt、ppareto・qpareto、dwilcox・pwilcox・qwilcox の m, n ≤ 200 の格子と m = n = 600、distSummary の全分布) を比べた。変わったのは次の 5 件だけ。

- pbeta(0.4999, a = b = 1e100・1e300・5e307) の −0 → 0
- pwilcox(1000, 600, 600, log) の末尾 2 ビット (R の値に近づいた)
- arcsine(−1, 3) の median 0.9999999999999998 → 1

## テスト

- `test/review45.test.ts` (10 件)
  - `git stash push -- src` で、8 件が修正前に失敗することを確かめた
  - 600 の 1 件は、修正前も 11 桁で一致するので通る
  - DIST-008 は修正前に止まるので、stash 中は `-t` で除いた
- `test/extradist.test.ts`: distSummary の R の fixture は、binom(5, 1) の歪度・尖度を −Inf・Inf としている (R の閉じた式が分散 0 で割る)。knownDifference に記録した
- `npx vitest run`: 2194 passed / 34 skipped、失敗 0。`npx tsc --noEmit -p .`: エラーなし

## docs

`docs/differences-from-r.md`・`docs/ja/`
- 「Where R fails」に追加: qbeta・pbeta (和が溢れる形状)、pwilcox の log (確率が 1e-308 を下回る裾)
- 「Deliberate differences」に追加: mn > 2^53 の wilcox は NaN
- distSummary・ppareto・dwilcox は、R に同じ関数がないか、R が正しいので書かない

## 要再現の一覧 (4 節)

具体的な誤答の例がないので、記録だけ (nbeta・nchisq・nt・tukey・wilcox の中央付近・signrank・Weibull と Kumaraswamy の積分・f)。

## 範囲外で見つかった問題 (未修正。ユーザーの判断待ち)

- **wilcox の中央付近が NaN になる (m = n ≥ 約 700。修正前から)**
  - 例: `dwilcox(200000, 700, 700)`、`pwilcox(m²/2, m, m)` (m = 800〜1050) が NaN
  - 原因: 途中の段 i の分布の上側 (中心 i·n/2 を超える添字) で、小さい値の誤差が累積和 (1 − q^i で割る段) で増幅される。m = n = 700 の第 270 段では −1.3e300 になり、第 271 段の Veltkamp 分割が溢れて NaN になる
  - NaN になる手前の大きさでは、誤った有限の値を返している可能性がある (未確認)
  - 直し方の案: 各段の後、上側 (中心を超える添字) を、対称な下側の値で上書きする (各段の分布は中心について対称)
- **distSummary の nbinom が止まる (修正前から)**
  - 例: `distSummary("nbinom", { size: 3, prob: 4e-201 })`
  - 最頻値を探す `while (ok(mode + 1)) mode++` で、mode が 5e200 では mode + 1 = mode となり、ループが終わらない
- distSummary の pois は λ = 0 を不正なパラメータとして NaN にしている (R の dpois は λ = 0 を点質量として扱う)。判断は保留
