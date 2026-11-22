# 段階 2 (実装) の指示 (1.8.0、Issue #545)

作成 2026-11-21。規則は入口 `briefs/regression-1.8-status.ja.md` (クリーンルーム)、全体は `briefs/regression-1.8.ja.md`。

## 1. 段階 1 の結果

- 仕様書 3 つの「rStats.js's choices」を、ユーザーの決定 (全部推奨どおり) で書いた。**choices は仕様書のほかの節より優先する。**
  食い違う所はほかの節を choices に合わせて直す。気づいた所:
  - `oracle/rq-behaviour.md` §3 の最後の段落 (boot の乱数は未解明) は §7.7 と食い違う。§7.7 に合わせる
  - `oracle/rq-behaviour.md` の `## Decisions for the user` の見出しが二重。前の版の 4 (既定の se)・5 (重み 0) が消えていた
    (choices 4・5 で決めた)
- **fixture はこちらで作った:** `test/fixtures/rq.json` (x86_64 の R。boot の乱数のため `oracle/rq.R` の先頭に
  `# oracle-platform: amd64`)、`test/fixtures/gee.json`、`test/fixtures/glmnet.json`。3 本の oracle の最後の行を、
  標準出力ではなく `/out/<名前>.json` に書く形に直した (既存の oracle と同じ)
- oracle は Issue の 60000 バイトの上限に合わせて出力を削ってあるが、**fixture には上限がない。** テストに要る値 (全部の
  fitted・residuals、全 case の `fitTight`、glmnet の経路の全列など) は oracle に足してよい。oracle を直したら push して、
  Issue に「fixture の依頼」と書く (こちらが作って push する。それまでそのテストは落ちてよい)
- **oracle に必ず足すもの (今の fixture に無い。`rq-behaviour.md` §7.8 の「covers」は今の `rq.R` と合っていない):**
  - `rq.R`: boot の 4 方法 (`set.seed` つき)、Engel (n = 235) の br・fn、解が一意でない例、完全一致、共線、NA の行、
    τ が範囲外のエラー、重み 0、`summary` の各 `se` の警告の case。`experiments/regression18-rq.R` の case が手本
  - `glmnet.R`: `intercept = FALSE`、`lower.limits`/`upper.limits`、`dfmax`/`pmax`、`nlambda`・`lambda.min.ratio`、
    与えた `lambda`、poisson の offset、`type` ごとの `predict`、端の case (定数の列、y が定数、p > n、1 列、分離、
    x × 1e100、y × 1e-100、NA)。`experiments/regression18-glmnet.R` が手本
  - `gee.R`: poisson の作業相関 4 種 (今は offset の 1 件だけ)
  - 3 本とも、1 行に 1 文で書く (今は 1 行に詰めてあって読みにくい)。記録する引数と呼び出しを 1 つの一覧から作る

## 2. 実装の順と止まり方

`rq` → `geeglm` → `glmnet` (`cvGlmnet` を含む)。1 つが CI 緑になったら Issue に短い報告を書き、**止まらずに次へ進む。**
3 つが済んだら段階 2 の報告をして止まる。各区切りで push と Issue への数行の途中経過。

## 3. 実装しながら突き止めるもの (R と合わなければ、試したことを添えて報告)

仕様書の「Unresolved」はどれも、テストが R と合うことで初めて決まる。式は文献から組み、R の出力と比べて合うものを
採る。合ったら仕様書のその節を書き直す (式と、何桁合ったか)。

- **rq の iid の $\hat f_0$:** 共分散から逆算した値 (§7.2 の 0.128571428571429) を再現する推定量を、文献の範囲で探す
  (Koenker 2005 の 3.4 節の Siddiqui の差分商。残差の分位点のとり方、帯域、基底の観測 (残差 0 の p 個) を除くか、
  などの組み合わせ)
- **rq の rank の区間の端点:** Koenker (1994) の反転で、§7.5 の区間を 1e-10 で再現する
- **rq の boot:** 各方法の乱数から各回の推定値への変換 (pwy・mcmb・wxy)。標準誤差が R と相対 1e-12 で一致すること
- **geeglm の jackknife:** `jack` と `j1s` の正確な式 (Yan & Fine 2004、Halekoh et al. 2006 など)。`fij` も、削除した
  クラスタごとの当て直しから R の値を再現して確かめる
- **glmnet:** binomial・poisson・multinomial と `alpha < 1`・`alpha = 0` の $\lambda_{\max}$、`penalty.factor` の
  正規化、経路の早い終わり (fdev・devmax・dfmax/pmax)、multinomial の係数の識別、経路の外の補間 (§8 の 1)

## 4. 合格の条件

- 推定値は R の `fitTight` と相対 1e-8 程度で厳しく、R の既定とは「既定と `fitTight` の差」から決めた幅で。
  **許容誤差を広げて通さない**
- 指示書 (`briefs/regression-1.8.ja.md`) 5 節の端の入力 (尺度 1e±100、10 万件、NaN・Infinity、重み 0 と定数倍、縮退)。
  配列を関数の引数に展開しない
- choices の項目ごとに、どのテストで確かめたかを報告に書く
- 落ちてよいテスト: `test/unknownOptions.test.ts`・`test/rIndexDoc.test.ts` の 2 件 (こちらが作り直す)。fixture の依頼中の
  テスト
