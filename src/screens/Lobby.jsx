import { useState } from 'react'
import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'

const MODE_NAMES = { same_page: 'Same Page', ask_me_anything: 'Ask Me Anything', would_you_rather: 'Would You Rather', most_likely_to: 'Most Likely To', this_or_that: 'This or That', truth_or_dare: 'Truth or Dare', deep_dive: 'Deep Dive', mix_it_up: 'Mix It Up' }

export default function Lobby({ room, isHost, onStart, onSetup, onExit, busy }) {
  const [copied, setCopied] = useState(false)
  const bothIn = Boolean(room.guest_id)
  const inviteLink = `${window.location.origin}/join/${room.code}`
  const modeName = MODE_NAMES[room.game_mode] || 'Same Page'

  async function share() {
    const text = 'Come play Same Page with me 👀'
    try {
      if (navigator.share) await navigator.share({ title: 'Same Page', text, url: inviteLink })
      else { await navigator.clipboard.writeText(inviteLink); setCopied(true); setTimeout(() => setCopied(false), 2000) }
    } catch {}
  }

  const myName = isHost ? room.host_name : room.guest_name
  const theirName = isHost ? room.guest_name : room.host_name

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Your game is ready</p>
        <p className="mt-4 font-mono text-5xl tracking-[0.2em] text-apricot">{room.code}</p>
        <p className="mx-auto mt-4 max-w-xs text-cream/70">Send them the invite. Let's see if you two are actually on the same page.</p>
      </header>
      <section className="my-8">
        <div className="mb-4 rounded-2xl border border-cream/10 bg-plum/50 px-4 py-3 text-center"><p className="seam-label">{modeName} · {room.total_rounds} rounds</p></div>
        <Seam>
          <SeamHalf label={isHost ? 'You' : 'Them'}><span className="font-display text-lg">{myName || 'Here'}</span></SeamHalf>
          <SeamHalf label={isHost ? 'Them' : 'You'} sealed={!bothIn}><span className={bothIn ? 'font-display text-lg' : 'text-sm text-cream/45'}>{bothIn ? theirName : 'Waiting...'}</span></SeamHalf>
        </Seam>
      </section>
      <div className="space-y-3">
        <Button variant="ghost" onClick={share}>{copied ? 'Invite link copied' : 'Send invite'}</Button>
        {isHost && <Button variant="ghost" onClick={onSetup} disabled={busy}>Change game</Button>}
        <Button onClick={onStart} disabled={!bothIn || busy}>{bothIn ? (busy ? 'Getting the first question...' : "Let's find out") : 'Waiting on your person...'}</Button>
        <Button variant="ghost" onClick={onExit}>Leave game</Button>
      </div>
    </div>
  )
}
