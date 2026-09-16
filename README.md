# Same Page

Two people, one question, answers hidden until both are in.

## Running it

```bash
npm install
cp .env.example .env   # fill in the Supabase values
npm run dev
```

## Database

Apply `supabase/migrations/20260916120000_init.sql` to your Supabase project, either
with `supabase db push` or by pasting it into the SQL editor.

Answers are never readable from the browser. The `answers` table has no select grant
for `anon`, and the only way an answer leaves the database is `get_reveal`, which
refuses until both players have submitted. `rooms` and `rounds` are readable so the
client can subscribe to realtime changes, but they carry only the question, how many
answers are in, and whether the round has flipped.

## Status

- [x] Schema and RPCs
- [x] Design tokens, landing, lobby
- [ ] Supabase wiring for create and join
- [ ] Round loop with realtime sync
- [ ] Reactions and scoring
- [ ] Summary screen
- [ ] AI questions for rounds 6 and up
