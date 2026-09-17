import { useState } from 'react'
import Button from '../components/Button.jsx'
import { Seam, SeamHalf } from '../components/Seam.jsx'

const MODE_HINTS = {
  same_page: 'Answer honestly. They cannot see yours yet.',
  ask_me_anything: 'Ask something you actually want to know.',
  would_you_rather: 'Pick one. They are making their choice too.',
  most_likely_to: 'Choose who fits the prompt. No lobbying.',
  this_or_that: 'Trust your instinct. Pick one.',
  truth_or_dare: 'Truth or dare. Your move.',
  deep_dive: 'Take your time. This one is worth thinking about.'
}

export default function Question({ round, mySubmission, myQuestionSubmitted, onSubmit, onSubmitCustomQuestion, busy }) {
  const [text, setText] = useState('')
  const submitted = Boolean(mySubmission)
  const isCustom = round.kind === 'custom_question'
  const isTruth = round.mode === 'truth_or_dare' && round.prompt?.toLowerCase().startsWith('truth:')
  const isDare = round.mode === 'truth_or_dare' && round.prompt?.toLowerCase().startsWith('dare:')
  const otherHere = round.answer_count >= (submitted ? 2 : 1)

  function sendCustom() { onSubmitCustomQuestion(text.trim()); setText('') }

  const prompt = round.prompt?.replace(/^(Truth|Dare):\s*/i, '')

  return (
    <div className="flex min-h-dvh flex-col justify-between px-5 pb-8 pt-14">
      <header className="text-center">
        <p className="seam-label">{isTruth ? 'Truth' : isDare ? 'Dare' : round.mode === 'ask_me_anything' ? 'Your question' : `Round ${round.idx + 1}`}</p>
        <h2 className="mx-auto mt-4 max-w-sm text-3xl leading-tight">{prompt}</h2>
        <p className="mx-auto mt-3 max-w-xs text-sm text-cream/40">{MODE_HINTS[round.mode] || MODE_HINTS.same_page}</p>
      </header>

      <section className="my-8">
        <Seam>
          <SeamHalf label="You"><span className="font-display text-lg">{submitted ? mySubmission : myQuestionSubmitted ? 'Question sent ✓' : isCustom ? 'Write something good...' : 'Still thinking...'}</span></SeamHalf>
          <SeamHalf label="Them" sealed>
            <span className="text-sm text-cream/45">{round.mode === 'ask_me_anything' && round.question_count < 2 ? 'Writing a question...' : otherHere ? 'They answered 👀' : 'Still waiting...'}</span>
          </SeamHalf>
        </Seam>
      </section>

      {round.mode === 'ask_me_anything' && !myQuestionSubmitted && !customQuestionDone(round) ? (
        <div className="space-y-3">
          <textarea autoFocus value={text} onChange={(e)=>setText(e.target.value.slice(0,300))} placeholder="Ask them something..." rows={3} className="w-full rounded-2xl border border-cream/20 bg-plum/70 px-5 py-4 text-lg text-cream placeholder:text-cream/25" />
          <Button onClick={sendCustom} disabled={busy || text.trim().length < 3}>Send the question</Button>
        </div>
      ) : submitted ? (
        <p className="text-center text-cream/60">Locked. Their answer is still hiding.</p>
      ) : isCustom ? (
        <p className="text-center text-cream/60">Waiting for their question...</p>
      ) : round.kind === 'choice' ? (
        <div className="space-y-3">{(round.options || []).map((opt)=><Button key={opt} variant="ghost" disabled={busy} onClick={()=>onSubmit(opt)} className="min-h-16 text-left">{opt}</Button>)}</div>
      ) : (
        <div className="space-y-3"><textarea autoFocus value={text} onChange={(e)=>setText(e.target.value.slice(0,500))} placeholder={isDare ? 'Do it. Then tell them what happened...' : 'Say it with your chest...'} rows={3} className="w-full rounded-2xl border border-cream/20 bg-plum/70 px-5 py-4 text-lg text-cream placeholder:text-cream/25"/><Button onClick={()=>onSubmit(text.trim())} disabled={busy||!text.trim()}>{isDare ? 'I did it' : 'Lock it in'}</Button></div>
      )}
    </div>
  )
}

function customQuestionDone(round) { return round.question_count >= 2 }
