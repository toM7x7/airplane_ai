# Airplane AI – AIキャラ × 飛行機トラッキング (PoC)

本PoCはローカル環境で動作する、AIキャラクターによる飛行機トラッキング体験の最小構成です。
方針と判断は常に `AGENTS.md` を参照します。

## 構成
- flight-proxy: Node/Express。開発時のみCORS許可。`/flights` はモックJSONを返却。
- tts: FastAPI（Python）。開発時のみCORS許可。`/speak` はスタブ返却（音声生成なし）。
- web: 素のThree.js + WebXR。デスクトップはOrbitControlsでフォールバック。

## 起動
- flight-proxy
  - `npm run proxy`
  - ブラウザ: `http://localhost:8000/flights`
  - 実データ: `FLIGHT_PROVIDER=opensky`（任意で `OPENSKY_USER`/`OPENSKY_PASS`）を設定して起動
- tts
  - Pythonで依存を入れてから: `npm run tts`
  - `services/tts/requirements.txt` を参照
- web（静的配信）
  - `npm run web` → `http://localhost:8080`
  - three.js を `web/lib/` に置くか、無い場合はCDNへフォールバック

詳細は `docs/DEVELOPMENT.md` を参照してください。

## セキュリティ（開発）
- CORS は開発中のみワイドオープンです。本番相当での利用時は必ず無効化してください。

## ROADMAP
- 正: `docs/ROADMAP.md`
- 直近の優先タスクはROADMAPを確認のうえ実装します。

## デモ公開メモ
- GCPでの簡易公開方針を `docs/DEPLOYMENT.md` に記載しました（Cloud Run + Cloud Storage/CDN）。

## 指針（AGENTS）
- 再帰回帰的に懐疑的に。想像的にGODモードで広く深く、わくわくしながら進めてください。
- Ultra Thinkingで松岡修造のように熱すぎるド熱意をもって、趣旨と目的を忘れずにネバーギブアップでがんばってください。
