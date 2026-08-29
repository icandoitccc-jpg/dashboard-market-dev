export default function Funnel({ steps = [], total = 0, accent = 'outbound' }) {
  if (!steps.length || total === 0) {
    return <div className="empty-block" style={{ padding: 20 }}>暂无可分析数据</div>
  }

  return (
    <div className={`funnel funnel-${accent}`}>
      {steps.map((step, idx) => {
        const pct = total > 0 ? (step.count / total) * 100 : 0
        const prevRate = idx > 0 && step.prev > 0 ? (step.count / step.prev) * 100 : null
        return (
          <div className="funnel-step" key={step.label}>
            <span className="funnel-marker" />
            <div className="funnel-name">
              {step.label}
              {step.sub ? <small>{step.sub}</small> : null}
            </div>
            <div className="funnel-bar-wrap">
              <div className="funnel-fill" style={{ width: `${Math.max(Math.min(pct, 100), step.count > 0 ? 2 : 0)}%` }} />
              <div className="funnel-content">
                <strong>{step.count}</strong>
                <span>{pct.toFixed(1)}%</span>
              </div>
            </div>
            <div className="funnel-meta">
              <span className="funnel-rate">{prevRate === null ? '—' : `${prevRate.toFixed(0)}%`}</span>
              <span>{prevRate === null ? '基准' : '较上步'}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
