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

## 段階 1 の作業メモ (2026-11-22)

- 仕様書: `oracle/{tamhane,page,grubbs,manova,lda,cancor}-behaviour.md` を追加。全て Decisions for the user と空の rStats.js's choices を持つ。choices は変更していない
- R oracle: `oracle/{tamhane,page,grubbs,manova,lda,cancor}.R` を追加。JSON には公開関数から取り出した数値・文字列・行列だけを入れる
- 独立式チェック用 `experiments/multivariate19-stage1-check.R` を追加し、Issue #549 で実行結果を受け取る予定。2026-11-22 11:09 JST 時点で Actions は queued
- 数値確認済み: Page の L・帰無平均・分散・連続性補正 z と正規 p (page_m1_two.sided、page_size_k3_n2、page_ties)
- 追加検証が必要: T2/T2' の df・調整確率 (特に T2')、Grubbs 3 type の U/p と type 20 補間、MANOVA 4 統計量の F/df、lda の scaling の正規化・符号と CV、cancor の係数正規化・符号
- 現段階は仕様書の初稿。未確認式を明示しており、段階 1 完了とはまだ扱わない。R 実験の結果を反映し、必要な追加実験を済ませてから Issue に正式報告する
