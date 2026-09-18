import { useEffect, useRef, useState } from 'react'
import Question from './Question.jsx'
import Reveal from './Reveal.jsx'
import Button from '../components/Button.jsx'
import { primeAudio, playAnswerNotification, playReadyNotification, playRevealNotification } from '../lib/sounds.js'
import { notify } from '../lib/notifications.js'
import { openRound, fetchRound, submitAnswer, submitCustomQuestion, getCustomQuestion, getReveal, setVerdict, getGameSummary, finishGame, subscribeRounds } from '../lib/rounds.js'

const MODE_NAMES = { same_page: 'Same Page', ask_me_anything: 'Ask Me Anything', would_you_rather: 'Would You Rather', most_likely_to: 'Most Likely To', this_or_that: 'This or That', truth_or_dare: 'Truth or Dare', deep_dive: 'Deep Dive' }

export default function Play({ room, me, onExit, onPlayAgain }) {
  const idx = room.current_round
  const [round, setRound] = useState(null)
  const [mySubmission, setMySubmission] = useState(null)
  const [customQuestion, setCustomQuestion] = useState(null)
  const [myQuestionSubmitted, setMyQuestionSubmitted] = useState(false)
  const [reveal, setReveal] = useState(null)
  const [summary, setSummary] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const previousAnswerCount = useRef(null)
  const noticeTimer = useRef(null)

  function showNotice(message) {
    setNotice(message)
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setNotice(''), 2400)
  }

  useEffect(() => () => clearTimeout(noticeTimer.current), [])

  useEffect(() => {
    let active = true
    setError(''); setNotice(''); setRound(null); setReveal(null); setMySubmission(null); setCustomQuestion(null); setMyQuestionSubmitted(false)
    previousAnswerCount.current = null
    if (room.status === 'finished') return () => { active = false }
    fetchRound(room.code, idx).then((existing) => { if (active && existing) { setRound(existing); previousAnswerCount.current = existing.answer_count }; return existing || openRound(room.code, idx) }).then((opened) => { if (active && opened) setRound(opened) }).catch((e) => { if (active) setError(e.message || 'Something went wrong opening this round.') })
    return () => { active = false }
  }, [room.code, idx, room.status])

  useEffect(() => subscribeRounds(room.code, (row) => {
    if (row.idx !== idx) return
    const previous = previousAnswerCount.current
    if (previous !== null && row.answer_count > previous) {
      if (row.answer_count === 1 && !mySubmission) {
        playAnswerNotification()
        showNotice('Your partner submitted.')
        notify('Same Page', 'Your partner submitted an answer.')
      }
      if (row.answer_count >= 2 && previous < 2) {
        playReadyNotification()
        showNotice('Both of you are ready.')
        notify('Same Page', 'Both answers are in. Reveal is ready.')
        playRevealNotification()
      }
    }
    previousAnswerCount.current = row.answer_count
    setRound(row)
  }), [room.code, idx, mySubmission])

  useEffect(() => {
    if (!round || round.mode !== 'ask_me_anything' || round.question_count < 2 || mySubmission) return
    let active = true
    getCustomQuestion(room.code, idx, me).then((q) => { if (active && q) setCustomQuestion(q) }).catch(() => {})
    return () => { active = false }
  }, [round?.question_count, round?.mode, room.code, idx, me, mySubmission])

  useEffect(() => {
    if (!round?.revealed) return
    let active = true
    getReveal(room.code, idx).then((answers) => { if (active) setReveal(answers) }).catch((e) => { if (active && e.message !== 'Both answers are not in yet.') setError(e.message) })
    return () => { active = false }
  }, [room.code, idx, round?.revealed, round?.matched])

  useEffect(() => {
    if (room.status !== 'finished') return
    let active = true
    getGameSummary(room.code).then((data) => { if (active) setSummary(data) }).catch((e) => { if (active) setError(e.message || "We couldn't load your results.") })
    return () => { active = false }
  }, [room.code, room.status])

  async function handleCustomQuestion(value) { primeAudio(); setBusy(true); setError(''); try { await submitCustomQuestion(room.code, idx, me, value); setMyQuestionSubmitted(true); const fresh = await fetchRound(room.code, idx); if (fresh) setRound(fresh) } catch (e) { setError(e.message || "Couldn't save your question.") } finally { setBusy(false) } }
  async function handleSubmit(value) { primeAudio(); setBusy(true); setError(''); try { await submitAnswer(room.code, idx, me, value); setMySubmission(value); const fresh = await fetchRound(room.code, idx); if (fresh) setRound(fresh) } catch (e) { setError(e.message || "Your answer didn't go through. Try again.") } finally { setBusy(false) } }
  async function handleVerdict(verdict) { primeAudio(); setBusy(true); setError(''); try { await setVerdict(room.code, idx, me, verdict); setReveal(await getReveal(room.code, idx)); const updated = await fetchRound(room.code, idx); if (updated) setRound(updated) } catch (e) { setError(e.message || "We couldn't save that call. Try again.") } finally { setBusy(false) } }
  async function handleNext() { primeAudio(); setBusy(true); setError(''); try { if (idx + 1 >= room.total_rounds) await finishGame(room.code); else await openRound(room.code, idx + 1) } catch (e) { setError(e.message || "We couldn't move to the next round. Try again.") } finally { setBusy(false) } }

  const exitButton = <div className="mt-6 flex justify-center"><Button variant="ghost" onClick={onExit}>Leave game</Button></div>

  if (room.status === 'finished') {
    const rows = summary ?? []
    const matched = rows.filter((item) => item.matched === true).length
    const played = rows.length
    return <div className="min-h-dvh px-5 pb-8 pt-14"><div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] max-w-lg flex-col">
      <header className="text-center"><p className="seam-label">And that's a wrap.</p><h1 className="mt-4 text-4xl leading-tight">Game over.</h1><p className="mx-auto mt-4 max-w-xs text-cream/70">You made it through. Now let's inspect the evidence. 👀</p></header>
      <section className="my-10 text-center"><p className="font-display text-6xl text-apricot">{matched}/{played}</p><p className="mt-3 text-cream/60">matched rounds</p></section>
      <div className="space-y-3">{rows.map((item) => <div key={item.idx} className="rounded-2xl border border-cream/10 bg-plum/50 px-4 py-3"><div className="flex items-center justify-between gap-4"><span className="text-sm text-cream/70">Round {item.idx + 1} · {MODE_NAMES[item.mode] || 'Game'}</span><span className="font-display">{item.matched === true ? 'Matched' : item.matched === false ? 'Different' : 'Done'}</span></div><p className="mt-1 text-sm text-cream/45">{item.prompt}</p></div>)}</div>
      <div className="mt-auto space-y-3 pt-8"><Button onClick={onPlayAgain}>Play Again</Button>{exitButton}</div>
    </div></div>
  }

  if (!round) return <div className="flex min-h-dvh items-center justify-center px-5">{error ? <p className="text-center text-cherry">{error}</p> : <p className="seam-label">Getting round {idx + 1} ready...</p>}</div>
  if (round.revealed && reveal) return <div className="min-h-dvh px-5 pb-8 pt-14"><div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] max-w-lg flex-col"><Reveal room={room} round={round} me={me} reveal={reveal} onVerdict={handleVerdict} onNext={handleNext} busy={busy} isLastRound={idx + 1 >= room.total_rounds}/><div className="mt-auto">{exitButton}</div></div></div>

  const activeRound = round.mode === 'ask_me_anything' ? { ...round, prompt: customQuestion || 'Write a question for your person.', kind: customQuestion ? 'text' : 'custom_question' } : round
  return <div className="min-h-dvh px-5 pb-8 pt-14"><div className="mx-auto flex min-h-[calc(100dvh-5.5rem)] max-w-lg flex-col"><div className="mb-3 text-center"><span className="seam-label">{MODE_NAMES[round.mode] || 'Round'} · Round {round.idx + 1}</span></div><Question round={activeRound} mySubmission={mySubmission} myQuestionSubmitted={myQuestionSubmitted} onSubmit={handleSubmit} onSubmitCustomQuestion={handleCustomQuestion} busy={busy}/><div className="mt-auto">{exitButton}</div>{notice && <div className="pointer-events-none fixed bottom-5 left-5 right-5 z-40 flex justify-center"><div className="rounded-full border border-cream/15 bg-ink/95 px-4 py-3 text-center text-sm text-cream shadow-2xl">{notice}</div></div>}{error && <p className="fixed bottom-4 left-5 right-5 text-center text-sm text-cherry">{error}</p>}</div></div>
}
