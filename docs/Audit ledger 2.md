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

