-- Same Page security hardening.

create or replace function public.gen_room_code()
returns text language plpgsql security definer set search_path = public as $$
declare v_code text;
begin
  loop
    v_code := upper(substr(md5(random()::text || clock_timestamp()::text), 1, 6));
    exit when not exists (select 1 from public.rooms where code = v_code);
  end loop;
  return v_code;
end;
$$;

drop function if exists public.create_room(uuid);
drop function if exists public.join_room(text, uuid);

create or replace function public.create_room(p_player uuid, p_name text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare r public.rooms; clean_name text;
begin
  if auth.uid() is null or auth.uid() <> p_player then raise exception 'not_authenticated' using message='Player session is invalid.'; end if;
  clean_name := trim(p_name);
  if clean_name is null or char_length(clean_name) < 1 or char_length(clean_name) > 24 then raise exception 'invalid_name' using message='Enter a name between 1 and 24 characters.'; end if;
  insert into public.rooms (code, host_id, host_name) values (public.gen_room_code(), p_player, clean_name) returning * into r;
  return r;
end;
$$;

create or replace function public.join_room(p_code text, p_player uuid, p_name text)
returns public.rooms language plpgsql security definer set search_path = public as $$
declare r public.rooms; clean_name text; clean_code text;
begin
  if auth.uid() is null or auth.uid() <> p_player then raise exception 'not_authenticated' using message='Player session is invalid.'; end if;
  clean_code := upper(trim(p_code)); clean_name := trim(p_name);
  if clean_name is null or char_length(clean_name) < 1 or char_length(clean_name) > 24 then raise exception 'invalid_name' using message='Enter a name between 1 and 24 characters.'; end if;
  select * into r from public.rooms where code = clean_code;
  if not found then raise exception 'no_room' using message='That code has no room.'; end if;
  if r.host_id = p_player or r.guest_id = p_player then return r; end if;
  if r.guest_id is not null then raise exception 'room_full' using message='Two people are already in this room.'; end if;
  update public.rooms set guest_id=p_player, guest_name=clean_name where code=r.code returning * into r;
  return r;
end;
$$;

create or replace function public.is_room_member(p_code text, p_player uuid)
returns boolean language sql stable security definer set search_path=public as $$
select exists(select 1 from public.rooms r where r.code=upper(p_code) and (r.host_id=p_player or r.guest_id=p_player));
$$;
revoke execute on function public.is_room_member(text,uuid) from anon, authenticated;

drop policy if exists "rooms_select" on public.rooms;
drop policy if exists "rooms_members_select" on public.rooms;
create policy "rooms_members_select" on public.rooms for select to authenticated using (host_id=auth.uid() or guest_id=auth.uid());

drop policy if exists "rounds_select" on public.rounds;
drop policy if exists "rounds_members_select" on public.rounds;
create policy "rounds_members_select" on public.rounds for select to authenticated using (public.is_room_member(room_code,auth.uid()));

drop policy if exists "answers_select" on public.answers;
drop policy if exists "answers_insert" on public.answers;
drop policy if exists "answers_update" on public.answers;
drop policy if exists "answers_delete" on public.answers;
drop policy if exists "questions_select" on public.questions;
drop policy if exists "questions_insert" on public.questions;
drop policy if exists "questions_update" on public.questions;
drop policy if exists "questions_delete" on public.questions;

create or replace function public.draw_question(p_code text, p_idx int)
returns public.questions language plpgsql security definer set search_path=public as $$
declare q public.questions;
begin
  if auth.uid() is null or not public.is_room_member(p_code,auth.uid()) then raise exception 'not_member' using message='You are not a member of this room.'; end if;
  select * into q from public.questions where not exists(select 1 from public.rounds rd where rd.room_code=upper(p_code) and rd.question_id=questions.id) order by random() limit 1;
  if not found then raise exception 'out_of_questions' using message='The question bank is empty.'; end if;
  return q;
end;
$$;

revoke execute on function public.create_room(uuid,text) from anon;
revoke execute on function public.join_room(text,uuid,text) from anon;
revoke execute on function public.draw_question(text,int) from anon;
revoke execute on function public.open_round(text,int) from anon;
revoke execute on function public.submit_answer(text,int,uuid,text) from anon;
revoke execute on function public.get_reveal(text,int) from anon;
revoke execute on function public.set_reaction(text,int,uuid,text) from anon;
revoke execute on function public.set_verdict(text,int,uuid,boolean) from anon;
revoke execute on function public.finish_game(text) from anon;
revoke execute on function public.game_summary(text) from anon;
revoke execute on function public.reset_game(text) from anon;
revoke execute on function public.add_ai_question(text,text,jsonb) from anon,authenticated;

grant execute on function public.create_room(uuid,text) to authenticated;
grant execute on function public.join_room(text,uuid,text) to authenticated;
grant execute on function public.draw_question(text,int) to authenticated;
grant execute on function public.open_round(text,int) to authenticated;
grant execute on function public.submit_answer(text,int,uuid,text) to authenticated;
grant execute on function public.get_reveal(text,int) to authenticated;
grant execute on function public.set_reaction(text,int,uuid,text) to authenticated;
grant execute on function public.set_verdict(text,int,uuid,boolean) to authenticated;
grant execute on function public.finish_game(text) to authenticated;
grant execute on function public.game_summary(text) to authenticated;
grant execute on function public.reset_game(text) to authenticated;
