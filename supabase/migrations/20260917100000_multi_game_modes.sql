-- Multi-mode game support.
-- The production question bank is seeded with Nigerian-context prompts for every banked mode.

alter table public.rooms add column if not exists game_mode text not null default 'same_page';
alter table public.questions add column if not exists mode text not null default 'same_page';
alter table public.rounds add column if not exists mode text not null default 'same_page';
alter table public.rounds add column if not exists host_question text;
alter table public.rounds add column if not exists guest_question text;
alter table public.rounds add column if not exists question_count int not null default 0;

alter table public.rooms drop constraint if exists rooms_game_mode_check;
alter table public.rooms add constraint rooms_game_mode_check check (game_mode in ('same_page','ask_me_anything','would_you_rather','most_likely_to','this_or_that','truth_or_dare','deep_dive','mix_it_up'));
alter table public.questions drop constraint if exists questions_mode_check;
alter table public.questions add constraint questions_mode_check check (mode in ('same_page','would_you_rather','most_likely_to','this_or_that','truth_or_dare','deep_dive'));

create or replace function public.configure_game(p_code text,p_mode text,p_total_rounds int) returns public.rooms language plpgsql security definer set search_path=public as $$ declare r public.rooms; begin
 select * into r from public.rooms where code=upper(p_code); if not found then raise exception 'no_room' using message='That room does not exist.'; end if;
 if r.host_id<>auth.uid() then raise exception 'not_host' using message='Only the game creator can change these settings.'; end if;
 if r.status<>'lobby' then raise exception 'game_started' using message='Game settings are locked once the game starts.'; end if;
 if p_mode not in ('same_page','ask_me_anything','would_you_rather','most_likely_to','this_or_that','truth_or_dare','deep_dive','mix_it_up') then raise exception 'invalid_mode' using message='That game mode is not available.'; end if;
 if p_total_rounds not in (5,10,15,20) then raise exception 'invalid_rounds' using message='Choose 5, 10, 15, or 20 rounds.'; end if;
 update public.rooms set game_mode=p_mode,total_rounds=p_total_rounds where code=r.code returning * into r; return r;
end $$;

create or replace function public.draw_question(p_code text,p_idx int) returns public.questions language plpgsql security definer set search_path=public as $$ declare q public.questions; want_mode text; want_tier text; begin
 select game_mode into want_mode from public.rooms where code=upper(p_code);
 if want_mode='mix_it_up' then select m into want_mode from unnest(array['same_page','would_you_rather','most_likely_to','this_or_that','truth_or_dare','deep_dive']) m order by random() limit 1; end if;
 want_tier:=case when p_idx<5 then 'opening' else 'deep' end;
 select * into q from public.questions where mode=want_mode and tier=want_tier and not exists(select 1 from public.rounds where room_code=upper(p_code) and question_id=public.questions.id) order by random() limit 1;
 if not found then select * into q from public.questions where mode=want_mode and not exists(select 1 from public.rounds where room_code=upper(p_code) and question_id=public.questions.id) order by random() limit 1; end if;
 if not found then raise exception 'out_of_questions' using message='There are not enough questions for this mode.'; end if; return q;
end $$;

create or replace function public.open_round(p_code text,p_idx int) returns public.rounds language plpgsql security definer set search_path=public as $$ declare r public.rounds; q public.questions; selected_mode text; begin
 select * into r from public.rounds where room_code=upper(p_code) and idx=p_idx; if found then return r; end if;
 select game_mode into selected_mode from public.rooms where code=upper(p_code);
 if selected_mode='ask_me_anything' then insert into public.rounds(room_code,idx,prompt,kind,mode,question_count) values(upper(p_code),p_idx,'Ask them anything.','ask_me_anything','ask_me_anything',0) on conflict(room_code,idx) do nothing returning * into r;
 else q:=public.draw_question(p_code,p_idx); insert into public.rounds(room_code,idx,question_id,prompt,kind,options,mode) values(upper(p_code),p_idx,q.id,q.prompt,q.kind,q.options,q.mode) on conflict(room_code,idx) do nothing returning * into r; end if;
 if r.id is null then select * into r from public.rounds where room_code=upper(p_code) and idx=p_idx; end if; update public.rooms set status='playing',current_round=p_idx where code=upper(p_code); return r;
end $$;

create table if not exists public.custom_questions (id uuid primary key default gen_random_uuid(),round_id uuid not null references public.rounds(id) on delete cascade,player_id uuid not null,question text not null check(char_length(trim(question)) between 3 and 300),created_at timestamptz not null default now(),unique(round_id,player_id));
alter table public.custom_questions enable row level security; revoke all on public.custom_questions from anon,authenticated;

create or replace function public.submit_custom_question(p_code text,p_idx int,p_player uuid,p_value text) returns void language plpgsql security definer set search_path=public as $$ declare rid uuid; host uuid; guest uuid; clean text; begin
 clean:=trim(p_value); if char_length(clean)<3 or char_length(clean)>300 then raise exception 'invalid_question' using message='Write a question between 3 and 300 characters.'; end if;
 select id into rid from public.rounds where room_code=upper(p_code) and idx=p_idx and mode='ask_me_anything'; if rid is null then raise exception 'wrong_mode' using message='This round is not Ask Me Anything.'; end if;
 select host_id,guest_id into host,guest from public.rooms where code=upper(p_code); if p_player<>auth.uid() or (p_player<>host and p_player<>guest) then raise exception 'not_member' using message='You are not in this game.'; end if;
 insert into public.custom_questions(round_id,player_id,question) values(rid,p_player,clean) on conflict(round_id,player_id) do update set question=excluded.question;
 update public.rounds set question_count=(select count(*) from public.custom_questions where round_id=rid) where id=rid;
end $$;

create or replace function public.get_custom_question(p_code text,p_idx int,p_player uuid) returns text language plpgsql security definer set search_path=public as $$ declare rid uuid; partner uuid; q text; n int; begin
 if p_player<>auth.uid() then raise exception 'not_player' using message='That player session is not yours.'; end if;
 select id into rid from public.rounds where room_code=upper(p_code) and idx=p_idx and mode='ask_me_anything'; if rid is null then return null; end if;
 select case when host_id=p_player then guest_id when guest_id=p_player then host_id end into partner from public.rooms where code=upper(p_code); select count(*) into n from public.custom_questions where round_id=rid; if n<2 then return null; end if;
 select question into q from public.custom_questions where round_id=rid and player_id=partner; return q;
end $$;

drop function if exists public.reset_game(text);
create function public.reset_game(p_code text) returns public.rooms language plpgsql security definer set search_path=public as $$ declare r public.rooms; begin
 select * into r from public.rooms where code=upper(p_code); if not found then raise exception 'no_room' using message='That room does not exist.'; end if; if r.host_id<>auth.uid() then raise exception 'not_host' using message='Only the game creator can restart this game.'; end if;
 delete from public.rounds where room_code=r.code; update public.rooms set status='lobby',current_round=0 where code=r.code returning * into r; return r;
end $$;

grant execute on function public.configure_game(text,text,int),public.submit_custom_question(text,int,uuid,text),public.get_custom_question(text,int,uuid) to authenticated;

-- Mode-specific question rows are seeded in production with Nigerian-context prompts.
