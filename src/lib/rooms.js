import { supabase } from './supabase.js'

const CODE_PATTERN = /^[2-9BCDFGHJKLMNPQRSTVWXYZ]{6}$/i

function assertRoom(room) {
  if (!room?.code) throw new Error('Supabase did not return a valid room.')
  return room
}

function normaliseCode(code) {
  const clean = String(code ?? '').trim().toUpperCase()
  if (!CODE_PATTERN.test(clean)) throw new Error('Enter a valid 6-character room code.')
  return clean
}

export async function createRoom(playerId, name) {
  if (!playerId) throw new Error('Could not identify this player. Refresh and try again.')
  const cleanName = String(name ?? '').trim()
  if (!cleanName) throw new Error('Enter your name first.')
  const { data, error } = await supabase.rpc('create_room', { p_player: playerId, p_name: cleanName })
  if (error) throw new Error(error.message || 'Could not create the room.')
  return assertRoom(data)
}

export async function joinRoom(code, playerId, name) {
  if (!playerId) throw new Error('Could not identify this player. Refresh and try again.')
  const cleanCode = normaliseCode(code)
  const cleanName = String(name ?? '').trim()
  if (!cleanName) throw new Error('Enter your name first.')
  const { data, error } = await supabase.rpc('join_room', { p_code: cleanCode, p_player: playerId, p_name: cleanName })
  if (error) throw new Error(error.message || 'Could not join the room.')
  return assertRoom(data)
}

export async function fetchRoom(code) {
  const cleanCode = normaliseCode(code)
  const { data, error } = await supabase.from('rooms').select('*').eq('code', cleanCode).single()
  if (error) throw new Error(error.message)
  return assertRoom(data)
}

export function subscribeRoom(code, cb) {
  const cleanCode = normaliseCode(code)
  const channel = supabase.channel(`room:${cleanCode}`)
    .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'rooms', filter: `code=eq.${cleanCode}` }, (payload) => cb(payload.new))
    .subscribe((status) => {
      if (status === 'CHANNEL_ERROR') console.error('Room realtime subscription failed.')
    })
  return () => supabase.removeChannel(channel)
}
