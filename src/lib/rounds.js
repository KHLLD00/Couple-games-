import { supabase } from './supabase.js'

export async function openRound(code, idx) {
  const { data, error } = await supabase.rpc('open_round', { p_code: code, p_idx: idx })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchRound(code, idx) {
  const { data, error } = await supabase
    .from('rounds')
    .select('*')
    .eq('room_code', code)
    .eq('idx', idx)
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data
}

export async function submitAnswer(code, idx, playerId, value) {
  const cleanValue = String(value ?? '').trim()
  if (!cleanValue) throw new Error('Please enter an answer.')
  const { error } = await supabase.rpc('submit_answer', {
    p_code: code,
    p_idx: idx,
    p_player: playerId,
    p_value: cleanValue
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

export function subscribeRounds(code, cb) {
  const channel = supabase
    .channel(`rounds:${code}`)
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rounds', filter: `room_code=eq.${code}` },
      (payload) => {
        if (payload.eventType !== 'DELETE') cb(payload.new)
      }
    )
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') {
        console.error(`Realtime subscription failed for room ${code}`)
      }
    })

  return () => supabase.removeChannel(channel)
}
