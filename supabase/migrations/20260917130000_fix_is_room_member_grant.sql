-- rounds_members_select calls is_room_member() in its USING clause. That
-- only worked before because the old permissive rounds_read policy let
-- Postgres short-circuit the OR and skip evaluating it. Dropping that
-- policy in the previous migration exposed a real gap: is_room_member had
-- no EXECUTE grant for authenticated, so every rounds read started failing
-- with "permission denied for function is_room_member".
grant execute on function public.is_room_member(text, uuid) to authenticated;
