import { useEffect, useState } from 'react'
import Question from './Question.jsx'
import Reveal from './Reveal.jsx'
import {
  openRound,
  fetchRound,
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

  useEffect(() => {
    let active = true
    setError('')
    setRound(null)
    setReveal(null)
    setMySubmission(null)

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
  }, [room.code, idx])

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
      await openRound(room.code, idx + 1)
    } catch (e) {
      setError(e.message || 'Could not open the next round.')
    } finally {
      setBusy(false)
    }
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
