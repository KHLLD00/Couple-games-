import { useEffect, useState } from 'react'
import Question from './Question.jsx'
import Reveal from './Reveal.jsx'
import {
  openRound,
  fetchRound,
  submitAnswer,
  getReveal,
  setVerdict,
  getGameSummary,
  finishGame,
  subscribeRounds
} from '../lib/rounds.js'

export default function Play({ room, me }) {
  const idx = room.current_round
  const [round, setRound] = useState(null)
  const [mySubmission, setMySubmission] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let active = true
    setError('')
    setRound(null)
    setReveal(null)
    setMySubmission(null)

    if (room.status === 'finished') return () => { active = false }

    fetchRound(room.code, idx)
      .then((existing) => {
        if (active && existing) setRound(existing)
        return existing || openRound(room.code, idx)
      })
      .then((opened) => {
        if (active && opened) setRound(opened)
      })
      .catch((e) => {
        if (active) setError(e.message || 'Could not open this round.')
      })

    return () => { active = false }
  }, [room.code, idx, room.status])

  useEffect(() => subscribeRounds(room.code, (row) => {
    if (row.idx === idx) setRound(row)
  }), [room.code, idx])

  useEffect(() => {
    if (!round?.revealed) return
    let active = true
    getReveal(room.code, idx)
      .then((answers) => { if (active) setReveal(answers) })
      .catch((e) => {
        if (active && e.message !== 'Both answers are not in yet.') setError(e.message)
      })
    return () => { active = false }
  }, [room.code, idx, round?.revealed, round?.matched])

  useEffect(() => {
    if (room.status !== 'finished') return
    let active = true
    getGameSummary(room.code)
      .then((data) => { if (active) setSummary(data) })
      .catch((e) => { if (active) setError(e.message || 'Could not load the final summary.') })
    return () => { active = false }
  }, [room.code, room.status])

  async function handleSubmit(value) {
    setBusy(true)
    setError('')
    try {
      await submitAnswer(room.code, idx, me, value)
      setMySubmission(value)
      const fresh = await fetchRound(room.code, idx)
      if (fresh) setRound(fresh)
    } catch (e) {
      setError(e.message || 'Could not submit your answer.')
    } finally {
      setBusy(false)
    }
  }

  async function handleVerdict(verdict) {
    setBusy(true)
    setError('')
    try {
      await setVerdict(room.code, idx, me, verdict)
      const fresh = await getReveal(room.code, idx)
      setReveal(fresh)
      const updated = await fetchRound(room.code, idx)
      if (updated) setRound(updated)
    } catch (e) {
      setError(e.message || 'Could not save your verdict.')
    } finally {
      setBusy(false)
    }
  }

  async function handleNext() {
    setBusy(true)
    setError('')
    try {
      if (idx + 1 >= room.total_rounds) {
        await finishGame(room.code)
        return
      }
      await openRound(room.code, idx + 1)
    } catch (e) {
      setError(e.message || 'Could not continue the game.')
    } finally {
      setBusy(false)
    }
  }

  if (room.status === 'finished') {
    const matched = (summary ?? []).filter((item) => item.matched === true).length
    const played = summary?.length ?? 0

    return (
      <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
        <header className="text-center">
          <p className="seam-label">Game complete</p>
          <h1 className="mt-4 text-4xl leading-tight">Same Page</h1>
          <p className="mx-auto mt-4 max-w-xs text-cream/70">You made it through all the questions.</p>
        </header>

        <section className="my-10 text-center">
          <p className="font-display text-6xl text-apricot">{matched}/{played}</p>
          <p className="mt-3 text-cream/60">matched rounds</p>
        </section>

        <div className="space-y-3">
          {(summary ?? []).map((item) => (
            <div key={item.idx} className="rounded-2xl border border-cream/10 bg-plum/50 px-4 py-3">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm text-cream/70">Round {item.idx + 1}</span>
                <span className="font-display">{item.matched === true ? 'Matched' : 'Different'}</span>
              </div>
              <p className="mt-1 text-sm text-cream/45">{item.prompt}</p>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (!round) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        {error ? <p className="text-center text-cherry">{error}</p> : <p className="seam-label">Opening round {idx + 1}</p>}
      </div>
    )
  }

  if (round.revealed && reveal) {
    return (
      <Reveal
        room={room}
        round={round}
        me={me}
        reveal={reveal}
        onVerdict={handleVerdict}
        onNext={handleNext}
        busy={busy}
        isLastRound={idx + 1 >= room.total_rounds}
      />
    )
  }

  return (
    <>
      <Question round={round} mySubmission={mySubmission} onSubmit={handleSubmit} busy={busy} />
      {error && <p className="fixed bottom-4 left-5 right-5 text-center text-sm text-cherry">{error}</p>}
    </>
  )
}
