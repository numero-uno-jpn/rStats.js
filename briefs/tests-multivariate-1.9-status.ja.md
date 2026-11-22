# 現状の要約: 小さな検定 3 つと多変量 3 つ (1.9.0: T2・Page・Grubbs、manova・lda・cancor)、Issue #549

更新 2026-11-22。新しい会話はこの文書と指示書 (`briefs/tests-multivariate-1.9.ja.md`) を読んで始める。

## クリーンルームの規則 (最重要。毎回守る)

- 照合先の PMCMRplus (`tamhaneT2Test`・`pageTest` など)・outliers (`grubbs.test`・`pgrubbs`・`qgrubbs` など)・MASS
  (`lda`・`predict.lda`) と、R 自身 (stats の `manova`・`summary.manova`・`cancor`) は GPL。**ソースを読まない・
  思い出して書かない・写さない。** 関数の本体の表示、CRAN・GitHub のミラー、解説記事に引用されたソースも対象。記憶に
  あるコードの構造や変数名をなぞった実装もしない。**outliers の表 (Grubbs の type 20 の臨界値) もソースから写さない**
  (値は R の出力から取る)
- **ウェブ検索を使わない** (1.8.0 で検索結果にソースの抜粋が 5 回出た)。方法は知っている範囲の論文・教科書と、R の
  ヘルプ・R の実行結果で決める。論文を確かめたいときは、題名を Issue に書いて止まらずに先へ進む
- 当てはめの中のコードも見ない: `unclass(fit)` を表示しない、関数を呼ばずに名前だけ書かない。値は公開の関数
  (`coef`・`summary`・`predict` など) とヘルプに書かれた戻り値の要素で取る
- 使ってよいもの: 論文と教科書 (Tamhane 1979 (JASA 74)、Page 1963 (JASA 58)、Grubbs 1950 (Ann. Math. Stat. 21)・
  Pearson & Sekar 1936・David, Hartley & Pearson 1954、Pillai 1955・Rao 1951 (Wilks の F 近似)・Hotelling 1951・
  Roy 1953、Fisher 1936・Rao 1948 (判別)、Hotelling 1936 (正準相関)、Venables & Ripley "Modern Applied Statistics with
  S" (文章)、Mardia, Kent & Bibby "Multivariate Analysis" など)、R とパッケージのヘルプ (文書。例の節も)、R の実行結果、
  rStats.js の既存の関数を呼ぶこと
- **仕様書の「rStats.js's choices」の節は変えない。** ユーザーの決定と根拠の記録で、こちらだけが書く。choices は仕様書の
  ほかの節よりいつも優先する。食い違いに気づいたら、ほかの節を choices に合わせて直す。choices を直すべきだと思ったら、
  Issue に提案を書いて止まる
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、流した実験の一覧) を書く

## 進め方

- **作業ブランチ `work/multivariate-1.9` にだけ push する。main には push しない。**
- **CI は自分で読む。** draft の PR #550 (`work/multivariate-1.9` → main、マージしない) で、push のたびに型チェックと
  全テストが流れる。push したら PR の Checks を見て、型エラーとテストの失敗は自分で直してから報告する。Checks が見えない
  ときは、Issue に「CI の確認の依頼」と書いて次の作業へ進む。CI は今、全部通る状態 (基準のコミット)
- **「手元の環境がない」で止まらない。** GitHub への直接の push、Actions の R (指示書 3 節)、PR の CI を使う
- **push のたびに、そのファイルを GitHub 上で開き直して中身を確かめる** (1.7.0 で改行が文字どおりの `\n` になった)
- 新しい関数やオプションを足すと、`test/unknownOptions.test.ts` (生成のブロック) と `test/rIndexDoc.test.ts` の 2 件
  (`docs/r-functions.md` の英・日) が落ちる。こちらがスクリプトで作り直すので、その 3 件だけは直さなくてよい。**手で
  `import { checkOptions }` や `*_KEYS` の定数を書かない**
- `/multivariate` の配線 (`package.json`・`scripts/`・`typedoc.json`) はこちらがする。最初の多変量の関数ができたら Issue
  に「配線の依頼」と書く
- **会話はよく途中で切れる。** 区切りごとに push し、Issue に数行の途中経過 (何をしたか、次に何をするか、コミット) を
  書く。会話が切れても、こちらがブランチ・CI・Issue を見て再開の依頼文を書く
- **R の実験はあなたが流す** (指示書 3 節。`# issue: 549` を先頭 5 行に)
- こちらがすること: fixture と生成物の作成、数値の点検 (独立の計算)、ユーザーへの Decisions の確認、配線、取り込みと公開
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる。小さな判断は推奨を書いて進めてよい

## 進み具合

| 対象 | 状態 |
| --- | --- |
| tamhaneT2Test | これから (段階 1) |
| pageTest | これから (段階 1) |
| grubbsTest | これから (段階 1) |
| manova | これから (段階 1) |
| lda | これから (段階 1) |
| cancor | これから (段階 1) |

## テストの書き方 (要点)

- R と比べる。**返す値の全要素** (全行・全列・ラベル・文字列)。不一致はラベル付きで集め、最後に
  `expect(mismatches).toEqual([])`
- **許容誤差を広げて通さない。期待値を実装に合わせて書き換えない。**
- strict の型 (`exactOptionalPropertyTypes`・配列の添字は `undefined` になりうる) で通るように。`describe` の中で
  `await` しない
- 端の入力 (尺度 1e±100・ずらし 1e8、10 万件、NaN・Infinity、縮退) は指示書 5 節が合格の条件
- 配列を関数の引数に展開しない (`Math.max(...列)`)

## 初回提出時点の作業メモ (差し戻し前・2026-11-22)

> 以下は初回提出時点の記録。差し戻し対応後の確定事項は後段の「差し戻し対応・段階 1 再点検完了」を参照。

- 仕様書: `oracle/{tamhane,page,grubbs,manova,lda,cancor}-behaviour.md` を追加。全て Decisions for the user と空の rStats.js's choices を持つ。choices は変更していない
- R oracle: `oracle/{tamhane,page,grubbs,manova,lda,cancor}.R` を追加。JSON には公開関数から取り出した数値・文字列・行列だけを入れる
- 独立式チェック用 `experiments/multivariate19-stage1-check.R` を追加し、Issue #549 で実行結果を受け取る予定。2026-11-22 11:09 JST 時点で Actions は queued
- 数値確認済み: Page の L・帰無平均・分散・連続性補正 z と正規 p (page_m1_two.sided、page_size_k3_n2、page_ties)
- 追加検証が必要: T2/T2' の df・調整確率 (特に T2')、Grubbs 3 type の U/p と type 20 補間、MANOVA 4 統計量の F/df、lda の scaling の正規化・符号と CV、cancor の係数正規化・符号
- 現段階は仕様書の初稿。未確認式を明示しており、段階 1 完了とはまだ扱わない。R 実験の結果を反映し、必要な追加実験を済ませてから Issue に正式報告する

## 差し戻し対応・段階 1 再点検完了 (2026-11-22)

- `briefs/tests-multivariate-1.9-stage1-review.ja.md` の 1〜3 に対応。初回 `experiments/multivariate19-stage1-check.R` はチェッカーに止められて未実行だったことを確認。ユーザー実行の `experiments/multivariate19-stage1-check-local.json` も読み、T2/T2'・Pillai・lda svd・cancor roots の結果を取り込んだ
- 実験: `experiments/multivariate19-stage1-tamhane-page.R`, `experiments/multivariate19-stage1-grubbs.R`, `experiments/multivariate19-stage1-manova.R`, `experiments/multivariate19-stage1-lda-cancor.R`。全て `# issue: 549` 付き。チェッカー通過後、Issue #549 に投稿された各 R 実行結果を読み、必要な式の修正後に再実行した
- T2/T2': PlantGrowth・InsectSprays・chickwts 全ペアで最大絶対差 0。T2' df は各ペア (n_i+n_j-2)。Page: 42 サイズ case は L/z/p 完全一致。NA は block 内の最後の順位、連続性補正は常に −0.5
- Grubbs: type 10 pgrubbs 式は全 q 点で最大差 (3.89\times10^{-15})。x1〜x3 の 36 組は G/U 完全一致、p 最大差 (9.99\times10^{-16})。type 20 は pgrubbs と qgrubbs(rev=TRUE) が格子内外で一致。U=0..1, 0.001 格子の reverse CDF を R 出力から作成し、線形 U 補間の最大誤差 (2.061\times10^{-4})
- MANOVA: 15 case、計算可能な12 caseの全行・4検定を照合。df差 0、F最大相対差 (1.91\times10^{-11})、p最大相対差 (1.37\times10^{-9})、SSP/eigen 最大相対差 (4.56\times10^{-15})。残差 rank 不足と単一応答のエラーも照合
- LDA: iris・prior・2クラス・3クラス・単一変数・class-of-one・共線・NA・尺度を照合。full-rank scaling 最大差 (3.25\times10^{-14})、svd (4.27\times10^{-14})。予測 posterior 最大差 (9.5\times10^{-15})、CV 明示的再当てはめと class 完全一致、posterior 最大差 (7.2\times10^{-15})。共線では係数非一意だが判別得点は (1.7\times10^{-14}) 差
- cancor: 10 case の相関最大差 (2.22\times10^{-15})、全係数はペア符号反転後に最大絶対差 (1.53\times10^{-14})。係数の cross-product metric は単位行列
- oracle: `oracle/{tamhane,page,grubbs,manova,lda,cancor}.R` を実験ファイルの全 case に拡張。Grubbs oracle は R の `qgrubbs` 公開出力だけから type-20 reverse CDF の sampled grid を生成する。native knot の位置は未確定で、0.001 格子を native table と見なさない
- 仕様書6件を式・照合 case 名・一致桁・Decisions for the user 付きに更新。全ての `rStats.js's choices` は空欄のまま保持。初回チェッカー停止スクリプトは安全な案内 stub に置換
- クリーンルーム: PMCMRplus・outliers・MASS・R stats のソースやソース由来表は読まず、思い出しても写してもいない。ウェブ検索なし。実験は上記4本とユーザー提供 local JSON。実装ファイルには変更なし
