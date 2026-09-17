-- get_reveal had already been extended directly on the database with a
-- custom_question column and a room-membership check, but neither change
-- was ever committed here, and the join picked the wrong question: it
-- returned the answering player's OWN question instead of the one they
-- were actually responding to. This commits the current, corrected version.
create or replace function public.get_reveal(p_code text, p_idx integer)
returns table(player_id uuid, value text, reaction text, verdict boolean, custom_question text)
language plpgsql security definer set search_path to 'public' as $function$
declare r rounds;
begin
  select * into r from rounds where room_code = upper(trim(p_code)) and idx = p_idx;
  if not found or not r.revealed then raise exception 'not_revealed' using message = 'Both answers are not in yet.'; end if;
  if auth.uid() is null or not exists (select 1 from rooms rm where rm.code = r.room_code and (rm.host_id = auth.uid() or rm.guest_id = auth.uid())) then raise exception 'not_a_member'; end if;
  return query select a.player_id, a.value, a.reaction, a.verdict, case when r.mode = 'ask_me_anything' then cq.question else null end
    from answers a left join custom_questions cq on cq.round_id = r.id and cq.player_id <> a.player_id
    where a.round_id = r.id;
end;
$function$;
