# プルリクエストまでの手順
- 任意のディレクトリに移動（パスに日本語を含まないようにする）
- リポジトリをクローンし，該当ディレクトリに移動
```bash
git clone https://github.com/takaaaa-jun/2026_opencampus_project2
cd 2026_opencampus_project2
```

- テスト用に自分の名前のブランチを作成
```bash
git switch -c (自分の苗字)
# (例) git switch -c takahashi
```

- ファーストコミット用のディレクトリに移動し，テストファイルを作成
```bash
cd test/first_commit
echo "苗字" > (苗字).txt
# (例) echo "takahashi" > takahashi.txt
```