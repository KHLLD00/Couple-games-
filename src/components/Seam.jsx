export function Seam({ children, className = '' }) {
  return <div className={`seam ${className}`}>{children}</div>
}

export function SeamHalf({ label, sealed = false, children }) {
  return (
    <div className={`seam-half ${sealed ? 'seam-sealed' : ''}`}>
      <span className="seam-label">{label}</span>
      {children}
    </div>
  )
}
