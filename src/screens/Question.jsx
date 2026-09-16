import { useState } from 'react'
import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'

export default function Question({ round, mySubmission, onSubmit, busy }) {
  const [text, setText] = useState('')

  const submitted = Boolean(mySubmission)
  const otherHere = round.answer_count >= (submitted ? 2 : 1)

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Round {round.idx + 1}</p>
        <h2 className="mx-auto mt-4 max-w-xs text-3xl leading-tight">{round.prompt}</h2>
      </header>

      <section className="my-8">
        <Seam>
          <SeamHalf label="You">
            {submitted ? (
              <span className="font-display text-lg">{mySubmission}</span>
            ) : (
              <span className="text-sm text-cream/45">Answering</span>
            )}
          </SeamHalf>
          <SeamHalf label="Them" sealed>
            <span className="text-sm text-cream/45">
              {otherHere ? 'Answered' : 'Waiting'}
            </span>
          </SeamHalf>
        </Seam>
      </section>

      {submitted ? (
        <p className="text-center text-cream/60">
          Sealed. It flips the moment they answer too.
        </p>
      ) : round.kind === 'choice' ? (
        <div className="space-y-3">
          {round.options.map((opt) => (
            <Button
              key={opt}
              variant="ghost"
              disabled={busy}
              onClick={() => onSubmit(opt)}
              className="text-left"
            >
              {opt}
            </Button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Type your answer"
            rows={3}
            className="w-full rounded-2xl border border-cream/20 bg-plum/70 px-5 py-4
              text-lg text-cream placeholder:text-cream/25"
          />
          <Button onClick={() => onSubmit(text.trim())} disabled={busy || !text.trim()}>
            Seal my answer
          </Button>
        </div>
      )}
    </div>
  )
}
