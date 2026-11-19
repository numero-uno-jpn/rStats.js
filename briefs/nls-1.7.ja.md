# 指示書: 非線形回帰 `nls` (1.7.0 の最後の関数)

作成 2026-11-19。Issue #540、作業ブランチ `work/regression`、CI 用の draft の PR #541。最初に
`briefs/regression-1.7-status.ja.md` (規則と進め方の正本) と、main の `briefs/regression-1.7.ja.md` を読んでください。

polr と rlm は完了しています (触らない)。nls では往復を減らすため、**前もって決められることは決めてあり、oracle と
fixture もこちらで作ってあります。** この 1 つの依頼で、仕様書から実装・テスト・CI が通るまで進めてください。

## 1. クリーンルームの規則 (要点。全文は要約の文書)

- R の stats (`nls`・`nls.control`・自己開始モデル `SS*`・`getInitial`・`profile`・`confint`・`anova`・`predict`) は
  GPL。**ソースを読まない・思い出して書かない・写さない。** 当てはめの `$m`、呼ばずに表示した `SSlogis` などは見ない。
  PORT のライブラリ (netlib の Fortran) も写さない
- 検索は論文名・著者名・方法の名前で行い、`nls`・`SSlogis` などの関数名を検索語に入れない。抜粋が見えたら使わずに報告
- 使ってよい文献: Bates & Watts 1988 "Nonlinear Regression Analysis and Its Applications"、Bates & Chambers 1992
  ("Statistical Models in S" 10 章)、Golub & Pereyra 1973 (変数射影、plinear)、Pinheiro & Bates 2000 "Mixed-Effects
  Models in S and S-PLUS" (付録 C に自己開始モデルの式と初期値の考え方)、Dennis, Gay & Welsch 1981 (NL2SOL)、
  Nocedal & Wright (上下限つきの最適化の一般論)、R のヘルプの文書、こちらの R の出力
- R は実行しない。足りない実験は `experiments/<名前>.R` をまとめて push し、Issue に「実験の依頼」と書いて止まる
- **仕様書の「rStats.js's choices」の節は書かない** (こちらが書く)

## 2. 決まっていること (ユーザーの決定、2026-11-19)

- **式は文字列:** `nls("rate ~ Vm * conc / (K + conc)", data, { start: { Vm: 200, K: 0.05 } })`。右辺は四則・`^`・
  単項の `-`・括弧・数値・データの列・パラメータと、関数 `exp`・`log`・`sqrt`・`abs` など (R の数学の関数で、仕様書で
  一覧を決める) と、自己開始モデル `SSasymp`・`SSasympOff`・`SSasympOrig`・`SSbiexp`・`SSfol`・`SSfpl`・
  `SSgompertz`・`SSlogis`・`SSmicmen`・`SSweibull` を解釈する。既存の `src/models/formula.ts` (線形モデルの式) は関数の
  呼び出しを解釈しないので、**非線形の式の解析は新しく書く**
- **範囲は全部:** アルゴリズムの既定 (Gauss-Newton)・`plinear` (`.lin` の係数)・`port` (上下限)、自己開始モデル
  10 個、`weights`、`nlsSummary`・`nlsVcov`・`nlsPredict` (`newdata`)・`nlsConfint` (プロファイルと Wald)・
  `nlsAnova` (入れ子の F 検定)。添字つきのパラメータ (`Vm[state]`) は入れない
- 分野は `regression` (`src/entries/regression.ts`)

## 3. 前もって推奨で決めておくこと (異論があれば仕様書の Decisions に書く。なければこのまま進める)

1. **収束:** polr・rlm と同じく、**rStats.js は既定で真の解まで反復する** (R の既定の `tol = 1e-5` (相対の
   オフセットの判定) の手前で止めない)。`nls.control` に当たるオプション (`maxiter`・`tol`・`minFactor`・`warnOnly`・
   `scaleOffset`) は受け付け、意味は仕様書で整理する。収束しなければエラー、`warnOnly` なら警告と `converged = false`
2. **微分:** 解析的な微分 (式から記号的に作る) を推奨。R は数値微分なので反復の道筋は違うが、収束した値は同じになる
3. **自己開始モデルの初期値 (`getInitial` に当たるもの):** 文献 (Pinheiro & Bates 2000 付録 C など) から組み立て、
   **当てはめの最終の値が R と一致すればよい。** 初期値そのものは R と一致しなくてよい (fixture の `initial` は参考)。
   自己開始モデルの値と勾配は、fixture の `models` と全桁近く一致させる (式が同じなので)
4. **名前:** `nls`・`nlsSummary`・`nlsVcov`・`nlsPredict`・`nlsConfint`・`nlsAnova`。自己開始モデルは式の中だけで
   使い、関数としては export しない
5. **エラー:** R のエラーの case (fixture の `error-*`) は、rStats.js もエラーにする。文言は R と同じでなくてよいが、
   原因が分かる文にする。`error-exact-fit` (残差が 0 の当てはめ) と `error-no-start` は、R がエラーになる理由が
   rStats.js にも当てはまるかを確かめ、統計学的に正しい答えが出せるなら出す (R と違えた所として仕様書に書く)
6. **R の既定の当てはめとの比べ方:** fixture の `fitTight` (R の推定値から `tol = 1e-10` で当て直したもの) を参照にし、
   推定値・標準誤差・逸脱度を厳しく比べる。`fitTight` の多くは `convInfo.isConv = false` だが、逸脱度は R の既定より
   小さい (下の 5 節)。参照に使う条件は、`isConv` の印ではなく、勾配 $J^\top r$ の残りで判断する (rlm の教訓)。R の
   既定の当てはめとは、その case の「既定と `fitTight` の差」から許容誤差を決める

## 4. 用意してあるもの (`cad76e30`)

- `oracle/nls.R` (こちらが書いた。公開の関数だけ) と `test/fixtures/nls.json`:
  - `cases` (29): `id`・`formula`・`data` (列)・`args` (`start`・`algorithm`・`lower`・`upper`・`weights`
    (列の名前)・`control`)・`fit` (`value` に係数・要約の表・`sigma`・`df`・`vcov`・相関・逸脱度・`logLik`・`AIC`・
    `BIC`・残差・当てはめ値・`convInfo`、または `error`)・`fitTight`・`newdata` と `predict`・`confint` (profile と
    Wald の 0.95 と 0.90)・`initial` (`getInitial`)
  - `anova`: Puromycin の入れ子の 2 つの当てはめの F 検定の表 (`data`・`models`・`result`)
  - `models`: 10 個の自己開始モデルの、決まったパラメータでの値と勾配 (`x` = 0.5, 1, 2, 4, 8)
  - 数は JSON の数 (17 桁)。`NA`・`NaN`・`Inf` は文字列。長さ 1 の値に名前は付けていない
- 前の実験 `experiments/regression-nls.R`・`.json` (同じ内容の一部と、エラーの文言)

## 5. polr と rlm で分かったこと (最初から守る)

- **R の既定の止め方は早い。** nls でも、`fitTight` との差は係数で最大相対 4e-6 (puromycin-default)
- **テストは同じ物差しで比べる。** 違う定義の量を「以下」で比べると、何も確かめないテストになる (rlm で 2 回あった)
- **R の定義の細部は、公開の出力の数値で確かめる** (rlm の MAD の定数 0.6745、Proposal 2 の $n-p$、S の尺度、LTS の
  $h$)。推測で式を決めない。分からなければ、実験の依頼をまとめて出す
- **R が正しいとは限らない。** 食い違ったら、独立の計算で確かめてからどちらが正しいかを書く (polr の cauchit と offset)
- `import { checkOptions }` と `*_KEYS` の定数は手で書かない (生成のブロックと二重になる)。関数の先頭の
  `checkOptions(options, NLS_KEYS, "nls"); // generated: option-keys.mjs` の 1 行だけを書く
- TSDoc: `@category Regression`、1 文目は「<説明>. Equivalent to R's `nls()`.」の形、`@example` は単独で動く塊。
  新しい関数は `test/demo.test.ts` の `NOT_IN_DEMO_YET` に足す
- テスト 1 件は 1 秒以内。表は全行・全列。許容誤差は広げず、根拠をコメントに書く
- strict の型 (`exactOptionalPropertyTypes`、配列の添字は `undefined` になりうる、`DataFrame` の列は `Float64Array` も)

## 6. 進め方 (この順。区切りごとに push して Issue #540 に数行。CI は PR #541 で自分で確かめて直す)

1. **仕様書 `oracle/nls-behaviour.md`** (英語。章立ては `oracle/rlm-behaviour.md` に合わせる): 式の文法、アルゴリズム
   3 つ、収束、標準誤差 ($\hat\sigma^2 (J^\top J)^{-1}$、plinear の `.lin` を含む)、予測、プロファイルの区間、anova、
   自己開始モデル 10 個の式と初期値の考え方、エラーと境界。末尾に「Decisions for the user」(上の 3 節の推奨で決めた
   ものは「推奨で決定済み」と書く。新しく決めるべき大きなことだけ選択肢と推奨) と、空の「rStats.js's choices」
2. **大きな判断が新しく出たら、ここで止まって Issue に書く。** 出なければ止まらずに次へ進む
3. **非線形の式の解析と微分** (`src/models/nlsFormula.ts` など): 字句・構文・評価・記号微分。自己開始モデルの値と勾配
   (fixture の `models` と照合)
4. **当てはめ** (`src/models/nls.ts`): Gauss-Newton (段の半減)、`plinear` (変数射影)、`port` (上下限)。`weights`。
   自己開始モデルの初期値。fixture の `cases` の当てはめと照合
5. **付属の関数:** `nlsSummary`・`nlsVcov`・`nlsPredict`・`nlsConfint` (プロファイルは polr の経験を生かす:
   挟み込み・守られた Newton・温めた初期値・端の独立の確かめ)・`nlsAnova`
6. **エラーと境界** (fixture の `error-*`、`maxiter-warnOnly`、`exact-scaleOffset`、`puromycin-na-row`、
   port の上下限に張り付く case)
7. PR #541 の CI が通ったら、Issue #540 に nls の段階 1・2 の報告 (要点、R と違えた所と根拠、Decisions、
   クリーンルームの確認) を書いて止まる

テスト `test/nls.test.ts` (式の解析は `test/nlsFormula.test.ts` に分けてもよい)。新しい関数とオプションを足すと、
生成物の検査 (`test/unknownOptions.test.ts`・`test/rIndexDoc.test.ts`) が落ちるが、それはこちらが作り直す。
