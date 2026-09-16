import { useState } from 'react'
import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'

export default function Landing({ onCreate, onJoin, busy, error, initialCode = '' }) {
  const [mode, setMode] = useState(initialCode ? 'join' : 'start')
  const [name, setName] = useState('')
  const [code, setCode] = useState(initialCode)

  const clean = code.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 6)
  const canContinue = name.trim().length > 0

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">Two people. One question. No peeking.</p>
        <h1 className="mt-3 text-[3.25rem] leading-[0.95]">Same Page</h1>
        <p className="mx-auto mt-4 max-w-xs text-cream/70">Answer honestly. They can't see a thing until they answer too.</p>
      </header>

      <section aria-hidden="true" className="my-10">
        <p className="mb-4 text-center font-display text-xl text-cream/90">How do you take your tea?</p>
        <Seam>
          <SeamHalf label="You"><span className="font-display text-lg">Sweet enough to stand a spoon in</span></SeamHalf>
          <SeamHalf label="Them" sealed><span className="text-sm text-cream/45">Their answer is hiding</span></SeamHalf>
        </Seam>
      </section>

      <div className="space-y-3">
        {mode === 'start' ? (
          <>
            <label className="block">
              <span className="seam-label">Your name or nickname</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="What should they call you?" autoComplete="nickname" className="mt-2 w-full rounded-2xl border border-cream/20 bg-plum/70 px-5 py-4 text-cream placeholder:text-cream/25" />
            </label>
            {error && <p className="text-center text-sm text-cherry">{error}</p>}
            <Button onClick={() => onCreate(name)} disabled={!canContinue || busy}>{busy ? 'Setting things up...' : 'Start the game'}</Button>
            <Button variant="ghost" onClick={() => setMode('join')}>I've got a code</Button>
          </>
        ) : (
          <>
            <label className="block">
              <span className="seam-label">Your name or nickname</span>
              <input value={name} onChange={(e) => setName(e.target.value.slice(0, 24))} placeholder="What should they call you?" autoComplete="nickname" className="mt-2 w-full rounded-2xl border border-cream/20 bg-plum/70 px-5 py-4 text-cream placeholder:text-cream/25" />
            </label>
            <label className="block">
              <span className="seam-label">Game code</span>
              <input autoFocus={!initialCode} value={clean} onChange={(e) => setCode(e.target.value)} placeholder="XXXXXX" inputMode="text" autoCapitalize="characters" autoComplete="off" className="mt-2 w-full rounded-2xl border border-cream/20 bg-plum/70 px-5 py-4 text-center font-mono text-2xl tracking-[0.35em] text-cream placeholder:text-cream/25" />
            </label>
            {error && <p className="text-center text-sm text-cherry">{error}</p>}
            <Button onClick={() => onJoin(clean, name)} disabled={clean.length < 6 || !canContinue || busy}>{busy ? 'Looking for your room...' : 'Let me in'}</Button>
            <Button variant="ghost" onClick={() => setMode('start')}>Never mind</Button>
          </>
        )}
      </div>
    </div>
  )
}
