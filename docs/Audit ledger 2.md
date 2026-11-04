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
