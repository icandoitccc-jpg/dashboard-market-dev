import { useMemo, useState } from 'react'
import { Search, ChevronRight, Users } from 'lucide-react'
import { LEAD_STATUS_LABELS } from '../metrics'

// 从社媒主页链接里提取出可读的用户名，比如
// https://www.instagram.com/icebathusa/ -> icebathusa
function extractHandle(url) {
  if (!url) return ''
  const match = String(url).replace(/\/$/, '').match(/\/([^/]+)$/)
  return match ? match[1] : url
}

// 「全部客户」= Outbound 客户档案 + Inbound 询盘，合并成一个可搜索、可一屏浏览的清单。
// 两类数据结构不同、字段不同，这里只做展示层的归一化，不改动底层数据表。
// 点击一行会跳到对应的 Outbound / Inbound 详情页（由 App.jsx 负责路由）。
export default function AllContacts({ state, onNavigate }) {
  const [search, setSearch] = useState('')
  const [typeFilter, setTypeFilter] = useState('all') // all | outbound | inbound

  const rows = useMemo(() => {
    const outboundRows = state.prospects.map((p) => ({
      key: `outbound:${p.id}`,
      type: 'outbound',
      id: p.id,
      name: p.name || '未命名客户',
      place: p.market || '',
      status: p.status || '待触达',
      owner: p.owner || '未署名',
      lastDate: p.last_sent || p.first_contact || (p.discovered_at || '').slice(0, 10) || '',
    }))
    const inboundRows = state.inbound_leads.map((l) => ({
      key: `inbound:${l.id}`,
      // 询盘经常还没确认公司名，优先显示干净的用户名（company_handle），
      // 其次从主页链接里提取用户名，而不是整条 URL
      type: 'inbound',
      id: l.id,
      name: l.company_handle || extractHandle(l.company) || l.contact || '未命名询盘',
      place: l.country || '',
      status: LEAD_STATUS_LABELS[l.inbound_status] || l.inbound_status || '新询盘',
      owner: l.lead_owner || '未署名',
      lastDate: l.last_contact || l.received_at || '',
    }))
    return [...outboundRows, ...inboundRows]
  }, [state.prospects, state.inbound_leads])

  const filtered = useMemo(() => {
    const kw = search.trim().toLowerCase()
    return rows
      .filter((r) => typeFilter === 'all' || r.type === typeFilter)
      .filter((r) => !kw || `${r.name} ${r.place} ${r.owner}`.toLowerCase().includes(kw))
      .sort((a, b) => (b.lastDate || '').localeCompare(a.lastDate || ''))
  }, [rows, search, typeFilter])

  const outboundCount = rows.filter((r) => r.type === 'outbound').length
  const inboundCount = rows.filter((r) => r.type === 'inbound').length

  return (
    <div className="flow-page">
      <div className="flow-header">
        <div>
          <h1><Users size={20} style={{ verticalAlign: '-3px', marginRight: 6 }} />全部客户</h1>
          <p>Outbound 客户档案与 Inbound 询盘合并展示，一屏浏览、按名称/市场/负责人搜索。点击进入对应详情页。</p>
        </div>
      </div>

      <div className="metrics-row">
        <div className="metric-card default"><div className="mc-body"><span className="mc-label">全部</span><strong className="mc-value">{rows.length}</strong><small className="mc-sub">条记录</small></div></div>
        <div className="metric-card green"><div className="mc-body"><span className="mc-label">Outbound 客户</span><strong className="mc-value">{outboundCount}</strong><small className="mc-sub">条</small></div></div>
        <div className="metric-card blue"><div className="mc-body"><span className="mc-label">Inbound 询盘</span><strong className="mc-value">{inboundCount}</strong><small className="mc-sub">条</small></div></div>
      </div>

      <div className="panel">
        <div className="card-head">
          <div className="map-mode-tabs" role="tablist" aria-label="筛选类型">
            <button type="button" role="tab" aria-selected={typeFilter === 'all'} className={typeFilter === 'all' ? 'active' : ''} onClick={() => setTypeFilter('all')}>全部</button>
            <button type="button" role="tab" aria-selected={typeFilter === 'outbound'} className={typeFilter === 'outbound' ? 'active' : ''} onClick={() => setTypeFilter('outbound')}>Outbound</button>
            <button type="button" role="tab" aria-selected={typeFilter === 'inbound'} className={typeFilter === 'inbound' ? 'active' : ''} onClick={() => setTypeFilter('inbound')}>Inbound</button>
          </div>
          <div className="search-box" style={{ marginBottom: 0, width: 260 }}><Search size={15} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索名称 / 市场 / 负责人" /></div>
        </div>

        {filtered.length ? (
          <table className="contacts-table">
            <thead>
              <tr>
                <th>类型</th>
                <th>名称</th>
                <th>市场 / 国家</th>
                <th>状态</th>
                <th>负责人</th>
                <th>最近动态</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.key} className="contacts-row" onClick={() => onNavigate(r.key)}>
                  <td><span className={`badge ${r.type === 'outbound' ? 'human' : 'auto'}`}>{r.type === 'outbound' ? 'Outbound' : 'Inbound'}</span></td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.place || '—'}</td>
                  <td>{r.status}</td>
                  <td>{r.owner}</td>
                  <td>{r.lastDate ? r.lastDate.slice(0, 10) : '—'}</td>
                  <td className="row-tail"><ChevronRight size={16} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="contact-empty">没有匹配的记录。</p>}
      </div>
    </div>
  )
}
