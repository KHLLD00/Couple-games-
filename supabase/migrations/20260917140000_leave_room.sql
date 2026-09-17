-- Deletes the room outright when a member leaves, which cascades to its
-- rounds, answers, and custom_questions (matching the existing product
-- decision that sessions are temporary, not permanent history). Idempotent:
-- calling it on an already-gone room is a no-op rather than an error, since
-- both players may end up calling it in quick succession.
create or replace function public.leave_room(p_code text, p_player uuid)
returns void language plpgsql security definer set search_path = public as $$
declare r public.rooms;
begin
  if auth.uid() is null or auth.uid() <> p_player then raise exception 'not_authenticated' using message='Player session is invalid.'; end if;
  select * into r from public.rooms where code = upper(trim(p_code));
  if not found then return; end if;
  if r.host_id <> p_player and r.guest_id <> p_player then raise exception 'not_member' using message='You are not in this game.'; end if;
  delete from public.rooms where code = r.code;
end;
$$;

revoke execute on function public.leave_room(text, uuid) from anon, public;
grant execute on function public.leave_room(text, uuid) to authenticated;
