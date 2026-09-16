import { useState } from 'react'
import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'

export default function Lobby({ room, isHost, onStart, onExit, busy }) {
  const [copied, setCopied] = useState(false)
  const bothIn = Boolean(room.guest_id)

  async function share() {
    const text = `Play Same Page with me. Room code: ${room.code}`
    try {
      if (navigator.share) {
        await navigator.share({ text })
      } else {
        await navigator.clipboard.writeText(room.code)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      }
    } catch {
      // The person dismissed the share sheet. Nothing to recover from.
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Room open</p>
        <p className="mt-4 font-mono text-5xl tracking-[0.2em] text-apricot">{room.code}</p>
        <p className="mx-auto mt-4 max-w-xs text-cream/70">
          Send this to them. They tap join and type it in.
        </p>
      </header>

      <section className="my-10">
        <Seam>
          <SeamHalf label={isHost ? 'You' : 'Them'}>
            <span className="font-display text-lg">Here</span>
          </SeamHalf>
          <SeamHalf label={isHost ? 'Them' : 'You'} sealed={!bothIn}>
            <span className={bothIn ? 'font-display text-lg' : 'text-sm text-cream/45'}>
              {bothIn ? 'Here' : 'Waiting'}
            </span>
          </SeamHalf>
        </Seam>
      </section>

      <div className="space-y-3">
        <Button variant="ghost" onClick={share}>
          {copied ? 'Code copied' : 'Send the code'}
        </Button>
        <Button onClick={onStart} disabled={!bothIn || busy}>
          {bothIn ? (busy ? 'Opening round 1' : 'Start playing') : 'Waiting for them'}
        </Button>
        <Button variant="ghost" onClick={onExit}>
          Exit session
        </Button>
      </div>
    </div>
  )
}
