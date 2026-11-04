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
