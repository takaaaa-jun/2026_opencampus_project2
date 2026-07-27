# Open Campus Project 2

## 起動方法

バックエンドとフロントエンドを、それぞれ別のターミナルで起動する。

### バックエンド

Python 3.11を使用する。初回だけ仮想環境の作成と依存パッケージのインストールを行う。

```bash
cd backend
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

以降は、仮想環境を有効にしてDjangoの開発サーバーを起動する。

```bash
cd backend
source .venv/bin/activate
python manage.py runserver 127.0.0.1:5174
```

### フロントエンド

別のターミナルで、Viteの開発サーバーを起動する。

```bash
cd frontend
npm install
npm run dev
```

ブラウザで `http://localhost:5173/2026_opencampus_project2/` を開く。フロントエンドの `/api` へのリクエストは、バックエンドの `http://127.0.0.1:5174` に転送される。

必要なら、フロントエンドのビルド確認も実行できる。

```bash
npm run build
```
