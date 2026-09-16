import { supabase } from './supabase.js'

// The SQL functions raise with a human-readable message already
// (see create_room / join_room in the migration), so on failure
// we just surface error.message as-is rather than re-mapping codes.

export async function createRoom(playerId) {
  const { data, error } = await supabase.rpc('create_room', { p_player: playerId })
  if (error) throw new Error(error.message)
  return data
}

export async function joinRoom(code, playerId) {
  const { data, error } = await supabase.rpc('join_room', {
    p_code: code,
    p_player: playerId
  })
  if (error) throw new Error(error.message)
  return data
}

export async function fetchRoom(code) {
  const { data, error } = await supabase.from('rooms').select('*').eq('code', code).single()
  if (error) throw new Error(error.message)
  return data
}

// Fires cb with the fresh room row on every change. Returns an unsubscribe fn.
export function subscribeRoom(code, cb) {
  const channel = supabase
    .channel(`room:${code}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${code}` },
      (payload) => cb(payload.new)
    )
    .subscribe()

  return () => supabase.removeChannel(channel)
}
