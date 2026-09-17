import { useState } from 'react'
import Button from '../components/Button.jsx'

const MODES = [
  ['same_page', 'Same Page', 'Answer the same question. No peeking.'],
  ['ask_me_anything', 'Ask Me Anything', 'Write a question for your person.'],
  ['would_you_rather', 'Would You Rather', 'Pick your side and hope they picked yours.'],
  ['most_likely_to', 'Most Likely To', 'Point the finger. Politely.'],
  ['this_or_that', 'This or That', 'Two options. One choice.'],
  ['truth_or_dare', 'Truth or Dare', 'Tell the truth or take the dare.'],
  ['deep_dive', 'Deep Dive', 'The questions get a little more real.'],
  ['mix_it_up', 'Mix It Up', 'A random mix of every mode.']
]

export default function GameSetup({ room, onSave, busy }) {
  const [mode, setMode] = useState(room.game_mode || 'same_page')
  const [rounds, setRounds] = useState(room.total_rounds || 10)

  return (
    <div className="flex min-h-dvh flex-col px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Before we start</p>
        <h1 className="mt-3 text-4xl leading-tight">Pick your game.</h1>
        <p className="mx-auto mt-4 max-w-xs text-cream/65">Choose how chaotic, cute, or questionable this gets.</p>
      </header>

      <div className="mt-8 flex-1 space-y-6">
        <section>
          <p className="seam-label mb-3">Game mode</p>
          <div className="space-y-2">
            {MODES.map(([value, label, description]) => (
              <button key={value} type="button" onClick={() => setMode(value)} className={`w-full rounded-2xl border px-4 py-4 text-left transition ${mode === value ? 'border-apricot bg-apricot/10' : 'border-cream/10 bg-plum/50'}`}>
                <div className="flex items-center justify-between gap-4">
                  <span className="font-display text-lg">{label}</span>
                  <span className={`h-4 w-4 rounded-full border ${mode === value ? 'border-apricot bg-apricot' : 'border-cream/25'}`} />
                </div>
                <p className="mt-1 text-sm text-cream/45">{description}</p>
              </button>
            ))}
          </div>
        </section>

        <section>
          <p className="seam-label mb-3">Rounds</p>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map((value) => (
              <button key={value} type="button" onClick={() => setRounds(value)} className={`rounded-2xl border py-3 font-bold ${rounds === value ? 'border-apricot bg-apricot/10 text-apricot' : 'border-cream/10 bg-plum/50 text-cream/65'}`}>{value}</button>
            ))}
          </div>
        </section>
      </div>

      <div className="pt-6">
        <Button onClick={() => onSave(mode, rounds)} disabled={busy}>{busy ? 'Setting things up...' : 'Lock it in'}</Button>
      </div>
    </div>
  )
}
