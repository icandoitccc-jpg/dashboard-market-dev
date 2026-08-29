import { useMemo } from 'react'

// Dual-line trend chart with gradient area fill and gentle grid
// props: series = [{ name, color: 'green'|'cyan', data: number[] }], labels = string[]
export default function TrendChart({ series = [], labels = [], width = 700, height = 220 }) {
  const padding = { top: 16, right: 16, bottom: 28, left: 36 }
  const w = width - padding.left - padding.right
  const h = height - padding.top - padding.bottom

  const { paths, yTicks, xTicks, maxV } = useMemo(() => {
    const allVals = series.flatMap((s) => s.data || [])
    const maxV = Math.max(...allVals, 1)
    const xCount = labels.length || (series[0]?.data?.length ?? 0)
    const xStep = xCount > 1 ? w / (xCount - 1) : w
    const yToPx = (v) => padding.top + h - (v / maxV) * h

    const paths = series.map((s) => {
      const pts = (s.data || []).map((v, i) => [padding.left + i * xStep, yToPx(v)])
      const line = pts.map((p, i) => (i === 0 ? `M${p[0]},${p[1]}` : `L${p[0]},${p[1]}`)).join(' ')
      const area = pts.length ? `${line} L${padding.left + (pts.length - 1) * xStep},${padding.top + h} L${padding.left},${padding.top + h} Z` : ''
      return { ...s, line, area, pts }
    })

    const yTicks = [0, 0.25, 0.5, 0.75, 1].map((p) => ({
      y: padding.top + h - p * h,
      v: Math.round(p * maxV),
    }))

    const xTickCount = Math.min(xCount, 6)
    const xTicks = Array.from({ length: xTickCount }, (_, i) => ({
      x: padding.left + (i * (xCount - 1)) / Math.max(xTickCount - 1, 1) * xStep,
      label: labels[Math.round((i * (xCount - 1)) / Math.max(xTickCount - 1, 1))] || '',
    }))

    return { paths, yTicks, xTicks, maxV }
  }, [series, labels, w, h, padding.top, padding.left])

  return (
    <svg className="trend-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <defs>
        <linearGradient id="trend-grad-green" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#22C55E" stopOpacity="0.30" />
          <stop offset="100%" stopColor="#22C55E" stopOpacity="0" />
        </linearGradient>
        <linearGradient id="trend-grad-cyan" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#06B6D4" stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* grid */}
      <g className="grid">
        {yTicks.map((t, i) => (
          <line key={`y${i}`} x1={padding.left} y1={t.y} x2={padding.left + w} y2={t.y} />
        ))}
      </g>

      {/* y-axis labels */}
      {yTicks.map((t, i) => (
        <text key={`yl${i}`} className="axis-label" x={padding.left - 8} y={t.y + 3} textAnchor="end">{t.v}</text>
      ))}

      {/* x-axis labels */}
      {xTicks.map((t, i) => (
        <text key={`xl${i}`} className="axis-label" x={t.x} y={padding.top + h + 18} textAnchor="middle">{t.label}</text>
      ))}

      {/* lines + areas */}
      {paths.map((p, i) => (
        <g key={i}>
          <path className={`area-${p.color}`} d={p.area} />
          <path className={`line-${p.color}`} d={p.line} />
          {p.pts.map((pt, j) => (
            <circle key={j} cx={pt[0]} cy={pt[1]} r="2.5" fill={p.color === 'cyan' ? '#06B6D4' : '#22C55E'} />
          ))}
        </g>
      ))}
    </svg>
  )
}
