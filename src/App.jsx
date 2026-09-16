import { useEffect, useState } from 'react'
import Landing from './screens/Landing.jsx'
import Lobby from './screens/Lobby.jsx'
import Play from './screens/Play.jsx'
import { playerId } from './lib/player.js'
import { createRoom, joinRoom, subscribeRoom, fetchRoom } from './lib/rooms.js'
import { openRound } from './lib/rounds.js'

const ROOM_KEY = 'same-page:room'

export default function App() {
  const me = playerId()
  const [room, setRoom] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Restore the room after a refresh so either player can reconnect without
  // having to enter the room code again.
  useEffect(() => {
    const savedCode = localStorage.getItem(ROOM_KEY)
    if (!savedCode) return

    let active = true
    fetchRoom(savedCode)
      .then((savedRoom) => {
        if (!active) return
        if (savedRoom.host_id === me || savedRoom.guest_id === me) {
          setRoom(savedRoom)
        } else {
          localStorage.removeItem(ROOM_KEY)
        }
      })
      .catch(() => {
        if (active) localStorage.removeItem(ROOM_KEY)
      })

    return () => {
      active = false
    }
  }, [me])

  // One subscription for the life of the room, shared by Lobby and Play.
  useEffect(() => {
    if (!room) return
    return subscribeRoom(room.code, setRoom)
  }, [room?.code])

  useEffect(() => {
    if (room?.code) localStorage.setItem(ROOM_KEY, room.code)
  }, [room?.code])

  async function handleCreate() {
    setBusy(true)
    setError('')
    try {
      setRoom(await createRoom(me))
    } catch (e) {
      setError(e.message || 'Could not create the room.')
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
      setError(e.message || 'Could not join the room.')
    } finally {
      setBusy(false)
    }
  }

  async function handleStart() {
    setBusy(true)
    setError('')
    try {
      await openRound(room.code, 0)
    } catch (e) {
      setError(e.message || 'Could not start the game.')
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
