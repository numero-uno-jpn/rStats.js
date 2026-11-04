# Audit ledger 2

このファイルを Audit #969 以降の監査台帳として使用する。
従来の docs/audit-ledger.md は変更せず、以後の監査記録は本ファイル末尾へ追記する。
各監査の詳細な再現手順・根拠は docs/review-logs/ の個別記録を参照。

---

## Audit #968 — Richardson 微分で負の eps を拒否する不整合

- 対象: src/numerics/deriv.ts
- 監査時 HEAD: 86bcea46d1c5923071fac9eae7a7f5f2f6d8ef07
- 対象ソース blob: df9a324746a0f194c3fb60461b14535bf16b58b2
- 判定: 再現条件をソース上で確認した不具合
- Issue: [#499](https://github.com/numero-uno-jpn/rStats.js/issues/499)
- 詳細: [review_audit_968_deriv_negative_eps.md](review-logs/review_audit_968_deriv_negative_eps.md)

### 要約

checkEps() は有限かつ非ゼロの負の eps を受理し、ステップ生成部のコメントも負のステップを反対方向に取る仕様を示している。しかし steps() が後段で h > 0 を要求するため、座標がゼロ付近にある場合に負の eps が拒否される。

```ts
grad((x) => x[0]! * x[0]!, [0], { eps: -1e-4 });
jacobian((x) => [x[0]! * x[0]!], [0], { eps: -1e-4 });
hessian((x) => x[0]! * x[0]!, [0], { eps: -1e-4 });
```

上記はいずれも現状では正の有限ステップを要求する RangeError になる。中心差分では分子・分母がともに符号反転するため負のステップでも計算可能であり、期待値は順に [0]、[[0]]、[[2]]。

### 検証範囲・制約

- src/numerics/deriv.ts、test/numerics.test.ts、oracle/numerics.R を確認。
- 既存 Issue を検索し、負の eps に関する同一原因の Issue がないことを確認。
- ソースの制御フローと差分式に基づく確認。Vitest、実行時再現、R/numDeriv の実行は未実施。
- ソースコード変更なし。

### 記録コミット

5d8d5a3c3d7832416484bcfbb138f1f236ba1a8d（個別監査ログの追加）

---

## Audit #969 — pivotLonger のゼロ幅区切りがサロゲートペアを分断する

- 対象: src/descriptive/pivot.ts
- 監査時 HEAD: c82481b17ee7095af372d00dca3fb766e748bf6e
- 対象ソース blob: 350ef5eef8e463ef35deba603d19cf89ed511cb1
- 判定: UTF-16 境界条件に起因する不具合
- Issue: [#500](https://github.com/numero-uno-jpn/rStats.js/issues/500)
- 詳細: [review_audit_969_pivotLonger_unicode_zero_width.md](review-logs/review_audit_969_pivotLonger_unicode_zero_width.md)

### 要約

pivotLonger() の separated() はゼロ幅正規表現に一致した後、start = m.index + 1 で検索位置を進める。JavaScript の正規表現インデックスと String.slice() は UTF-16 コード単位であるため、絵文字など BMP 外文字のサロゲートペアの途中に検索位置が移動し、1文字を2つの断片に分割し得る。R/PCRE の文字単位の処理では当該文字を保持する必要がある。

```ts
pivotLonger(
  { "A😀B": [1] },
  { cols: ["A😀B"], namesTo: ["p1", "p2", "p3", "p4", "p5"], namesSep: "(?=.)" },
);
```

期待される名前パーツは ["", "A", "😀", "B", null]。現行 JS 実装では絵文字の上位・下位サロゲートが別々のパーツとなり、後続のパーツ位置がずれる。

### 検証範囲・制約

- src/descriptive/pivot.ts と test/pivot.test.ts を確認。
- ゼロ幅一致後の UTF-16 コード単位による進行と slice の挙動をソースから確認。
- ソースレベルの解析のみ。Vitest、R/tidyr の実行は未実施。
- ソースコード変更なし。

### 記録コミット

09802991e274a70130f316172380be98deb8d171（個別監査ログの追加）

---

## Audit #970 — merge の allY 専用行でキー列の共通型が失われる

- 対象: src/descriptive/dataFrames.ts
- 監査時 HEAD: 35cfc32dab1fa9bf1e6ddc9e7b067c0eb26e83e4
- 対象ソース blob: 55fe65c67d8a8a71077af562a24ad7d41f2bc3d5
- 参照仕様: oracle/dataframes-behaviour.md（merge step 1）
- 判定: allY かつ x 側に結果行がない場合のキー型不整合
- Issue: [#501](https://github.com/numero-uno-jpn/rStats.js/issues/501)
- 詳細: [review_audit_970_merge_allY_key_type.md](review-logs/review_audit_970_merge_allY_key_type.md)

### 要約

merge() で yOnly が true かつ fromX が false の場合、キー列は y 側の列 cy だけから gather される。その後 commonType() もその出力値だけを調べるため、x 側のキー列が文字列で y 側が数値でも、結果のキー列が数値のまま残る。仕様資料では all.y による y-only 行のキー列は x・y 両方のキー列の共通型とする。

```ts
merge(
  { id: ["unmatched-x"] },
  { id: [1], value: ["from-y"] },
  { by: "id", allY: true },
);
```

期待されるキー列は id: ["1"]（文字列）。現行ソース経路では id: [1]（数値）になる。

### 検証範囲・制約

- src/descriptive/dataFrames.ts、test/dataFrames.test.ts、oracle/dataframes-behaviour.md を確認。
- yOnly && !fromX の分岐と commonType() の処理をソースから追跡。
- 既存 Issue を検索。該当する同一原因の Issue は見つからなかった。
- ソースレベルの解析のみ。Vitest、R 実行は未実施。
- ソースコード変更なし。

### 記録コミット

c888d42a3f70f9a31ec019a27682248340c0075d（個別監査ログの追加）


---

## Audit #981 — wilcoxTest の mu 差し引き・加算による信頼区間データの精度喪失

- 対象: src/htest/wilcoxTest.ts
- 監査時 HEAD: 6a89d88316fc0b53d85a08a662cddb0bb973866a
- 判定: signed-rank の信頼区間・Hodges–Lehmann 推定値における決定的な浮動小数点精度喪失
- Issue: [#502](https://github.com/numero-uno-jpn/rStats.js/issues/502)
- 詳細: [review_audit_981_wilcox_mu_roundtrip_precision.md](review-logs/review_audit_981_wilcox_mu_roundtrip_precision.md)

### 要約

signedRank() は検定統計量のために入力値 x0 から mu を減算する。信頼区間を計算する段階では元データを復元するために x.map(v => v + mu) を実行するが、binary64 の浮動小数点演算では (x - mu) + mu が元の x と一致する保証はない。その結果、Walsh averages と Hodges–Lehmann 推定値が入力値と異なるデータに基づいて計算される。

```ts
const x = [8841848152503256, 8841848152503264];
const mu = -5054035322351469;
wilcoxTest(x, { mu, confInt: true, exact: true });
```

このデータでは復元値が [8841848152503255, 8841848152503263] となり、両観測値が 1 ずつ小さくなる。期待される exact 区間は [8841848152503256, 8841848152503264]、Hodges–Lehmann 推定値は 8841848152503260。

### 検証範囲・制約

- signedRank() の差し引き、ゼロ除外、CI用データ再構築、Walsh averages の制御フローを確認。
- 既存 Issue を検索し、同一原因の報告がないことを確認して Issue #502 を登録。
- 再現用のbinary64値を演算経路から確認。Vitest・Rの実行は未実施。
- ソースコード変更なし。

### 記録コミット

aa3cc3ae1b151c49421c94eff9f5dbf405f8b07b（個別監査ログの追加）

---

## Audit #982 — Mauchly's test: contrast-space, rank and degenerate covariance recheck

- 対象: `src/models/mauchly.ts`
- 監査時 HEAD: `29415c4e5e4584a65068b1838f0968df91e795f6`
- 対象ソース blob: `eeca9936cefa62a52e8a60a83ba042127c9ccd70`
- 判定: 今回確認した範囲で新規不具合なし
- 関連既存 Issue: [#342](https://github.com/numero-uno-jpn/rStats.js/issues/342)（1次元 contrast space。現行ソースでは `pp === 1` を拒否）
- 詳細: [review_audit_982_mauchly_recheck.md](review-logs/review_audit_982_mauchly_recheck.md)

### 要約

欠損行除外後の群平均・残差自由度、double-doubleによる残差交差積、M/X のQR rank・部分空間包含判定、contrast spaceの次元、Mauchly's W と補正p値を再確認した。既存 #342 の修正が現行ソースに反映されていることを確認。旧 #59 はQR pivot順の誤認による誤検出として扱い、再オープンしない。新規Issueは作成しなかった。

### 検証範囲・制約

- `src/models/mauchly.ts` の入力検証、欠損除外、group residual、contrastCrossprod、sphericityW、mauchlyPValue をソース上で追跡。
- #342 と #59 の既存記録を照合。
- ソースレベルの静的監査のみ。Vitest、Node、R の実行は未実施。
- ソースコード変更なし。

---

## Audit #983 — aovEz が後で除外する不完全被験者の値で応答スケールを決める

- 対象: `src/models/aovEz.ts`
- 監査時 HEAD: `41138101928a6b68ec026fcb8c3906fdf8f6974e`
- 対象ソース blob: `14f22254dde32c0295d86e4bb0cd4ec24e238d6f`
- 判定: 不完全被験者の極端値が完全データの交差積をアンダーフローさせる不具合
- Issue: [#508](https://github.com/numero-uno-jpn/rStats.js/issues/508)
- 詳細: [review_audit_983_aovez_incomplete_subject_scale.md](review-logs/review_audit_983_aovez_incomplete_subject_scale.md)

### 要約

`aovEz()` は `dvUsed` 全体に対して `scaleToUnit()` を実行してから、欠損response/cellを持つ被験者を step 6 で除外する。このため、後で解析から除外される被験者の有限極端値（例: `1e308`）がスケール指数を決め、残る完全被験者の通常値（1〜5）が約 `1e-308` に縮小される。その二乗・交差積がbinary64でアンダーフローし、error SSPを含む反復測定ANOVAの情報が失われる。既存 #350 はzero-weight行のスケール汚染であり、この被験者単位のcomplete-case除外経路とは別原因。新規Issue #508を登録。

### 再現データ

```ts
const data = {
  id: ["s1", "s1", "s2", "s2", "s3", "s3", "incomplete", "incomplete"],
  W: ["a", "b", "a", "b", "a", "b", "a", "b"],
  y: [1, 2, 2, 4, 3, 5, 1e308, null],
};
aovEz(data, { id: "id", dv: "y", within: "W" });
```

### 検証範囲・制約

- `src/models/aovEz.ts`、`test/aovEz.test.ts`、`src/internal/summary.ts` の `scaleToUnit()` / `unitExponent()` を確認。
- `aovEz`、missing response、incomplete subject、response scale、#350 を検索し重複を確認。
- 決定的な入力とIEEE-754の指数範囲に基づく静的解析。Vitest、Node、Rの実行は未実施。
- ソースコード変更なし。


---

## Audit #984 — weighted model comparison の nested 判定が zero-weight 行を含む可能性（要実行確認）

- 対象: `src/models/anovaSequential.ts` / `src/models/estimable.ts`
- 監査時 HEAD: `97335b0b081369e24860725beb82777b4620de11`
- 対象ソース blob: `a449e425fc88c7e51959c5d126c1ae3b433a5bf8` / `e917c393281dd0781e4d5bad24fff78bde0269f5`
- 判定: 要確認。Issue未作成（公開API実行ができていないため）

### 要約

`comparisonTable()` は残差自由度を正weight行のみで計算する一方、nestedness判定に全行の `fit.x` を `nestedColumns()` へ渡す。
zero-weight 行でのみ異なる列があると、正weight行上では nested なモデル比較を非nestedと誤判定し、F値・p値をNaNにする可能性がある。公開APIでの再現実行後にIssue化を判断する。

### 再開時の再現候補

`y=[0,1,1,4,999]`, `x=[0,1,2,3,4]`, `z=[0,1,2,3,100]`, `w=[0,0,1,1,0]`, `weights=[1,1,1,1,0]`。比較式は `y ~ x` と `y ~ z + w`。

### 検証制約

- `responseScale()` の #350 対応と `addedSS()` の正weight行フィルタを確認。
- `nestedColumns()` が全行を使うこと、および正weight行上の列空間包含と全行上の非包含を線形代数的に確認。
- GitHubへの直接cloneはDNS失敗。パッケージの公開API実行・Vitest未実施。重複Issue検索では同一原因を確認できず。


---

## Audit #985 — aov(Error()) の treatment/error 行対応を再確認

- 対象: `src/models/aovStrata.ts`
- 監査時 HEAD: `f0e0d0c3e92b32ebabae32000174d881087d0904`
- 対象ソース blob: `2a7a37613d82b4aa15ae260b7baa791704faad5c`
- 判定: 既存Issue #353 と同一原因。新規Issueなし
- 既存Issue: [#353](https://github.com/numero-uno-jpn/rStats.js/issues/353)（closed / not_planned）
- 詳細: [review_audit_985_aovstrata_rows_existing_issue.md](review-logs/review_audit_985_aovstrata_rows_existing_issue.md)

### 要約

`aovStrataFit()` は treatment design `dt` と Error design `de` を別々に構築する。Error() 変数だけに欠損がある場合、`dt.frame.rows` と `de.frame.rows` が異なり、処置応答と誤差モデルの行対応が崩れる。これは既存Issue #353 と同一原因であり、重複登録はしない。Issueが closed / not_planned である一方、現行ソースには同じ制御フローが残ることを記録。

### 検証範囲・制約

- `src/models/aovStrata.ts`、`src/models/modelMatrix.ts`、`src/models/modelFrame.ts` の行選択を確認。
- Issue #353 の再現データと原因記述を現行ソースに照合。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #986 — cov/cor の欠損・定数列対角成分を再確認

- 対象: `src/descriptive/cov.ts`
- 監査時 HEAD: `a424c121644dc2dba660f63c8a271a0654e078c1`
- 対象ソース blob: `574aaddc25d99f13ffac22f261962984d803c8df`
- 判定: 今回確認した範囲で新規不具合なし
- 関連既存Issue: #16（closed / not_planned）、#78（closed / completed）
- 詳細: [review_audit_986_cov_cor_diagonal_recheck.md](review-logs/review_audit_986_cov_cor_diagonal_recheck.md)

### 要約

matrix-only の `cor()` の対角成分上書きを確認。現行コードは計算結果がNaNでない場合だけ1に置き換えるため、定数列や `use="everything"` の欠損列の未定義な自己相関は保持される。Issue #78 の無条件上書きは現行ソースで修正済み。pairwise complete のSpearman順位再計算も確認。

### 検証範囲・制約

- `src/descriptive/cov.ts`、`src/descriptive/rank.ts`、`src/htest/cor.ts` を確認。
- Issue #16 / #78 と現行コードを照合。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #987 — moment/shape summaries の境界条件を再確認

- 対象: `src/descriptive/moments.ts`
- 監査時 HEAD: `a424c121644dc2dba660f63c8a271a0654e078c1`
- 対象ソース blob: `740c02eaceadd6f1454ecd7564bcd6f09f563b5b`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_987_moments_edge_recheck.md](review-logs/review_audit_987_moments_edge_recheck.md)

### 要約

skewness/kurtosis の空標本・単一標本・定数列・type 2最小標本数・type 3補正、geometricMean の負値/ゼロ、modes の空/全値一意、meanAD の中心指定、cv の小標本補正、scale の各center/scale組合せを確認。Rの `scale.default` のRMS分母 `max(1,n-1)` も公式定義と照合し、単一観測の処理は現行コードと整合。

### 検証範囲・制約

- `src/descriptive/moments.ts`、`src/descriptive/basic.ts`、`test/descriptive.test.ts`、`test/fixtures/scale.json` を確認。
- Rのscale定義を公式ドキュメント・実装と照合。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #988 — hist / pretty / ecdf の境界条件を再確認

- 対象: `src/descriptive/hist.ts`
- 監査時 HEAD: `220e2952e33f07846c6dbe9f6f10905940e73e14`
- 対象ソース blob: `b60c1aaceb351286a99ab8ef005a0019acd0e842`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_988_hist_pretty_ecdf_edges.md](review-logs/review_audit_988_hist_pretty_ecdf_edges.md)

### 要約

pretty の有限値抽出・同値範囲・ゼロ近傍・極端な尺度・n/minN検証・breaks拡張、hist の明示/自動breaks・right/includeLowest・fuzz・範囲外値・density overflow、ecdf の空標本・NaN/±Infinity・二分探索境界を確認。今回の範囲で新規不具合は確認できなかった。

### 検証範囲・制約

- `src/descriptive/hist.ts`、`test/descriptive.test.ts` を確認。
- 関連Issue検索で同一原因の報告は確認できなかった。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #989 — omega の入力・Schmid-Leiman 境界条件を再確認

- 対象: `src/descriptive/omega.ts`
- 監査時 HEAD: `fd0e1a57ac39e2edbb0e6ae26c4a698bd50954ff`
- 対象ソース blob: `e07f01ef3d54e489882ecd88dda6bc21bf2f3500`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_989_omega_edge_review.md](review-logs/review_audit_989_omega_edge_review.md)

### 要約

nfactors範囲、covmat検証、pairwise correlation、SMC擬似逆、minres、q=1/2/3+の一般因子、Schmid-Leimanのh2/u2/p2/com、flip、空グループを確認。q=1の厳密なゼロとRの丸め差異はテスト上も明示され、今回の範囲で新規不具合は確認できなかった。

### 検証範囲・制約

- `src/descriptive/omega.ts`、`test/omega.test.ts`、`oracle/omega-behaviour.md`、`src/internal/covmat.ts` を確認。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。

---

## Audit #990 — coxph の欠損・層別・重み・Newton反復境界を再確認

- 対象: `src/models/coxph.ts`
- 監査時 HEAD: `fd0e1a57ac39e2edbb0e6ae26c4a698bd50954ff`
- 対象ソース blob: `93829de198c811cb03b2f2ce8921d65ff273a2a2`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_990_coxph_edge_review.md](review-logs/review_audit_990_coxph_edge_review.md)

### 要約

入力検証、欠損除外、weights、Infinity時刻、層別境界、同時刻のイベント/打切り、Efron/Breslow、共変量の中心化/尺度化、ゼロイベント、Newton step halving、非収束時variance、aliased係数、summary検定を確認。重み付きEfron処理とstratum境界のrisk set管理はoracle記述と一致した。

### 検証範囲・制約

- `src/models/coxph.ts`、`test/coxph.test.ts`、`oracle/coxph-behaviour.md` を確認。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #991 — glmAnova の逐次比較・nestedness 判定を再確認

- 対象: `src/models/glmAnova.ts`
- 監査時 HEAD: `d322bc6660c78ec07f49a645dc615f7da5101906`
- 対象ソース blob: `3d681de41770cd9a354e568927eded47dc2b05c7`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_991_glmanova_nestedness_recheck.md](review-logs/review_audit_991_glmanova_nestedness_recheck.md)

### 要約

逐次/比較表、rank差、Rao、Chisq/LRT/F/Cp、dispersion、family/link、offsetを含むnestednessを確認。比較時のnestedness判定は両モデルのpositive-weight行だけを使い、Audit #984のzero-weight行候補と異なり除外漏れは見られなかった。

### 検証範囲・制約

- `src/models/glmAnova.ts`、`src/models/glm.ts`、`src/models/estimable.ts`、`test/glmAnova.test.ts` を確認。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。

---

## Audit #992 — glmConfint の profile bracket・Rao/LRT 境界を再確認

- 対象: `src/models/glmConfint.ts`
- 監査時 HEAD: `d322bc6660c78ec07f49a645dc615f7da5101906`
- 対象ソース blob: `9c0759d5a3124bef063030c5be76ae47c4cd869c`
- 判定: 今回確認した範囲で新規不具合なし
- 関連既存Issue: #179（tiny confidence levelでの区間崩壊。現行コードに専用処理あり）
- 詳細: [review_audit_992_glmconfint_profile_recheck.md](review-logs/review_audit_992_glmconfint_profile_recheck.md)

### 要約

aliased係数、full/restricted fit収束、offset移動、LRT/Rao、未収束時NaN、bracket doubling、Brent法、極小levelの近似・補間を確認。既存 #179 の対策が現行ソースに反映されている。

### 検証範囲・制約

- `src/models/glmConfint.ts`、`src/models/glm.ts`、`src/internal/uniroot.ts`、`test/glmConfint.test.ts` を確認。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #993 — factanal のML推定・回転・factor scoresを再確認

- 対象: `src/descriptive/factanal.ts`
- 監査時 HEAD: `61ec53024a32b811d2f8566374fce25313fcc44b`
- 対象ソース blob: `78015f198496bfd2c28321c541ff970a5cea7b96`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_993_factanal_edge_review.md](review-logs/review_audit_993_factanal_edge_review.md)

### 要約

covmat/data入力、p/q/dof、相関標準化、uniqueness最適化、ML objective/gradient、収束、loadings順序・符号、varimax/pro­max、統計量、regression/Bartlett scoresを確認。nObs未指定時やdof<=0時のNaN、covmatでのscores拒否はAPI/Oracleと整合した。

### 検証範囲・制約

- `src/descriptive/factanal.ts`、`test/factanal.test.ts`、`oracle/factanal-behaviour.md`、`src/internal/covmat.ts` を確認。
- 静的監査のみ。Vitest、Node、R実行は未実施。
- ソースコード変更なし。

---

## Audit #994 — GLM core IRLS・family/link 境界の再監査

- 対象: `src/models/glm.ts`, `src/models/glmFamily.ts`
- 監査時 HEAD: `b4276a67a06e7f6a5ca6f4eab34fbb4a3f5b11fc`
- 対象ソース blob: `2dfb7750111ba38d4a518ed6b37a81c5c9fc5727`, `80bfa28198a7d7efe6fd5c9ee1a03465d961d7be`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細: [review_audit_994_glm_core_irls_family.md](review-logs/review_audit_994_glm_core_irls_family.md)

### 要約

IRLSの開始値・反復・step-halving・収束/分離警告、正weight行のQR選択、offset、null deviance、残差自由度、family response初期化、two-column binomial、各linkのdomain/逆関数/微分、deviance/AICを再監査。offsetの二重加算やzero-effective-weight行の自由度算入は確認されず、今回の範囲で独立した新規不具合は確定できなかった。既存のGLM数値安定性・AIC・zero-weight Issueと重複する疑義は新規登録しない。

### 検証範囲・制約

- `src/models/glm.ts`、`src/models/glmFamily.ts` の主要制御フローを静的に追跡。
- 既存GLM/IRLS/binomial/offset/weight/link/family関連Issueを検索。
- Vitest、Node、R実行は未実施。確証のない疑義はIssue化しない。
- ソースコード変更なし。

---

## Audit #995 — survdiff の特異分散行列フォールバック

- 対象: `src/models/survival.ts`, `src/models/tiedTimes.ts`
- 監査時 HEAD: `53ee5d75c9ded25c1ab80dcd261470c84aacf290`
- 判定: oracle仕様との不一致候補。Issue [#510](https://github.com/numero-uno-jpn/rStats.js/issues/510) 登録（R実行確認待ち）
- 詳細: [review_audit_995_survdiff_singular_variance.md](review-logs/review_audit_995_survdiff_singular_variance.md)

### 要約

`survdiff()` は特異な `V_r` に対して直接solveが失敗すると一般化逆行列相当の `pseudoQuadratic()` にフォールバックする。oracleは選択群の分散部分行列を直接solveし、一般化逆行列を使わないと記載。再現データ `time=[1,1]`, `status=[1,1]`, `group=["a","b"]` では現行コードが `chisq=0, df=0, pvalue=NaN` を返す。Rでの正確な特異ケース挙動は未実行のためIssueでは確認待ちと明記。

### 検証範囲・制約

- KM、Greenwood、CI3種、中央値、G-rho重み、同時event/censor、risk set、分散式、timefixを静的に確認。
- R fixtureとoracleを照合。Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #996 — QR / matrix shape / matrix norms

- 対象: `src/linalg/qr.ts`, `src/linalg/matrix.ts`, `src/linalg/norm.ts`
- 監査時 HEAD: `f76c0f3d07a73a6fc0fc9f2d8fc18f4676cd6f17`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_996_qr_matrix_norm.md](review-logs/review_audit_996_qr_matrix_norm.md)

### 要約

LINPACK/LAPACK QR、pivot/rank、Householder、qrCoef/qrSolve/qrResid/qrFitted/qrQ/qrR/qrX、行列shape変換、norm各種のNaN/Inf・空行列・overflow/underflowを確認。既存のQR大規模値Householder overflow Issueは重複登録を回避。LAPACK QRのrank非検出やqrResid/qrFittedの制限は実装契約と整合し、未検証の疑義はIssue化しなかった。

### 検証範囲・制約

- ソースと既存テスト/oracle harnessを静的確認。
- Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #997 — SVD / eigen / Schur

- 対象: `src/linalg/svd.ts`, `src/linalg/eigen.ts`, `src/linalg/schur.ts`
- 監査時 HEAD: `203356623d253a5d1a50f75cf3bd35b840605420`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_997_svd_eigen_schur.md](review-logs/review_audit_997_svd_eigen_schur.md)

### 要約

SVDのwide/tall変換、nu/nv境界、Householder、bidiagonal QR、収束判定、singular value/vectorの並べ替えとscale復元を確認。eigenの対称性判定、スケーリング、対称/非対称QR、balancing、複素固有値・固有ベクトルを確認。Schurの複素共役2x2 block処理、lanv2標準化、Q/T回転整合性を確認。今回新規Issueは確定せず。

### 検証範囲・制約

- 既存SVD/Schur test harnessを静的に確認。
- Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #998 — Cholesky / matrix exponential / condition number / LU-PCA

- 対象: `src/linalg/chol.ts`, `src/linalg/expm.ts`, `src/linalg/kappa.ts`, `src/linalg/lu.ts`
- 監査時 HEAD: `042e4846cc08413101d5f6e7055bfc345eceb920`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_998_chol_expm_kappa_lu.md](review-logs/review_audit_998_chol_expm_kappa_lu.md)

### 要約

Choleskyのpivot/rank/tolerance、chol2inv、expm全6方式のスケーリング・balancing・order境界、kappaのexact/estimated・wide/triangular経路、LUの長方形行列・zero pivot、prcompのcenter/scale/rank/tol・大規模値fallbackを確認。既存Issueと重複するpivoted Cholesky初回pivot toleranceは再登録せず、今回の範囲で新規Issueは確定しなかった。

### 検証範囲・制約

- Cholesky/expm test harnessを静的確認。
- Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #999 — Matrix products / dot products / triangular solves / balancing

- 対象: `src/linalg/basic.ts`, `src/linalg/dot.ts`, `src/linalg/ops.ts`, `src/linalg/balance.ts`
- 監査時 HEAD: `9622e1a59bcb054f8b0fa89055f322f1bef5d95f`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_999_matrix_ops_dot_balance.md](review-logs/review_audit_999_matrix_ops_dot_balance.md)

### 要約

crossprod/tcrossprod、backsolve/forwardsolve、BigIntによるdot積の厳密再計算、matrix arithmeticとshape/recycling、balanceのpermutation・power-of-two scaling・back transformationを確認。通常範囲の桁落ちをむやみに再計算しないdot仕様、ゼロ内積次元の出力shape、ベクトルの行/列変換を確認し、新規Issueは確定しなかった。

### 検証範囲・制約

- matrix-ops test harnessを静的確認。
- Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #1000 — Root finding / noncentral distributions / Poisson mixtures

- 対象: `src/internal/uniroot.ts`, `src/internal/dpq.ts`, `src/internal/noncentral.ts`, `src/internal/poissonMixture.ts`, `src/numerics/integrate.ts`
- 監査時 HEAD: `f4d4a9597586cc0ea289f231626170aa9aaa281c`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1000_uniroot_noncentral_mixture.md](review-logs/review_audit_1000_uniroot_noncentral_mixture.md)

### 要約

Brent root findingのbracket/endpoint/tolerance、odds ratioのlog-scale root、dpqのlowerTail/logP境界とsmaller-tail切替、noncentral quantileのadjacent-double探索、adaptive GK15積分、Poisson mixtureのdouble-double表現・peak探索・tail truncation・上下方向再帰・log/linear出力を確認。今回、新規の再現可能な不具合は確定せず。

### 検証範囲・制約

- nchisq/nbeta/fisher/wilcox関連テストファイルとuniroot実装を静的確認。
- Vitest、Node、R実行は未実施。
- ソースコード変更なし。


---

## Audit #1001 — Binomial distribution boundary and tail paths

- 対象: `src/distributions/binomial.ts` と dpq / discrete / integer / incomplete-beta / Loader 依存部
- 監査時 HEAD: `51f8fc361962e8cd8ff7680bf37e812a7b57b488`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1001_binomial_boundaries.md](review-logs/review_audit_1001_binomial_boundaries.md)

### 要約

dbinom/pbinom/qbinomの無効値・支持域端・prob=0/1・size=0/Infinity・非整数丸め、2^53近傍のx+1非表現可能分岐、incomplete-betaとpmf補正、upper-tail/log-domain fallback、離散quantile探索を静的に確認。新規Issueは確定しなかった。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1002 — Normal distribution tails, quantiles and scaling

- 対象: `src/distributions/normal.ts`, `src/special/erf.ts`, `src/special/ndtri.ts`, `src/internal/ddexp.ts`
- 監査時 HEAD: `6ae5e29856a291aa2638b5917123d8406a737307`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1002_normal_tails_quantiles.md](review-logs/review_audit_1002_normal_tails_quantiles.md)

### 要約

pnormの±Inf/NaN/Inf-Inf/標準化overflow、lower/upper・log tail、erf/erfcx切替、qnormのlog確率・端点・Newton補正、dnormのsd=0/Infinity・tiny sd・subnormal経路を静的に確認。既知Issue #33対応の極端log-tail overflow回避も確認し、新規Issueは確定しなかった。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1003 — Central Student t distribution

- 対象: `src/distributions/t.ts` の central `dt/pt/qt` 経路と巨大df helper
- 監査時 HEAD: `d12bf15ecfbe8b901c358b5e6dbc82b0103c75b0`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1003_central_t_distribution.md](review-logs/review_audit_1003_central_t_distribution.md)

### 要約

dt/pt/qtのdf・確率境界、±Infinity、tiny/huge df、x² overflow、beta引数のscale、log/linear tail、Newton反転を静的に確認。qtの確率端点をdf<=0検証より先に扱う順序はRのqt.cと一致することを確認し、誤検出を回避した。新規Issueなし。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Rソースの処理順を参照したが、Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1004 — Central F distribution

- 対象: `src/distributions/f.ts` の central `df/pf/qf` と incomplete-beta / gamma-limit / quantile inversion依存部
- 監査時 HEAD: `3d3dac9a464fc0e8a934d938e827d3a2f1f63bbc`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1004_f_distribution.md](review-logs/review_audit_1004_f_distribution.md)

### 要約

df/pf/qfの支持域端、片側/両側無限df、tiny shape、m*x overflow/underflow、2^600 scaling、incomplete-betaのtail、gamma極限、quantileの0/Infinity判定を静的に確認。既存 #32/#116/#493 の修正経路が現行ソースに存在することを確認し、新規Issueは確定しなかった。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1005 — Gamma distribution density, CDF and quantile

- 対象: `src/distributions/gamma.ts`、incomplete-gamma / inverse-gamma / invert / Loader / DD依存部
- 監査時 HEAD: `71e2cec35e404a0d67513abf10f658a3f6088afc`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1005_gamma_distribution.md](review-logs/review_audit_1005_gamma_distribution.md)

### 要約

dgamma/pgamma/qgammaのshape/scale/rate境界、x/scaleのsubnormal・overflow、tiny shapeのDD log、Poisson関係式、tail補正、inverse gamma初期値と反転を静的に確認。既存 #245/#368 とRとの差異文書を照合し、意図的な仕様差をIssue化せず。新規Issueなし。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1006 — Exponential distribution and infinite-rate endpoints

- 対象: `src/distributions/exponential.ts` と dpq / DD exponential helpers
- 監査時 HEAD: `4d0429d487fcde0a8806707616a5f01c3aa376b6`
- 判定: 新規不具合1件を確認しIssue登録
- Issue: [#511 qexp returns infinite endpoints when rate = Infinity, unlike R's scale-zero result](https://github.com/numero-uno-jpn/rStats.js/issues/511)
- 詳細: [review_audit_1006_exponential_endpoints.md](review-logs/review_audit_1006_exponential_endpoints.md)

### 要約

dexp/pexp/qexpのrate=0/Infinity、x/qの支持域端、DD積、subnormal・overflow、lower/upper・log tailを確認。qexpは一般的な確率境界をrate検査より先に返すため、rate=Infinityの端点でRと異なることを確認し、Issue #511に登録した。

### 再現入力

```ts
qexp(1, { rate: Infinity });
qexp(0, { rate: Infinity, lowerTail: false });
```

### 検証範囲・制約

- 固定入力による静的な制御フロー追跡。Rのqexp.cソースを参照。
- Vitest、Node、R runtimeは未実施。
- ソースコード変更なし。


---

## Audit #1007 — Weibull distribution endpoints and extreme scaling

- 対象: `src/distributions/weibull.ts` と DD exponential / dpq helpers
- 監査時 HEAD: `c512b64d8945499662a6e457c024bd9b85c81cc6`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1007_weibull_distribution.md](review-logs/review_audit_1007_weibull_distribution.md)

### 要約

dweibull/pweibull/qweibullのshape/scale端点、±Infinity、scale=Infinityの極限、subnormal/overflow、DD log・expm1/log1mExp、quantile境界を静的に確認。既存 #111/#408/#451 と仕様差文書を照合し、別領域の問題や意図的差異を重複Issue化しなかった。新規Issueなし。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1008 — Logistic distribution

- 対象: `src/distributions/logistic.ts` と standardize / location-scale helpers
- 監査時 HEAD: `abee37542a29c4ea31385eac3bc2427f627f264b`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1008_logistic_distribution.md](review-logs/review_audit_1008_logistic_distribution.md)

### 要約

dlogis/plogis/qlogisのscale<=0/0/Infinity、±Infinity、差分overflow、subnormal density、upper/lower・log tail、logitの端点を静的に確認。既存 #109/#415 とRのqlogis.cを照合し、random generatorの別問題を誤って重複登録しなかった。新規Issueなし。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1009 — Cauchy distribution extreme tails and location-scale boundaries

- 対象: `src/distributions/cauchy.ts` と location-scale / DD helpers
- 監査時 HEAD: `c8ad712ea9c2f8b69c774246124fe92e0c119e5d`
- 判定: 今回の確認範囲で新規不具合なし
- 詳細: [review_audit_1009_cauchy_distribution.md](review-logs/review_audit_1009_cauchy_distribution.md)

### 要約

dcauchy/pcauchy/qcauchyのscale境界、差分overflow、subnormal scale、tiny tail、frexp復元、locationScaleを静的に確認。Rのqcauchy.cの引数検査順と差異文書を照合し、scale=Infinityの意図的差異を誤検出しなかった。新規Issueなし。

### 検証範囲・制約

- 固定入力の境界監査セットを作成し、実装経路を静的追跡。
- Vitest、Node、R oracleは未実施。
- ソースコード変更なし。


---

## Audit #1010 — Beta distribution support boundaries and degenerate shapes

- 対象: `src/distributions/beta.ts`、incomplete-beta / Loader / continuous quantile inversion
- 監査時 HEAD: `796ea76ca11809c772893331c78669014fa2a3a1`
- 判定: 新規不具合1件を確認しIssue登録
- Issue: [#512 pbeta checks q < 0 before zero-shape point masses, reversing R's endpoint behavior](https://github.com/numero-uno-jpn/rStats.js/issues/512)
- 詳細: [review_audit_1010_beta_distribution.md](review-logs/review_audit_1010_beta_distribution.md)

### 要約

dbeta/pbeta/qbetaの支持域端、zero/infinite shape、point mass、DD密度、incomplete-beta、左右半区間quantile inversionを静的に確認。pbetaはq<0をpoint massより先に判定し、Rと結果が異なる固定再現例を確認したためIssue #512に登録。

### 再現入力

```ts
pbeta(-1, 0, 2); // current 0; R 1
pbeta(-1, 0, 0); // current 0; R 0.5
pbeta(-1, 0, 2, { lowerTail: false }); // current 1; R 0
```

### 検証範囲・制約

- 固定入力による静的な制御フロー追跡。Rのpbeta.cソースを参照。
- Vitest、Node、R runtimeは未実施。
- ソースコード変更なし。
