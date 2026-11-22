# 段階 1 の点検: 差し戻し (1.9.0、Issue #549)

作成 2026-11-22 (Claude)。対象は `1b670c13`。**段階 1 はまだ完了ではありません。** 下の 1〜3 を済ませてから、もう一度
報告してください。クリーンルームの規則 (入口の文書) はそのまま守る。ウェブ検索は使わない。

## 0. 何が起きていたか

- `experiments/multivariate19-stage1-check.R` は **queued ではなく、チェッカーに止められて流れていません** (Issue #549 に
  「R experiment not run」のコメントがある)。理由: 変数名 `ranks` (quantreg の関数名) と `page` (使えない名前)。
  **push の後は Issue のコメントと Actions の結果を必ず見る**
- こちらで変数名だけ変えて流しました: `experiments/multivariate19-stage1-check-local.R`/`.json`。あなたの式は
  次のとおり R と一致しています (相対 1e-15 程度):
  - T2: Welch の自由度 + Šidák `1 − (1 − p)^m` (PlantGrowth の 3 組で t・p とも)
  - **T2': 同じ t で自由度 `n_i + n_j − 2`、Šidák** (PlantGrowth と、大きさの違う chickwts の全組。`N − k`・`N − 2` は違う)
  - MANOVA: iris の Pillai = Σ λ/(1+λ) (H・E は `lm` の当てはめ値と残差から)
  - lda: `svd² = λ (N − g)/(g − 1)` (λ は W⁻¹B の固有値。iris の 2 つ)
  - cancor: 相関 = Sxx⁻¹ Sxy Syy⁻¹ Syx の固有値の平方根 (LifeCycleSavings)
- つまり材料はそろっています。**「未確認」のまま止まらず、出力を見て式を確定する**のが段階 1 の仕事です

## 1. 仕様書に足すこと (式のレベル、各式に照合した case 名と一致の桁)

- **T2:** 上の 2 つの式を確定として書く。大きさ 1 の群 (NA)、分散 0、全部同じ値 (NaN)、`t2_large_scale` で p が NaN に
  なる理由 (R の中間値の溢れか) を、出力と独立の計算で説明する。rStats.js が溢れない計算をするなら Decisions に
- **Page:** 確定でよい。ただし **「One block ... error」は誤り** (`page_one_block` は z = 1.5588 を返す)。NA の扱いも
  出力 (`page_na`) を見て書き直す
- **Grubbs (ほぼ手つかず):** type 10・11・20 の G と U の式 (U は分散の比。`grubbs_x1_*` の 12 通りで確かめる)、
  `opposite`・`two.sided` が統計量・p 値・`alternative` の文をどう変えるか、p 値の式:
  - type 10: Pearson & Sekar の近似 (t 分布による式) を `pgrubbs_type10_*` の全点で再現する
  - type 11: David, Hartley & Pearson の式と、`uniroot` が失敗する所 (`pgrubbs_type11_n10` の q = 3) の扱い
  - type 20: 表の補間の方法を `pgrubbs_type20_grid_*` から決める (線形か、どの変数で)。表の値は `qgrubbs` を表の確率で
    呼んだ R の出力から取る (ソースから写さない)。表の外 (p が 0・1 に貼りつく所) の扱い
  - 定数の x で p = 0 になるのは R の不具合と見てよいか (Decisions に)
- **MANOVA:** Wilks (Rao の F)・Hotelling-Lawley・Roy (df1 = max(p, q) の上界) の F と自由度を書き、`multivariate19.json`
  の **manova の全 case・全行** で R と比べる (`intercept`・2 因子の順・交互作用・共変量・`manova_p_gt_df`・`npk`)。SSP 行列と
  Eigenvalues も独立に計算して比べる
- **lda:** `scaling` の正規化 (群内の判別得点の分散が 1 になるか) と**符号の向きの規則**を、iris・2 クラス・3 クラス
  (`lda_three_cyl`)・`prior` の case で R と全成分を比べて決める。`predict` の `posterior`・`x` (判別得点の中心は何か) と
  `CV` (明示的に 1 件ずつ抜いた当て直しと比べる)。`prior` を与えたときに `scaling` が変わる理由
- **cancor:** `xcoef`・`ycoef` の正規化 (a′Sxx a = 1 か、n − 1 で割るか) と符号、共線の列・n が小さい case で行の数が
  どう決まるか。全成分を R と比べる

## 2. oracle (fixture の生成) を広げる

今の `oracle/*.R` は 1 本 3〜6 case で、fixture として足りません。**`experiments/tests19-small.R` と
`experiments/multivariate19.R` の case を全部入れる** (端の入力も。R がエラーになる case はエラーの文を記録する)。R の
オブジェクトは入れない (今の形でよい)。`tamhane.R` には chickwts・InsectSprays・`welch = FALSE`・`aov` を足す

## 3. 報告の前に

- 仕様書の各式の横に、照合した case 名と一致の桁を書く。照合していないものは残さない (どうしても決まらないものだけ、
  理由と試したことを書いて Decisions に)
- R の実験は push したら Issue に結果が出るまで確かめる。チェッカーに止められたら直して push し直す。**変数名に関数名を
  使わない** (`ranks`・`scores`・`outlier`・`page`・`cancor`・`manova` など)
- 報告の最後にクリーンルームの確認 (ソースを使っていない、ウェブ検索をしていない、参照した文献、流した実験の一覧)
