# デプロイメモ（PoC用 / GCP）

目的: デモのタイミングで任意のURLにアクセスして手軽に試せるようにする。

## 候補: Google Cloud Platform
- Web (静的): Cloud Storage + Cloud CDN（`web/` 配信）。
- API: Cloud Run
  - flight-proxy（環境変数: `FLIGHT_PROVIDER=opensky`, 認証があれば `OPENSKY_USER`, `OPENSKY_PASS`）
  - tts（FastAPI）
- ドメイン: Cloud Run ドメインマッピング or Cloud Load Balancing 経由でサブドメイン割当。

## 構成案
- `web` はCIでビルド不要のため、そのまま GCS バケットに `index.html`/`main.js` をアップロード。
- `flight-proxy` と `tts` は別々の Cloud Run サービスとしてデプロイ。
- フロント側のエンドポイントは `window.AI_CONFIG` で上書き可能にし、環境に合わせて `FLIGHT_PROXY` と `TTS_API` を差し替え。

## 簡易手順（要 gcloud CLI）
1) プロジェクト選択・API有効化（Run/Storage/Artifact Registry など）
2) コンテナ化とデプロイの一例
   - flight-proxy: Node 18 ベースで `services/flight-proxy` を Cloud Run
   - tts: Python 3.11 ベースで `services/tts` を Cloud Run
3) `web/` を GCS バケットに公開（CDN有効化 optionally）。
4) 取得先エンドポイントを `web/index.html` で `window.AI_CONFIG` として指定。

メモ: PoC中はCORSを許可しておくが、本番相当の公開時はオリジンを厳密に絞ること。

## TODO
- 簡易 Dockerfile と `gcloud` コマンド例の追加
- Cloud Run における`CACHE_TTL_MS` のチューニングとレート制御
- カスタムドメインとHTTPS有効化手順の追記

