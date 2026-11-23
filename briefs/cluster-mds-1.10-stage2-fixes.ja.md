# 段階 2 の直し (1.10.0、Issue #556): kmeans・cmdscale・isoMDS

作成 2026-11-23 (Claude)。基準のコミット `74735082`。dist・asDist・hclust・cutree は R と一致し、テストも通っています
(触らない)。この文書の 1〜3 を、**1 回の作業で全部**直してください。規則は入口 `briefs/cluster-mds-1.10-status.ja.md`
(先頭の「書き込んでよい場所」とクリーンルーム) のとおりです。

## 0. こちらでしたこと (`74735082`)

- isoMDS を厳しく収束させた R の fixture `isomds_tight_*` (10 case、`tol = 1e-10`・`maxit = 5000`、全部 `converged`) を
  `test/fixtures/isomds.json` に足した。あなたの実験 `mds110-isomds-tight.R` はチェッカーに止められていた (`args`・
  `trace` は変数名・引数名に使えない。今後の実験でも避ける)
- option keys と R 関数の一覧を作り直した。生成スクリプトがデータの型を options と取り違えないよう、入力の表の型を
  `CmdscaleInputTable`・`KmeansInputTable` に改めた (データの型の名前は `...Table`・`...Result`・`...Fit` で終える)。
  doc comment の 1 文目に説明を足し、R の名前の文を決まった形 (「Equivalent to R's `kmeans()`.」・「Equivalent to
  `MASS::isoMDS()` in R.」) にした
- 今のテストの結果 (手元): kmeans は 37 case で不一致、cmdscale は 7 case、isoMDS は 77 件

## 1. kmeans (合格: 全 case で全要素が一致)

乱数を使う case (`kmeans_seed_*`・`kmeans_dup_start_*`・`kmeans_equal_best_*`) は全部通っています。外れているのは次です。

- **MacQueen** (11 case、不一致の大半): `kmeans_iris_MacQueen`・`kmeans_usarrests_MacQueen`・`kmeans_iris_poor_start_MacQueen`・
  `kmeans_iris_iter1_MacQueen`・`kmeans_iter_MacQueen_1`〜`_5`・`kmeans_empty_MacQueen`・`kmeans_k1_MacQueen`。
  1 回の更新と、パスの終わりに中心を平均で置き直すか、収束の判定、`iter` の数え方を `kmeans_iter_MacQueen_1`〜`_5`
  (iter.max ごとの結果) から決め直す
- **Hartigan-Wong** (6 case): `kmeans_iris_Hartigan-Wong`・`kmeans_usarrests_Hartigan-Wong` (iter が 1 多い)、
  `kmeans_iris_poor_start_Hartigan-Wong`、`kmeans_iris_iter1_Hartigan-Wong`・`kmeans_iter_Hartigan-Wong_1` (iter.max = 1 で
  結果が違う)、`kmeans_k1_Hartigan-Wong`。論文の optimal-transfer と quick-transfer の段の順と、何を 1 回と数えるかを
  `kmeans_iter_Hartigan-Wong_1`〜`_5` から決める
- **Lloyd・Forgy** (5 case ずつ): 収束しなかったときの `ifault` (R は 2、今は null) と警告 (`kmeans_iris_poor_start_*`・
  `kmeans_iris_iter1_*`・`kmeans_iter_*_1`)、空のクラスタ (`kmeans_empty_*`)、k = 1 の形 (`kmeans_k1_*`: centers の行名、
  withinss・size は長さ 1 の配列、betweenss は R の値 6.8e-13 そのもの。0 に丸めない)
- そのほか: `kmeans_data_frame`・`kmeans_partial_name`・`kmeans_scale`
- 合わないまま残るものがあれば、case 名と R の値・こちらの値を Issue に書いて止まる (choices 1。決める前に聞く)

## 2. cmdscale (7 case)

- **Cailliez の定数** (`cmdscale_eurodist_add`・`_add_k1`・`cmdscale_usarrests_add`): ユーザーの決定は「R と同じ量を計算する」
  です。二分法をやめ、Cailliez (1983) の 2n × 2n 行列 `[[0, 2B₀], [−I, −4B₁]]` の**最大の実固有値**を、既存の
  `src/linalg/eigen.ts` (非対称にも対応) で求める (B₀・B₁ は D² と D の二重中心化に −1/2 を掛けたもの。式は仕様書のとおり、
  記号は Cailliez の論文に合わせる)。今は座標が 1e-9 しか合っていない
- **固有値の重なりと 0 に近い固有値** (`cmdscale_simplex`: 固有値 0.5 が 3 重、`cmdscale_small_k4`・`cmdscale_k_n_minus_1`:
  4 番目の固有値が 4.5e-16): 固有ベクトルが一意に決まらない (R の列は LAPACK の内部で決まる)。テストは、そうした列の
  まとまり (固有値の相対差が 1e-10 以下、または |λ| ≤ n·ε·max|λ|) について、座標そのものでなく `points · pointsᵀ`
  (その列だけの寄与) を R と比べる。ほかの列は今のまま列ごとに比べる。**この比べ方の理由をテストのコメントに書く**
- `cmdscale_non_euclidean_k3`: 警告の文と数を R (`only 2 of the first 3 eigenvalues are > 0`、1 回) に合わせる

## 3. isoMDS (choices 2 の切り替え: ユーザーの決定のとおり)

あなたの報告 (Kruskal の方法では R の printed に届かない) を受けて、合格の条件を「厳しく収束させた R」に切り替えます。
仕様書 `oracle/isomds-behaviour.md` の choices 2 にこちらが追記しました。

- **合格の条件:** `isomds_tight_*` の 10 case で、rStats.js を `tol: 1e-10`・`maxit: 5000` で呼んだ結果が R と一致すること。
  stress は相対 1e-6、座標は p = 2 なら回転と反転 (直交 Procrustes) で R にそろえてから、ほかの p は列の反転と入れ替えで
  そろえてから、R の座標の最大の絶対値に対して 1e-5 以内。どれも根拠 (収束の判定の大きさ) をテストのコメントに書く
- **今の実装は収束が弱い:** `isomds_small` (完全に埋め込めるデータ) で R の stress は 3.5e-14 なのに、こちらは 1.8e-4。
  `tol` を小さくすれば stress が 0 に近づくように、更新と止め方を直す (Kruskal 1964b の歩幅の調整、または勾配の大きさでの
  判定)。止め方は尺度によらないこと (指示書 5 節、choices 5)
- **既定の設定の case** (`isomds_swiss` など `printed` のある case): 座標は比べない (既知の違いとして文書に書く)。比べるのは
  エラー・警告と、rStats.js の既定の stress が R の既定の stress の 1.01 倍以下であること (悪い解で止まらないこと)
- `trace` は数値で返すまま。R の `printed` と一致することは求めない

## 4. 報告

1〜3 が済み CI が緑になったら (生成物の 2 件 `unknownOptions`・`rIndexDoc` は落ちていてよい)、Issue #556 に段階 2 の
報告を書いて止まる: 関数ごとの case 数と最大の誤差、合わなかったものの一覧、大きな入力の時間 (指示書 5 節)、
クリーンルームの確認。途中で止まらない (Checks が出ないときだけ Issue に書いて止まる)。
