-- 手動混雑状況の上書き用カラム追加
-- 実行: Supabase SQL Editor で実行するか、supabase db push で適用

ALTER TABLE hospitals
ADD COLUMN IF NOT EXISTS manual_status text,
ADD COLUMN IF NOT EXISTS manual_status_expires_at timestamptz;

COMMENT ON COLUMN hospitals.manual_status IS '手動設定: 空いている / ふつう / 混んでいる、NULL=自動集計';
COMMENT ON COLUMN hospitals.manual_status_expires_at IS '手動設定の有効期限（過ぎたら自動解除）';
