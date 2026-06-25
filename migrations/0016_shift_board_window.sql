-- Migration number: 0016_shift_board_window.sql
-- シフト表を「単一日」から「日付範囲（複数日）＋日々の時間帯」へ拡張する。
-- 管理者は作成時に start_date〜end_date と、各日の収集時間帯 day_start_min/day_end_min を定義し、
-- メンバーはその範囲内で「参加不可の時間帯」をマークする。

ALTER TABLE shift_boards ADD COLUMN start_date INTEGER;
ALTER TABLE shift_boards ADD COLUMN end_date INTEGER;
ALTER TABLE shift_boards ADD COLUMN day_start_min INTEGER NOT NULL DEFAULT 540;
ALTER TABLE shift_boards ADD COLUMN day_end_min INTEGER NOT NULL DEFAULT 1080;

-- 既存行（単一日 date）を範囲へバックフィル。
UPDATE shift_boards SET start_date = date, end_date = date;

-- 旧 date 列を撤去（D1/SQLite は DROP COLUMN 対応）。
ALTER TABLE shift_boards DROP COLUMN date;
