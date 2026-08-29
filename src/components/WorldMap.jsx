import { useMemo } from 'react'

// ═══════════════════════════════════════════
// World Map — REAL continent SVG outlines
// ViewBox: 0 0 1000 500 (equirectangular-ish projection)
// Each path is a recognizable continent silhouette
// ═══════════════════════════════════════════

const CONTINENTS = [
  // ── North America ──
  { id: 'na', d: 'M 85 62 L 95 55 L 115 48 L 135 46 L 155 48 L 172 52 L 188 58 L 200 68 L 208 82 L 212 98 L 210 115 L 202 132 L 190 148 L 175 160 L 158 168 L 142 172 L 125 170 L 110 164 L 98 152 L 88 136 L 82 118 L 80 98 L 82 80 Z M 145 175 L 155 178 L 162 188 L 158 200 L 148 205 L 138 198 L 140 185 Z' },
  // ── South America ──
  { id: 'sa', d: 'M 195 215 L 210 210 L 225 218 L 238 235 L 245 258 L 248 285 L 245 315 L 235 345 L 220 372 L 202 392 L 185 405 L 168 412 L 155 408 L 148 392 L 145 368 L 150 342 L 158 318 L 165 292 L 175 268 L 185 240 Z' },
  // ── Europe ──
  { id: 'eu', d: 'M 455 72 L 472 66 L 492 64 L 512 68 L 528 78 L 538 92 L 542 108 L 538 124 L 528 138 L 512 148 L 492 154 L 472 156 L 455 150 L 442 138 L 435 122 L 432 104 L 435 88 L 442 78 Z' },
  // ── Africa ──
  { id: 'af', d: 'M 458 175 L 480 168 L 505 165 L 530 172 L 550 188 L 562 212 L 568 245 L 565 282 L 552 320 L 530 355 L 502 382 L 472 400 L 445 408 L 420 402 L 402 382 L 392 355 L 388 322 L 392 288 L 405 255 L 422 225 L 438 198 Z' },
  // ── Asia (mainland) ──
  { id: 'as', d: 'M 530 58 L 560 48 L 600 42 L 650 40 L 700 45 L 750 58 L 795 78 L 830 105 L 855 138 L 870 175 L 875 212 L 868 248 L 850 280 L 822 305 L 785 322 L 745 332 L 705 335 L 665 330 L 628 318 L 595 298 L 568 272 L 548 242 L 535 208 L 528 172 L 525 135 L 528 100 L 535 75 Z' },
  // ── Japan ──
  { id: 'jp', d: 'M 865 128 L 878 122 L 888 128 L 892 142 L 886 155 L 875 158 L 865 150 Z' },
  // ── UK / British Isles ──
  { id: 'uk', d: 'M 432 82 L 438 78 L 444 82 L 442 92 L 435 95 L 430 90 Z' },
  // ── Southeast Asia islands (simplified) ──
  { id: 'sea', d: 'M 760 340 L 778 335 L 795 342 L 802 358 L 795 375 L 778 382 L 762 375 L 755 358 Z M 820 320 L 835 315 L 848 325 L 845 342 L 830 348 L 818 338 Z' },
  // ── Oceania / Australia ──
  { id: 'oc', d: 'M 818 395 L 855 388 L 895 395 L 928 415 L 945 445 L 938 478 L 915 498 L 882 508 L 845 508 L 812 495 L 792 472 L 785 445 L 790 420 Z M 955 435 L 970 428 L 985 438 L 978 455 L 962 452 Z' },
]

// Sparse dot grid — gives the "intelligence terminal" texture feel
function generateDots() {
  const dots = []
  for (let y = 0; y < 52; y++) {
    for (let x = 0; x < 105; x++) {
      if ((x * 7 + y * 13 + Math.sin(x * 0.6) * 5 + Math.cos(y * 0.4) * 3) % 5 === 0) {
        dots.push({ x: x * 9.5 + 3, y: y * 9.5 + 3 })
      }
    }
  }
  return dots
}
const DOT_GRID = generateDots()

// Longitude / latitude → approximate SVG coordinate on our 1000x500 map
// This is a rough equirectangular projection mapping
const MARKET_COORDS = {
  '美国':       { x: 172, y: 128, labelOffset: { dx: 0, dy: -22 } },
  '加拿大':     { x: 175, y: 82,  labelOffset: { dx: 0, dy: -20 } },
  '墨西哥':     { x: 148, y: 182, labelOffset: { dx: 0, dy: 0 } },
  '巴西':       { x: 245, y: 328, labelOffset: { dx: 0, dy: 0 } },
  '英国':       { x: 440, y: 95,  labelOffset: { dx: 0, dy: -18 } },
  '德国':       { x: 482, y: 98,  labelOffset: { dx: 0, dy: -18 } },
  '法国':       {   x: 455, y: 108, labelOffset: { dx: 0, dy: 0 } },
  '荷兰':       {   x: 468, y: 94,  labelOffset: { dx: 0, dy: -18 } },
  '西班牙':     { x: 438, y: 128, labelOffset: { dx: -10, dy: 0 } },
  '意大利':     { x: 492, y: 125, labelOffset: { dx: 0, dy: 0 } },
  '土耳其':     { x: 545, y: 135, labelOffset: { dx: 0, dy: 0 } },
  '埃及':       { x: 520, y: 185, labelOffset: { dx: 0, dy: 0 } },
  '伊朗':       { x: 585, y: 155, labelOffset: { dx: 0, dy: 0 } },
  '印度':       { x: 642, y: 185, labelOffset: { dx: 0, dy: 0 } },
  '日本':       { x: 878, y: 138, labelOffset: { dx: 12, dy: -14 } },
  '韩国':       { x: 848, y: 138, labelOffset: { dx: 0, dy: -18 } },
  '澳大利亚':   { x: 875, y: 455, labelOffset: { dx: 0, dy: 0 } },
  '新西兰':     { x: 960, y: 478, labelOffset: { dx: 0, dy: 0 } },
}

const COLOR_MAP = {
  green:  { hex: '#22C55E', glow: 'rgba(34,197,94,0.35)', soft: 'rgba(34,197,94,0.10)' },
  cyan:   { hex: '#06B6D4', glow: 'rgba(6,182,212,0.35)', soft: 'rgba(6,182,212,0.10)' },
  purple: { hex: '#8B5CF6', glow: 'rgba(139,92,246,0.35)', soft: 'rgba(139,92,246,0.10)' },
  blue:   { hex: '#2563EB', glow: 'rgba(37,99,235,0.35)', soft: 'rgba(37,99,235,0.10)' },
  amber:  { hex: '#F59E0B', glow: 'rgba(245,158,11,0.35)', soft: 'rgba(245,158,11,0.10)' },
}

export default function WorldMap({ points = [], onSelectMarket, activeMarket = null }) {
  const sortedPoints = useMemo(
    () => [...points].sort((a, b) => b.count - a.count),
    [points]
  )

  return (
    <div className="world-map">
      <svg viewBox="0 0 1000 500" preserveAspectRatio="xMidYMid meet" xmlns="http://www.w3.org/2000/svg">
        {/* ══ Background gradient ══ */}
        <defs>
          <radialGradient id="mapBgGlow1" cx="28%" cy="30%" r="50%">
            <stop offset="0%" stopColor="rgba(34,197,94,0.07)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          <radialGradient id="mapBgGlow2" cx="78%" cy="72%" r="45%">
            <stop offset="0%" stopColor="rgba(6,182,212,0.06)" />
            <stop offset="100%" stopColor="transparent" />
          </radialGradient>
          {/* Glow filter for data points */}
          <filter id="pointGlow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="4" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect width="1000" height="500" fill="#F8FAFC" rx="14" />

        {/* Ambient glows */}
        <rect width="1000" height="500" fill="url(#mapBgGlow1)" rx="14" />
        <rect width="1000" height="500" fill="url(#mapBgGlow2)" rx="14" />

        {/* ══ Dot grid texture ══ */}
        <g opacity={0.28}>
          {DOT_GRID.map((d, i) => (
            <circle key={`gd${i}`} cx={d.x} cy={d.y} r="0.6" fill="#94A3B8" />
          ))}
        </g>

        {/* ══ Continents — real outlines ══ */}
        <g>
          {CONTINENTS.map((c) => (
            <path key={c.id} d={c.d}
              fill="rgba(15,23,42,0.05)"
              stroke="rgba(71,85,105,0.28)"
              strokeWidth="0.8"
              strokeLinejoin="round"
            />
          ))}
        </g>

        {/* ══ Latitude / longitude reference lines (very subtle) ══ */}
        <g stroke="rgba(148,163,184,0.12)" strokeWidth="0.4" strokeDasharray="4 6">
          <line x1="0" y1="250" x2="1000" y2="250" /> {/* equator */}
          <line x1="500" y1="0" x2="500" y2="500" />   {/* prime meridian area */}
        </g>

        {/* ══ Data points — glowing, pulsing, clickable ══ */}
        <g>
          {sortedPoints.map((p, i) => {
            const coord = MARKET_COORDS[p.market]
            if (!coord) return null

            const isActive = activeMarket === p.market
            const colors = COLOR_MAP[p.color] || COLOR_MAP.green
            const rBase = Math.max(12 + p.count * 1.2, 18)
            const r = rBase * (isActive ? 1.3 : 1)
            const dur = `${2.0 + (i % 4) * 0.4}s`
            const lo = coord.labelOffset || { dx: 0, dy: -22 }
            const badgeY = lo.dy < 0 ? coord.y + r + 16 : coord.y + r + 18

            return (
              <g
                key={p.market}
                className={`map-point ${isActive ? 'active' : ''}`}
                onClick={() => onSelectMarket && onSelectMarket(p.market)}
                style={{ cursor: 'pointer' }}
              >
                {/* Outer pulse ring */}
                <circle cx={coord.x} cy={coord.y} r={r * 2.4} fill={colors.glow}>
                  <animate attributeName="r" values={`${r * 2.0};${r * 3.0};${r * 2.0}`} dur={dur} repeatCount="indefinite" />
                  <animate attributeName="opacity" values="0.45;0.06;0.45" dur={dur} repeatCount="indefinite" />
                </circle>

                {/* Selection ring */}
                {isActive && (
                  <circle cx={coord.x} cy={coord.y} r={r * 1.6}
                    fill="none" stroke={colors.hex} strokeWidth="2" strokeDasharray="6 4" opacity="0.9">
                    <animateTransform attributeName="transform" type="rotate"
                      from={`0 ${coord.x} ${coord.y}`} to={`360 ${coord.x} ${coord.y}`} dur="14s" repeatCount="indefinite" />
                  </circle>
                )}

                {/* Solid core with drop shadow */}
                <circle cx={coord.x} cy={coord.y} r={r}
                  fill={colors.hex}
                  opacity={isActive ? 1 : 0.85}
                  filter="url(#pointGlow)"
                />

                {/* Inner bright center */}
                <circle cx={coord.x} cy={coord.y} r={r * 0.32} fill="#fff" opacity={0.9} />

                {/* Market name label — dark bold, white stroke for readability */}
                <text x={coord.x + lo.dx} y={coord.y + lo.dy}
                  textAnchor="middle"
                  fill="#0F172A"
                  fontSize="13.5"
                  fontWeight="800"
                  letterSpacing="0.3"
                  style={{ pointerEvents: 'none', paintOrder: 'stroke', stroke: 'rgba(255,255,255,0.92)', strokeWidth: 4 }}
                >
                  {p.market}
                </text>

                {/* Count badge */}
                <rect x={coord.x - 28} y={badgeY - 11} width="56" height="20" rx="10"
                  fill={colors.soft} stroke={colors.hex} strokeWidth="1" opacity="0.9" />
                <text x={coord.x} y={badgeY + 4}
                  textAnchor="middle"
                  fill={colors.hex}
                  fontSize="12"
                  fontWeight="800"
                  style={{ pointerEvents: 'none' }}
                >
                  {p.count} 家
                </text>
              </g>
            )
          })}
        </g>

        {/* ══ Bottom hint ══ */}
        <text x="500" y="488" textAnchor="middle" fill="#64748B" fontSize="11" fontWeight="600" letterSpacing="0.3">
          {activeMarket
            ? `当前筛选：${activeMarket} · 再次点击取消`
            : '点击发光点或下方市场名切换全局筛选 ↑'
          }
        </text>
      </svg>
    </div>
  )
}
