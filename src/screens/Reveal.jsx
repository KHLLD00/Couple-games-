import { useEffect, useState } from 'react'
import { Seam, SeamHalf } from '../components/Seam.jsx'
import Button from '../components/Button.jsx'
import { getReveal, setReaction } from '../lib/rounds.js'

const REACTIONS = ['❤️', '😂', '🥹', '😮']
const MODE_NAMES = { same_page: 'Same Page', ask_me_anything: 'Ask Me Anything', would_you_rather: 'Would You Rather', most_likely_to: 'Most Likely To', this_or_that: 'This or That', truth_or_dare: 'Truth or Dare', deep_dive: 'Deep Dive' }

export default function Reveal({ room, round, me, reveal, onVerdict, onNext, busy, isLastRound }) {
  const mine = reveal.find((a) => a.player_id === me)
  const theirs = reveal.find((a) => a.player_id !== me)
  const [reaction, setReactionState] = useState(mine?.reaction ?? null)
  const [reacting, setReacting] = useState(false)

  useEffect(() => setReactionState(mine?.reaction ?? null), [mine?.reaction])

  const isText = round.kind === 'text'
  const isChoice = round.kind === 'choice'
  const isTruthDare = round.mode === 'truth_or_dare'
  const isAskMeAnything = round.mode === 'ask_me_anything'
  const myVerdictIn = isText && mine?.verdict != null
  const bothVerdictsIn = isText && mine?.verdict != null && theirs?.verdict != null
  const matched = round.matched

  async function react(value) {
    setReacting(true)
    try {
      await setReaction(room.code, round.idx, me, value)
      setReactionState(value)
      const fresh = await getReveal(room.code, round.idx)
      if (fresh.length) setReactionState(fresh.find((a) => a.player_id === me)?.reaction ?? value)
    } finally { setReacting(false) }
  }

  const matchMessage = matched
    ? round.mode === 'most_likely_to' ? 'You pointed at the same person 😂' : 'Okayyy, you two actually agree.'
    : round.mode === 'would_you_rather' ? 'Different choices. We have questions.'
    : round.mode === 'this_or_that' ? 'You went separate ways on that one.'
    : 'Well... someone has explaining to do.'

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">{MODE_NAMES[round.mode] || 'Reveal'} · Round {round.idx + 1}</p>
        <h2 className="mx-auto mt-4 max-w-sm text-3xl leading-tight">{round.prompt?.replace(/^(Truth|Dare):\s*/i, '')}</h2>
        <p className="mt-3 text-sm text-cream/40">{isAskMeAnything ? 'Here is what they actually asked, and what you said back.' : 'Now you get to see what they picked.'}</p>
      </header>

      <section className="my-8">
        <Seam>
          <SeamHalf label="You">
            {isAskMeAnything && <p className="mb-1 text-xs text-cream/40">{mine?.custom_question}</p>}
            <span className="font-display text-lg">{mine?.value ?? '...'}</span>
          </SeamHalf>
          <SeamHalf label="Them">
            {isAskMeAnything && <p className="mb-1 text-xs text-cream/40">{theirs?.custom_question}</p>}
            <span className="font-display text-lg">{theirs?.value ?? '...'}</span>
          </SeamHalf>
        </Seam>

        {(isChoice || bothVerdictsIn) && !isTruthDare && (
          <p className={`mt-4 text-center font-display text-xl ${matched ? 'text-mint' : 'text-cream/70'}`}>{matchMessage}</p>
        )}

        {isTruthDare && (
          <p className="mt-4 text-center font-display text-xl text-apricot">Well, now there's no taking it back. 👀</p>
        )}

        <div className="mt-6 flex justify-center gap-2">
          {REACTIONS.map((item) => <button key={item} type="button" onClick={() => react(item)} disabled={reacting} aria-label={`React ${item}`} className={`flex h-11 w-11 items-center justify-center rounded-full border text-xl transition ${reaction === item ? 'border-apricot bg-apricot/15' : 'border-cream/15 bg-plum/60'}`}>{item}</button>)}
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
        <Button onClick={onNext} disabled={busy}>{isLastRound ? 'Show me the damage' : 'Keep going'}</Button>
      )}
    </div>
  )
}
