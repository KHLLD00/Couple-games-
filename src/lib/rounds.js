import { supabase } from './supabase.js'

export async function openRound(code, idx) {
  const { data, error } = await supabase.rpc('open_round', { p_code: code, p_idx: idx })
  if (error) throw new Error(error.message)
  return data
}

export async function submitAnswer(code, idx, playerId, value) {
  const { error } = await supabase.rpc('submit_answer', {
    p_code: code,
    p_idx: idx,
    p_player: playerId,
    p_value: value
  })
  if (error) throw new Error(error.message)
}

export async function getReveal(code, idx) {
  const { data, error } = await supabase.rpc('get_reveal', { p_code: code, p_idx: idx })
  if (error) throw new Error(error.message)
  return data
}

export async function setVerdict(code, idx, playerId, verdict) {
  const { error } = await supabase.rpc('set_verdict', {
    p_code: code,
    p_idx: idx,
    p_player: playerId,
    p_verdict: verdict
  })
  if (error) throw new Error(error.message)
}

export async function finishGame(code) {
  const { error } = await supabase.rpc('finish_game', { p_code: code })
  if (error) throw new Error(error.message)
}

// One subscription covers every round in the room — Play filters by idx itself,
// since realtime's postgres_changes filter can only match one column at a time.
export function subscribeRounds(code, cb) {
  const channel = supabase
    .channel(`rounds:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rounds', filter: `room_code=eq.${code}` },
      (payload) => cb(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
