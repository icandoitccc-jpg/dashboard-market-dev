import { useMemo, useState } from 'react'
import { ChevronRight, Plus, Search, TrendingUp, Target, AlertCircle } from 'lucide-react'
import CustomerDetail from './CustomerDetail'
import AddCustomerModal from './AddCustomerModal'
import { registerOption } from '../dict'

// Prospect browser: left rail (optionally scoped to one worker) + detail pane.
// Used by the manager's "总体 Outbound" view (ownerId=null) and a worker's
// Outbound tab (ownerId set). When ownerId is set, a personal analytics band
// is shown so the worker sees their own feedback — this is their辅助工具.
export default function SalesWorkspace({ state, setState, ownerId = null, currentUser = '陈晨', initialSelectedId = null }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)

  // 归属原则：谁录入（当前操作员），客户就归谁 —— 跨 Outbound / Inbound / 未来老客户统一。
  const addCustomer = (data) => {
    const id = data.id
    const prospect = {
      id,
      name: data.name,
      url: data.url,
      domain: data.domain,
      market: data.market,
      customerType: data.customerType,
      segment: data.customerType,
      sourceMethod: data.sourceMethod,
      source: data.sourceMethod,
      fitNote: data.fitNote,
      owner: currentUser,
      status: '待触达',
      region: '',
      scale: '',
      remark: '',
      discovered_at: data.discovered_at,
      first_contact: (data.discovered_at || '').slice(0, 10),
      updatedAt: '刚刚',
      channels: data.channels,
      initialContacts: data.initialContacts,
      touchCount: 0,
    }
    setState((current) => {
      const newContacts = (data.initialContacts || []).map((c, i) => ({
        id: `c_${id}_${i}_${Date.now()}`,
        company_id: id,
        name: c.name,
        level: c.level || 'Unknown',
        acquisition_method: c.acquisition_method || '',
        email: c.email || '',
        created_at: new Date().toISOString(),
      }))
      return { ...current, prospects: [...current.prospects, prospect], contacts: [...current.contacts, ...newContacts] }
    })
    setSelectedId(id)
    setShowAdd(false)
  }

  // 业务员新增下拉选项 → 共享字典 + 前线事件
  const register = (field, value) => setState((cur) => registerOption(cur, field, value, currentUser))

  const myProspects = useMemo(
    () => state.prospects.filter((p) => !ownerId || p.owner === ownerId),
    [state.prospects, ownerId],
  )
  const prospects = useMemo(
    () => myProspects.filter((p) => `${p.name} ${p.market}`.toLowerCase().includes(search.toLowerCase())),
    [myProspects, search],
  )
  const selected = prospects.find((p) => p.id === selectedId) || (prospects.length ? prospects[0] : null)

  const myIds = useMemo(() => new Set(myProspects.map((p) => p.id)), [myProspects])
  const analytics = useMemo(() => {
    if (!ownerId) return null
    const out = state.activities.filter((a) => a.flow_type === 'outbound' && a.kind === 'outreach' && myIds.has(a.company_id))
    const human = out.filter((a) => a.replyType === 'human')
    const auto = out.filter((a) => a.replyType === 'auto')
    const touched = new Set(out.map((a) => a.company_id))
    const humanCos = new Set(human.map((a) => a.company_id))
    const today = new Date().toISOString().slice(0, 10)
    return {
      prospects: myProspects.length,
      total: out.length,
      todayTouches: out.filter((a) => a.at?.startsWith(today)).length,
      humanRate: out.length ? `${((human.length / out.length) * 100).toFixed(1)}%` : '—',
      human, auto, touched: touched.size, humanCos: humanCos.size,
    }
  }, [ownerId, myProspects, state.activities, myIds])

  if (!selected) {
    return (
      <div className="sales-layout">
        <section className="prospect-rail">
          <div className="rail-heading"><h1>客户开发</h1><button className="button primary compact" onClick={() => setShowAdd(true)}><Plus size={15} />添加客户</button></div>
          <div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索客户" /></div>
          <div className="empty-list">{ownerId ? `${ownerId} 暂无可查看客户` : '还没有客户记录'}</div>
        </section>
        {showAdd && <AddCustomerModal state={state} onNewOption={register} onClose={() => setShowAdd(false)} onAdd={addCustomer} />}
        <section className="empty-main"><div>
          <h1>从真实客户开始</h1>
          <p>这是开发工作台。添加一个实际发现的客户，记录渠道和触达结果，数据会自动汇总到主管看板。</p>
          <button className="button primary large" onClick={() => setShowAdd(true)}><Plus size={17} />添加第一个客户</button>
        </div></section>
      </div>
    )
  }

  return (
    <div className="sales-layout">
      {analytics ? (
        <section className="personal-analytics wide">
          <h3><TrendingUp size={16} />我的数据反馈</h3>
          <div className="pa-grid">
            <div className="pa-card"><span className="pa-label">我负责的客户</span><strong className="pa-value">{analytics.prospects}</strong></div>
            <div className="pa-card"><span className="pa-label">总触达动作</span><strong className="pa-value">{analytics.total}</strong></div>
            <div className="pa-card"><span className="pa-label">今天触达</span><strong className="pa-value pa-today">{analytics.todayTouches}</strong></div>
            <div className="pa-card"><span className="pa-label">真人回复率</span><strong className="pa-value pa-good">{analytics.humanRate}</strong><small>{analytics.human.length} 真人 / {analytics.total} 触达</small></div>
            <div className="pa-card"><span className="pa-label">获回复客户</span><strong className="pa-value">{analytics.humanCos}</strong><small>/ {analytics.touched} 已触达</small></div>
          </div>
          {analytics.total > 0 ? (
            <p className="pa-hint"><Target size={13} />真人回复率 {analytics.humanRate} · 自动回复 {analytics.auto.length} 条（市场信号保留）· 无回应 {analytics.total - analytics.human.length - analytics.auto.length} 条{analytics.humanCos > 0 ? ` · ${analytics.humanCos} 个客户给了真人回复，建议优先二次触达` : ''}</p>
          ) : <p className="pa-hint empty-hint"><AlertCircle size={13} /> 还没有触达记录。添加客户并完成第一次触达后，这里会显示你的个人数据反馈。</p>}
        </section>
      ) : null}

      <section className="prospect-rail">
        <div className="rail-heading"><h1>客户列表</h1><span className="rail-count">{prospects.length}</span><button className="button primary compact" onClick={() => setShowAdd(true)}><Plus size={15} />添加</button></div>
        <div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索客户" /></div>
        <div className="prospect-list">
          {prospects.map((prospect) => (
            <button key={prospect.id} className={`prospect-row ${prospect.id === selected.id ? 'selected' : ''}`} onClick={() => setSelectedId(prospect.id)}>
              <span><strong>{prospect.name}</strong><small>{prospect.market} · {prospect.customerType || prospect.segment || '未分类'}</small><small>{prospect.status || '待触达'}</small></span>
              <span className="row-tail"><ChevronRight size={16} /></span>
            </button>
          ))}
        </div>
      </section>

      <CustomerDetail state={state} setState={setState} prospect={selected} currentUser={currentUser} />
      {showAdd && <AddCustomerModal state={state} onNewOption={register} onClose={() => setShowAdd(false)} onAdd={addCustomer} />}
    </div>
  )
}
