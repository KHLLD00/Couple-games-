export default function Toast({ message }) {
  if (!message) return null
  return (
    <div className="pointer-events-none fixed inset-x-4 bottom-5 z-50 flex justify-center" aria-live="polite" aria-atomic="true">
      <div className="max-w-sm rounded-full border border-cream/15 bg-ink/95 px-4 py-3 text-center text-sm text-cream shadow-2xl backdrop-blur">
        {message}
      </div>
    </div>
  )
}
