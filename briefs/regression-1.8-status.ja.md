# 現状の要約: 回帰の続き (1.8.0: rq・GEE・glmnet)、Issue #545

更新 2026-11-20 (夜)。新しい会話はこの文書と指示書 (`briefs/regression-1.8.ja.md`) を読んで始める。

## クリーンルームの規則 (最重要。毎回守る)

- 照合先の quantreg (`rq` など)・geepack (`geeglm`・`geese` など)・glmnet と、R 自身 (stats) は GPL。**ソースを読まない・
  思い出して書かない・写さない。** 関数の本体の表示、CRAN・GitHub のミラー、解説記事や検索結果に引用されたソースも
  対象。記憶にあるコードの構造や変数名をなぞった実装もしない。glmnet の Fortran・C++ と、quantreg の Fortran
  (`rqbr`・`rqfnb` など) も写さない
- 当てはめの中のコードも見ない: 族のオブジェクトの関数 (`fit$family$linkfun` など) を表示しない、`unclass(fit)` を
  表示しない。値は公開の関数 (`coef`・`vcov`・`summary`・`predict`・`anova`・`QIC`・`residuals`・`fitted`) とヘルプに
  書かれた戻り値の要素で取る
- 検索は論文名・著者名・方法の名前で行い、「rq」「quantreg」「geepack」「glmnet」などの関数名・パッケージ名だけを
  検索語にしない。これまでに 2 回、検索結果にソースの抜粋が出た。**抜粋が見えたら使わずに報告する**
- 使ってよいもの: 論文と教科書 (Koenker & Bassett 1978、Koenker "Quantile Regression" 2005、Koenker & d'Orey 1987、
  Portnoy & Koenker 1997 (内点法)、Hall & Sheather 1988・Bofinger 1975 (帯域)、Powell 1991 (核の分散)、Gutenbrunner
  et al. 1993 (順位検定)、Parzen, Wei & Ying 1994 (pwy)、He & Hu 2002・Kocherginsky et al. 2005 (mcmb)、Liang & Zeger
  1986、Prentice 1988、Halekoh, Højsgaard & Yan 2006 (J. Stat. Softw. の geepack の論文)、Pan 2001 (QIC)、Friedman,
  Hastie & Tibshirani 2010・Tibshirani et al. 2012 (strong rules)・Simon et al. 2011 など)、R とパッケージのヘルプ (文書。
  例の節も)、vignette の文章、R の実行結果、rStats.js の既存の関数を呼ぶこと
- **仕様書の「rStats.js's choices」の節は変えない。** ユーザーの決定と根拠の記録で、こちらだけが書く。choices は仕様書の
  ほかの節よりいつも優先する。食い違いに気づいたら、ほかの節を choices に合わせて直す。choices を直すべきだと思ったら、
  Issue に提案を書いて止まる
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、流した実験の一覧) を書く

## 進め方

- **作業ブランチ `work/regression-1.8` にだけ push する。main には push しない。**
- **CI は自分で読む。** draft の PR #PR (`work/regression-1.8` → main、マージしない) で、push のたびに型チェックと全テストが
  流れる。push したら PR の Checks を見て、型エラーとテストの失敗は自分で直してから報告する。Checks が見えないときは、
  Issue に「CI の確認の依頼」と書いて次の作業へ進む。CI は今、全部通る状態 (基準のコミット)
- **push のたびに、そのファイルを GitHub 上で開き直して中身を確かめる** (1.7.0 で改行が文字どおりの `\n` になり、型
  チェックで止まったまま 8 コミット進んだ)
- 新しい関数やオプションを足すと、`test/unknownOptions.test.ts` (生成のブロック) と `test/rIndexDoc.test.ts` の 2 件
  (`docs/r-functions.md` の英・日) が落ちる。こちらがスクリプトで作り直すので、その 3 件だけは直さなくてよい。**手で
  `import { checkOptions }` や `*_KEYS` の定数を書かない**
- **区切りは大きめでよい。** ただし長い作業の途中では、区切りごとに push し、Issue に数行の途中経過 (何をしたか、次に
  何をするか、コミット) を書く。会話が切れても、ここから再開できる
- **R の実験はあなたが流す** (指示書 3 節。`# issue: <番号>` を先頭に)
- こちらがすること: fixture と生成物の作成、数値の点検 (独立の計算)、ユーザーへの Decisions の確認、取り込みと公開
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる。小さな判断は推奨を書いて進めてよい

## 進み具合

| 対象 | 状態 |
| --- | --- |
| rq | これから (段階 1) |
| geeglm | これから (段階 1) |
| glmnet | これから (段階 1) |

## テストの書き方 (要点)

- R と比べる。推定値は `fitTight` と厳しく、R の既定とはその差から決めた幅で。許容誤差を広げて通さない
- 表は全行・全列。不一致はラベル付きで集め、最後に `expect(mismatches).toEqual([])`
- strict の型 (`exactOptionalPropertyTypes`・配列の添字は `undefined` になりうる) で通るように。`describe` の中で
  `await` しない
- 端の入力 (尺度 1e±100、10 万件、NaN・Infinity、縮退、重みの定数倍) は指示書 5 節が合格の条件
- 配列を関数の引数に展開しない (`Math.max(...列)`)
