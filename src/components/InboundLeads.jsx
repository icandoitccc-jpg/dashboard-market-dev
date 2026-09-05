import { useMemo, useState } from 'react'
import { ChevronRight, Inbox, Plus, Search } from 'lucide-react'
import { computeInbound, LEAD_STATUS_LABELS, LEAD_STATUSES } from '../metrics'
import Combobox from './Combobox'
import { getOptions, registerOption } from '../dict'

const SOURCE_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Website', 'WhatsApp', 'Email', '其他']
const NEED_DISCOVERY = ['产品匹配', '采购权/预算', '交期要求', '现有供应商', '决策流程']
const blankForm = (currentUser = '陈晨') => ({
  received_at: new Date().toISOString().slice(0, 10),
  source_platform: 'Instagram',
  country: '澳大利亚',
  original_message: '',
  lead_owner: currentUser,
  assigned_by: currentUser,
  inbound_status: 'New',
  next_action: '',
  follow_up: '',
  lost_reason: '',
  need_discovery: [],
})

export default function InboundView({ state, setState, currentUser = '陈晨', initialSelectedId = null }) {
  const [selectedId, setSelectedId] = useState(initialSelectedId || state.inbound_leads[0]?.id)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(blankForm(currentUser))
  const [newNeedType, setNewNeedType] = useState('')

  // 业务员新增选项 → 共享字典 + 前线事件（主管总览可见）
  const register = (field, value) => setState((cur) => registerOption(cur, field, value, currentUser))

  const ib = computeInbound(state, {})
  const leads = useMemo(
    () => state.inbound_leads.filter((l) => `${l.original_message} ${l.lead_owner} ${l.source_platform} ${l.country}`.toLowerCase().includes(search.toLowerCase())),
    [state.inbound_leads, search],
  )
  const selected = state.inbound_leads.find((l) => l.id === selectedId) || state.inbound_leads[0]

  const updateLead = (id, changes) => setState((current) => ({
    ...current, inbound_leads: current.inbound_leads.map((l) => (l.id === id ? { ...l, ...changes } : l)),
  }))
  const toggleNeed = (label) => {
    if (!selected) return
    const has = selected.need_discovery?.includes(label)
    updateLead(selected.id, { need_discovery: has ? selected.need_discovery.filter((x) => x !== label) : [...(selected.need_discovery || []), label] })
  }
  // 需求类型（枚举来自 Inbound 表真实取值，可自定义新增）
  const needTypes = useMemo(() => [...new Set([...getOptions(state, 'inboundNeedType'), ...(selected?.need_type || [])])], [state, selected])
  const toggleNeedType = (label) => {
    if (!selected) return
    const has = selected.need_type?.includes(label)
    updateLead(selected.id, { need_type: has ? (selected.need_type || []).filter((x) => x !== label) : [...(selected.need_type || []), label] })
  }
  const addNeedType = () => {
    const v = newNeedType.trim()
    if (!v || !selected) return
    if (!(selected.need_type || []).includes(v)) toggleNeedType(v)
    if (!getOptions(state, 'inboundNeedType').includes(v)) register('inboundNeedType', v)
    setNewNeedType('')
  }
  const addLead = () => {
    // 归属原则：谁录入（当前操作员），询盘就归谁；负责人字段可在详情页改。
    const owner = form.lead_owner.trim() || currentUser
    if (!form.original_message.trim() && !owner.trim()) return
    const id = `il_${Date.now()}`
    const lead = { id, received_at: form.received_at || new Date().toISOString(), source_platform: form.source_platform, country: form.country, original_message: form.original_message, lead_owner: owner, assigned_by: form.assigned_by.trim() || currentUser, assigned_at: new Date().toISOString(), inbound_status: form.inbound_status, next_action: form.next_action, follow_up: form.follow_up, lost_reason: form.lost_reason, need_discovery: form.need_discovery, company: '', company_handle: '', contact: '', first_reply: null, last_contact: null, follow_up_count: 0, note: '' }
    const activity = { id: `a_in_${id}`, company_id: null, contact_id: null, flow_type: 'inbound', channel: form.source_platform, kind: 'discovery', replyType: null, sentiment: null, at: lead.assigned_at, round_id: null, note: `Inbound 询盘接入：${form.source_platform}` }
    setState((current) => ({ ...current, inbound_leads: [lead, ...current.inbound_leads], activities: [...current.activities, activity] }))
    setSelectedId(id); setShowAdd(false); setForm(blankForm(currentUser))
  }

  if (!selected) {
    return (
      <div className="flow-page">
        <div className="flow-header"><div><h1>总体 Inbound</h1><p>客户主动发来的询盘（社媒私信、官网表单、邮件等）在这里接入，与 Outbound 平级、互不污染。</p></div></div>
        <div className="sales-layout">
          <section className="prospect-rail"><div className="rail-heading"><h1>Inbound 询盘</h1><button className="button outline" onClick={() => setShowAdd(true)}><Plus size={17} />接入询盘</button></div><div className="empty-list">还没有 Inbound 询盘记录</div></section>
          <section className="empty-main"><div><h1>从真实询盘开始</h1><p>先记下来源平台和原始留言，再补需求发现与跟进。</p><button className="button primary large" onClick={() => setShowAdd(true)}><Plus size={17} />接入第一个询盘</button></div></section>
          {showAdd && <LeadModal form={form} setForm={setForm} onClose={() => setShowAdd(false)} onAdd={addLead} />}
        </div>
      </div>
    )
  }

  return (
    <div className="flow-page">
      <div className="flow-header"><div><h1>总体 Inbound</h1><p>客户主动询盘接入、需求发现与转化跟进；事件写入 flow_type=inbound，不污染 Outbound 指标。</p></div></div>
      <div className="metrics-row">
        <div className="metric-card blue"><div className="mc-body"><span className="mc-label">总询盘</span><strong className="mc-value">{ib.total}</strong><small className="mc-sub">条</small></div></div>
        {LEAD_STATUSES.slice(0, 5).map((s) => <div key={s} className={`metric-card ${s === 'Converted' ? 'green' : s === 'Lost' ? 'red' : 'default'}`}><div className="mc-body"><span className="mc-label">{LEAD_STATUS_LABELS[s]}</span><strong className="mc-value">{ib.counts[s]}</strong><small className="mc-sub">条</small></div></div>)}
      </div>

      <div className="sales-layout">
        <section className="prospect-rail">
          <div className="rail-heading"><h1>Inbound 询盘</h1><button className="button outline" onClick={() => setShowAdd(true)}><Plus size={17} />接入询盘</button></div>
          <div className="search-box"><Search size={17} /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="搜索留言 / 负责人 / 来源" /></div>
          <div className="inbound-summary">{LEAD_STATUSES.map((s) => <span key={s} className={`lead-count status-${s}`}>{LEAD_STATUS_LABELS[s]} {ib.counts[s]}</span>)}</div>
          <div className="prospect-list">
            {leads.map((lead) => (
              <button key={lead.id} className={`prospect-row ${lead.id === selected.id ? 'selected' : ''}`} onClick={() => setSelectedId(lead.id)}>
                <span><strong>{lead.lead_owner || lead.company_handle || '未填负责人'}</strong><small>{lead.source_platform} · {lead.country}</small><small>{lead.received_at?.slice(0, 10)}</small></span>
                <span className="row-tail"><span className={`lead-status status-${lead.inbound_status}`}>{LEAD_STATUS_LABELS[lead.inbound_status]}</span><ChevronRight size={16} /></span>
              </button>
            ))}
          </div>
        </section>

        <section className="customer-workspace">
          <div className="customer-heading"><div><h1>询盘详情</h1><p>原始留言、需求发现、状态与跟进都在这里。</p></div></div>
          <div className="customer-meta">
            <div className="customer-fields">
              <div><span>来源平台</span><select value={selected.source_platform} onChange={(e) => updateLead(selected.id, { source_platform: e.target.value })}>{SOURCE_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></div>
              <div><span>国家 / 地区</span><input value={selected.country || ''} onChange={(e) => updateLead(selected.id, { country: e.target.value })} placeholder="例如 澳大利亚" /></div>
              <div><span>负责人</span><input value={selected.lead_owner || ''} onChange={(e) => updateLead(selected.id, { lead_owner: e.target.value })} placeholder="谁在跟进这个询盘" /></div>
              <div><span>分配人</span><strong>{selected.assigned_by}</strong></div>
              <div><span>接入时间</span><strong>{selected.assigned_at?.slice(0, 10)}</strong></div>
              <div><span>当前状态</span><select value={selected.inbound_status} onChange={(e) => updateLead(selected.id, { inbound_status: e.target.value })}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}</select></div>
            </div>
            <label className="fit-note"><span>下一步动作<small>选填</small></span><textarea value={selected.next_action || ''} onChange={(e) => updateLead(selected.id, { next_action: e.target.value })} placeholder="例如：发送报价单 / 约视频会议" /></label>
          </div>

          <section className="contacts-panel"><h2>原始询盘 <small>Original Inquiry</small></h2><textarea className="inquiry-box" value={selected.original_message || ''} onChange={(e) => updateLead(selected.id, { original_message: e.target.value })} placeholder="粘贴客户发来的原始留言" /></section>

          <section className="contacts-panel"><h2>需求发现 <small>Need Discovery</small></h2><div className="need-grid">
            {NEED_DISCOVERY.map((item) => { const checked = selected.need_discovery?.includes(item); return <button type="button" key={item} className={`need-chip ${checked ? 'on' : ''}`} onClick={() => toggleNeed(item)}><span className="need-check">{checked ? '✓' : ''}</span>{item}</button> })}
          </div></section>

          <section className="contacts-panel"><h2>需求类型 <small>客户主动想要什么；列表没有的，输入新增</small></h2><div className="need-grid">
            {needTypes.map((item) => { const checked = selected.need_type?.includes(item); return <button type="button" key={item} className={`need-chip ${checked ? 'on' : ''}`} onClick={() => toggleNeedType(item)}><span className="need-check">{checked ? '✓' : ''}</span>{item}</button> })}
          </div>
          <div className="need-add-row">
            <Combobox label="新增需求类型" value={newNeedType} onChange={setNewNeedType} onNewOption={(v) => register('inboundNeedType', v)} options={getOptions(state, 'inboundNeedType')} placeholder="例如：定制贴牌、加急订单" />
            <button type="button" className="button outline compact" onClick={addNeedType}><Plus size={15} />加入</button>
          </div>
          </section>

          <div className="customer-meta" style={{ gridTemplateColumns: '1fr 1fr' }}>
            <div className="customer-fields"><div><span>跟进日期</span><input type="date" value={selected.follow_up || ''} onChange={(e) => updateLead(selected.id, { follow_up: e.target.value })} /></div></div>
            {(selected.inbound_status === 'Stalled' || selected.inbound_status === 'Lost') ? (
              <div className="customer-fields"><div><span>{selected.inbound_status === 'Lost' ? '流失原因' : '停滞原因'}</span><input value={selected.lost_reason || ''} onChange={(e) => updateLead(selected.id, { lost_reason: e.target.value })} placeholder="例如：价格高于预期" /></div></div>
            ) : null}
          </div>
        </section>
        {showAdd && <LeadModal form={form} setForm={setForm} onClose={() => setShowAdd(false)} onAdd={addLead} />}
      </div>
    </div>
  )
}

function LeadModal({ form, setForm, onClose, onAdd }) {
  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div className="modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-heading"><div><h2>接入 Inbound 询盘</h2><p>先保存最少信息，详情随后补充。</p></div><button type="button" className="icon-button" onClick={onClose}>×</button></div>
        <div className="form-grid">
          <label>来源平台<select value={form.source_platform} onChange={(e) => setForm((f) => ({ ...f, source_platform: e.target.value }))}>{SOURCE_PLATFORMS.map((p) => <option key={p}>{p}</option>)}</select></label>
          <label>国家 / 地区<input value={form.country} onChange={(e) => setForm((f) => ({ ...f, country: e.target.value }))} placeholder="澳大利亚" /></label>
          <label>接入日期<input type="date" value={form.received_at} onChange={(e) => setForm((f) => ({ ...f, received_at: e.target.value }))} /></label>
          <label>负责人<input value={form.lead_owner} onChange={(e) => setForm((f) => ({ ...f, lead_owner: e.target.value }))} placeholder="谁在跟进" /></label>
          <label>分配人<input value={form.assigned_by} onChange={(e) => setForm((f) => ({ ...f, assigned_by: e.target.value }))} placeholder="陈晨" /></label>
          <label>初始状态<select value={form.inbound_status} onChange={(e) => setForm((f) => ({ ...f, inbound_status: e.target.value }))}>{LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}</select></label>
          <label className="full">原始留言（选填）<textarea value={form.original_message} onChange={(e) => setForm((f) => ({ ...f, original_message: e.target.value }))} placeholder="粘贴客户原始留言" /></label>
        </div>
        <div className="modal-actions"><button type="button" className="button secondary" onClick={onClose}>取消</button><button type="button" className="button primary" onClick={onAdd}>接入询盘</button></div>
      </div>
    </div>
  )
}
