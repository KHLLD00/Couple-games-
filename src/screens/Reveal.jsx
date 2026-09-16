import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'

export default function Reveal({ round, me, reveal, onVerdict, onNext, busy }) {
  const mine = reveal.find((a) => a.player_id === me)
  const theirs = reveal.find((a) => a.player_id !== me)

  const isText = round.kind === 'text'
  const myVerdictIn = isText && mine?.verdict !== null && mine?.verdict !== undefined
  const bothVerdictsIn =
    isText && mine?.verdict !== null && mine?.verdict !== undefined &&
    theirs?.verdict !== null && theirs?.verdict !== undefined

  const matched = round.matched
  const showMatchState = round.kind === 'choice' || bothVerdictsIn

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Round {round.idx + 1} · Revealed</p>
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
            {matched ? 'Same page.' : 'Different pages, still one book.'}
          </p>
        )}
      </section>

      {isText && !myVerdictIn ? (
        <div className="space-y-3">
          <p className="text-center text-cream/60">Close enough to call it a match?</p>
          <Button onClick={() => onVerdict(true)} disabled={busy}>
            That&rsquo;s us
          </Button>
          <Button variant="ghost" onClick={() => onVerdict(false)} disabled={busy}>
            Not quite
          </Button>
        </div>
      ) : isText && !bothVerdictsIn ? (
        <p className="text-center text-cream/60">Waiting on their call.</p>
      ) : (
        <Button onClick={onNext} disabled={busy}>
          Next round
        </Button>
      )}
    </div>
  )
}
