import { useEffect, useState } from 'react'
import Question from './Question.jsx'
import Reveal from './Reveal.jsx'
import {
  openRound,
  submitAnswer,
  getReveal,
  setVerdict,
  subscribeRounds
} from '../lib/rounds.js'

export default function Play({ room, me }) {
  const idx = room.current_round
  const [round, setRound] = useState(null)
  const [mySubmission, setMySubmission] = useState(null)
  const [reveal, setReveal] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // One subscription for the whole room; each round change is filtered by idx below.
  useEffect(() => {
    return subscribeRounds(room.code, (row) => {
      if (row.idx !== idx) return
      setRound(row)
    })
  }, [room.code, idx])

  // Opening is idempotent — safe even if both devices call it at once.
  useEffect(() => {
    let cancelled = false
    setRound(null)
    setMySubmission(null)
    setReveal(null)
    openRound(room.code, idx)
      .then((r) => { if (!cancelled) setRound(r) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [room.code, idx])

  // Fetch both answers as soon as the round flips, and again on any nudge
  // (a verdict coming in) while it's still open.
  useEffect(() => {
    if (!round?.revealed) return
    let cancelled = false
    getReveal(room.code, idx)
      .then((r) => { if (!cancelled) setReveal(r) })
      .catch((e) => { if (!cancelled) setError(e.message) })
    return () => { cancelled = true }
  }, [room.code, idx, round?.revealed, round?.answer_count, round?.matched])

  async function handleSubmit(value) {
    setBusy(true)
    setError('')
    try {
      await submitAnswer(room.code, idx, me, value)
      setMySubmission(value)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleVerdict(verdict) {
    setBusy(true)
    setError('')
    try {
      await setVerdict(room.code, idx, me, verdict)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleNext() {
    setBusy(true)
    setError('')
    try {
      // Bumping current_round on rooms is what carries both players to the
      // next question at once — open_round does that as a side effect.
      await openRound(room.code, idx + 1)
    } catch (e) {
      setError(e.message)
    } finally {
      setBusy(false)
    }
  }

  if (!round) {
    return (
      <div className="flex min-h-dvh items-center justify-center px-5">
        {error ? (
          <p className="text-center text-cherry">{error}</p>
        ) : (
          <p className="seam-label">Opening round {idx + 1}</p>
        )}
      </div>
    )
  }

  if (round.revealed && reveal) {
    return (
      <Reveal
        round={round}
        me={me}
        reveal={reveal}
        onVerdict={handleVerdict}
        onNext={handleNext}
        busy={busy}
      />
    )
  }

  return (
    <Question round={round} mySubmission={mySubmission} onSubmit={handleSubmit} busy={busy} />
  )
}
