-- Migration number: 0017_shift_member_department.sql
-- 回答入力時に「部署名」を取得できるようにする。割当ポップアップで部署別に絞り込む用途。

ALTER TABLE shift_members ADD COLUMN department TEXT;
