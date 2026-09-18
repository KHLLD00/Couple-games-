import { playTap } from '../lib/sounds.js'

const styles = {
  primary: 'bg-cherry text-cream shadow-[0_6px_0_0_#B32C48]',
  ghost: 'bg-transparent text-cream border border-cream/25'
}

export default function Button({ variant = 'primary', className = '', onClick, ...props }) {
  function handleClick(event) {
    playTap()
    onClick?.(event)
  }

  return (
    <button
      {...props}
      onClick={handleClick}
      className={`pressable w-full rounded-2xl px-5 py-4 font-bold tracking-tight
        disabled:opacity-40 disabled:shadow-none ${styles[variant]} ${className}`}
    />
  )
}
