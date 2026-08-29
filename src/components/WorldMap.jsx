import { useMemo } from 'react'
import { geoGraticule10, geoNaturalEarth1, geoPath } from 'd3-geo'
import { feature } from 'topojson-client'
import world from 'world-atlas/countries-110m.json'

const WIDTH = 1000
const HEIGHT = 500
const COUNTRIES = feature(world, world.objects.countries).features
const PROJECTION = geoNaturalEarth1().fitExtent([[18, 18], [WIDTH - 18, HEIGHT - 18]], {
  type: 'FeatureCollection',
  features: COUNTRIES,
})
const PATH = geoPath(PROJECTION)
const GRATICULE_PATH = PATH(geoGraticule10())

// Real longitude / latitude coordinates. d3-geo projects these positions;
// marker placement is no longer drawn by hand in SVG space.
const MARKET_COORDS = {
  美国: [-98.5, 39.5], 加拿大: [-106.3, 56.1], 墨西哥: [-102.6, 23.6], 巴西: [-51.9, -14.2],
  英国: [-3.4, 55.4], 德国: [10.4, 51.2], 法国: [2.2, 46.2], 荷兰: [5.3, 52.1],
  西班牙: [-3.7, 40.4], 意大利: [12.6, 41.9], 土耳其: [35.2, 39.0], 埃及: [30.8, 26.8],
  伊朗: [53.7, 32.4], 印度: [78.9, 20.6], 日本: [138.3, 36.2], 韩国: [127.8, 36.5],
  澳大利亚: [133.8, -25.3], 新西兰: [174.9, -40.9], 新加坡: [103.8, 1.35],
  阿联酋: [53.8, 23.4], 沙特阿拉伯: [45.1, 23.9], 南非: [24.7, -28.5],
  泰国: [100.9, 15.9], 印度尼西亚: [113.9, -0.8], 马来西亚: [101.9, 4.2],
  瑞士: [8.2, 46.8], 瑞典: [18.6, 60.1], 挪威: [8.5, 60.5], 丹麦: [9.5, 56.3],
  波兰: [19.1, 51.9], 捷克: [15.5, 49.8], 葡萄牙: [-8.2, 39.4], 爱尔兰: [-8.2, 53.4],
  比利时: [4.5, 50.5],
}

const COLOR_MAP = {
  green: { hex: '#16A34A', glow: 'rgba(34,197,94,0.24)' },
  cyan: { hex: '#0891B2', glow: 'rgba(6,182,212,0.24)' },
  purple: { hex: '#7C3AED', glow: 'rgba(124,58,237,0.24)' },
}

export default function WorldMap({ points = [], onSelectMarket, activeMarket = null, metricLabel = '条记录' }) {
  const projectedPoints = useMemo(() => points.flatMap((point) => {
    const lonLat = MARKET_COORDS[point.market]
    const projected = lonLat ? PROJECTION(lonLat) : null
    return projected ? [{ ...point, x: projected[0], y: projected[1] }] : []
  }).sort((a, b) => b.count - a.count), [points])

  return (
    <div className="world-map">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} preserveAspectRatio="xMidYMid meet" aria-label="全球市场分布地图">
        <rect width={WIDTH} height={HEIGHT} className="map-background" rx="14" />
        <path d={GRATICULE_PATH || ''} className="map-graticule" />
        <g className="map-countries">
          {COUNTRIES.map((country) => <path key={country.id} d={PATH(country) || ''} className="map-country" />)}
        </g>
        <g>
          {projectedPoints.map((point, index) => {
            const active = activeMarket === point.market
            const color = COLOR_MAP[point.color] || COLOR_MAP.green
            // Keep low-volume neighbouring markets individually clickable.
            // Large radii made Turkey/Egypt and Germany overlap in Inbound mode.
            const radius = Math.min(8 + Math.sqrt(point.count) * 2, 21)
            return (
              <g
                key={point.market}
                className={`map-point ${active ? 'active' : ''}`}
                role="button"
                tabIndex="0"
                aria-label={`${point.market}，${point.count}${metricLabel}`}
                onClick={() => onSelectMarket?.(point.market)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault()
                    onSelectMarket?.(point.market)
                  }
                }}
              >
                <circle cx={point.x} cy={point.y} r={radius * 2.2} fill={color.glow} className="map-point-pulse" style={{ animationDelay: `${index * 180}ms` }} />
                {active ? <circle cx={point.x} cy={point.y} r={radius * 1.55} className="map-selection-ring" style={{ stroke: color.hex }} /> : null}
                <circle cx={point.x} cy={point.y} r={radius} fill={color.hex} className="map-point-core" />
                <circle cx={point.x} cy={point.y} r={radius * 0.3} fill="#fff" opacity="0.92" />
                <text x={point.x} y={point.y - radius - 9} className="map-market-label">{point.market}</text>
                <text x={point.x} y={point.y + 4} className="map-value-label">{point.count}</text>
              </g>
            )
          })}
        </g>
      </svg>
    </div>
  )
}
