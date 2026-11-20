# 1.7.0 段階 3: 端の入力の直し (polr・rlm・nls)

作成: 2026-11-20 (調整役)。入口は `briefs/regression-1.7-status.ja.md` (規則と進め方)。ここは今回の依頼の中身。

## 1. 前提

- nls の段階 1・2 は完了・点検済み (`oracle/nls-behaviour.md` の choices 1〜9、`43a90e2e`)。PR #541 の CI は `fc7a6e38` で全部緑
- 調整役が手元で端の入力を一括で流した。証拠 (どれも公開の関数だけ):
  - `experiments/regression-stage3-edge.mjs` と `.out.txt`: 尺度 1e±300、水準の数、外れ値の割合、分離、直線上の点、大きさ
  - `experiments/regression-nls-strd.mjs` と `.js.out.txt`: NIST StRD の非線形回帰 26 題 (公有、認証値つき) の一致桁数
    (LRE)。データは https://www.itl.nist.gov/div898/strd/nls/ から取得する (repo には入れない)
  - `experiments/regression-nls-strd.R` と `.out.txt`、`experiments/regression-polr-scale.R` と `.out.txt`、
    `experiments/regression-edge-r.R` と `.out.txt`: 同じ入力での R の振る舞い (調整役が実行)
- スクリプトの使い方は各ファイルの先頭。バンドルは `npx esbuild src/entries/regression.ts --bundle --format=esm
  --platform=node --outfile=<tmp>/reg.mjs`

## 2. 直すこと (優先順)

### A. 不具合 (必ず直す)

1. **nls: 底が負の冪の微分が NaN。** `y ~ a + b*x^2 + c*x` (x に負の値) や `(x - c)^2` が、初期値から
   「non-finite model value or gradient」で落ちる。`(x-c)*(x-c)` なら通る。`u^v` の微分の $\log u$ の項が、
   指数が定数でも入るため ($0 \cdot \mathrm{NaN}$)。指数がパラメータに依らないときは $v u^{v-1} u'$ だけにする。
   指数がパラメータに依り底が負のときだけ、定義域のエラーにする。StRD の Gauss1・Gauss2・Gauss3・Eckerle4 (Start 2)・
   Thurber が全部これで落ちている (R はどれも解ける)
2. **nls: 残差がほぼ 0 のときの収束の判定。** 2 つは同じ根:
   - `scaleOffset: 1` で、残差 0 のデータ (`exact-scaleOffset`、`error-exact-fit` と同じデータ) の反復が 1 回早く止まり、
     係数の誤差 2e-12・RSS 3.4e-23 で終わる。完全一致と判定されず、意味のない SE 1e-12 を返す。勾配の判定の尺度
     $\sqrt{\mathrm{RSS}} + \texttt{scaleOffset}$ (`src/models/nls.ts:449-451`) のため
   - `scaleOffset` なしでは、StRD の Lanczos1 (RSS 1.4e-25、データの丸めの水準) が maxiter で失敗する。`warnOnly` なら
     認証値と 2.8e-11 で一致する点にいるのに、収束と判定できない (R も同じく失敗する。R の文書は `scaleOffset` を勧める)

   求める形: 段が丸めの水準 (パラメータに対して相対で数 ulp、または目的関数がもう下がらない) になったら収束とする。
   `scaleOffset` があってもなくても、`exact-scaleOffset` と `error-exact-fit` は同じ答え (完全一致、推論は NaN)、
   Lanczos1 は収束して LRE 9 以上。`scaleOffset` は判定を緩める向きにだけ働き、真の解の手前で止めない
3. **rlm MM: S 推定の尺度に絶対の閾値がある。** y を定数倍すると、係数と尺度が同じ倍率にならない:
   y × 1e-6 で尺度が相対 2.8e-11、1e-8 で 3.8e-7 (係数 7.7e-9)、1e-12 で 2.7e-4 (係数 5.5e-6)、1e-20 で係数 8.4e-3・
   尺度 4.5 倍ずれる (`regression-stage3-edge.out.txt` の「rlm MM x*1 y*…」)。単位が 1e-8 程度のデータ (濃度など) は普通にある。M は 1e±100 でも 1e-15 以内で
   同変。MM も y × c ($10^{-100} \le c \le 10^{100}$) で係数・尺度・SE が相対 1e-12 程度で c 倍になるようにする
4. **polr が R の 100〜300 倍遅い。** 応答 200 水準 (n = 1000) で 284 秒 (R 0.87 秒)、150 水準の因子 (n = 300) で 240 秒
   (R 1.76 秒)。原因 (密な行列の作り方、反復ごとの計算量、数値微分など) を調べて直す。目安は両方とも数秒以内。
   答えは変えない (既存の fixture のテストがそのまま通ること)
5. **rlm: 過半数の点がまったく直線上にあるとき** (ユーザーの決定 2026-11-20): **直線を返し、尺度は 0、収束した扱い。
   標準誤差・t 値などの推論は NaN にして警告を付ける** (nls の choices 6 とそろえる)。今は MM がエラー
   (「robust scale is not positive and finite」)、M は正しい係数なのに「failed to converge in 1000 steps」と警告する。
   R は M・MM とも直線を返し収束 TRUE (尺度 1e-16 程度。`regression-edge-r.out.txt`)。全部の点が直線上でも同じ

### B. 尺度への強さ (直す)

6. **nls: 「singular gradient」の判定が尺度で変わる。** Puromycin を初期値も同じ倍率にして当てはめると、y × 1e20、
   x × 1e±20 から落ちる (1e±10 までは通る)。判定を列の尺度に対して相対にする。y × c、x × c ($10^{-100}$〜$10^{100}$)
   で係数が c 倍になること
7. **polr: x × 1e100 で「the matrix is not positive definite」、x × 1e-300 で score が収束しない。** 内部で列の尺度を
   そろえて解き、元の尺度に戻す。x × c ($10^{-100}$〜$10^{100}$) で係数 × c・zeta・logLik が相対 1e-8 程度で一致すること。
   R も 1e100 で失敗し、1e-100 では黙って 4% ずれる (`regression-polr-scale.out.txt`)。ここは R に合わせない
8. **rlm MM: 部分集合の探索の予算が choices 1 の「約 1 秒」より小さい。** n = 100、p = 2 (4950 通り) で 3750 通りしか
   調べず (160 ms)、外れ値 49% の例で外れる。choices 1 の書き方 (約 1 秒の作業) に合わせて予算を決め直す。choices の
   文は変えない (変える必要があると思ったら、報告に書く)

### C. 足すこと (ユーザーの決定 2026-11-20)

9. **nls の式に `atan`・`asin`・`acos`** (微分つき)。StRD の Roszman1 (`y ~ b1 - b2*x - atan(b3/(x-b4))/pi`。今は
   `pi` も使えないので、R と同じく定数 `pi` を足す。データの列に `pi` があればそちらを優先するかは R の文書で確かめて
   仕様書に書く) で LRE を確かめる
10. **nls の左辺の式** (`log(y) ~ b1 - b2*x1*exp(-b3*x2)` など)。左辺はパラメータを含まない式に限る (含んだらエラー)。
    StRD の Nelson を `log(y)` のまま当てはめて確かめる。`nlsPredict` は左辺の尺度 (例: log y) で返す (R と同じ)

### 直さないこと (記録だけ)

- StRD の Start 1 (遠い初期値) で BoxBOD・MGH09・MGH10・MGH17・Rat43 が失敗するのは、R も同じ 5 題で失敗するので
  そのままでよい (Levenberg-Marquardt を足さない)
- polr の完全分離はエラー (R もエラー)。分離に近いデータは R と 6 桁一致 (coef 8.17997、logLik −8.04367)
- rlm の x × 1e-200 (正規方程式の下位桁あふれ) と、x × 1e150・y × 1e-150 の SE が 0 になるのは、極端なので直さなくてよい
  (QR に変えて簡単に直るなら直してよい)

## 3. テスト

- 上の 1〜10 のそれぞれに、`.out.txt` の入力 (または同じ形の小さな入力) でテストを足す。基準は R ではなく、同変性・
  認証値・独立の計算 (例: 3 と 6 と 7 は c 倍したときの関係、9・10 は StRD の認証値)
- StRD は 26 題の全部を入れなくてよい。今回の不具合に当たる題 (Gauss1、Thurber、Eckerle4、Lanczos1、Roszman1、Nelson)
  と、易しい題 1 つ (Misra1a) を、データを fixture として `test/fixtures/` に新しいファイルで置く (StRD は公有)。
  認証値との LRE は、収束判定の丸めを見込んで 7 以上を条件にし、実際の値を報告する
- 許容誤差は通すために緩めない。合わないときは理由を添えて報告する
- 4 の速さは CI でテストしない (機械で変わる)。報告に手元の数字を書く

## 4. 報告 (Issue #540、1 回)

CI が緑になったら止まって報告。要点 (1〜10 それぞれ、何をどう直したか)、4 の前後の時間、9・10 の LRE、R と違えた所と
根拠、仕様書 (`oracle/*-behaviour.md`) に足した記述の場所、クリーンルームの確認。choices の節は変えない
(5・9・10 の決定は調整役が choices に書く)。

## 5. 規則の要点

- R・MASS・GPL のソースは読まない (検索結果に出たら、読まずに報告)。PORT・netlib のコードも写さない
- R は実行しない (足りない実験は `experiments/` に push して Issue #540 で依頼)
- `rStats.js's choices`・既存の fixture・生成物は変えない (生成物の検査が落ちたら残してよい。調整役が作り直す)
- **push 先は `work/regression` だけ。** 前回 `main` に 1 件誤って push した (`c95e7c5e`、`6acb2bbc` で取り消し済み)。
  起きたら報告に書く
