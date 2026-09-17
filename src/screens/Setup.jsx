import { useState } from 'react'
import Button from '../components/Button.jsx'
import { configureGame } from '../lib/rooms.js'

const MODES = [
  ['same_page', 'Same Page', 'Answer the same question and see if your minds match.'],
  ['ask_me_anything', 'Ask Me Anything', 'Write a question for your person. They answer it privately.'],
  ['would_you_rather', 'Would You Rather', 'Pick your side. No peeking.'],
  ['most_likely_to', 'Most Likely To', 'Point the finger. Hope they agree.'],
  ['this_or_that', 'This or That', 'Two choices. One answer.'],
  ['truth_or_dare', 'Truth or Dare', 'Tell the truth or take the dare.'],
  ['deep_dive', 'Deep Dive', 'The questions get a little more real.'],
  ['mix_it_up', 'Mix It Up', 'A random mix of every mode. Anything can happen.']
]

export default function Setup({ room, onDone, onExit, busy }) {
  const [mode, setMode] = useState(room.game_mode || 'same_page')
  const [rounds, setRounds] = useState(room.total_rounds || 10)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function save() {
    setSaving(true); setError('')
    try { onDone(await configureGame(room.code, mode, rounds)) }
    catch (e) { setError(e.message || 'Could not save the game settings.') }
    finally { setSaving(false) }
  }

  return (
    <div className="min-h-dvh px-5 pb-8 pt-14">
      <div className="mx-auto max-w-lg">
        <header className="text-center">
          <p className="seam-label">Make it yours</p>
          <h1 className="mt-3 text-4xl">How are we playing?</h1>
          <p className="mx-auto mt-3 max-w-xs text-cream/60">Pick the game. Pick the rounds. Then send them in.</p>
        </header>

        <section className="mt-9">
          <p className="seam-label mb-3">Game mode</p>
          <div className="grid gap-2">
            {MODES.map(([value, title, description]) => (
              <button key={value} type="button" onClick={() => setMode(value)} className={`rounded-2xl border px-4 py-4 text-left transition ${mode === value ? 'border-cherry bg-cherry/10' : 'border-cream/10 bg-plum/40'}`}>
                <div className="flex items-center justify-between gap-3"><span className="font-bold">{title}</span>{mode === value && <span className="text-cherry">✓</span>}</div>
                <p className="mt-1 text-sm text-cream/50">{description}</p>
              </button>
            ))}
          </div>
        </section>

        <section className="mt-8">
          <p className="seam-label mb-3">Number of rounds</p>
          <div className="grid grid-cols-4 gap-2">
            {[5, 10, 15, 20].map(value => <button key={value} type="button" onClick={() => setRounds(value)} className={`rounded-2xl border py-4 font-display text-xl ${rounds === value ? 'border-cherry bg-cherry/10 text-cream' : 'border-cream/10 bg-plum/40 text-cream/60'}`}>{value}</button>)}
          </div>
        </section>

        {error && <p className="mt-4 text-center text-sm text-cherry">{error}</p>}
        <div className="mt-8 space-y-3">
          <Button onClick={save} disabled={saving || busy}>{saving ? 'Saving...' : 'Save & continue'}</Button>
          <Button variant="ghost" onClick={onExit} disabled={saving}>Back to lobby</Button>
        </div>
      </div>
    </div>
  )
}
