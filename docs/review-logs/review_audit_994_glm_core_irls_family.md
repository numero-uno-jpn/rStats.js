# Audit #994 — GLM の IRLS・応答初期化・link/family 境界を再監査

- 対象: `src/models/glm.ts`, `src/models/glmFamily.ts`
- 監査時 HEAD: `b4276a67a06e7f6a5ca6f4eab34fbb4a3f5b11fc`
- 対象ソース blob: `2dfb7750111ba38d4a518ed6b37a81c5c9fc5727`, `80bfa28198a7d7efe6fd5c9ee1a03465d961d7be`
- 判定: 今回確認した範囲で新規不具合なし
- 詳細監査範囲: IRLS開始値・反復/step-halving・収束/分離警告、正weight行のQR選択、offset、null deviance、df、family response初期化、two-column binomial、各linkの逆関数/微分/valideta、deviance/AIC

## 確認事項

1. **入力行選択**: NaNを含むx/y/weights/offset行を先に除外し、InfはNaNと区別して後段の有限性検証へ渡す。raggedなx行は欠損除外前に拒否。weightsの負値・非有限値、offsetの非有限値を拒否する。
2. **IRLS**: 正weightかつ微分が0でない行だけをweighted QRへ渡す。working responseにはoffsetを二重加算せず、再構成したlinear predictorにはoffsetを一度加える。deviance発散・範囲外・deviance増加のstep-halving、収束判定、分離時の線形予測子移動警告を追跡。
3. **応答初期化**: binomial二列応答の列数、負count、合計overflow、proportion、effective prior weight、zero-sizeを確認。ベクトルbinomialのzero-weight行を初期値計算前に0へ置く処理を確認。Poisson/Gamma/inverse-Gaussianの応答領域チェックは現行実装どおり。
4. **offset/null model**: offset付きintercept modelでは同じoffsetを維持してnull modelを再fit。offsetなしではpositive-weight行だけでweighted meanを計算し、weight/response sumのoverflow fallbackを確認。no-intercept時のnull devianceはoffsetのみのfitを使う。
5. **自由度/AIC**: effective weight 0（binomial二列でsize 0を含む）をdfから除外。Gaussian AICはpositive-weight件数とlog weights、binomial/Poisson/Gamma/inverse-Gaussianのfamily AICは各family固有のweight/sizeを参照する。Gamma AICのweight sum overflow等は既存Issue群で報告済みの範囲として新規登録しない。
6. **link/family**: identity/log/inverse/sqrt/1/mu^2/logit/probit/cauchit/cloglog/powerのdomain・clamp・微分、quasi variance各種、deviance近傍計算のscaled fallbackを確認。確証を得られないvalideta差はIssue化しない。

## 重複確認

GLM、IRLS、binomial、offset、zero weight、link、family AIC、convergenceに関する既存Issueを検索。既存の数値安定性・family AIC・zero-weight関連Issueを確認したが、今回のコード経路で新たに独立した再現可能な欠陥は確定できなかった。Audit #991/#992で扱ったglmAnova/glmConfintの個別経路は今回の主対象から除外。

## 検証制約

- GitHub上の現行ソースを静的に追跡。ローカル実行環境がないためVitest/Node/Rによる実行・数値照合は未実施。
- 実行未確認の疑義を不具合として断定せず、新規Issueは作成しない。
- ソースコード変更なし。
