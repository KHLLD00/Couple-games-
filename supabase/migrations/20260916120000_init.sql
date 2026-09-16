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
  update rounds set answer_count = answer_count where id = r.id;
end $$;

-- Free text rounds score on agreement: both people have to call it a match.
-- Nudges rounds on every verdict so the partner's realtime subscription fires
-- as soon as either person has weighed in.
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

-- Original question bank
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

-- 100 Nigerian-context questions. Kept in the migration so a fresh database
-- gets the same 118-question bank as the current production database.
insert into questions (prompt, kind, options, tier) values
  ('If we had ₦20,000 for dinner, what would I choose?', 'text', null, 'opening'),
  ('Which Nigerian food could I eat three days in a row?', 'text', null, 'opening'),
  ('Who is more likely to finish the last piece of chicken without asking?', 'text', null, 'opening'),
  ('If we were at a buka, what would I order?', 'text', null, 'opening'),
  ('Who would complain first if NEPA took the light during a movie?', 'text', null, 'opening'),
  ('What small thing do I do that secretly makes you happy?', 'text', null, 'opening'),
  ('If I do not reply for three hours, what is the most likely reason?', 'text', null, 'opening'),
  ('Who is more likely to say “I am not angry” while clearly being angry?', 'text', null, 'opening'),
  ('Who would make the first move after an argument?', 'text', null, 'opening'),
  ('Who would take longer to get ready for an outing?', 'text', null, 'opening'),
  ('Who would enjoy an owambe more?', 'text', null, 'opening'),
  ('Who would be more likely to suggest staying home after we already dressed up?', 'text', null, 'opening'),
  ('Who would survive longer at a Nigerian family gathering?', 'text', null, 'opening'),
  ('If we ordered suya, who would secretly eat more than their share?', 'text', null, 'opening'),
  ('Who would be more likely to spend ₦5,000 on snacks without thinking twice?', 'text', null, 'opening'),
  ('If we had a free Saturday, what would I rather do?', 'text', null, 'opening'),
  ('Who is more likely to call instead of text?', 'text', null, 'opening'),
  ('Who would notice first if I changed my hairstyle?', 'text', null, 'opening'),
  ('Who is more likely to be late because of traffic?', 'text', null, 'opening'),
  ('If we went on a road trip, who would control the music?', 'text', null, 'opening'),
  ('What would I say if my parents asked what I like most about you?', 'text', null, 'deep'),
  ('What part of Nigerian dating culture do you think I find most stressful?', 'text', null, 'deep'),
  ('If our families disagreed about our wedding plans, what would I want us to do?', 'text', null, 'deep'),
  ('How important do you think family approval would be to me before marriage?', 'text', null, 'deep'),
  ('What kind of introduction ceremony would I actually want?', 'text', null, 'deep'),
  ('Would I prefer a huge Nigerian wedding or a smaller celebration?', 'text', null, 'deep'),
  ('What would I consider a reasonable amount to spend on a wedding?', 'text', null, 'deep'),
  ('If we had to choose between buying a car and saving for a house, which would I pick?', 'text', null, 'deep'),
  ('If we suddenly received ₦1 million, what would I want to do with it first?', 'text', null, 'deep'),
  ('Would I rather save extra money or use it for a memorable experience?', 'text', null, 'deep'),
  ('What money habit of mine would probably annoy you?', 'text', null, 'deep'),
  ('Would I expect us to tell each other exactly how much we earn?', 'text', null, 'deep'),
  ('If one of us lost a job, what would I expect from the other person?', 'text', null, 'deep'),
  ('Would I rather split bills equally or contribute based on income?', 'text', null, 'deep'),
  ('What financial goal would I want us to work toward first?', 'text', null, 'deep'),
  ('Would I be comfortable lending money to family from our shared savings?', 'text', null, 'deep'),
  ('How much personal space do I think a relationship should have?', 'text', null, 'deep'),
  ('What would make me feel most appreciated in a relationship?', 'text', null, 'deep'),
  ('What is one thing I would never want us to argue about in public?', 'text', null, 'deep'),
  ('Would I rather solve an argument immediately or take time to cool down?', 'text', null, 'deep'),
  ('How do you think I prefer to receive an apology?', 'text', null, 'deep'),
  ('What kind of disagreement would be hardest for me to let go of?', 'text', null, 'deep'),
  ('Would I tell you immediately if something you did hurt me?', 'text', null, 'deep'),
  ('What would I consider crossing a line in a relationship?', 'text', null, 'deep'),
  ('How much privacy do I think partners should have with their phones?', 'text', null, 'deep'),
  ('Would I be comfortable with my partner having close friends of the opposite sex?', 'text', null, 'deep'),
  ('What would make me feel jealous even if I tried not to show it?', 'text', null, 'deep'),
  ('Would I rather receive a thoughtful ₦2,000 gift or an expensive gift with little thought behind it?', 'text', null, 'deep'),
  ('What kind of date would feel most romantic to me?', 'text', null, 'deep'),
  ('If money was tight, what simple date would I still enjoy?', 'text', null, 'deep'),
  ('Would I rather spend a weekend at home together or travel somewhere new?', 'text', null, 'deep'),
  ('What Nigerian city would I most want us to visit together?', 'text', null, 'deep'),
  ('Would I rather live in Abuja, Lagos, or somewhere quieter?', 'text', null, 'deep'),
  ('How important would living close to our families be to me?', 'text', null, 'deep'),
  ('Would I be willing to relocate for my partner’s career?', 'text', null, 'deep'),
  ('Would I rather build our life slowly or chase a more ambitious lifestyle?', 'text', null, 'deep'),
  ('How important would owning a home be to me before marriage?', 'text', null, 'deep'),
  ('Would I prefer to have children early or wait until we feel financially ready?', 'text', null, 'deep'),
  ('How many children do you think I would ideally want?', 'text', null, 'deep'),
  ('Who do you think I would want to name our first child after?', 'text', null, 'deep'),
  ('Would I want our children raised with strong Nigerian traditions?', 'text', null, 'deep'),
  ('Which Nigerian tradition would I most want to pass on?', 'text', null, 'deep'),
  ('Would I want our children to speak our local languages?', 'text', null, 'deep'),
  ('How involved do you think I would want our parents to be in raising our children?', 'text', null, 'deep'),
  ('Would I rather spend Christmas with my family or yours?', 'text', null, 'deep'),
  ('Who would I want to visit first during a festive holiday?', 'text', null, 'deep'),
  ('Would I rather attend church or mosque together every week or keep our practice more private?', 'text', null, 'deep'),
  ('How important would religion be in our future family?', 'text', null, 'deep'),
  ('Would I expect my partner to participate in family events even when they do not feel like going?', 'text', null, 'deep'),
  ('What would I do if a relative made my partner uncomfortable?', 'text', null, 'deep'),
  ('Would I defend my partner publicly even if I disagreed with them privately?', 'text', null, 'deep'),
  ('What would I want my partner to do when my family crosses a boundary?', 'text', null, 'deep'),
  ('How would I want us to handle pressure from relatives about marriage?', 'text', null, 'deep'),
  ('Would I rather keep our relationship private or share it openly with friends and family?', 'text', null, 'deep'),
  ('Who would probably know about our relationship first?', 'text', null, 'deep'),
  ('What would I post about our relationship online, if anything?', 'text', null, 'deep'),
  ('Would I want matching outfits for an occasion?', 'text', null, 'deep'),
  ('Would I enjoy taking couple pictures at an owambe?', 'text', null, 'deep'),
  ('Would I rather spend money on a nice restaurant or a home-cooked meal?', 'text', null, 'deep'),
  ('Which Nigerian snack would I most likely buy on a random outing?', 'text', null, 'deep'),
  ('If we were travelling by road, who would complain about the journey first?', 'text', null, 'deep'),
  ('Who would be more likely to say “we are almost there” when we clearly are not?', 'text', null, 'deep'),
  ('Who would handle a flat tyre better?', 'text', null, 'deep'),
  ('If our generator ran out of fuel during a movie, what would I do first?', 'text', null, 'deep'),
  ('Who would be more likely to argue with a danfo driver?', 'text', null, 'deep'),
  ('Who would be more likely to bargain aggressively at a market?', 'text', null, 'deep'),
  ('Would I rather shop at a mall or a local market?', 'text', null, 'deep'),
  ('Who would be more likely to spend an afternoon at a Nigerian beach?', 'text', null, 'deep'),
  ('If we had one free day in Lagos, what would I want us to do?', 'text', null, 'deep'),
  ('If we had one free day in Abuja, what would I want us to do?', 'text', null, 'deep'),
  ('Would I rather have suya, shawarma, or pizza for a late-night meal?', 'text', null, 'deep'),
  ('Which Nigerian drink would I choose at a casual hangout?', 'text', null, 'deep'),
  ('Who would be more likely to order extra meat?', 'text', null, 'deep'),
  ('Would I rather cook together or order food?', 'text', null, 'deep'),
  ('Who would be more likely to leave dishes until later?', 'text', null, 'deep'),
  ('Would I care if my partner could not cook Nigerian food?', 'text', null, 'deep'),
  ('Who would be more likely to wake up early on a Saturday?', 'text', null, 'deep'),
  ('Would I rather spend a rainy day indoors or go out anyway?', 'text', null, 'deep'),
  ('What is one everyday habit of mine you think would become very obvious if we lived together?', 'text', null, 'deep'),
  ('Who would be more likely to control the TV remote?', 'text', null, 'deep');
