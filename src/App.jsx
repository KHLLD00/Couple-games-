import { useEffect, useRef, useState } from 'react'
import Landing from './screens/Landing.jsx'
import Lobby from './screens/Lobby.jsx'
import GameSetup from './screens/GameSetup.jsx'
import Play from './screens/Play.jsx'
import SoundToggle from './components/SoundToggle.jsx'
import Toast from './components/Toast.jsx'
import { supabase } from './lib/supabase.js'
import { createRoom, joinRoom, leaveRoom, subscribeRoom, configureGame, resetGame } from './lib/rooms.js'
import { openRound } from './lib/rounds.js'
import { primeAudio, playPartnerJoined, playCompleteNotification } from './lib/sounds.js'
import { notify } from './lib/notifications.js'
import { notifyPartner } from './lib/push.js'

export default function App() {
  const [me, setMe] = useState(null)
  const [room, setRoom] = useState(null)
  const [setup, setSetup] = useState(false)
  const [busy, setBusy] = useState(true)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const previousRoom = useRef(null)
  const noticeTimer = useRef(null)
  const inviteCode = window.location.pathname.match(/^\/join\/([A-Za-z0-9]+)\/?$/i)?.[1]?.toUpperCase() || ''

  function showNotice(message) {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 2600)
  }

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  useEffect(() => {
    let active=true
    async function initialisePlayer(){
      try {
        const {data:{session}}=await supabase.auth.getSession()
        let user=session?.user
        if(!user){
          const {data,error:authError}=await supabase.auth.signInAnonymously()
          if(authError) throw authError
          user=data.user
        }
        if(!user) throw new Error('Could not create a player session.')
        if(active) setMe(user.id)
      } catch(e){if(active)setError(e.message||'Could not create a player session.')}
      finally{if(active)setBusy(false)}
    }
    initialisePlayer()
    return()=>{active=false}
  },[])

  useEffect(() => {
    if(!room) return
    return subscribeRoom(room.code,(updated)=>{
      if(!updated){
        setRoom(null)
        setSetup(false)
        setError('Your partner left. This game has ended.')
        showNotice('Your partner left the game.')
        if(window.location.pathname!=='/')window.history.replaceState({},'','/')
        return
      }
      const previous = previousRoom.current
      if(previous?.guest_id !== updated.guest_id && updated.guest_id && updated.host_id === me){
        primeAudio()
        playPartnerJoined()
        showNotice('Your partner joined.')
        notify('Same Page', 'Your partner joined the game.')
        notifyPartner(updated.code, 'partner_joined')
      }
      if(previous?.status !== 'finished' && updated.status === 'finished'){
        playCompleteNotification()
        showNotice('Game complete.')
        notify('Same Page', 'Your game is complete.')
        notifyPartner(updated.code, 'game_complete')
      }
      previousRoom.current = updated
      setRoom(updated)
    })
  },[room?.code, me])

  async function handleCreate(name){primeAudio();setBusy(true);setError('');try{const created=await createRoom(me,name);previousRoom.current=created;setRoom(created);setSetup(true)}catch(e){setError(e.message||'Could not create the room.')}finally{setBusy(false)}}
  async function handleJoin(code,name){primeAudio();setBusy(true);setError('');try{const joined=await joinRoom(code,me,name);previousRoom.current=joined;setRoom(joined);window.history.replaceState({},'','/')}catch(e){setError(e.message||'Could not join the room.')}finally{setBusy(false)}}
  async function handleConfigure(mode,rounds){primeAudio();setBusy(true);setError('');try{setRoom(await configureGame(room.code,mode,rounds));setSetup(false)}catch(e){setError(e.message||'Could not save game settings.')}finally{setBusy(false)}}
  async function handleStart(){primeAudio();setBusy(true);setError('');try{await openRound(room.code,0)}catch(e){setError(e.message||'Could not start the game.')}finally{setBusy(false)}}
  async function handlePlayAgain(){primeAudio();setBusy(true);setError('');try{setRoom(await resetGame(room.code))}catch(e){setError(e.message||'Could not start another game.')}finally{setBusy(false)}}
  function handleExit(){const code=room?.code;setRoom(null);previousRoom.current=null;setSetup(false);setError('');if(window.location.pathname!=='/')window.history.replaceState({},'','/');if(code&&me)leaveRoom(code,me).catch(()=>{})}

  if(busy&&!me)return <div className="flex min-h-dvh items-center justify-center px-5"><p className="seam-label">Starting your session</p></div>
  if(!me)return <div className="flex min-h-dvh items-center justify-center px-5"><p className="text-center text-cherry">{error||'Could not start the game.'}</p></div>
  return <>
    <SoundToggle />
    <Toast message={notice} />
    {!room?<Landing onCreate={handleCreate} onJoin={handleJoin} busy={busy} error={error} initialCode={inviteCode}/>
      :room.status==='lobby'&&setup&&room.host_id===me?<GameSetup room={room} onSave={handleConfigure} busy={busy}/>
      :room.status==='lobby'?<Lobby room={room} isHost={room.host_id===me} onStart={handleStart} onSetup={()=>setSetup(true)} onExit={handleExit} busy={busy}/>
      :<Play room={room} me={me} onExit={handleExit} onPlayAgain={handlePlayAgain}/>}
    <footer className="pb-4 pt-2 text-center text-xs text-cream/40">Powered by <a href="https://kaytechwebsolutions.vercel.app" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">Kaytech Web Solutions</a></footer>
  </>
}
