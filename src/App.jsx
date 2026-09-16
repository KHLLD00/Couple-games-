import { useState } from 'react'
import Landing from './screens/Landing.jsx'
import Lobby from './screens/Lobby.jsx'
import { playerId } from './lib/player.js'
import { createRoom, joinRoom } from './lib/rooms.js'

export default function App() {
  const me = playerId()
  const [room, setRoom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

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

  if (!room) {
    return <Landing onCreate={handleCreate} onJoin={handleJoin} busy={busy} error={error} />
  }

  return (
    <Lobby
      room={room}
      isHost={room.host_id === me}
      onRoomUpdate={setRoom}
      onStart={() => {}}
    />
  )
}
