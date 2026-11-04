# Audit #989 — omega の入力・Schmid-Leiman 境界条件を再確認

- 対象: `src/descriptive/omega.ts`
- 監査時 HEAD: `fd0e1a57ac39e2edbb0e6ae26c4a698bd50954ff`
- 対象ソース blob: `e07f01ef3d54e489882ecd88dda6bc21bf2f3500`
- 判定: 今回確認した範囲で新規不具合なし

## 確認内容

`nfactors` の範囲、covmat の正方・有限・対称・正対角チェック、データ入力時のpairwise correlation、SMCのSVD擬似逆、minresの下限 uniqueness と収束警告、q=1/q=2/q>=3 の一般因子処理、Schmid-Leimanの h2/u2/p2/com、負の一般因子負荷のflip、omegaGroupの空グループを確認した。

`q=1` のF1*列とomegaGroup group成分は仕様上の厳密な0として扱われ、R側の丸め残差はテストで明示的な既知差異として扱われている。2因子時の一般因子負荷の式とメッセージも oracle と一致。

## 検証範囲・制約

- `src/descriptive/omega.ts`、`test/omega.test.ts`、`oracle/omega-behaviour.md`、`src/internal/covmat.ts` を確認。
- 関連Issue検索で同一原因の未解決報告は確認できなかった。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし.