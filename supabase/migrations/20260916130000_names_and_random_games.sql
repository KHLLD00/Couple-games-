-- Same Page: player names, shareable invite links, and fully random 10-question games.

alter table rooms
  add column if not exists host_name text,
  add column if not exists guest_name text;

create or replace function create_room(p_player uuid, p_name text)
returns rooms language plpgsql security definer set search_path = public as $$
declare r rooms; clean_name text;
begin
  clean_name := trim(p_name);
  if clean_name is null or char_length(clean_name) < 1 or char_length(clean_name) > 24 then
    raise exception 'invalid_name' using message = 'Enter a name between 1 and 24 characters.';
  end if;
  insert into rooms (code, host_id, host_name)
  values (gen_room_code(), p_player, clean_name)
  returning * into r;
  return r;
end $$;

create or replace function join_room(p_code text, p_player uuid, p_name text)
returns rooms language plpgsql security definer set search_path = public as $$
declare r rooms; clean_name text;
begin
  clean_name := trim(p_name);
  if clean_name is null or char_length(clean_name) < 1 or char_length(clean_name) > 24 then
    raise exception 'invalid_name' using message = 'Enter a name between 1 and 24 characters.';
  end if;

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
  update rooms set guest_id = p_player, guest_name = clean_name where code = r.code returning * into r;
  return r;
end $$;

-- Every round is drawn from the complete bank. The room's rounds table locks
-- the random selection so both players see the same questions in the same order.
create or replace function draw_question(p_code text, p_idx int)
returns questions language plpgsql security definer set search_path = public as $$
declare q questions;
begin
  select * into q from questions
   where not exists (select 1 from rounds where room_code = p_code and question_id = questions.id)
   order by random() limit 1;
  if not found then
    raise exception 'out_of_questions' using message = 'The question bank is empty.';
  end if;
  return q;
end $$;
