-- イベント作成者の user_id を保持する。デバイス（localStorage）に保存された
-- userId を作成時 cookie-less に受け取り、「自分の作ったイベント一覧」を
-- そのデバイスで再表示できるようにする。
ALTER TABLE events ADD COLUMN created_by_user_id TEXT;

CREATE INDEX IF NOT EXISTS idx_events_created_by_user_id
    ON events (created_by_user_id);
