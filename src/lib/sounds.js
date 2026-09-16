let audioContext

function getContext() {
  if (typeof window === 'undefined') return null
  audioContext ||= new (window.AudioContext || window.webkitAudioContext)()
  if (audioContext.state === 'suspended') audioContext.resume().catch(() => {})
  return audioContext
}

export function primeAudio() {
  getContext()
}

function tone(ctx, frequency, start, duration, volume = 0.035) {
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

export function playAnswerNotification() {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  tone(ctx, 660, now, 0.12)
  tone(ctx, 880, now + 0.07, 0.14)
}

export function playRevealNotification() {
  const ctx = getContext()
  if (!ctx) return
  const now = ctx.currentTime
  tone(ctx, 523.25, now, 0.12)
  tone(ctx, 659.25, now + 0.08, 0.12)
  tone(ctx, 783.99, now + 0.16, 0.18)
}
