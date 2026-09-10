import { useMemo, useState } from 'react'
import { ChevronRight, Plus, Search, ArrowLeft, Pencil, MessageSquare, RefreshCw } from 'lucide-react'
import { computeInbound, LEAD_STATUS_LABELS, LEAD_STATUSES } from '../metrics'
import Combobox from './Combobox'
import { getOptions, registerOption } from '../dict'
import { deleteFollowUpLog } from '../storage'

// 从社媒主页链接里提取可读用户名：https://www.instagram.com/icebathusa/ -> icebathusa
function extractHandle(url) {
  if (!url) return ''
  const match = String(url).replace(/\/$/, '').match(/\/([^/]+)$/)
  return match ? match[1] : url
}

const SOURCE_PLATFORMS = ['Instagram', 'Facebook', 'LinkedIn', 'Website', 'WhatsApp', 'Email', '其他']

// 客户画像里可编辑的字段：改了要走「保存」按钮，且自动在时间线里留痕
const PROFILE_FIELDS = [
  { key: 'company_handle', label: '店铺/账号名' },
  { key: 'source_platform', label: '来源平台', type: 'select', options: SOURCE_PLATFORMS },
  { key: 'country', label: '国家/地区' },
  { key: 'website', label: '网站' },
  { key: 'business_type', label: '主营品类' },
  { key: 'contact_name', label: '联系人' },
  { key: 'email', label: '邮箱' },
  { key: 'phone', label: '电话' },
  { key: 'lead_owner', label: '负责人' },
  { key: 'need_discovery_text', label: '需求发现', type: 'textarea' },
]

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
  need_discovery_text: '',
})

function profileFormFrom(lead) {
  const form = {}
  PROFILE_FIELDS.forEach((f) => { form[f.key] = lead[f.key] || '' })
  form.need_type = [...(lead.need_type || [])]
  return form
}

export default function InboundView({ state, setState, currentUser = '陈晨', initialSelectedId = null, onNavigate }) {
  const focusMode = Boolean(initialSelectedId) // 从「全部客户」点进来：只看这一条，不甩出一整个列表和新增按钮
  const [selectedId, setSelectedId] = useState(initialSelectedId || state.inbound_leads[0]?.id)
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [form, setForm] = useState(blankForm(currentUser))
  const [newNeedType, setNewNeedType] = useState('')
  const [followNote, setFollowNote] = useState('')
  const [followNextAction, setFollowNextAction] = useState('')
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState({})

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
  const pushLog = (entry) => setState((current) => ({
    ...current, lead_follow_ups: [{ id: `lf_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, lead_id: selected.id, created_by: currentUser, created_at: new Date().toISOString(), note: '', next_action: '', ...entry }, ...(current.lead_follow_ups || [])],
  }))

  const startEditProfile = () => { setProfileForm(profileFormFrom(selected)); setEditingProfile(true) }
  const cancelEditProfile = () => setEditingProfile(false)
  const toggleDraftNeedType = (label) => setProfileForm((p) => ({
    ...p, need_type: p.need_type.includes(label) ? p.need_type.filter((x) => x !== label) : [...p.need_type, label],
  }))
  const addDraftNeedType = () => {
    const v = newNeedType.trim()
    if (!v) return
    if (!profileForm.need_type.includes(v)) toggleDraftNeedType(v)
    if (!getOptions(state, 'inboundNeedType').includes(v)) register('inboundNeedType', v)
    setNewNeedType('')
  }
  const saveProfile = () => {
    const changed = PROFILE_FIELDS.filter((f) => (profileForm[f.key] || '') !== (selected[f.key] || ''))
    const oldTypes = selected.need_type || []
    const newTypes = profileForm.need_type || []
    const typesChanged = oldTypes.length !== newTypes.length || oldTypes.some((t) => !newTypes.includes(t))
    if (!changed.length && !typesChanged) { setEditingProfile(false); return }
    const now = new Date().toISOString()
    const logs = changed.map((f, i) => ({
      id: `lf_${Date.now()}_${i}`, lead_id: selected.id, kind: 'profile_edit', created_by: currentUser, created_at: now,
      note: `把「${f.label}」从「${selected[f.key] || '空'}」改成了「${profileForm[f.key] || '空'}」`,
    }))
    if (typesChanged) {
      logs.push({
        id: `lf_${Date.now()}_type`, lead_id: selected.id, kind: 'profile_edit', created_by: currentUser, created_at: now,
        note: `把「需求类型」改成了：${newTypes.length ? newTypes.join('、') : '（空）'}`,
      })
    }
    setState((current) => ({
      ...current,
      inbound_leads: current.inbound_leads.map((l) => (l.id === selected.id ? { ...l, ...profileForm } : l)),
      lead_follow_ups: [...logs, ...(current.lead_follow_ups || [])],
    }))
    setEditingProfile(false)
  }
  const changeStatus = (newStatus) => {
    if (!selected || newStatus === selected.inbound_status) return
    pushLog({ kind: 'status_change', note: `状态从「${LEAD_STATUS_LABELS[selected.inbound_status]}」改成了「${LEAD_STATUS_LABELS[newStatus]}」` })
    updateLead(selected.id, { inbound_status: newStatus })
  }

  // 需求类型（枚举来自 Inbound 表真实取值，可自定义新增）
  const needTypes = useMemo(() => [...new Set([...getOptions(state, 'inboundNeedType'), ...(selected?.need_type || [])])], [state, selected])
  const addLead = () => {
    // 归属原则：谁录入（当前操作员），询盘就归谁；负责人字段可在详情页改。
    const owner = form.lead_owner.trim() || currentUser
    if (!form.original_message.trim() && !owner.trim()) return
    const id = `il_${Date.now()}`
    const lead = { id, received_at: form.received_at || new Date().toISOString(), source_platform: form.source_platform, country: form.country, original_message: form.original_message, lead_owner: owner, assigned_by: form.assigned_by.trim() || currentUser, assigned_at: new Date().toISOString(), inbound_status: form.inbound_status, next_action: form.next_action, follow_up: form.follow_up, lost_reason: form.lost_reason, need_discovery_text: form.need_discovery_text, company: '', company_handle: '', contact: '', website: '', business_type: '', contact_name: '', email: '', phone: '', first_reply: null, last_contact: null, follow_up_count: 0, note: '' }
    setState((current) => ({ ...current, inbound_leads: [lead, ...current.inbound_leads] }))
    setSelectedId(id); setShowAdd(false); setForm(blankForm(currentUser))
  }
  const addFollowUp = () => {
    const note = followNote.trim()
    const next = followNextAction.trim()
    if ((!note && !next) || !selected) return
    // 日期自动记成保存的那一刻，不需要手动挑日期
    const entry = { id: `lf_${Date.now()}`, lead_id: selected.id, kind: 'follow_up', note, next_action: next, created_by: currentUser, created_at: new Date().toISOString() }
    setState((current) => ({
      ...current,
      lead_follow_ups: [entry, ...(current.lead_follow_ups || [])],
      inbound_leads: current.inbound_leads.map((l) => (l.id === selected.id ? { ...l, next_action: next || l.next_action, last_contact: entry.created_at.slice(0, 10) } : l)),
    }))
    setFollowNote(''); setFollowNextAction('')
  }
  const [editingLogId, setEditingLogId] = useState(null)
  const [editLogForm, setEditLogForm] = useState({ note: '', next_action: '' })
  const startEditLog = (entry) => { setEditingLogId(entry.id); setEditLogForm({ note: entry.note || '', next_action: entry.next_action || '' }) }
  const cancelEditLog = () => setEditingLogId(null)
  const saveEditLog = () => {
    const now = new Date().toISOString()
    setState((current) => ({
      ...current,
      lead_follow_ups: (current.lead_follow_ups || []).map((f) => (f.id === editingLogId ? { ...f, note: editLogForm.note, next_action: editLogForm.next_action, updated_at: now, updated_by: currentUser } : f)),
    }))
    setEditingLogId(null)
  }
  const deleteLog = (id) => {
    if (!window.confirm('确定删除这条跟进记录吗？删除后无法恢复。')) return
    setState((current) => ({ ...current, lead_follow_ups: (current.lead_follow_ups || []).filter((f) => f.id !== id) }))
    deleteFollowUpLog(id) // 直接同步删库，避免刷新后又出现（整表 upsert 不会主动删远端数据）
    setEditingLogId(null)
  }

  if (!selected) {
    return (
      <div className="flow-page">
        {initialSelectedId && onNavigate ? (
          <button type="button" className="back-link" onClick={() => onNavigate('contacts')}><ArrowLeft size={15} />全部客户</button>
        ) : null}
        <div className="flow-header"><div><h1>总体 Inbound</h1><p>客户主动发来的询盘（社媒私信、官网表单、邮件等）都记在这里，和 Outbound 分开管理，互不影响。</p></div></div>
        <div className="sales-layout">
          <section className="prospect-rail"><div className="rail-heading"><h1>Inbound 询盘</h1><button className="button outline" onClick={() => setShowAdd(true)}><Plus size={17} />接入询盘</button></div><div className="empty-list">还没有 Inbound 询盘记录</div></section>
          <section className="empty-main"><div><h1>从真实询盘开始</h1><p>先记下来源平台和原始留言，再补需求发现与跟进。</p><button className="button primary large" onClick={() => setShowAdd(true)}><Plus size={17} />接入第一个询盘</button></div></section>
          {showAdd && <LeadModal form={form} setForm={setForm} onClose={() => setShowAdd(false)} onAdd={addLead} />}
        </div>
      </div>
    )
  }

  const followLog = (state.lead_follow_ups || []).filter((f) => f.lead_id === selected.id)
  const timeline = [
    { id: 'origin', kind: 'origin', at: selected.assigned_at || selected.received_at, note: selected.original_message || '（没有留下原始留言）', created_by: selected.lead_owner },
    ...followLog,
  ].sort((a, b) => (b.at || b.created_at || '').localeCompare(a.at || a.created_at || ''))
  const displayName = selected.company_handle || extractHandle(selected.company) || selected.contact_name || '未命名询盘'

  return (
    <div className="flow-page">
      {initialSelectedId && onNavigate ? (
        <button type="button" className="back-link" onClick={() => onNavigate('contacts')}><ArrowLeft size={15} />全部客户</button>
      ) : null}
      <div className="flow-header"><div><h1>总体 Inbound</h1><p>记录每一条客户主动询盘：从哪里来、聊了什么、跟进到什么程度。</p></div></div>
      {!focusMode ? (
        <div className="metrics-row">
          <div className="metric-card blue"><div className="mc-body"><span className="mc-label">总询盘</span><strong className="mc-value">{ib.total}</strong><small className="mc-sub">条</small></div></div>
          {LEAD_STATUSES.slice(0, 5).map((s) => <div key={s} className={`metric-card ${s === 'Converted' ? 'green' : s === 'Lost' ? 'red' : 'default'}`}><div className="mc-body"><span className="mc-label">{LEAD_STATUS_LABELS[s]}</span><strong className="mc-value">{ib.counts[s]}</strong><small className="mc-sub">条</small></div></div>)}
        </div>
      ) : null}

      <div className={focusMode ? 'focus-layout' : 'sales-layout'}>
        {!focusMode ? (
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
        ) : null}

        <section className="customer-workspace">
          <div className="customer-heading">
            <div>
              <h1>{displayName} <small style={{ fontWeight: 400, fontSize: 13, color: 'var(--muted)' }}>· {selected.source_platform}</small></h1>
              <p>当前状态、画像信息、完整进展都在这里，改动会留痕。</p>
            </div>
            <div className="heading-actions">
              <select className="status-pill-select" value={selected.inbound_status} onChange={(e) => changeStatus(e.target.value)} aria-label="当前状态">
                {LEAD_STATUSES.map((s) => <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>)}
              </select>
            </div>
          </div>

          {/* ① 客户画像 —— 相对稳定的身份信息 + 需求信息，改身份字段要走「保存」并自动留痕 */}
          <section className="card">
            <div className="card-head">
              <h2><span className="section-num">①</span> 客户画像</h2>
              {!editingProfile ? (
                <button type="button" className="button outline compact" onClick={startEditProfile}><Pencil size={14} />编辑画像</button>
              ) : null}
            </div>
            {!editingProfile ? (
              <div className="info-grid">
                {PROFILE_FIELDS.filter((f) => f.type !== 'textarea').map((f) => (
                  <div key={f.key}><span>{f.label}</span><strong>{selected[f.key] || '待补充'}</strong></div>
                ))}
                <div><span>接入时间</span><strong>{selected.assigned_at?.slice(0, 10) || '待补充'}</strong></div>
                <div><span>分配人</span><strong>{selected.assigned_by || '待补充'}</strong></div>
                {PROFILE_FIELDS.filter((f) => f.type === 'textarea').map((f) => (
                  <div key={f.key} className="span-3">
                    <span>{f.label}</span>
                    <div className="inquiry-readonly" style={{ marginTop: 4 }}>{selected[f.key] || '待补充'}</div>
                  </div>
                ))}
                <div className="span-3">
                  <span>需求类型</span>
                  <div className="need-grid" style={{ marginTop: 4 }}>
                    {(selected.need_type || []).length ? selected.need_type.map((item) => <span key={item} className="need-chip readonly">{item}</span>) : <span style={{ fontSize: 12.5, color: 'var(--muted)' }}>待补充</span>}
                  </div>
                </div>
              </div>
            ) : (
              <>
                <div className="form-grid">
                  {PROFILE_FIELDS.filter((f) => f.type !== 'textarea').map((f) => (
                    <label key={f.key}>{f.label}
                      {f.type === 'select' ? (
                        <select value={profileForm[f.key] || ''} onChange={(e) => setProfileForm((p) => ({ ...p, [f.key]: e.target.value }))}>
                          {f.options.map((o) => <option key={o}>{o}</option>)}
                        </select>
                      ) : (
                        <input value={profileForm[f.key] || ''} onChange={(e) => setProfileForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                      )}
                    </label>
                  ))}
                  {PROFILE_FIELDS.filter((f) => f.type === 'textarea').map((f) => (
                    <label key={f.key} className="full">{f.label}
                      <textarea value={profileForm[f.key] || ''} onChange={(e) => setProfileForm((p) => ({ ...p, [f.key]: e.target.value }))} />
                    </label>
                  ))}
                  <div className="full">
                    <span style={{ fontSize: 11.5, color: 'var(--muted)' }}>需求类型<small style={{ marginLeft: 6 }}>客户主动想要什么；列表没有的，输入新增</small></span>
                    <div className="need-grid" style={{ marginTop: 6 }}>
                      {needTypes.map((item) => { const checked = profileForm.need_type?.includes(item); return <button type="button" key={item} className={`need-chip ${checked ? 'on' : ''}`} onClick={() => toggleDraftNeedType(item)}><span className="need-check">{checked ? '✓' : ''}</span>{item}</button> })}
                    </div>
                    <div className="need-add-row">
                      <Combobox label="新增需求类型" value={newNeedType} onChange={setNewNeedType} onNewOption={(v) => register('inboundNeedType', v)} options={getOptions(state, 'inboundNeedType')} placeholder="例如：定制贴牌、加急订单" />
                      <button type="button" className="button outline compact" onClick={addDraftNeedType}><Plus size={15} />加入</button>
                    </div>
                  </div>
                </div>
                <div className="form-actions">
                  <button type="button" className="button secondary" onClick={cancelEditProfile}>取消</button>
                  <button type="button" className="button primary" onClick={saveProfile}>保存修改</button>
                </div>
              </>
            )}
          </section>

          {/* ② 开发进展时间线 —— 原始留言 + 每次跟进 + 每次画像/状态修改，统一按时间倒序 */}
          <section className="card">
            <div className="card-head">
              <h2><span className="section-num">②</span> 开发进展</h2>
              <span className="current-next-action">当前下一步：{selected.next_action || '还没定'}</span>
            </div>
            <div className="timeline-list">
              {timeline.map((t) => (
                <div className="timeline-item" key={t.id}>
                  <div className="timeline-icon">{t.kind === 'origin' ? <MessageSquare size={14} /> : t.kind === 'profile_edit' ? <Pencil size={13} /> : t.kind === 'status_change' ? <RefreshCw size={13} /> : <MessageSquare size={14} />}</div>
                  <div className="timeline-body">
                    <div className="timeline-meta">
                      <span>{(t.at || t.created_at || '').slice(0, 10)}</span>
                      <span>· {t.created_by || '未知'}</span>
                      {t.kind === 'origin' ? <span className="badge idle">原始留言</span> : null}
                      {t.kind === 'profile_edit' ? <span className="badge auto">画像修改</span> : null}
                      {t.kind === 'status_change' ? <span className="badge human">状态变更</span> : null}
                      {t.updated_at ? <span className="badge idle">已修改</span> : null}
                      {t.kind === 'follow_up' && editingLogId !== t.id ? (
                        <button type="button" className="icon-button small" onClick={() => startEditLog(t)} aria-label="编辑这条跟进记录"><Pencil size={12} /></button>
                      ) : null}
                    </div>
                    {editingLogId === t.id ? (
                      <div className="follow-add-row" style={{ marginTop: 6 }}>
                        <textarea value={editLogForm.note} onChange={(e) => setEditLogForm((f) => ({ ...f, note: e.target.value }))} placeholder="这次跟进说了什么" />
                        <input value={editLogForm.next_action} onChange={(e) => setEditLogForm((f) => ({ ...f, next_action: e.target.value }))} placeholder="下一步打算做什么" />
                        <div className="form-actions">
                          <button type="button" className="button danger-text" onClick={() => deleteLog(t.id)}>删除这条记录</button>
                          <button type="button" className="button secondary" onClick={cancelEditLog}>取消</button>
                          <button type="button" className="button primary compact" onClick={saveEditLog}>保存修改</button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {t.note ? <div className="timeline-note">{t.note}</div> : null}
                        {t.next_action ? <div className="timeline-next">下一步：{t.next_action}</div> : null}
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {/* ③ 更新进展 —— 保存后立刻出现在②的最上面，同时刷新「当前下一步」 */}
          <section className="card">
            <h2><span className="section-num">③</span> 更新进展</h2>
            <div className="follow-add-row">
              <textarea value={followNote} onChange={(e) => setFollowNote(e.target.value)} placeholder="这次跟进说了什么 / 客户反馈是什么（选填）" />
              <input value={followNextAction} onChange={(e) => setFollowNextAction(e.target.value)} placeholder="下一步打算做什么（选填，例如：发报价单）" />
              <button type="button" className="button primary compact" onClick={addFollowUp}><Plus size={15} />保存这次更新</button>
            </div>
          </section>

          {(selected.inbound_status === 'Stalled' || selected.inbound_status === 'Lost') ? (
            <div className="customer-meta" style={{ gridTemplateColumns: '1fr' }}>
              <div className="customer-fields"><div><span>{selected.inbound_status === 'Lost' ? '流失原因' : '停滞原因'}</span><input value={selected.lost_reason || ''} onChange={(e) => updateLead(selected.id, { lost_reason: e.target.value })} placeholder="例如：价格高于预期" /></div></div>
            </div>
          ) : null}
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
