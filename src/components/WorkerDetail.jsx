import { useState } from 'react'
import { Users, TrendingUp, Inbox, Target, ArrowLeft } from 'lucide-react'
import { computeWorkers, computeOutbound, computeInbound } from '../metrics'
import SalesWorkspace from './SalesWorkspace'
import DailyLog from './DailyLog'
import { LEAD_STATUS_LABELS, LEAD_STATUSES } from '../metrics'

export default function WorkerDetail({ state, setState, workerId, onNavigate, currentUser, autoOpenDaily = false }) {
  const [tab, setTab] = useState(autoOpenDaily ? 'analytics' : 'overview')
  const worker = state.workers.find((w) => w.id === workerId) || computeWorkers(state).find((w) => w.id === workerId)
  if (!worker) return <div className="empty-block">未找到该业务员。</div>

  const ids = new Set(state.prospects.filter((p) => p.owner === worker.name).map((p) => p.id))
  const ob = computeOutbound(state, { ownerIds: [worker.name] })
  const ib = computeInbound(state, { ownerIds: [worker.name] })
  // 只显示这位业务员自己的每日复盘，不与其他人的记录混在一起
  const daily = (state.daily_rhythm || [])
    .filter((d) => d.worker === worker.name)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
  const currentUserRole = state.workers.find((w) => w.name === currentUser)?.role
  const canManagerEdit = currentUserRole === '主管' && currentUser !== worker.name

  return (
    <div className="dash-page worker-page">
      <button type="button" className="back-link" onClick={() => onNavigate('team')}><ArrowLeft size={15} />业务员动向</button>
      <div className="worker-header">
        <div className="worker-avatar">{worker.name.slice(0, 1)}</div>
        <div className="worker-id">
          <h1>{worker.name}</h1>
          <span className="team-role">{worker.role} · 主管可见其全部动态</span>
        </div>
        <div className="worker-kpis">
          <div><span>客户</span><strong>{worker.prospects}</strong></div>
          <div><span>触达</span><strong>{worker.touches}</strong></div>
          <div><span>真人回复率</span><strong>{worker.humanRate}</strong></div>
          <div><span>Inbound</span><strong>{worker.inbound}</strong></div>
        </div>
      </div>

      <div className="sub-tabs">
        {[['overview', '总览'], ['outbound', 'Outbound'], ['inbound', 'Inbound'], ['analytics', '分析反馈']].map(([k, label]) => (
          <button key={k} className={`sub-tab ${tab === k ? 'active' : ''}`} onClick={() => setTab(k)}>{label}</button>
        ))}
      </div>

      {tab === 'overview' && (
        <div className="dash-section">
          <div className="kpi-row">
            <div className="kpi"><span className="kpi-label">负责客户</span><strong className="kpi-value">{worker.prospects}</strong></div>
            <div className="kpi"><span className="kpi-label">触达动作</span><strong className="kpi-value">{ob.total}</strong></div>
            <div className="kpi good"><span className="kpi-label">真人回复率</span><strong className="kpi-value">{ob.humanReplyRate}</strong><span className="kpi-sub">{ob.human} 次</span></div>
            <div className="kpi blue"><span className="kpi-label">Inbound 询盘</span><strong className="kpi-value">{ib.total}</strong></div>
          </div>
          <div className="dash-grid-2">
            <div className="panel"><h3>Outbound 渠道表现</h3>{ob.total > 0 ? <div className="ch-perf-list">{ob.perChannel.map(([name, v, rate]) => <div className="ch-perf-row" key={name}><span className="ch-name">{name}</span><span className="ch-rate">{rate}%</span><div className="bar-track"><i style={{ width: `${Math.min(Number(rate), 100)}%` }} /></div></div>)}</div> : <p className="contact-empty">暂无触达</p>}</div>
            <div className="panel"><h3>Inbound 状态</h3><div className="owner-list">{LEAD_STATUSES.slice(0, 5).map((s) => <div className="owner-row" key={s}><span>{LEAD_STATUS_LABELS[s]}</span><strong>{ib.counts[s]}</strong></div>)}</div></div>
          </div>
        </div>
      )}

      {tab === 'outbound' && <SalesWorkspace state={state} setState={setState} ownerId={worker.name} currentUser={currentUser} />}

      {tab === 'inbound' && (
        <div className="dash-section">
          {ib.total > 0 ? (
            <div className="panel"><div className="table-scroll"><table className="data-table"><thead><tr><th>负责人</th><th>来源</th><th>国家</th><th>状态</th><th>接入</th></tr></thead><tbody>{ib.leads.map((l) => <tr key={l.id}><td>{l.lead_owner || '未分配'}</td><td>{l.source_platform}</td><td>{l.country}</td><td>{LEAD_STATUS_LABELS[l.inbound_status]}</td><td>{l.received_at?.slice(0, 10)}</td></tr>)}</tbody></table></div></div>
          ) : <div className="empty-block">该业务员暂未被分配 Inbound 询盘。接入询盘时把「负责人」填成 TA 即可在此显示。</div>}
        </div>
      )}

      {tab === 'analytics' && (
        <div className="dash-section">
          <section className="personal-analytics wide">
            <h3><TrendingUp size={16} />{worker.name} 的数据反馈</h3>
            <div className="pa-grid">
              <div className="pa-card"><span className="pa-label">负责客户</span><strong className="pa-value">{worker.prospects}</strong></div>
              <div className="pa-card"><span className="pa-label">总触达</span><strong className="pa-value">{ob.total}</strong></div>
              <div className="pa-card"><span className="pa-label">真人回复率</span><strong className="pa-value pa-good">{ob.humanReplyRate}</strong><small>{ob.human} 真人 / {ob.total} 触达</small></div>
              <div className="pa-card"><span className="pa-label">获回复客户</span><strong className="pa-value">{ob.humanCompanies}</strong><small>/ {ob.touchedCompanies} 已触达</small></div>
              <div className="pa-card"><span className="pa-label">自动回复</span><strong className="pa-value">{ob.auto}</strong><small>市场信号</small></div>
              <div className="pa-card"><span className="pa-label">待跟进提醒</span><strong className="pa-value pa-warn">{worker.pending}</strong></div>
            </div>
          </section>
          <DailyLog entries={daily} worker={worker.name} currentUser={currentUser} canManagerEdit={canManagerEdit} setState={setState} autoOpen={autoOpenDaily} />
        </div>
      )}
    </div>
  )
}
