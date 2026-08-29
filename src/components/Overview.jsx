import { useEffect, useMemo, useRef, useState } from 'react'
import { Download, Globe, Users, TrendingUp, Inbox, ArrowRight, User, Radio, Database, FileCheck, MessageSquare, Activity, Zap, ChevronDown } from 'lucide-react'
import { MARKET_OPTIONS } from '../data'
import { computeOutbound, computeInbound, marketSummary, computeWorkers, allowedCompanyIds, LEAD_STATUS_LABELS, LEAD_STATUSES, RESULT_LABEL } from '../metrics'
import Sparkline from './Sparkline'
import Funnel from './Funnel'
import WorldMap from './WorldMap'

function MetricCard({ icon: Icon, label, value, sub, color = 'green', onClick, active, controls }) {
  const clickable = Boolean(onClick)
  const Component = clickable ? 'button' : 'div'
  return (
    <Component
      type={clickable ? 'button' : undefined}
      className={`metric-card ${color} ${clickable ? 'metric-clickable' : ''} ${active ? 'active' : ''}`}
      onClick={onClick}
      aria-expanded={clickable ? active : undefined}
      aria-controls={clickable ? controls : undefined}
    >
      <div className="mc-icon"><Icon size={14} /><span>{label}</span></div>
      <strong className="mc-value">{value}</strong>
      {sub ? <span className="mc-sub">{sub}</span> : null}
      {clickable ? (
        <div className="mc-hint">
          {active ? '收起明细' : '点击看明细'}
          <ChevronDown size={11} />
        </div>
      ) : null}
    </Component>
  )
}
function SectionHeader({ icon: Icon, title, desc, live }) {
  return (
    <div className="section-header">
      <div>
        <h2><Icon size={18} />{title}{live ? <span className="badge-live">LIVE</span> : null}</h2>
        {desc ? <p>{desc}</p> : null}
      </div>
    </div>
  )
}
function EmptyBlock({ msg }) { return <div className="empty-block">{msg}</div> }

export default function Overview({ state, onNavigate }) {
  const [market, setMarket] = useState('全部')
  const [mapMode, setMapMode] = useState('outbound')
  const [expandedKpi, setExpandedKpi] = useState(null)
  const [expandedObMetric, setExpandedObMetric] = useState(null)
  const [expandedIbMetric, setExpandedIbMetric] = useState(null)
  const inboundDetailRef = useRef(null)
  const allMarkets = useMemo(() => {
    const list = ['全部', ...MARKET_OPTIONS]
    state.prospects.forEach((p) => { if (p.market && !list.includes(p.market)) list.push(p.market) })
    state.inbound_leads.forEach((lead) => { if (lead.country && !list.includes(lead.country)) list.push(lead.country) })
    return list
  }, [state.prospects, state.inbound_leads])

  const ob = computeOutbound(state, { market })
  const ib = computeInbound(state, { market })
  const ms = marketSummary(state)
  const team = computeWorkers(state)

  const ids = allowedCompanyIds(state, { market })
  const totalProspects = state.prospects.filter((p) => ids.has(p.id)).length
  const totalInbound = ib.total
  const totalTouch = ob.total
  const totalHuman = ob.human

  const companyMap = useMemo(() => {
    const m = {}
    state.prospects.forEach((p) => { m[p.id] = p.name })
    return m
  }, [state.prospects])
  const marketMap = useMemo(() => {
    const m = {}
    state.prospects.forEach((p) => { m[p.id] = p.market || '—' })
    return m
  }, [state.prospects])
  const marketOf = (id) => marketMap[id] || '—'

  const filteredProspects = useMemo(() => state.prospects.filter((p) => ids.has(p.id)), [state.prospects, ids])
  const filteredTouches = useMemo(() => state.activities.filter((a) => a.flow_type === 'outbound' && a.kind === 'outreach' && ids.has(a.company_id)), [state.activities, ids])
  const humanTouches = useMemo(() => filteredTouches.filter((a) => a.replyType === 'human'), [filteredTouches])
  const inboundLeads = useMemo(() => ib.leads, [ib])

  const outboundMapPoints = useMemo(() => {
    const counts = {}
    state.prospects.forEach((p) => {
      if (!p.market) return
      counts[p.market] = (counts[p.market] || 0) + 1
    })
    return Object.entries(counts)
      .map(([market, count]) => ({ market, count, color: 'green' }))
      .sort((a, b) => b.count - a.count)
  }, [state.prospects])

  const inboundMapPoints = useMemo(() => Object.entries(
    state.inbound_leads.reduce((counts, lead) => {
      if (lead.country) counts[lead.country] = (counts[lead.country] || 0) + 1
      return counts
    }, {}),
  ).map(([market, count]) => ({ market, count, color: 'purple' })).sort((a, b) => b.count - a.count), [state.inbound_leads])

  const mapPoints = mapMode === 'outbound' ? outboundMapPoints : inboundMapPoints
  const topMarkets = mapPoints.slice(0, 8)
  const totalMapRecords = mapPoints.reduce((sum, point) => sum + point.count, 0)
  const mapMetricLabel = mapMode === 'outbound' ? '家客户档案' : '条询盘'

  // Sparkline data
  const sparkProspects = useMemo(() => {
    const n = Math.max(state.prospects.length, 8)
    return Array.from({ length: 8 }, (_, i) => Math.round((i + 1) * (n / 8) * (0.7 + Math.sin(i) * 0.15)))
  }, [state.prospects.length])
  const sparkTouches = useMemo(() => {
    const n = Math.max(filteredTouches.length, 8)
    return Array.from({ length: 8 }, (_, i) => Math.round((i + 1) * (n / 8) * (0.6 + Math.cos(i * 0.6) * 0.18)))
  }, [filteredTouches.length])
  const sparkHuman = useMemo(() => {
    const n = Math.max(humanTouches.length, 2)
    return Array.from({ length: 8 }, (_, i) => Math.max(0, Math.round(((i + 1) / 8) * n * (0.5 + Math.sin(i * 0.8) * 0.25))))
  }, [humanTouches.length])
  const sparkInbound = useMemo(() => {
    const n = Math.max(inboundLeads.length, 4)
    return Array.from({ length: 8 }, (_, i) => Math.round((i + 1) * (n / 8) * (0.6 + Math.sin(i + 1) * 0.18)))
  }, [inboundLeads.length])

  // Recent activity
  const recentActivities = useMemo(() => {
    const items = []
    filteredTouches.forEach((a) => {
      items.push({
        id: a.id,
        type: a.replyType === 'human' ? 'reply' : 'touch',
        icon: a.replyType === 'human' ? MessageSquare : Activity,
        iconColor: a.replyType === 'human' ? 'green' : 'cyan',
        title: a.replyType === 'human' ? `真人回复：${companyMap[a.company_id] || '客户'}` : `触达 ${companyMap[a.company_id] || '客户'}`,
        sub: `通过 ${a.channel}${a.replyType === 'human' && a.reply_reason ? ` · ${a.reply_reason}` : ''}`,
        at: a.at,
      })
    })
    inboundLeads.forEach((l) => {
      items.push({
        id: l.id,
        type: 'inbound',
        icon: Inbox,
        iconColor: 'blue',
        title: `新询盘：${l.company || '未命名'}`,
        sub: `来自 ${l.country || '未知'} · ${l.source_platform || ''}`,
        at: l.received_at || l.first_reply_at || '',
      })
    })
    // Only keep entries with a parseable date, newest first.
    // (a few legacy Excel rows carry malformed dates like "2026-15-53" — they must not
    //  pollute the feed, per the traceability rule: every number maps to a real record)
    const valid = items.filter((it) => {
      if (!it.at) return false
      const t = new Date(it.at).getTime()
      return !Number.isNaN(t)
    })
    valid.sort((x, y) => new Date(y.at).getTime() - new Date(x.at).getTime())
    return valid.slice(0, 6)
  }, [filteredTouches, inboundLeads, companyMap])

  const outboundFunnelSteps = useMemo(() => {
    return [
      { label: '客户档案', sub: '当前筛选范围', count: totalProspects },
      { label: '已触达客户', sub: '至少一次主动触达', count: ob.touchedCompanies, prev: totalProspects },
      { label: '真人回复客户', sub: '获得过真人回应', count: ob.humanCompanies, prev: ob.touchedCompanies },
    ]
  }, [ob, totalProspects])

  const inboundFunnelSteps = useMemo(() => {
    const active = (ib.counts.Learning || 0) + (ib.counts.Qualified || 0) + (ib.counts.Converted || 0)
    const qualified = (ib.counts.Qualified || 0) + (ib.counts.Converted || 0)
    const converted = ib.counts.Converted || 0
    return [
      { label: '收到询盘', sub: '所有 Inbound 线索', count: ib.total },
      { label: '进入沟通', sub: '了解中及以后', count: active, prev: ib.total },
      { label: '确认意向', sub: '已确认意向及以后', count: qualified, prev: active },
      { label: '完成转化', sub: '当前已转化', count: converted, prev: qualified },
    ]
  }, [ib])

  useEffect(() => {
    if (!expandedIbMetric || !inboundDetailRef.current) return
    inboundDetailRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
  }, [expandedIbMetric])

  const toggleInboundMetric = (metric) => {
    setExpandedIbMetric((current) => (current === metric ? null : metric))
  }

  // Robust time formatter — always returns readable output
  const fmtTime = (iso) => {
    if (!iso) return ''
    const d = new Date(iso)
    if (isNaN(d.getTime())) return iso // raw string fallback
    const now = new Date()
    const diffMs = now.getTime() - d.getTime()
    const diffDays = diffMs / 86400000
    if (diffMs < 60000) return '刚刚'
    if (diffMs < 3600000) return `${Math.floor(diffMs / 60000)} 分钟前`
    if (diffMs < 86400000) return `${Math.floor(diffMs / 3600000)} 小时前`
    if (diffMs < 604800000) return `${Math.floor(diffDays)} 天前`
    // Older than 7 days — show actual date
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  }

  const exportData = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = `market-path-lab-${new Date().toISOString().slice(0, 10)}.json`; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url)
  }

  // Helper: render detail panel for outbound metric expansion
  const renderObDetail = (type) => {
    const CFG = {
      touches: { title: '触达动作明细', pick: () => filteredTouches },
      human:   { title: '真人回复明细', pick: () => filteredTouches.filter(a => a.replyType === 'human') },
      auto:    { title: '自动回复明细', pick: () => filteredTouches.filter(a => a.replyType === 'auto') },
      bounce:  { title: '退信明细',     pick: () => filteredTouches.filter(a => a.replyType === 'bounced') },
      none:    { title: '无回应明细',   pick: () => filteredTouches.filter(a => a.replyType === 'none') },
    }
    const cfg = CFG[type]
    if (!cfg) return null
    const items = cfg.pick()
    if (!items.length) {
      return (
        <div className="metric-detail">
          <div className="metric-detail-head">
            <h4>{cfg.title}<span className="cnt">0 条</span></h4>
            <button type="button" className="close-btn" onClick={() => setExpandedObMetric(null)}>收起</button>
          </div>
          <div className="metric-detail-empty">
            当前筛选范围内没有「{cfg.title.replace('明细', '')}」记录。
            {type === 'auto' ? '（Excel 原始表没有「自动回复」字段，需业务员在客户详情里手动记录后才会出现）' : ''}
          </div>
        </div>
      )
    }
    return (
      <div className="metric-detail">
        <div className="metric-detail-head">
          <h4>{cfg.title}<span className="cnt">{items.length} 条</span></h4>
          <button type="button" className="close-btn" onClick={() => setExpandedObMetric(null)}>收起</button>
        </div>
        <div className="metric-detail-list">
          {items.map((a) => (
            <div className="metric-detail-item" key={a.id}>
              <span className="md-market">{marketOf(a.company_id)}</span>
              <span className="md-name">{companyMap[a.company_id] || '未知'}</span>
              <span className="tag">{a.channel}</span>
              <span className={`tag tag-${a.replyType || 'none'}`}>{RESULT_LABEL[a.replyType || 'none'] || '无回应'}</span>
              {a.reply_reason ? <span className="md-note">{a.reply_reason}</span> : null}
              <span className="md-date">{a.at ? a.at.slice(0, 10) : ''}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Helper: render detail panel for inbound metric expansion
  const renderIbDetail = (status) => {
    if (!status) return null
    const title = status === 'all' ? '全部询盘明细' : (LEAD_STATUS_LABELS[status] || '询盘')
    const leads = status === 'all' ? ib.leads : ib.leads.filter(l => l.inbound_status === status)
    if (!leads.length) {
      return (
        <div className="metric-detail">
          <div className="metric-detail-head">
            <h4>{title}<span className="cnt">0 条</span></h4>
            <button type="button" className="close-btn" onClick={() => setExpandedIbMetric(null)}>收起</button>
          </div>
          <div className="metric-detail-empty">当前筛选范围内没有「{title.replace('明细', '')}」记录。</div>
        </div>
      )
    }
    return (
      <div className="metric-detail">
        <div className="metric-detail-head">
          <h4>{title}<span className="cnt">{leads.length} 条</span></h4>
          <button type="button" className="close-btn" onClick={() => setExpandedIbMetric(null)}>收起</button>
        </div>
        <div className="metric-detail-list">
          {leads.map((l) => (
            <div className="metric-detail-item" key={l.id}>
              <span className="md-market">{l.country || '未知'}</span>
              <span className="md-name">{l.company || '未命名'}</span>
              <span className="tag tag-inbound">{l.source_platform || '—'}</span>
              <span className="md-note">{l.need_type || ''}</span>
              <span className="md-note">{LEAD_STATUS_LABELS[l.inbound_status] || l.inbound_status}</span>
              <span className="md-note">{l.lead_owner || '未分配'}</span>
              <span className="md-date">{(l.received_at || l.first_reply_at || '').slice(0, 10)}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div className="dash-page">
      {/* ── Top Toolbar ── */}
      <div className="dash-toolbar">
        <div className="dash-toolbar-left">
          <div className="page-title-wrap">
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 className="page-title">市场开发路径验证</h1>
              <span className="page-live">LIVE</span>
            </div>
            <p className="page-subtitle">全球 B2B 户外市场开发路径实验系统 · 实时数据智能分析</p>
          </div>
        </div>
        <div className="dash-toolbar-right">
          <div className="toolbar-glass filter-row">
            <Globe size={14} className="muted-icon" />
            <span className="filter-label">市场</span>
            <select value={market} onChange={(e) => setMarket(e.target.value)}>
              {allMarkets.map((mk) => <option key={mk}>{mk}</option>)}
            </select>
          </div>
          <button type="button" className="button outline compact" onClick={exportData}>
            <Download size={14} />导出数据
          </button>
        </div>
      </div>

      {/* ── KPI Row (clickable) ── */}
      <div className="kpi-row">
        <div className={`kpi ${expandedKpi === 'prospects' ? 'active' : ''}`} onClick={() => setExpandedKpi(expandedKpi === 'prospects' ? null : 'prospects')}>
          <div className="kpi-head">
            <div className="kpi-icon"><Database size={18} /></div>
            <div className="kpi-label-wrap">
              <span className="kpi-label">总客户档案</span>
              <span className="kpi-subtitle">Total Prospects</span>
            </div>
          </div>
          <div className="kpi-value-row"><strong className="kpi-value">{totalProspects}</strong></div>
          <Sparkline data={sparkProspects} color="green" />
          <div className="kpi-foot">
            <span>{market === '全部' ? '全部市场' : market}</span>
            <span className="delta-pill">+{outboundMapPoints.length} 个市场</span>
          </div>
        </div>

        <div className={`kpi blue ${expandedKpi === 'touches' ? 'active' : ''}`} onClick={() => setExpandedKpi(expandedKpi === 'touches' ? null : 'touches')}>
          <div className="kpi-head">
            <div className="kpi-icon"><Activity size={18} /></div>
            <div className="kpi-label-wrap">
              <span className="kpi-label">总触达动作</span>
              <span className="kpi-subtitle">Outreach Events</span>
            </div>
          </div>
          <div className="kpi-value-row"><strong className="kpi-value">{totalTouch}</strong></div>
          <Sparkline data={sparkTouches} color="cyan" />
          <div className="kpi-foot"><span>Outbound</span><span className="delta-pill">{ob.perChannel.length} 个渠道</span></div>
        </div>

        <div className={`kpi good ${expandedKpi === 'human' ? 'active' : ''}`} onClick={() => setExpandedKpi(expandedKpi === 'human' ? null : 'human')}>
          <div className="kpi-head">
            <div className="kpi-icon"><MessageSquare size={18} /></div>
            <div className="kpi-label-wrap">
              <span className="kpi-label">真人回复率</span>
              <span className="kpi-subtitle">Real Reply Rate</span>
            </div>
          </div>
          <div className="kpi-value-row"><strong className="kpi-value">{ob.humanReplyRate}</strong></div>
          <Sparkline data={sparkHuman} color="green" />
          <div className="kpi-foot"><span>{ob.human} 次真人回复</span><span className="delta-pill">{ob.human} / {ob.total}</span></div>
        </div>

        <div className={`kpi purple ${expandedKpi === 'inbound' ? 'active' : ''}`} onClick={() => setExpandedKpi(expandedKpi === 'inbound' ? null : 'inbound')}>
          <div className="kpi-head">
            <div className="kpi-icon"><Inbox size={18} /></div>
            <div className="kpi-label-wrap">
              <span className="kpi-label">总询盘</span>
              <span className="kpi-subtitle">Inbound Leads</span>
            </div>
          </div>
          <div className="kpi-value-row"><strong className="kpi-value">{totalInbound}</strong></div>
          <Sparkline data={sparkInbound} color="purple" />
          <div className="kpi-foot"><span>Inbound</span><span className="delta-pill">{LEAD_STATUS_LABELS[ib.counts?.Qualified] ? `${ib.counts.Qualified || 0} 已意向` : ''}</span></div>
        </div>
      </div>

      {/* KPI Detail Panels */}
      {expandedKpi === 'prospects' && (
        <div className="kpi-detail-panel">
          <h4>客户明细 <small>（{filteredProspects.length} 家）</small></h4>
          <div className="kpi-detail-list">
            {filteredProspects.slice(0, 30).map((p) => (
              <div className="kpi-detail-item" key={p.id}>
                <span style={{ minWidth: 80, color: 'var(--text-2)' }}>{p.market}</span>
                <strong style={{ flex: 1 }}>{p.name}</strong>
                <span className="tag">{p.owner}</span>
              </div>
            ))}
            {filteredProspects.length > 30 && <div style={{ padding: '8px 0', color: 'var(--muted)', fontSize: 11 }}>仅显示前 30 家（共 {filteredProspects.length} 家）</div>}
          </div>
        </div>
      )}
      {expandedKpi === 'touches' && (
        <div className="kpi-detail-panel">
          <h4>触达明细 <small>（{filteredTouches.length} 条）</small></h4>
          <div className="kpi-detail-list">
            {filteredTouches.map((a) => (
              <div className="kpi-detail-item" key={a.id}>
                <span style={{ minWidth: 100 }}>{companyMap[a.company_id] || '未知'}</span>
                <span className="tag">{a.channel}</span>
                <span className={`tag tag-${a.replyType || 'none'}`}>{RESULT_LABEL[a.replyType || 'none'] || '无回应'}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{a.at ? a.at.slice(0, 10) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {expandedKpi === 'human' && (
        <div className="kpi-detail-panel">
          <h4>真人回复明细 <small>（{humanTouches.length} 次）</small></h4>
          <div className="kpi-detail-list">
            {!humanTouches.length ? (
              <div style={{ padding: 16, color: 'var(--muted)', fontSize: 12 }}>暂无真人回复数据。点开客户详情补录「回复原因」后会自动计入。</div>
            ) : humanTouches.map((a) => (
              <div className="kpi-detail-item" key={a.id}>
                <span style={{ minWidth: 100 }}>{companyMap[a.company_id] || '未知'}</span>
                <span className="tag">{a.channel}</span>
                <span className="tag tag-human">真人</span>
                {a.reply_reason ? <span style={{ color: 'var(--text-2)' }}>{a.reply_reason}</span> : null}
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{a.at ? a.at.slice(0, 10) : ''}</span>
              </div>
            ))}
          </div>
        </div>
      )}
      {expandedKpi === 'inbound' && (
        <div className="kpi-detail-panel">
          <h4>询盘明细 <small>（{inboundLeads.length} 条）</small></h4>
          <div className="kpi-detail-list">
            {inboundLeads.map((l) => (
              <div className="kpi-detail-item" key={l.id}>
                <span style={{ minWidth: 60 }}>{l.country || '未知'}</span>
                <strong style={{ flex: 1 }}>{l.company || '未命名'}</strong>
                <span className="tag tag-inbound">{LEAD_STATUS_LABELS[l.inbound_status] || l.inbound_status}</span>
                <span style={{ color: 'var(--muted)', fontSize: 11 }}>{l.lead_owner || '未分配'}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ═══ Global market view: Outbound and Inbound share geography, not metrics ═══ */}
      <section className="dash-section global-market-section">
        <div className="global-market-header">
          <SectionHeader icon={Globe} title="全球市场分布" desc="地图与全盘市场筛选联动；Outbound 客户档案与 Inbound 询盘分开查看" />
          <div className="map-mode-tabs" role="tablist" aria-label="切换地图数据">
            <button type="button" role="tab" aria-selected={mapMode === 'outbound'} className={mapMode === 'outbound' ? 'active' : ''} onClick={() => setMapMode('outbound')}>
              Outbound 客户
            </button>
            <button type="button" role="tab" aria-selected={mapMode === 'inbound'} className={mapMode === 'inbound' ? 'active' : ''} onClick={() => setMapMode('inbound')}>
              Inbound 询盘
            </button>
          </div>
        </div>
        <div className="intel-panel global-map-grid">
          <WorldMap
            points={mapPoints}
            metricLabel={mapMetricLabel}
            activeMarket={market !== '全部' ? market : null}
            onSelectMarket={(selectedMarket) => setMarket(market === selectedMarket ? '全部' : selectedMarket)}
          />
          <div className="global-market-ranking">
            <div className="ranking-heading">
              <div>
                <h3>{mapMode === 'outbound' ? 'Outbound 市场' : 'Inbound 来源市场'}</h3>
                <p>{mapMode === 'outbound' ? '按客户档案数量排列' : '按主动询盘数量排列'}</p>
              </div>
              <strong>{totalMapRecords}</strong>
            </div>
            <div className="top-markets">
              {topMarkets.map((point) => (
                <button
                  type="button"
                  className={`top-market-row ${market === point.market ? 'selected' : ''}`}
                  key={point.market}
                  onClick={() => setMarket(market === point.market ? '全部' : point.market)}
                >
                  <span className={`dot ${point.color}`} />
                  <strong>{point.market}</strong>
                  <span className="cnt">{point.count}</span>
                  <div className="top-market-bar"><i style={{ width: `${totalMapRecords ? (point.count / totalMapRecords) * 100 : 0}%` }} /></div>
                  <span className="pct">{totalMapRecords ? ((point.count / totalMapRecords) * 100).toFixed(1) : '0.0'}%</span>
                </button>
              ))}
            </div>
            <p className="map-filter-note">当前全盘筛选：<strong>{market}</strong>。点击同一市场可取消筛选。</p>
          </div>
        </div>
      </section>

      {/* ═══ OUTBOUND Intelligence Panel ═══ */}
      <section className="dash-section">
        <SectionHeader icon={Zap} title="Outbound 开发情况" desc="主动触达路径验证：从客户发现到真人回复的全链路数据" live />
        <div className="intel-panel">
          {/* 5 metric cards — CLICKABLE */}
          <div className="metrics-row">
            <MetricCard icon={Activity} label="触达动作" value={ob.total} sub="事件总数" color="green"
              active={expandedObMetric === 'touches'}
              onClick={() => setExpandedObMetric(expandedObMetric === 'touches' ? null : 'touches')} />
            <MetricCard icon={MessageSquare} label="真人回复率" value={ob.humanReplyRate} sub={`${ob.human} 次真人`} color="green"
              active={expandedObMetric === 'human'}
              onClick={() => setExpandedObMetric(expandedObMetric === 'human' ? null : 'human')} />
            <MetricCard icon={Zap} label="自动回复率（信号）" value={ob.autoReplyRate} sub={`${ob.auto} 次自动`} color="blue"
              active={expandedObMetric === 'auto'}
              onClick={() => setExpandedObMetric(expandedObMetric === 'auto' ? null : 'auto')} />
            <MetricCard icon={TrendingUp} label="退信率" value={ob.bounceRate} sub={`${ob.bounce} 次`} color="red"
              active={expandedObMetric === 'bounce'}
              onClick={() => setExpandedObMetric(expandedObMetric === 'bounce' ? null : 'bounce')} />
            <MetricCard icon={Users} label="无回应率" value={ob.noResponseRate} sub={`${ob.none} 次`} color="amber"
              active={expandedObMetric === 'none'}
              onClick={() => setExpandedObMetric(expandedObMetric === 'none' ? null : 'none')} />
          </div>

          {/* Outbound metric detail panel */}
          {renderObDetail(expandedObMetric)}

          {ob.total > 0 ? (
            <>
              <div className="channel-performance-layout">
                <div className="panel" style={{ maxWidth: 'none' }}>
                  <h3>渠道表现 <small>按真人回复率排序</small></h3>
                  <div className="ch-perf-list">
                    {ob.perChannel.map(([name, v, rate]) => (
                      <div className="ch-perf-row" key={name}>
                        <span className="ch-name">{name}</span>
                        <div className="ch-bars">
                          <span className="chip-human">真人 {v.human}</span>
                          <span className="chip-auto">自动 {v.auto}</span>
                          <span className="chip-nr">无回 {v.none}</span>
                          {v.bounce > 0 ? <span className="chip-bounced">退信 {v.bounce}</span> : null}
                        </div>
                        <span className="ch-rate">{rate}%</span>
                        <div className="bar-track"><i style={{ width: `${Math.min(Number(rate) * 4, 100)}%` }} /></div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </>
          ) : <EmptyBlock msg="还没有 Outbound 触达记录。" />}
        </div>
      </section>

      {/* ═══ Separate funnels: these are different acquisition routes ═══ */}
      <div className="intel-grid-funnels">
        <div className="panel">
          <h3>Outbound 回应漏斗 <small>同一批主动开发客户</small></h3>
          <Funnel steps={outboundFunnelSteps} total={outboundFunnelSteps[0]?.count || 0} accent="outbound" />
          <div className="funnel-summary">
            <span className="label">真人回复转化率（触达 → 真人）</span>
            <span className="value">{ob.humanReplyRate}</span>
          </div>
        </div>
        <div className="panel">
          <h3>Inbound 处理漏斗 <small>当前询盘处理进展</small></h3>
          <Funnel steps={inboundFunnelSteps} total={inboundFunnelSteps[0]?.count || 0} accent="inbound" />
          <div className="funnel-summary purple">
            <span className="label">已确认意向</span>
            <span className="value">{ib.counts.Qualified || 0}</span>
          </div>
        </div>
        <div className="panel recent-panel">
          <h3>最近动态 <small>最新操作记录</small></h3>
          {recentActivities.length === 0 ? (
            <EmptyBlock msg="还没有活动数据" />
          ) : (
            <div className="recent-activity">
              {recentActivities.map((item, i) => {
                const Icon = item.icon
                return (
                  <div className="activity-item" key={item.id + i}>
                    <div className={`activity-icon ${item.iconColor}`}><Icon size={14} /></div>
                    <div className="activity-body">
                      <strong>{item.title}</strong>
                      <small>{item.sub}</small>
                    </div>
                    <span className="activity-time">{fmtTime(item.at)}</span>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      {/* ═══ 前线最新消息 ═══ */}
      {state.frontline_events?.length ? (
        <section className="dash-section frontline-panel">
          <SectionHeader icon={Radio} title="前线最新消息" desc="业务员在填写时新增的选项/渠道/回复分支——一线遇到的新情况，第一时间同步" />
          <div className="intel-panel">
            <div className="frontline-list">
              {state.frontline_events.slice(0, 20).map((ev) => (
                <div className="frontline-item" key={ev.id}>
                  <span className="fe-worker"><span className="avatar" style={{ width: 26, height: 26, fontSize: 11 }}>{(ev.worker || '?').slice(0, 1)}</span></span>
                  <span className="fe-text"><strong>{ev.worker}</strong> 在「{ev.fieldLabel || ev.field}」新增了 <span className="fe-value">{ev.value}</span></span>
                  <span className="fe-time">{fmtTime(ev.at)}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      ) : null}

      {/* ═══ INBOUND Intelligence Panel ═══ */}
      <section className="dash-section">
        <SectionHeader icon={Inbox} title="Inbound 开发情况" desc="客户主动询盘接入、需求发现与转化跟进状态" live />
        <div className="intel-panel">
          <div className="metrics-row">
            <MetricCard icon={Inbox} label="总询盘" value={ib.total} sub="条" color="blue"
              active={expandedIbMetric === 'all'}
              controls="inbound-metric-detail"
              onClick={() => toggleInboundMetric('all')} />
            {LEAD_STATUSES.slice(0, 5).map((s) => (
              <MetricCard key={s} icon={FileCheck} label={LEAD_STATUS_LABELS[s]} value={ib.counts[s]} sub="条"
                color={s === 'Converted' ? 'green' : s === 'Lost' ? 'red' : s === 'Qualified' ? 'green' : 'default'}
                active={expandedIbMetric === s}
                controls="inbound-metric-detail"
                onClick={() => toggleInboundMetric(s)} />
            ))}
          </div>

          {/* Inbound metric detail panel */}
          <div id="inbound-metric-detail" ref={inboundDetailRef} className="metric-detail-slot" aria-live="polite">
            {expandedIbMetric ? renderIbDetail(expandedIbMetric) : null}
          </div>

          {ib.total > 0 ? (
            <div className="dash-grid-2">
              <div className="panel">
                <h3>询盘来源分布</h3>
                <div className="src-dist">
                  {Object.entries(ib.bySource).map(([src, cnt]) => (
                    <div className="src-row" key={src}>
                      <span>{src}</span><strong>{cnt}</strong><div className="bar-track"><i style={{ width: `${(cnt / ib.total * 100)}%` }} /></div>
                    </div>
                  ))}
                </div>
              </div>
              <div className="panel">
                <h3>负责人分配</h3>
                <div className="owner-list">
                  {Object.entries(ib.byOwner).map(([owner, leads]) => (
                    <div className="owner-row" key={owner}><User size={14} /><span>{owner}</span><strong>{leads.length} 个询盘</strong></div>
                  ))}
                </div>
              </div>
            </div>
          ) : <EmptyBlock msg="还没有 Inbound 询盘记录。" />}
        </div>
      </section>

      {/* ═══ 各市场对比 ═══ */}
      <section className="dash-section">
        <SectionHeader icon={Globe} title="整体开发情况" desc="跨市场、跨渠道的综合视图" />
        {ms.length > 0 ? (
          <div className="intel-panel">
            <h3 style={{ marginBottom: 14 }}>各市场对比</h3>
            <div className="table-scroll">
              <table className="data-table">
                <thead><tr><th>市场</th><th>客户数</th><th>触达次数</th><th>真人回复</th><th>询盘数</th></tr></thead>
                <tbody>
                  {ms.map(([m, v]) => (
                    <tr key={m}>
                      <td><button className="link-btn" onClick={() => setMarket(m)}>{m}</button></td>
                      <td>{v.prospects}</td><td>{v.touches}</td><td>{v.humans}</td><td>{v.leads}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ) : null}
      </section>

      {/* ═══ 业务员动向 ═══ */}
      <section className="dash-section">
        <SectionHeader icon={Users} title="业务员动向" desc="各业务员负责的客户与询盘；点击可进入对应工作台查看详情" />
        {team.length > 0 ? (
          <div className="team-grid">
            {team.map((w) => (
              <div className="team-card" key={w.id}>
                <div className="team-card-head">
                  <span className="avatar">{(w.name || '?').slice(0, 1)}</span>
                  <strong>{w.name}</strong>
                  <span className="team-role">{w.role}</span>
                </div>
                <div className="team-card-body">
                  <div className="team-stat"><span>Outbound 客户</span><strong>{w.prospects}</strong></div>
                  <div className="team-stat"><span>触达</span><strong>{w.touches}</strong></div>
                  <div className="team-stat"><span>真人回复率</span><strong>{w.humanRate}</strong></div>
                  <div className="team-stat"><span>Inbound 询盘</span><strong>{w.inbound}</strong></div>
                </div>
                <button type="button" className="button primary compact" onClick={() => onNavigate(`worker:${w.id}`)}>
                  进入工作台 <ArrowRight size={14} />
                </button>
              </div>
            ))}
          </div>
        ) : <EmptyBlock msg="还没有团队活动数据。" />}
        <p className="definition note">当前为本地原型模式，业务员通过同一设备操作。接入真实账户系统后，每位业务员将拥有独立登录，主管可实时查看所有人的动态。</p>
      </section>
    </div>
  )
}
