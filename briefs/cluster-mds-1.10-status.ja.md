# 現状の要約: クラスタ分析と多次元尺度法 (1.10.0: dist・hclust・cutree・kmeans、cmdscale・isoMDS)、Issue #556

更新 2026-11-22。新しい会話はこの文書と指示書 (`briefs/cluster-mds-1.10.ja.md`)、**段階 2 の指示 (`briefs/cluster-mds-1.10-stage2.ja.md`)** を読んで始める。

## クリーンルームの規則 (最重要。毎回守る)

- 照合先の R 自身 (stats の `dist`・`as.dist`・`hclust`・`cutree`・`kmeans`・`cmdscale`) と MASS (`isoMDS`) は GPL。
  **ソースを読まない・思い出して書かない・写さない。** 関数の本体の表示、CRAN・GitHub のミラー、解説記事に引用された
  ソース (C・Fortran の `hclust.f`・`kmns.f` なども) も対象。記憶にあるコードの構造や変数名をなぞった実装もしない。
  Hartigan-Wong の手法は論文 (Hartigan & Wong 1979, Applied Statistics 28, AS 136) の文章から組み立て、AS 136 の
  Fortran のコードは写さない
- **ウェブ検索を使わない** (1.8.0 で検索結果にソースの抜粋が 5 回出た)。方法は知っている範囲の論文・教科書と、R の
  ヘルプ・R の実行結果で決める。論文を確かめたいときは、題名を Issue に書いて止まらずに先へ進む
- 結果の中のコードも見ない: `unclass(fit)` を表示しない、関数を呼ばずに名前だけ書かない。値は公開の関数とヘルプに
  書かれた戻り値の要素 (`$merge`・`$height`・`$order`・`$cluster`・`$points` など) で取る
- 使ってよいもの: 論文と教科書 (Lance & Williams 1967 (Computer J. 9)、Murtagh & Legendre 2014 (J. Classification 31、
  ward.D と ward.D2)、Hartigan & Wong 1979、Lloyd 1982 (IEEE Trans. Inf. Theory 28)、Forgy 1965、MacQueen 1967、
  Torgerson 1952・Gower 1966 (古典的 MDS)、Cailliez 1983 (Psychometrika 48)、Kruskal 1964 (Psychometrika 29 の 2 本)、
  Venables & Ripley "Modern Applied Statistics with S" (文章)、Mardia, Kent & Bibby "Multivariate Analysis"、Cox & Cox
  "Multidimensional Scaling"、Gordon "Classification" など)、R とパッケージのヘルプ (文書。例の節も)、R の実行結果、
  rStats.js の既存の関数を呼ぶこと
- **仕様書の「rStats.js's choices」の節は変えない。** ユーザーの決定と根拠の記録で、こちらだけが書く。choices は仕様書の
  ほかの節よりいつも優先する。食い違いに気づいたら、ほかの節を choices に合わせて直す。choices を直すべきだと思ったら、
  Issue に提案を書いて止まる
- 報告の最後に、クリーンルームの確認 (ソースを使っていないこと、参照した文献、流した実験の一覧) を書く

## 進め方

- **作業ブランチ `work/cluster-mds-1.10` にだけ push する。main には push しない。`HANDOFF.md` は触らない** (1.9.0 で
  main と衝突し、PR の CI が動かなかった)
- **CI は自分で読む。** draft の PR #557 (`work/cluster-mds-1.10` → main、マージしない) で、push のたびに型チェックと
  全テストが流れる。push したら PR の Checks を見て、型エラーとテストの失敗は自分で直してから報告する。Checks が見えない
  ときは、Issue に「CI の確認の依頼」と書いて次の作業へ進む。CI は今、全部通る状態 (基準のコミット)
- **「手元の環境がない」で止まらない。** GitHub への直接の push、Actions の R (指示書 3 節)、PR の CI を使う
- **push のたびに、そのファイルを GitHub 上で開き直して中身を確かめる** (1.7.0 で改行が文字どおりの `\n` になった)
- 新しい関数やオプションを足すと、`test/unknownOptions.test.ts` (生成のブロック) と `test/rIndexDoc.test.ts` の 2 件
  (`docs/r-functions.md` の英・日) が落ちる。こちらがスクリプトで作り直すので、その 3 件だけは直さなくてよい。**手で
  `import { checkOptions }` や `*_KEYS` の定数を書かない**
- `/multivariate` の配線は済んでいる。新しい関数は `src/entries/multivariate.ts` に export を足し、テストはそこから import
- **会話はよく途中で切れる。** 区切りごとに push し、Issue に数行の途中経過 (何をしたか、次に何をするか、コミット) を
  書く。会話が切れても、こちらがブランチ・CI・Issue を見て再開の依頼文を書く
- **R の実験はあなたが流す** (指示書 3 節。`# issue: 556` を先頭 5 行に)
- こちらがすること: fixture と生成物の作成、数値の点検 (独立の計算)、ユーザーへの Decisions の確認、取り込みと公開
- 判断に迷ったら、推測で進めず Issue に質問を書いて止まる。小さな判断は推奨を書いて進めてよい

## 進み具合

| 対象 | 状態 |
| --- | --- |
| dist・asDist | 段階 2 (仕様・choices・fixture は済み) |
| hclust・cutree | 段階 2 (仕様・choices・fixture は済み) |
| kmeans | 段階 2 (仕様・choices・fixture は済み) |
| cmdscale | 段階 2 (仕様・choices・fixture は済み) |
| isoMDS | 段階 2 (仕様・choices・fixture は済み) |

## テストの書き方 (要点)

- R と比べる。**返す値の全要素** (全行・全列・ラベル・文字列・警告の文)。不一致はラベル付きで集め、最後に
  `expect(mismatches).toEqual([])`
- **許容誤差を広げて通さない。期待値を実装に合わせて書き換えない。** 許容は根拠のある最小に
- **戻り値はいつも配列** (長さ 1 でも)。cmdscale・isoMDS の配置は列の符号を R にそろえてから比べる
- strict の型 (`exactOptionalPropertyTypes`・配列の添字は `undefined` になりうる) で通るように。`describe` の中で
  `await` しない
- 端の入力 (尺度 1e±100・ずらし 1e8、大きな入力、NaN・Infinity、縮退) は指示書 5 節が合格の条件
- 配列を関数の引数に展開しない (`Math.max(...列)`)
