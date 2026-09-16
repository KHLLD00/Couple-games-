import { useEffect, useState } from 'react'
import Landing from './screens/Landing.jsx'
import Lobby from './screens/Lobby.jsx'
import Play from './screens/Play.jsx'
import { supabase } from './lib/supabase.js'
import { createRoom, joinRoom, subscribeRoom, fetchRoom } from './lib/rooms.js'
import { openRound } from './lib/rounds.js'

const ROOM_KEY = 'same-page:room'

export default function App() {
  const [me, setMe] = useState(null)
  const [room, setRoom] = useState(null)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true

    async function initialisePlayer() {
      try {
        const { data: { session } } = await supabase.auth.getSession()
        let user = session?.user

        if (!user) {
          const { data, error: authError } = await supabase.auth.signInAnonymously()
          if (authError) throw authError
          user = data.user
        }

        if (!user) throw new Error('Could not create a player session.')
        if (active) setMe(user.id)
      } catch (e) {
        if (active) setError(e.message || 'Could not create a player session.')
      } finally {
        if (active) setBusy(false)
      }
    }

    initialisePlayer()
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!me) return
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

    return () => { active = false }
  }, [me])

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

  function handleExit() {
    localStorage.removeItem(ROOM_KEY)
    setRoom(null)
    setError('')
  }

  if (busy && !me) {
    return <div className="flex min-h-dvh items-center justify-center px-5"><p className="seam-label">Starting your session</p></div>
  }

  if (!me) {
    return <div className="flex min-h-dvh items-center justify-center px-5"><p className="text-center text-cherry">{error || 'Could not start the game.'}</p></div>
  }

  if (!room) {
    return <Landing onCreate={handleCreate} onJoin={handleJoin} busy={busy} error={error} />
  }

  if (room.status === 'lobby') {
    return <Lobby room={room} isHost={room.host_id === me} onStart={handleStart} onExit={handleExit} busy={busy} />
  }

  return <Play room={room} me={me} onExit={handleExit} />
}
