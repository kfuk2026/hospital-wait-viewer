-- reports テーブルの RLS ポリシー
-- 患者が混雑状況を報告できるように INSERT を許可
-- Supabase SQL Editor で実行してください

-- 既存の同名ポリシーがあれば削除
DROP POLICY IF EXISTS "reports_insert_allow" ON reports;
DROP POLICY IF EXISTS "reports_select_allow" ON reports;

-- INSERT: 匿名ユーザーも含めて報告の投稿を許可
CREATE POLICY "reports_insert_allow"
ON reports
FOR INSERT
TO anon, authenticated
WITH CHECK (true);

-- SELECT: 報告の読み取りを許可（患者・管理画面で表示用）
CREATE POLICY "reports_select_allow"
ON reports
FOR SELECT
TO anon, authenticated
USING (true);

-- DELETE: 管理画面からのデモ用リセットを許可
DROP POLICY IF EXISTS "reports_delete_allow" ON reports;
CREATE POLICY "reports_delete_allow"
ON reports
FOR DELETE
TO anon, authenticated
USING (true);
