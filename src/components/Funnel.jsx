// Conversion funnel visualization
// Layout: marker | name (outside, always readable) | bar (label left + count right, inside) | meta
// No absolute positioning — everything stays in its grid cell
export default function Funnel({ steps = [], total = 0 }) {
  if (!steps.length || total === 0) {
    return <div className="empty-block" style={{ padding: 20 }}>暂无转化数据</div>
  }
  return (
    <div className="funnel">
      {steps.map((step, idx) => {
        const pct = total > 0 ? (step.count / total) * 100 : 0
        // Keep a visible minimum so the bar never disappears
        const widthPct = Math.max(pct, 3)
        const isEmpty = step.count === 0
        return (
          <div className="funnel-step" key={idx}>
            <span
              className="funnel-marker"
              style={{ background: ['var(--green)', 'var(--cyan)', 'var(--blue)', 'var(--purple)'][idx] || 'var(--green)' }}
            />
            <div className="funnel-name">
              {step.label}
              {step.sub ? <small>{step.sub}</small> : null}
            </div>
            <div className="funnel-bar-wrap">
              {(() => {
                const barClass = isEmpty ? 'funnel-bar step-empty' : `funnel-bar step-${Math.min(idx + 1, 4)}`
                return (
                  <div className={barClass} style={{ width: `${widthPct}%` }}>
                    {/* Label on LEFT side of bar */}
                    {widthPct >= 28 ? <span className="funnel-label">{step.label}</span> : null}
                    {/* Count + pct on RIGHT side of bar — always inside, never overlaps */}
                    <span className="funnel-counts">
                      <strong>{step.count}</strong>
                      {pct > 0 && <span className="funnel-pct">{pct.toFixed(1)}%</span>}
                    </span>
                  </div>
                )
              })()}
            </div>
            <div className="funnel-meta">
              {idx > 0 && step.prev > 0 ? (
                <>
                  <span className="funnel-rate">{((step.count / step.prev) * 100).toFixed(0)}%</span>
                  <span>较上步</span>
                </>
              ) : (
                <>
                  <span className="funnel-rate">—</span>
                  <span>基准</span>
                </>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
