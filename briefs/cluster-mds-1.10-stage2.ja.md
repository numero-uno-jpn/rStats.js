# 段階 2 の指示: 実装 (1.10.0、Issue #556)

作成 2026-11-22 (Claude)。段階 1 は完了です。**Decisions はユーザーが決めました** (2026-11-22)。各仕様書の末尾の
「rStats.js's choices」に書いてあります。choices はほかの節よりいつも優先します。クリーンルームの規則 (入口の文書) と
指示書の 4・5 節はそのまま守る。ウェブ検索は使わない。

## 0. こちらでしたこと

- **点検:** hclust の同点の規則を、こちらで独立に組んだ計算で `experiments/cluster110.json` の hclust の **82 ケース全部**
  (同点の 40 と USArrests・small・triangle・members) と比べ、merge・order は全部同じ、高さは相対 4.7e-15 以内でした。
  一見外れた `hclust_triangle_complete` は、R の d(1,3) が 1.9999999999999998 (`sqrt(1 + sqrt(3)^2)`) で同点では
  なかったためです。**dist は R と同じ素朴な式で計算する** (`Math.hypot` を使わない。dist の choices 1)
- **直し:** binary で両方とも全部 0 の行の対は、R では **0** です (仕様書の「1」は誤り。根拠にした `dist_binary_zero_rows`
  にその対は無い)。`dist_binary_both_zero` を足しました。dist の仕様書の binary の段落を choices 2 に合わせて直してください
- **oracle:** あなたの probe のケース (初期値の引き直し・nstart の同点・iter.max 1〜5・等距離の点・非対称の行列) を
  `oracle/_cluster110cases.R` に移しました (`kmeans_dup_start_seed_*`・`kmeans_equal_best_seed_*`・
  `kmeans_equal_best_dup_seed_*`・`kmeans_iter_*`・`kmeans_midpoint_*`・`cmdscale_asym_*`)。`oracle/kmeans.R` は
  x86_64 の R で流す印 (`# oracle-platform: amd64`) を足しました
- **fixture:** `test/fixtures/{dist,hclust,kmeans,cmdscale,isomds}.json` (54・120・114・37・29 case)。既にあった case は
  こちらの実験の JSON と全件同じ。kmeans は x86_64 の R
- choices の要点 (詳しくは各仕様書):
  - dist: ふだんは R と同じ式でビット単位に一致させ、溢れ・潰れが起きた対だけ尺度を直して計算し直す。`diag`・`upper` も返す
  - hclust: 段階 1 の規則のまま。行列をそのまま渡すと分かりやすいエラー (`asDist` を使うよう案内)
  - **kmeans の Hartigan-Wong は論文の文章から組み、全 case で R と一致させるのが合格の条件** (cluster・centers・
    withinss・size。iter・ifault も。合わないものは case 名を添えて報告し、決める前に聞く)。乱数の後の状態も R と同じ
    (fixture の `tail`)
  - cmdscale: いつも全部を返す、列の符号は決まった規則、**Cailliez の定数は 0 に丸めずに同じ量を計算**、非対称は R どおり
  - **isoMDS: Kruskal (1964b) の数値の方法で組み、R の 5 回ごとの stress (`printed`) と最終の座標を合わせるのが目標。**
    届かなければ、根拠を報告してから「R を厳しく収束させた解との一致」に切り替える。途中経過は数値で返す (`trace`)
  - 警告は結果の `warnings: string[]` (manova・lda の前例)。戻り値はいつも配列

## 1. 実装の順と置き場所

dist・asDist → hclust・cutree → kmeans → cmdscale → isoMDS。置き場所は `src/multivariate/` (ファイルは
`dist.ts`・`hclust.ts`・`kmeans.ts`・`cmdscale.ts`・`isoMDS.ts` を推奨)、export は `src/entries/multivariate.ts`。
1 つが CI 緑になったら Issue に短い報告 (コミット、R と比べた case の数と最大の誤差、指示書 5 節の大きな入力の時間) を
書き、**止まらずに次へ進む**。全部済んだら段階 2 の報告をして止まる。

## 2. テスト

- `test/<名前>.test.ts`。fixture の**全 case・返す値の全要素**を R と比べる。不一致はラベル付きで集め、最後に
  `expect(mismatches).toEqual([])`。テストは**入口 (`src/entries/multivariate.ts`) から import** する
- 許容: dist・hclust の高さ・cutree・kmeans の cluster と size は**完全一致** (dist はビット単位、choices 1)、そのほかは
  相対 1e-12 前後を目安に、根拠のある最小に。広げて通さない、期待値を書き換えない
- cmdscale・isoMDS の座標は列の符号を R にそろえてから比べる。kmeans の乱数の case は `setSeed` してから呼び、後の
  `runif` を `tail` と比べる
- R のエラーの case は、エラーになること (文は rStats.js のもの) を確かめる。警告は文と数を比べる
- 指示書 5 節の端の入力 (尺度・ずらし・大きさ・NaN と Infinity・縮退) もこの段階で入れる
- `test/demo.test.ts` の `NOT_IN_DEMO_YET` に新しい関数を足す。`test/unknownOptions.test.ts` の生成のブロックと
  `test/rIndexDoc.test.ts` の 2 件は、こちらがスクリプトで作り直すので落ちたままでよい

## 3. 報告

1 つずつの短い報告と、最後の段階 2 の報告 (関数ごとの case 数・最大の誤差・大きな入力の時間、kmeans の iter・ifault と
isoMDS の最適化で R と合わなかったものの一覧) を Issue #556 に。最後にクリーンルームの確認 (ソースを使っていないこと、
参照した文献、流した実験の一覧)。
