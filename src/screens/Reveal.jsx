import { useEffect, useState } from 'react'
import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'
import { getReveal, setReaction } from '../lib/rounds.js'

const REACTIONS = ['❤️', '😂', '🥹', '😮']

export default function Reveal({ room, round, me, reveal, onVerdict, onNext, busy, isLastRound }) {
  const mine = reveal.find((a) => a.player_id === me)
  const theirs = reveal.find((a) => a.player_id !== me)
  const [reaction, setReactionState] = useState(mine?.reaction ?? null)
  const [reacting, setReacting] = useState(false)

  useEffect(() => {
    setReactionState(mine?.reaction ?? null)
  }, [mine?.reaction])

  const isText = round.kind === 'text'
  const myVerdictIn = isText && mine?.verdict !== null && mine?.verdict !== undefined
  const bothVerdictsIn =
    isText && mine?.verdict !== null && mine?.verdict !== undefined &&
    theirs?.verdict !== null && theirs?.verdict !== undefined

  const matched = round.matched
  const showMatchState = round.kind === 'choice' || bothVerdictsIn

  async function react(value) {
    setReacting(true)
    try {
      await setReaction(room.code, round.idx, me, value)
      setReactionState(value)
      const fresh = await getReveal(room.code, round.idx)
      if (fresh.length) setReactionState(fresh.find((a) => a.player_id === me)?.reaction ?? value)
    } finally {
      setReacting(false)
    }
  }

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Round {round.idx + 1} · No more hiding</p>
        <h2 className="mx-auto mt-4 max-w-xs text-3xl leading-tight">{round.prompt}</h2>
      </header>

      <section className="my-8">
        <Seam>
          <SeamHalf label="You">
            <span className="font-display text-lg">{mine?.value}</span>
          </SeamHalf>
          <SeamHalf label="Them">
            <span className="font-display text-lg">{theirs?.value}</span>
          </SeamHalf>
        </Seam>

        {showMatchState && (
          <p className={`mt-4 text-center font-display text-xl ${matched ? 'text-mint' : 'text-cream/70'}`}>
            {matched ? 'Okayyy, you two actually agree.' : 'Well... someone has explaining to do.'}
          </p>
        )}

        <div className="mt-6 flex justify-center gap-2">
          {REACTIONS.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => react(item)}
              disabled={reacting}
              aria-label={`React ${item}`}
              className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${
                reaction === item ? 'border-apricot bg-apricot/15' : 'border-cream/15 bg-plum/60'
              }`}
            >
              {item}
            </button>
          ))}
        </div>
      </section>

      {isText && !myVerdictIn ? (
        <div className="space-y-3">
          <p className="text-center text-cream/60">We're calling that a match, right?</p>
          <Button onClick={() => onVerdict(true)} disabled={busy}>Yep, that's us</Button>
          <Button variant="ghost" onClick={() => onVerdict(false)} disabled={busy}>Absolutely not 😂</Button>
        </div>
      ) : isText && !bothVerdictsIn ? (
        <p className="text-center text-cream/60">They're deciding... this could get interesting.</p>
      ) : (
        <Button onClick={onNext} disabled={busy}>
          {isLastRound ? 'Show me the damage' : 'Keep going'}
        </Button>
      )}
    </div>
  )
}
