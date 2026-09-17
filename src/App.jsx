import { useEffect, useState } from 'react'
import Landing from './screens/Landing.jsx'
import Lobby from './screens/Lobby.jsx'
import GameSetup from './screens/GameSetup.jsx'
import Play from './screens/Play.jsx'
import { supabase } from './lib/supabase.js'
import { createRoom, joinRoom, subscribeRoom, configureGame, resetGame } from './lib/rooms.js'
import { openRound } from './lib/rounds.js'

export default function App() {
  const [me, setMe] = useState(null)
  const [room, setRoom] = useState(null)
  const [setup, setSetup] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const inviteCode = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/i)?.[1]?.toUpperCase() || ''

  useEffect(() => {
    let active = true
    async function initialisePlayer() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let user = session?.user
        if (!user) { const { data, error: authError } = await supabase.auth.signInAnonymously(); if (authError) throw authError; user = data.user }
        if (!user) throw new Error('Could not create a player session.')
        if (active) setMe(user.id)
      } catch (e) { if (active) setError(e.message || 'Could not create a player session.') }
      finally { if (active) setBusy(false) }
    }
    initialisePlayer(); return () => { active = false }
  }, [])

  useEffect(() => { if (!room) return; return subscribeRoom(room.code, setRoom) }, [room?.code])

  async function handleCreate(name) { setBusy(true); setError(''); try { setRoom(await createRoom(me, name)); setSetup(true) } catch (e) { setError(e.message || 'Could not create the room.') } finally { setBusy(false) } }
  async function handleJoin(code, name) { setBusy(true); setError(''); try { setRoom(await joinRoom(code, me, name)); window.history.replaceState({}, '', '/') } catch (e) { setError(e.message || 'Could not join the room.') } finally { setBusy(false) } }
  async function handleConfigure(mode, rounds) { setBusy(true); setError(''); try { setRoom(await configureGame(room.code, mode, rounds)); setSetup(false) } catch (e) { setError(e.message || 'Could not save game settings.') } finally { setBusy(false) } }
  async function handleStart() { setBusy(true); setError(''); try { await openRound(room.code, 0) } catch (e) { setError(e.message || 'Could not start the game.') } finally { setBusy(false) } }
  async function handlePlayAgain() { setBusy(true); setError(''); try { setRoom(await resetGame(room.code)); setSetup(true) } catch (e) { setError(e.message || 'Could not start another game.') } finally { setBusy(false) } }
  function handleExit() { setRoom(null); setSetup(false); setError(''); if (window.location.pathname !== '/') window.history.replaceState({}, '', '/') }

  if (busy && !me) return <div className="flex min-h-dvh items-center justify-center px-5"><p className="seam-label">Starting your session</p></div>
  if (!me) return <div className="flex min-h-dvh items-center justify-center px-5"><p className="text-center text-cherry">{error || 'Could not start the game.'}</p></div>
  if (!room) return <Landing onCreate={handleCreate} onJoin={handleJoin} busy={busy} error={error} initialCode={inviteCode} />
  if (room.status === 'lobby' && setup && room.host_id === me) return <GameSetup room={room} onSave={handleConfigure} busy={busy} />
  if (room.status === 'lobby') return <Lobby room={room} isHost={room.host_id === me} onStart={handleStart} onExit={handleExit} busy={busy} />
  return <Play room={room} me={me} onExit={handleExit} onPlayAgain={handlePlayAgain} />
}
