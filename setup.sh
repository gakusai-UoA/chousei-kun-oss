#!/bin/bash

# エラーが発生したらスクリプトを停止する
set -e

echo "📦 依存パッケージをインストールしています..."
pnpm install

echo "🔑 Cloudflareへのログイン状態を確認しています..."
# ログイン状態の確認（エラーになってもスクリプトを止めないように set +e）
set +e
pnpm exec wrangler whoami > /dev/null 2>&1
LOGIN_EXIT_CODE=$?
set -e

# "Not logged in" 等が含まれている場合はログイン処理を行う
if [ $LOGIN_EXIT_CODE -ne 0 ]; then
  # 複数アカウントエラーか未ログインか判定するために出力を取得
  set +e
  LOGIN_CHECK=$(pnpm exec wrangler whoami 2>&1)
  set -e
  
  if echo "$LOGIN_CHECK" | grep -qi "not logged in"; then
    echo "⚠️ 未ログイン状態です。ブラウザが開くのでログインしてください。"
    pnpm exec wrangler login
  fi
fi

# 複数アカウントがある場合の対応
ACCOUNT_ID=""
set +e
LOGIN_CHECK=$(pnpm exec wrangler whoami 2>&1)
set -e
if echo "$LOGIN_CHECK" | grep -qi "More than one account available"; then
  echo "⚠️ 複数のCloudflareアカウントが検出されました。"
  echo "以下のリストを参考に、リソースを作成するアカウントのIDを入力してください。"
  
  # 利用可能なアカウントのみを抽出して表示（エラーメッセージから）
  echo "$LOGIN_CHECK" | grep '`.*`:' || true
  
  echo ""
  read -p "Account ID: " ACCOUNT_ID
  export CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID
  
  # 環境変数を.envに書き込む (.env.exampleが存在する場合)
  if [ -f ".env.example" ]; then
    if ! grep -q "CLOUDFLARE_ACCOUNT_ID=" .env 2>/dev/null; then
      echo "CLOUDFLARE_ACCOUNT_ID=$ACCOUNT_ID" >> .env
      echo "※ アカウントIDを .env ファイルに保存しました。以降のコマンドで自動的に利用されます。"
    fi
  fi
fi


echo "📝 wrangler.jsonc.example から wrangler.jsonc を作成しています..."
cp wrangler.jsonc.example wrangler.jsonc

echo "🗄️ D1データベース 'chosei-kun-db' を作成しています..."
# データベース作成コマンド
# ※対話プロンプト（「Would you like Wrangler to add it on your behalf?」）には
# 「no」と答えてください（このスクリプトが自動で jsonc に書き込むため）。
set +e
pnpm exec wrangler d1 create chosei-kun-db
set -e

echo "🔍 データベースIDを取得しています..."
# 既存DB一覧のJSONを取得してIDを抽出する
set +e
DBS_JSON=$(pnpm exec wrangler d1 list --json 2>/dev/null)
set -e

DB_ID=""
if [ -n "$DBS_JSON" ]; then
  DB_ID=$(echo "$DBS_JSON" | node -e "const dbs = JSON.parse(require('fs').readFileSync(0, 'utf-8')); const db = dbs.find(d => d.name === 'chosei-kun-db'); if(db) console.log(db.uuid);" 2>/dev/null)
fi

if [ -n "$DB_ID" ]; then
  echo "✅ データベースIDを取得しました: $DB_ID"
  echo "📝 wrangler.jsonc を更新しています..."
  
  # OSに合わせてsedコマンドを切り替え (MacとLinuxでsedの仕様が異なるため)
  if [[ "$OSTYPE" == "darwin"* ]]; then
    # database_id: "" の部分に取得したIDを挿入する
    sed -i '' "s/\"database_id\": \"\"/\"database_id\": \"$DB_ID\"/g" wrangler.jsonc
  else
    sed -i "s/\"database_id\": \"\"/\"database_id\": \"$DB_ID\"/g" wrangler.jsonc
  fi
  echo "✅ wrangler.jsonc の書き換えが完了しました"
else
  echo "⚠️ データベースIDを自動で取得できませんでした。"
  echo "Cloudflareダッシュボードまたは 'pnpm exec wrangler d1 list' でIDを確認し、wrangler.jsoncを手動で書き換えてください。"
fi

echo "🚀 本番データベースへテーブルを作成（マイグレーション）しています..."
# 対話プロンプトをスキップしてマイグレーションを実行する（--remote）
# ※ 初回セットアップの自動化のため、YESを自動入力する
echo "y" | pnpm exec wrangler d1 migrations apply chosei-kun-db --remote

echo "☁️ Cloudflareへアプリケーションをデプロイしています..."
pnpm run deploy

echo "🎉 すべてのセットアップとデプロイが完了しました！"
echo "デプロイされたURLにアクセスして、アプリケーションを確認してください。"
