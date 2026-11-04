# Audit #990 — coxph の欠損・層別・重み・Newton反復境界を再確認

- 対象: `src/models/coxph.ts`
- 監査時 HEAD: `fd0e1a57ac39e2edbb0e6ae26c4a698bd50954ff`
- 対象ソース blob: `93829de198c811cb03b2f2ce8921d65ff273a2a2`
- 判定: 今回確認した範囲で新規不具合なし

## 確認内容

入力長と行列形状、statusの0/1制約、欠損行除外後の重み検証、Infinity時刻の扱い、層別ソートとstratum境界、同時刻イベント/打切りのrisk set、Efron/Breslowの重み付き分母、共変量のnocenter・加重中心化/尺度化、ゼロイベント早期return、Newton反復のstep halving、収束/非収束時のvariance、aliased係数のNaN化、summaryのWald/LR/score検定を確認した。

Efronの重み付きタイ処理は `dw / ndead` の平均イベント重みを使い、各stepで `deathRisk / ndead` をリスク和に加える実装で、oracleの記述と一致。stratumEndによる逆順走査のrisk setリセットも境界をまたがない。

## 検証範囲・制約

- `src/models/coxph.ts`、`test/coxph.test.ts`、`oracle/coxph-behaviour.md` を確認。
- 既存Issue検索で今回の経路に一致する未解決報告は確認できなかった。
- ソースレベルの静的監査。Vitest、Node、R実行は未実施。
- ソースコード変更なし.