# 2026_opencampus_frontend

React + MediaPipe Tasks Vision + WebRTC を使ったデモ用フロントエンドです。

## 特徴

- 上部にシンプルな動作タブ
- 左にカメラ映像、右に骨格映像
- カメラ映像は左右反転の鏡表示
- 下段は距離バー 1 本だけ
- バックエンドの DataChannel が来ない場合でも、ローカルの Hand Landmarker で骨格を表示するフォールバック付き

## 起動

```bash
npm install
npm run dev
```

## バックエンド接続

Vite の proxy で `/api` を backend に流す想定です。`docker-compose.yml` で backend サービス名が `backend` ならそのまま動きます。

`VITE_API_BASE_URL` を設定する場合は `.env` を使ってください。
