# バックエンド仕様書

本プロジェクトのバックエンドは、フロントエンドから送信されるリアルタイムの骨格検出データおよびカメラ映像（画像データ）を受信し、それらを別PC等の視聴クライアントへ中継する（リレーする）ためのAPIサーバーとして機能します。

---

## 1. 使用言語・フレームワーク・主要ライブラリ

- **言語**: Python
- **フレームワーク**: Django (v5.1.x)
- **主要ライブラリ**:
  - **`django-cors-headers`**: フロントエンドとのクロスドメイン通信（CORS）を許可するために使用。
  - **`numpy`**: 多次元配列処理ライブラリ（数学処理などの拡張用）。
  - **`aiortc`**: Python用のWebRTC/ORTC実装。※本バージョンの標準機能ではHTTPポーリングによる簡易リレー方式が採用されていますが、依存関係として含まれています。

---

## 2. ディレクトリ構造（主要部分）

```text
backend/
├── config/              # Django プロジェクト構成設定（settings.py, urls.py 等）
├── webrtc/              # 本プロジェクトのコアアプリケーション（中継ロジック）
│   ├── domain.py        # ドメインモデル定義 (PoseFrame, ImageFrame)
│   ├── repositories.py  # データアクセス層（インメモリリポジトリ）
│   ├── services.py      # ビジネスロジック層（リレーサービス）
│   ├── views.py         # プレゼンテーション層（APIエンドポイント・ビュー）
│   └── urls.py          # ルーティング定義
├── manage.py            # Django管理用スクリプト
└── requirements.txt     # 依存パッケージ定義
```

---

## 3. 機能別の説明

### ① 簡易パスワード認証機能 (`auth_verify`)
- **機能詳細**: 
  フロントエンドでの操作を制限するための簡易的なアクセスパスワード検証機能です。
- **アルゴリズム**:
  1. クライアントから `/api/webrtc/auth/verify/` に POST された JSON データから `password` フィールドを取得。
  2. Django 設定ファイル (`settings.py`) で定義されている環境変数 `OPENCAMPUS_PASSWORD` の値を取得。
  3. 送信されたパスワードと定義済みの正しいパスワードを照合。
  4. 一致した場合はステータスコード `200 OK` と `{"ok": true}` を、不一致の場合は `401 Unauthorized` とエラー詳細を返却。

### ② 骨格（ポーズ）リレーAPI (`pose_update` / `pose_latest`)
- **機能詳細**: 
  送信側クライアントから送られたリアルタイムの骨格データを保存し、視聴側クライアントからの要求に応じて最新のデータを即座に返却します。
- **アルゴリズム**:
  - **更新処理 (`pose_update`)**:
    1. クライアントから `/api/webrtc/pose/update/` への POST リクエストを受信。
    2. JSON から `room_id`（未指定時は `default`）、タイムスタンプ（`updated_at`）、解像度（`image_width`, `image_height`）、および 33 点のランドマーク座標配列を取得。
    3. `RelayService.update_pose()` を介して、メモリ空間に `room_id` をキーとして保存（上書き更新）。
  - **取得処理 (`pose_latest`)**:
    1. クライアントから `/api/webrtc/pose/latest/` への GET リクエストを受信。
    2. クエリパラメータから `room_id` を取得。
    3. `RelayService.get_latest_pose()` を呼び出し、該当する `room_id` の最新の `PoseFrame` を取得。
    4. データが存在しない場合は `404 Not Found` を返し、存在する場合は JSON 形式に変換して `200 OK` で返却。

### ③ 画像リレーAPI (`image_update` / `image_latest`)
- **機能詳細**: 
  送信側クライアントがキャプチャしたカメラ映像（JPEG形式）を Base64 文字列として受信し、視聴側へ最新の映像フレームとして中継します。
- **アルゴリズム**:
  - **更新処理 (`image_update`)**:
    1. クライアントから `/api/webrtc/image/update/` への POST リクエストを受信。
    2. JSON から `room_id` と JPEGの Base64 文字列（`image`）を取得。
    3. `RelayService.update_image()` を介して、メモリ空間に `room_id` をキーとして画像を保存（上書き更新）。
  - **取得処理 (`image_latest`)**:
    1. クライアントから `/api/webrtc/image/latest/` への GET リクエストを受信。
    2. クエリパラメータから `room_id` を取得。
    3. `RelayService.get_latest_image()` を呼び出し、該当する `room_id` の最新の Base64 画像オブジェクトを取得。
    4. 存在する場合は JPEG Base64 データを含む JSON を `200 OK` で返却。存在しない場合は `404 Not Found`。

### ④ インメモリデータ永続化（スレッドセーフ） (`InMemoryRoomRepository`)
- **機能詳細**: 
  高速な中継を実現するため、データベース（SQLiteなど）を使用せず、Pythonのプログラム実行メモリ空間（辞書オブジェクト）にデータを一時保持します。
- **アルゴリズム**:
  1. リポジトリクラス内に骨格データ用の `self._poses` および画像用の `self._images` の辞書を用意。
  2. 複数クライアントからの並行リクエストによる競合を防ぐため、`threading.Lock()` を用いて書き込み（`save_pose`, `save_image`）および読み込み（`get_pose`, `get_image`）の処理を `with self._lock:` ブロックで保護し、排他制御を行います。
  3. シングルトンインスタンス `room_repository` として常駐させ、Djangoプロセスのメモリが稼働している間、最新状態を維持します。

### ⑤ 動作判定結果受信API (`receive_data`)
- **機能詳細**: 
  フロントエンドのMediaPipeの推論結果や各種動作（手を叩く、ジャンプ、しゃがむ等の特定のアクション判定結果など）をJSON形式の汎用データとして受け取るためのエンドポイントです。現状は送信処理の開発に先立ち、データを受け取るためのプレースホルダ（受け皿）として実装されています。
- **アルゴリズム**:
  1. クライアントから `/api/webrtc/receive/` への POST リクエストを受信。
  2. リクエストの JSON ボディを解析し、Python 辞書オブジェクトに変換。
  3. 変換したデータを標準出力（ログ）へ出力する。（今後の拡張で、DBへの保存や、視聴側クライアントへのポーリング中継などのロジックをここに挿入可能）
  4. 正常に処理された場合、ステータスコード `200 OK` と `{"ok": true, "message": "Data received successfully."}` をJSONレスポンスとして返却。
  5. http://[IP_ADDRESS]/2026_opencampus_project2/api/webrtc/receive/

