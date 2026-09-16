-- Same Page: two-player rooms, hidden answers, simultaneous reveal.
-- Players are anonymous. Each device generates a uuid and keeps it in localStorage.
-- The answers table is never readable from the client; everything goes through RPCs.

create extension if not exists pgcrypto;

create table questions (
  id          uuid primary key default gen_random_uuid(),
  prompt      text not null,
  kind        text not null check (kind in ('choice', 'text')),
  options     jsonb,
  tier        text not null default 'opening' check (tier in ('opening', 'deep')),
  source      text not null default 'bank' check (source in ('bank', 'ai')),
  created_at  timestamptz not null default now(),
  constraint choice_needs_options check (kind <> 'choice' or jsonb_array_length(options) between 2 and 4)
);

create table rooms (
  code          text primary key,
  host_id       uuid not null,
  guest_id      uuid,
  status        text not null default 'lobby' check (status in ('lobby', 'playing', 'finished')),
  current_round int  not null default 0,
  total_rounds  int  not null default 10,
  created_at    timestamptz not null default now()
);

create table rounds (
  id           uuid primary key default gen_random_uuid(),
  room_code    text not null references rooms(code) on delete cascade,
  idx          int  not null,
  question_id  uuid references questions(id),
  prompt       text not null,
  kind         text not null,
  options      jsonb,
  answer_count int  not null default 0,
  revealed     boolean not null default false,
  matched      boolean,
  unique (room_code, idx)
);

create table answers (
  id         uuid primary key default gen_random_uuid(),
  round_id   uuid not null references rounds(id) on delete cascade,
  player_id  uuid not null,
  value      text not null,
  reaction   text,
  verdict    boolean,
  created_at timestamptz not null default now(),
  unique (round_id, player_id)
);

create index rounds_room_idx on rounds(room_code, idx);
create index answers_round_idx on answers(round_id);

-- Rooms and rounds are readable so clients can subscribe to realtime changes.
-- They carry no answer content: only how many answers are in and whether the
-- round has flipped. Answers themselves are unreachable without an RPC.

alter table rooms     enable row level security;
alter table rounds    enable row level security;
alter table answers   enable row level security;
alter table questions enable row level security;

create policy rooms_read  on rooms  for select using (true);
create policy rounds_read on rounds for select using (true);

revoke all on answers   from anon, authenticated;
revoke all on questions from anon, authenticated;
revoke insert, update, delete on rooms, rounds from anon, authenticated;

alter publication supabase_realtime add table rooms;
alter publication supabase_realtime add table rounds;

-- 6 characters, no vowels and no lookalikes, because couples read these aloud.
create or replace function gen_room_code() returns text
language plpgsql as $$
declare
  alphabet text := '23456789BCDFGHJKLMNPQRSTVWXYZ';
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, 1 + floor(random() * length(alphabet))::int, 1);
    end loop;
    exit when not exists (select 1 from rooms where rooms.code = code);
  end loop;
  return code;
end $$;

create or replace function create_room(p_player uuid)
returns rooms language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  insert into rooms (code, host_id) values (gen_room_code(), p_player) returning * into r;
  return r;
end $$;

create or replace function join_room(p_code text, p_player uuid)
returns rooms language plpgsql security definer set search_path = public as $$
declare r rooms;
begin
  select * into r from rooms where code = upper(p_code);
  if not found then
    raise exception 'no_room' using message = 'That code has no room.';
  end if;
  if r.host_id = p_player or r.guest_id = p_player then
    return r;
  end if;
  if r.guest_id is not null then
    raise exception 'room_full' using message = 'Two people are already in this room.';
  end if;
  update rooms set guest_id = p_player where code = r.code returning * into r;
  return r;
end $$;

-- Draws a question the room has not seen. Opening tier for the first half,
-- deep tier after that, falling back to the other tier if one runs dry.
create or replace function draw_question(p_code text, p_idx int)
returns questions language plpgsql security definer set search_path = public as $$
declare q questions; want text;
begin
  want := case when p_idx < 5 then 'opening' else 'deep' end;
  select * into q from questions
   where tier = want
     and not exists (select 1 from rounds where room_code = p_code and question_id = questions.id)
   order by random() limit 1;
  if not found then
    select * into q from questions
     where not exists (select 1 from rounds where room_code = p_code and question_id = questions.id)
     order by random() limit 1;
  end if;
  if not found then
    raise exception 'out_of_questions' using message = 'The question bank is empty.';
  end if;
  return q;
end $$;

-- Safe to call from both devices at once: the unique index settles the race.
create or replace function open_round(p_code text, p_idx int)
returns rounds language plpgsql security definer set search_path = public as $$
declare r rounds; q questions;
begin
  select * into r from rounds where room_code = p_code and idx = p_idx;
  if found then return r; end if;

  q := draw_question(p_code, p_idx);
  insert into rounds (room_code, idx, question_id, prompt, kind, options)
  values (p_code, p_idx, q.id, q.prompt, q.kind, q.options)
  on conflict (room_code, idx) do nothing
  returning * into r;

  if r.id is null then
    select * into r from rounds where room_code = p_code and idx = p_idx;
  end if;

  update rooms set status = 'playing', current_round = p_idx where code = p_code;
  return r;
end $$;

create or replace function submit_answer(p_code text, p_idx int, p_player uuid, p_value text)
returns void language plpgsql security definer set search_path = public as $$
declare r rounds; n int;
begin
  select * into r from rounds where room_code = p_code and idx = p_idx;
  if not found then
    raise exception 'no_round' using message = 'That round is not open yet.';
  end if;
  if r.revealed then return; end if;

  insert into answers (round_id, player_id, value)
  values (r.id, p_player, p_value)
  on conflict (round_id, player_id) do nothing;

  select count(*) into n from answers where round_id = r.id;

  update rounds set
    answer_count = n,
    revealed = (n >= 2),
    matched = case
      when n >= 2 and r.kind = 'choice'
      then (select count(distinct value) = 1 from answers where round_id = r.id)
      else matched end
  where id = r.id;
end $$;

-- The only way answers leave the database, and only once both are in.
create or replace function get_reveal(p_code text, p_idx int)
returns table (player_id uuid, value text, reaction text, verdict boolean)
language plpgsql security definer set search_path = public as $$
declare r rounds;
begin
  select * into r from rounds where room_code = p_code and idx = p_idx;
  if not found or not r.revealed then
    raise exception 'not_revealed' using message = 'Both answers are not in yet.';
  end if;
  return query
    select a.player_id, a.value, a.reaction, a.verdict
      from answers a where a.round_id = r.id;
end $$;

create or replace function set_reaction(p_code text, p_idx int, p_player uuid, p_reaction text)
returns void language plpgsql security definer set search_path = public as $$
declare r rounds;
begin
  select * into r from rounds where room_code = p_code and idx = p_idx;
  if not found or not r.revealed then return; end if;
  update answers set reaction = p_reaction where round_id = r.id and player_id = p_player;
  update rounds set answer_count = answer_count where id = r.id; -- nudge realtime
end $$;

-- Free text rounds score on agreement: both people have to call it a match.
-- Nudges rounds on every verdict (not just the second one) so the partner's
-- realtime subscription fires as soon as either person has weighed in.
create or replace function set_verdict(p_code text, p_idx int, p_player uuid, p_verdict boolean)
returns void language plpgsql security definer set search_path = public as $$
declare r rounds;
begin
  select * into r from rounds where room_code = p_code and idx = p_idx;
  if not found or not r.revealed or r.kind <> 'text' then return; end if;

  update answers set verdict = p_verdict where round_id = r.id and player_id = p_player;

  update rounds set
    answer_count = answer_count,
    matched = case
      when (select count(*) filter (where verdict is not null) from answers where round_id = r.id) = 2
      then (select count(*) filter (where verdict is true) = 2 from answers where round_id = r.id)
      else matched
    end
  where id = r.id;
end $$;

create or replace function finish_game(p_code text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update rooms set status = 'finished' where code = p_code;
end $$;

create or replace function game_summary(p_code text)
returns table (idx int, prompt text, kind text, matched boolean)
language sql security definer set search_path = public as $$
  select r.idx, r.prompt, r.kind, r.matched
    from rounds r where r.room_code = p_code order by r.idx;
$$;

-- AI rounds are written by the serverless function, never by a browser.
create or replace function add_ai_question(p_prompt text, p_kind text, p_options jsonb)
returns questions language plpgsql security definer set search_path = public as $$
declare q questions;
begin
  insert into questions (prompt, kind, options, tier, source)
  values (p_prompt, p_kind, p_options, 'deep', 'ai')
  returning * into q;
  return q;
end $$;

revoke execute on function add_ai_question(text, text, jsonb) from anon, authenticated;

grant execute on function
  create_room(uuid), join_room(text, uuid), open_round(text, int),
  submit_answer(text, int, uuid, text), get_reveal(text, int),
  set_reaction(text, int, uuid, text), set_verdict(text, int, uuid, boolean),
  finish_game(text), game_summary(text)
to anon, authenticated;

insert into questions (prompt, kind, options, tier) values
  ('Who is more likely to fall asleep first tonight?', 'choice', '["Me", "You", "Dead heat", "Depends who had jollof"]', 'opening'),
  ('How do you take your tea?', 'choice', '["Sweet enough to stand a spoon in", "A little sugar", "No sugar", "I do not drink tea"]', 'opening'),
  ('Ideal Saturday together?', 'choice', '["Out all day", "Nowhere, all day", "Brunch then home", "One errand, one treat"]', 'opening'),
  ('Who apologises first after a small argument?', 'choice', '["Me", "You", "Neither, it just passes", "Whoever is hungrier"]', 'opening'),
  ('Pick the sound that means home.', 'choice', '["Rain on the roof", "A kitchen in use", "Someone humming", "Traffic outside"]', 'opening'),
  ('What is your shared comfort meal?', 'text', null, 'opening'),
  ('Name a song that belongs to the two of you.', 'text', null, 'opening'),
  ('Where were we the first time you thought this might last?', 'text', null, 'opening'),
  ('What do you always argue about in the car?', 'text', null, 'opening'),
  ('Describe the other person in three words.', 'text', null, 'opening'),
  ('Money turns up unexpectedly. First move?', 'choice', '["Save it", "Book the trip", "Fix something overdue", "Spend it on each other"]', 'deep'),
  ('Which is harder for you to say out loud?', 'choice', '["I was wrong", "I need help", "I am scared", "I love you"]', 'deep'),
  ('Five years out, where are we living?', 'text', null, 'deep'),
  ('What is one thing you have never told the other person?', 'text', null, 'deep'),
  ('What do you need more of from this relationship?', 'text', null, 'deep'),
  ('What does the other person do that quietly fixes a bad day?', 'text', null, 'deep'),
  ('When you picture us old, what are we doing?', 'text', null, 'deep'),
  ('Who carries more of the invisible work right now?', 'choice', '["Me", "You", "Evenly split", "Neither of us, honestly"]', 'deep');
