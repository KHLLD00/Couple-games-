import { useEffect, useState } from 'react'
import Landing from './screens/Landing.jsx'
import Lobby from './screens/Lobby.jsx'
import Play from './screens/Play.jsx'
import { playerId } from './lib/player.js'
import { createRoom, joinRoom, subscribeRoom } from './lib/rooms.js'
import { openRound } from './lib/rounds.js'

export default function App() {
  const me = playerId()
  const [room, setRoom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // One subscription for the life of the room, shared by Lobby and Play —
  // this is how a "Next round" tap on one phone advances the other.
  useEffect(() => {
    if (!room) return
    return subscribeRoom(room.code, setRoom)
  }, [room?.code])

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      setRoom(await createRoom(me))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin(code) {
    setBusy(true)
    setError('')
    try {
      setRoom(await joinRoom(code, me))
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    setBusy(true)
    setError('')
    try {
      // Opening round 0 flips rooms.status to 'playing' for both devices.
      await openRound(room.code, 0)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!room) {
    return <Landing onCreate={handleCreate} onJoin={handleJoin} busy={busy} error={error} />
  }

  if (room.status === 'lobby') {
    return (
      <Lobby room={room} isHost={room.host_id === me} onStart={handleStart} busy={busy} />
    )
  }

  return <Play room={room} me={me} />
}
