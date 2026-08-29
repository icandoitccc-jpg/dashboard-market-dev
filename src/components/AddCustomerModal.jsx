import { useState } from 'react'
import { ChevronDown, Plus, Trash2, X } from 'lucide-react'
import { DEFAULT_CHANNELS, MARKET_OPTIONS } from '../data'
import Combobox from './Combobox'
import { getOptions } from '../dict'

function InputWithChoices({ label, value, onValueChange, options, placeholder }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="editable-select">
      <input aria-label={label} value={value} onChange={(event) => onValueChange(event.target.value)} placeholder={placeholder} />
      <button type="button" aria-label={`打开${label}选项`} onClick={() => setOpen((current) => !current)}><ChevronDown size={17} /></button>
      {open ? <div className="editable-options" role="listbox" aria-label={`${label}已有选项`}>
        {options.map((option) => <button type="button" role="option" key={option} onClick={() => { onValueChange(option); setOpen(false) }}>{option}</button>)}
      </div> : null}
    </div>
  )
}

const AVAIL_OPTIONS = [
  { value: 'unknown', label: '不确认' },
  { value: 'yes', label: '有' },
  { value: 'no', label: '无' },
]

export default function AddCustomerModal({ prospect, onClose, onAdd, onEdit, state, onNewOption }) {
  const isEdit = Boolean(prospect)
  const [form, setForm] = useState({
    name: prospect?.name || '',
    url: prospect?.url || '',
    market: prospect?.market || '澳大利亚',
    customerType: prospect?.customerType || '',
    sourceMethod: prospect?.sourceMethod || '',
    fitNote: prospect?.fitNote || '',
  })
  const [contacts, setContacts] = useState(prospect?.initialContacts || [])
  const [contactDraft, setContactDraft] = useState({ name: '', level: 'Owner', acquisition_method: '', email: '' })
  const [availability, setAvailability] = useState(
    prospect ? Object.fromEntries(prospect.channels.map((c) => [c.key, c.available || 'unknown'])) : {},
  )

  const update = (key, value) => setForm((current) => ({ ...current, [key]: value }))
  const setAvail = (key, value) => setAvailability((current) => ({ ...current, [key]: value }))

  const addContactDraft = () => {
    if (!contactDraft.name.trim()) return
    setContacts((current) => [...current, { ...contactDraft, name: contactDraft.name.trim() }])
    setContactDraft({ name: '', level: 'Owner', acquisition_method: '', email: '' })
  }
  const removeContact = (index) => setContacts((current) => current.filter((_, i) => i !== index))

  const submit = (event) => {
    event.preventDefault()
    if (!form.name.trim()) return
    if (isEdit) {
      onEdit(prospect.id, {
        ...form,
        availability,
      })
      return
    }
    const domain = form.url.replace(/^https?:\/\//, '').replace(/\/.*$/, '')
    const today = new Date().toISOString().slice(0, 10)
    const channels = DEFAULT_CHANNELS.map((channel) => ({
      key: channel.key,
      name: channel.name,
      available: availability[channel.key] || 'unknown',
      discoveredAt: today,
    }))
    onAdd({
      ...form,
      id: `${Date.now()}`,
      domain,
      discovered_at: new Date().toISOString(),
      updatedAt: '刚刚',
      channels,
      initialContacts: contacts.map((contact) => ({ ...contact })),
    })
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <form className="modal modal-wide" onSubmit={submit} onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-heading">
          <div><h2>{isEdit ? '编辑客户' : '添加客户'}</h2><p>{isEdit ? '修改基本信息与确认有的渠道；联系人在详情页单独管理。' : '一次性录完：基本信息、联系人和确认有的渠道。'}</p></div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="关闭"><X size={20} /></button>
        </div>

        <div className="form-grid">
          <label>客户名称<input autoFocus value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="例如 Adventure 4x4" /></label>
          <label>客户网址或主页<input value={form.url} onChange={(e) => update('url', e.target.value)} placeholder="https://" /></label>
          <label>市场 <small>可输入，也可选择</small><InputWithChoices label="市场" value={form.market} onValueChange={(value) => update('market', value)} options={MARKET_OPTIONS} placeholder="输入或选择市场" /></label>
          <label>客户类型 <small>列表没有的，直接输入新增</small><Combobox label="客户类型" value={form.customerType} onChange={(value) => update('customerType', value)} onNewOption={(value) => onNewOption?.('customerType', value)} options={getOptions(state, 'customerType')} placeholder="输入或选择终端业态" /></label>
          <label className="full">从哪里发现 <small>列表没有的，直接输入新增</small><Combobox label="从哪里发现" value={form.sourceMethod} onChange={(value) => update('sourceMethod', value)} onNewOption={(value) => onNewOption?.('sourceMethod', value)} options={getOptions(state, 'sourceMethod')} placeholder="输入或选择发现方法；新方法可直接输入" /></label>
          <label className="full">客户匹配备注（业务员选填）<small>记录为什么值得触达；不清楚时可以留空。</small><textarea value={form.fitNote} onChange={(e) => update('fitNote', e.target.value)} placeholder="例如：主营4WD露营装备，产品与我们的目标场景接近。" /></label>
        </div>

        {!isEdit && (
          <div className="modal-section">
            <h3>联系人（决策人层级与获取方法）<small>找到的客户当场记；可加多个</small></h3>
            {contacts.length ? (
              <ul className="draft-contact-list">
                {contacts.map((contact, index) => (
                  <li key={index}>
                    <span><strong>{contact.name}</strong> <span className={`level-badge level-${contact.level}`}>{contact.level}</span></span>
                    <span className="draft-contact-meta">{contact.acquisition_method || '未填获取方法'}{contact.email ? ` · ${contact.email}` : ''}</span>
                    <button type="button" className="icon-button small" onClick={() => removeContact(index)} aria-label="删除联系人"><Trash2 size={15} /></button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="draft-contact-form">
              <input value={contactDraft.name} onChange={(e) => setContactDraft((f) => ({ ...f, name: e.target.value }))} placeholder="姓名" />
              <select value={contactDraft.level} onChange={(e) => setContactDraft((f) => ({ ...f, level: e.target.value }))}>
                <option>Owner</option><option>Buyer</option><option>Manager</option><option>Unknown</option>
              </select>
              <input value={contactDraft.acquisition_method} onChange={(e) => setContactDraft((f) => ({ ...f, acquisition_method: e.target.value }))} placeholder="获取方法（选填）" />
              <input value={contactDraft.email} onChange={(e) => setContactDraft((f) => ({ ...f, email: e.target.value }))} placeholder="邮箱（选填）" />
              <button type="button" className="button outline compact" onClick={addContactDraft}><Plus size={15} />加联系人</button>
            </div>
          </div>
        )}

        <div className="modal-section">
          <h3>确认有哪些渠道<small>第一轮主动搜索后能得到 80%+ 覆盖；标「无」代表确认对方没有，主管不会误判为没联系</small></h3>
          <div className="channel-availability">
            {DEFAULT_CHANNELS.map((channel) => (
              <div className="avail-row" key={channel.key}>
                <span className="avail-name">{channel.name}</span>
                <div className="segmented compact">
                  {AVAIL_OPTIONS.map((opt) => (
                    <button type="button" key={opt.value} className={(`${availability[channel.key] || 'unknown'}` === opt.value) ? 'active' : ''} onClick={() => setAvail(channel.key, opt.value)}>{opt.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="modal-actions">
          <button type="button" className="button secondary" onClick={onClose}>取消</button>
          <button type="submit" className="button primary">{isEdit ? '保存修改' : '保存客户'}</button>
        </div>
      </form>
    </div>
  )
}
