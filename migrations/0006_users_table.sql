-- Migration number: 0006_users_table.sql
-- ユーザーテーブル: 端末識別とカレンダー購読トークン管理

CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,                    -- 端末固有識別子 (UUID)
    calendar_token TEXT NOT NULL UNIQUE,    -- カレンダー購読用トークン (UUID, 再生成可能)
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
);

-- カレンダートークンでの高速検索用インデックス
CREATE INDEX IF NOT EXISTS idx_users_calendar_token ON users(calendar_token);

-- participants に user_id カラムを追加 (既存データは NULL)
ALTER TABLE participants ADD COLUMN user_id TEXT REFERENCES users(id);

-- user_id での検索用インデックス
CREATE INDEX IF NOT EXISTS idx_participants_user_id ON participants(user_id);

-- google_oauth_sessions に user_id カラムを追加 (既存データは NULL)
ALTER TABLE google_oauth_sessions ADD COLUMN user_id TEXT REFERENCES users(id);

-- user_id での検索用インデックス
CREATE INDEX IF NOT EXISTS idx_google_oauth_sessions_user_id ON google_oauth_sessions(user_id);
