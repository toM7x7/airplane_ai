# 開発手順（PoC）

以後の方針・実装判断は `AGENTS.md` を参照します。

## サービス構成

- flight-proxy: Node/Express。開発時のみCORS許可。`/flights` はモックJSON返却。
- tts: FastAPI（Python）。開発時のみCORS許可。`/speak` はスタブ返却。
- web: 素のThree.js + WebXR。デスクトップはOrbitControlsでフォールバック。

## 起動

### flight-proxy

```
cd services/flight-proxy
npm install
npm start
# -> http://localhost:8000/flights
```

実データ（OpenSky）に切り替えるには環境変数を設定して起動してください。

```
# 例（PowerShell / bash）
$env:FLIGHT_PROVIDER="opensky"         # Windows PowerShell の例
export FLIGHT_PROVIDER=opensky          # bash の例

# 認証（任意、匿名はレート制限あり）
$env:OPENSKY_USER="<username>"
$env:OPENSKY_PASS="<password>"

npm start
```

クライアントからは `GET /flights?lat=<緯度>&lon=<経度>&radius=<km>` で周辺のフライトを取得します。

### tts

```
cd services/tts
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8001
# -> http://localhost:8001/health
```

### web（静的）

単純に `web/index.html` をブラウザで開くか、`npm run web` でローカルHTTPサーバ（8080）から配信してください。
Three.js は `web/lib/` に配置するか、無い場合はCDNへフォールバックします。

#### Quest 3（WebXR AR）メモ
- WebXRのARは「セキュアコンテキスト」が必要です。`localhost` は多くの環境で例外的に許可されますが、ヘッドセットブラウザからPCの `http://<PCのIP>:8080` にアクセスする場合はHTTPSが必要なことがあります。
- 開発ではまずデスクトップChromeでのWebXR（またはフォールバック）動作確認→Quest 3でのAR実機確認の順で検証してください。
- ARセッション開始時に端末の位置情報（Geolocation）を起点に、フライトの緯度経度をローカル座標(ENU)へ変換して可視化します。位置情報が取れない場合は東京駅付近を起点とします。
- デスクトップ（ノートPC等）のブラウザは通常、カメラベースの「immersive-ar」セッションをサポートしていません（エミュレータでの動作は可）。実際のAR表示はQuest 3のMeta Browserなど対応デバイスで確認してください。

#### デスクトップ検証のコツ
- 画面左上の「中心(lat,lon)」で取得中心を変更できます。お住まいの地域に設定してください。
- 実データモード（OpenSky）時は、空域によっては便が少ない時間帯があります。中心と時間帯を変えて確認してください。
- Immersive Web Emulator を使っている場合、コンソールに `[Immersive Web Emulator] native WebXR API successfully overridden` と表示されます。ARボタンが表示される挙動は正常です。

## エンドポイント

- フライト取得: `GET http://localhost:8000/flights`
- TTSスタブ: `POST http://localhost:8001/speak`（JSON: `{ text, voice? }`）
- チャット（Gemini経由/スタブ）: `POST http://localhost:8000/chat`（JSON: `{ input }`）

## セキュリティ（開発）

## 対話（Gemini）
- 低遅延な応答体験のため、フロントは `POST /chat` を叩きます。
- 実接続: `services/flight-proxy` に `GEMINI_API_KEY` を設定して起動。

```
# 例（PowerShell / bash）
$env:GEMINI_API_KEY = "<your_api_key>"
npm run proxy
```

- 未設定時はスタブ応答にフォールバックします。

- CORSは開発中のみワイドオープン。本番に相当する運用では無効化してください。
## 使い方メモ（UI）
- 画面左上の「中心(lat,lon)」「半径km」「取得」で対象エリアの機体を更新
- 右側「フライト一覧」をクリックで該当機体を選択（3D側でハイライト）
- XRコントローラのselectまたは視線で選択（AR時）
- 「表示切替」で機体とラベルの表示/非表示
- 「非選択」で選択解除（背景クリックでも解除可）
- 選択中は上部にHUD（距離/方位/高度/速度）を表示。数値UIと重ならないよう左上に配置
