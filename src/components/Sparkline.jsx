import { useMemo } from 'react'

// Compact SVG line chart for KPI cards.
// props: data = number[], color = 'green' | 'cyan' | 'blue' | 'purple'
export default function Sparkline({ data = [], color = 'green', width = 140, height = 30 }) {
  const path = useMemo(() => {
    if (!data.length) return { line: '', area: '', dots: [] }
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1
    const step = width / (data.length - 1 || 1)
    const pts = data.map((v, i) => [i * step, height - 2 - ((v - min) / range) * (height - 4)])
    const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
    const area = `${line} L${width},${height} L0,${height} Z`
    return { line, area, dots: pts }
  }, [data, width, height])

  if (!data.length || data.length < 2) {
    return (
      <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`}>
        <line x1={0} y1={height - 1} x2={width} y2={height - 1} stroke="rgba(148,163,184,0.2)" strokeWidth="1" />
      </svg>
    )
  }

  return (
    <svg className="sparkline" width={width} height={height} viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`spark-grad-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={`var(--${color === 'cyan' ? 'cyan' : color === 'blue' ? 'blue' : color === 'purple' ? 'purple' : 'green'})`} stopOpacity="0.35" />
          <stop offset="100%" stopColor={`var(--${color === 'cyan' ? 'cyan' : color === 'blue' ? 'blue' : color === 'purple' ? 'purple' : 'green'})`} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path className="area" d={path.area} fill={`url(#spark-grad-${color})`} />
      <path className={`line ${color}`} d={path.line} />
    </svg>
  )
}
