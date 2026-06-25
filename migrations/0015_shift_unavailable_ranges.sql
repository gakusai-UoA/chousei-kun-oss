-- Migration number: 0015_shift_unavailable_ranges.sql
-- シフト調整のフロー変更: 「シフト枠と無関係に回答を収集し、集計段階で枠を作成する」へ。
-- メンバーは枠ごとの NG ではなく「出られない時間帯(レンジ)」を申告するようになるため、
-- 枠×人の shift_unavailabilities を廃止し、人×時間レンジの shift_unavailable_ranges へ移行する。
-- 枠ごとの NG は、枠の時間と本人 NG レンジの重なりで集計時に導出する。

DROP TABLE IF EXISTS shift_unavailabilities;

CREATE TABLE IF NOT EXISTS shift_unavailable_ranges (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL REFERENCES shift_members(id) ON DELETE CASCADE,
    starts_at INTEGER NOT NULL,
    ends_at INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_shift_unavail_ranges_member ON shift_unavailable_ranges(member_id);
