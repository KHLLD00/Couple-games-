let audioContext
const STORAGE_KEY = 'same-page:sound-enabled'

export function isSoundEnabled() {
  if (typeof window === 'undefined') return true
  return localStorage.getItem(STORAGE_KEY) !== 'false'
}

export function setSoundEnabled(enabled) {
  if (typeof window !== 'undefined') localStorage.setItem(STORAGE_KEY, String(enabled))
  if (enabled) primeAudio()
}

function getContext() {
  if (typeof window === 'undefined') return null
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

export function primeAudio() {
  getContext()
}

function tone(ctx, frequency, start, duration, volume = 0.028) {
  const oscillator = ctx.createOscillator()
  const gain = ctx.createGain()
  oscillator.type = 'sine'
  oscillator.frequency.value = frequency
  gain.gain.setValueAtTime(0.0001, start)
  gain.gain.exponentialRampToValueAtTime(volume, start + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration)
  oscillator.connect(gain).connect(ctx.destination)
  oscillator.start(start)
  oscillator.stop(start + duration + 0.02)
}

function playSequence(notes) {
  if (!isSoundEnabled()) return
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  notes.forEach(([frequency, offset, duration, volume]) => tone(ctx, frequency, now + offset, duration, volume))
}

export function playTap() {
  playSequence([[520, 0, 0.045, 0.018]])
}

export function playPartnerJoined() {
  playSequence([[520, 0, 0.07, 0.018], [740, 0.06, 0.1, 0.024]])
}

export function playAnswerNotification() {
  playSequence([[660, 0, 0.11, 0.024], [880, 0.07, 0.13, 0.026]])
}

export function playReadyNotification() {
  playSequence([[587.33, 0, 0.09, 0.022], [783.99, 0.07, 0.12, 0.025]])
}

export function playRevealNotification() {
  playSequence([[523.25, 0, 0.11, 0.023], [659.25, 0.08, 0.12, 0.026], [783.99, 0.16, 0.18, 0.028]])
}

export function playCompleteNotification() {
  playSequence([[392, 0, 0.11, 0.022], [523.25, 0.09, 0.13, 0.025], [659.25, 0.18, 0.2, 0.028]])
}
