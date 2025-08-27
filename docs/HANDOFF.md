# Handoff Notes

以後の判断は `AGENTS.md` を参照。PoC再開時の最短ルートを記載します。

## 起動クイックスタート
- flight-proxy: `cd services/flight-proxy && npm install && npm start`
  - 実データ: `FLIGHT_PROVIDER=opensky`（任意で `OPENSKY_USER`/`OPENSKY_PASS`）
  - 追加: `GEMINI_API_KEY`（対話APIを有効化）/ `CACHE_TTL_MS`（既定5s）
- tts: `cd services/tts && pip install -r requirements.txt && uvicorn app.main:app --reload --port 8001`
- web: `npm run web` → `http://localhost:8080`

## ポートとエンドポイント
- flight-proxy: `http://localhost:8000/`（`/`, `/health`, `/flights`, `/chat`）
- tts: `http://localhost:8001/`（`/speak`）
- web: `http://localhost:8080`

## 操作メモ（UI）
- 左上: 中心(lat,lon)/半径kmを設定→「取得」
- 右: フライト一覧クリックで選択（3Dハイライト＋カメラ注視）
- 背景クリック or 「非選択」ボタンで解除
- 「表示切替」で可視切替、右上に `source | flights:N`
- AR: Quest 3 のMeta Browser等で実機確認（PCブラウザは通常AR非対応）。HTTPS要件に注意。

## 変数一覧（例）
- `FLIGHT_PROVIDER=opensky`、`OPENSKY_USER`、`OPENSKY_PASS`
- `GEMINI_API_KEY`（未設定時はスタブ応答）
- `CACHE_TTL_MS=5000`

## 次の実装候補（優先順）
- 同期/UI: hoverと選択の別表現、HUD微調整、一覧↔注視の双方向同期強化
- 更新: SSE/WebSocketで滑らかな機体更新
- 演出: タイプライター/SE調整、ドット絵口パク（PNG2枚提供後）
- Quest強化: WebXR hit-test/anchors/plane-detection/hand-tracking などを optionalFeatures で活用
- 実データ: プロバイダ拡張（env切替）
