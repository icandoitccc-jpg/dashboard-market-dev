import { Fragment, useEffect, useState, useMemo } from 'react'
import { Check, ChevronRight, ExternalLink, Pencil, Plus, Search, AlertCircle, Clock, Target } from 'lucide-react'
import AddCustomerModal from './AddCustomerModal'
import Combobox from './Combobox'
import { getOptions, registerOption } from '../dict'

const RESULT_OPTIONS = [
  { value: 'none', label: '无回应' },
  { value: 'auto', label: '自动回复' },
  { value: 'human', label: '真人回复' },
  { value: 'bounced', label: '退信 / 投递失败' },
]
// 真人回复细分（用户定义的结果分支）：拒绝也是有效信号
const REASON_TO_SENTIMENT = { '感兴趣': 'interested', '拒绝': 'not_interested' }
const SENTIMENT_LABEL = { interested: '感兴趣', neutral: '中性', not_interested: '不感兴趣' }

function ResultBadge({ replyType, sentiment, replyReason }) {
  if (replyType === 'auto') return <span className="badge auto">自动回复</span>
  if (replyType === 'human') return <span className="badge human">真人{replyReason ? `·${replyReason}` : (sentiment && sentiment !== 'neutral' ? `·${SENTIMENT_LABEL[sentiment] || ''}` : '')}</span>
  if (replyType === 'bounced') return <span className="badge bounced">退信</span>
  return <span className="badge idle">未触达</span>
}

// Right-hand workspace for one selected prospect: info, contacts, touch form, history.
export default function CustomerDetail({ state, setState, prospect, currentUser = '陈晨' }) {
  const [showEdit, setShowEdit] = useState(false)
  const [showRoundForm, setShowRoundForm] = useState(false)
  const [round, setRound] = useState({ messageNote: '', note: '', entries: {} })
  const [toast, setToast] = useState('')
  const [showContactForm, setShowContactForm] = useState(false)
  const [contactForm, setContactForm] = useState({ name: '', level: 'Owner', acquisition_method: '', email: '' })

  // 业务员新增选项 → 共享字典 + 前线事件（主管总览可见）
  const register = (field, value) => setState((cur) => registerOption(cur, field, value, currentUser))

  const companyContacts = state.contacts.filter((c) => c.company_id === prospect.id)
  const availableChannels = prospect.channels.filter((c) => c.available === 'yes')
  const openTasks = state.follow_up_tasks.filter((t) => t.status === 'open' && t.company_id === prospect.id)

  // 该客户的历史触达记录，按日期倒序
  const companyActivities = useMemo(() => {
    return state.activities
      .filter((a) => a.company_id === prospect.id && a.kind === 'outreach')
      .sort((a, b) => new Date(b.at) - new Date(a.at))
  }, [state.activities, prospect.id])

  useEffect(() => { setShowRoundForm(false); setRound({ messageNote: '', note: '', entries: {} }) }, [prospect.id])

  const updateSelected = (updater) => setState((current) => ({
    ...current,
    prospects: current.prospects.map((p) => (p.id === prospect.id ? updater(p) : p)),
  }))

  const toggleSent = (key) => setRound((cur) => ({
    ...cur, entries: { ...cur.entries, [key]: { sent: !cur.entries[key]?.sent, result: cur.entries[key]?.result || 'none', replyReason: cur.entries[key]?.replyReason || '' } },
  }))
  const setResult = (key, result) => setRound((cur) => ({
    ...cur, entries: { ...cur.entries, [key]: { sent: cur.entries[key]?.sent || false, result, replyReason: cur.entries[key]?.replyReason || '' } },
  }))
  const setReplyReason = (key, replyReason) => setRound((cur) => ({
    ...cur, entries: { ...cur.entries, [key]: { ...(cur.entries[key] || { sent: false, result: 'none' }), replyReason } },
  }))
  const resetRound = () => setRound({ messageNote: '', note: '', entries: {} })

  const selectedChannelKeys = availableChannels.filter((c) => round.entries[c.key]?.sent).map((c) => c.key)

  const saveRound = () => {
    const sentKeys = selectedChannelKeys
    if (!sentKeys.length) { setToast('请先选择至少一个渠道'); return }
    const roundId = `r_${Date.now()}`
    const at = new Date().toISOString()
    const outreach = []
    const reply = []
    let humanCompany = null
    sentKeys.forEach((key, index) => {
      const channel = availableChannels.find((c) => c.key === key)
      if (!channel) return
      outreach.push({ id: `a_${roundId}_${index}_${key}`, company_id: prospect.id, contact_id: null, flow_type: 'outbound', channel: channel.name, kind: 'outreach', replyType: null, sentiment: null, at, round_id: roundId, note: round.messageNote || null })
      const result = round.entries[key]?.result || 'none'
      if (result === 'auto') reply.push({ id: `a_${roundId}_${index}_${key}_r`, company_id: prospect.id, contact_id: null, flow_type: 'outbound', channel: channel.name, kind: 'outreach', replyType: 'auto', sentiment: null, reply_reason: null, at, round_id: roundId, note: round.note || null })
      else if (result === 'human') {
        const replyReason = (round.entries[key]?.replyReason || '').trim()
        const sentiment = REASON_TO_SENTIMENT[replyReason] || 'neutral'
        reply.push({ id: `a_${roundId}_${index}_${key}_r`, company_id: prospect.id, contact_id: null, flow_type: 'outbound', channel: channel.name, kind: 'outreach', replyType: 'human', sentiment, reply_reason: replyReason || null, at, round_id: roundId, note: round.note || null })
        humanCompany = { id: prospect.id, name: prospect.name, replyReason }
      } else if (result === 'bounced') reply.push({ id: `a_${roundId}_${index}_${key}_r`, company_id: prospect.id, contact_id: null, flow_type: 'outbound', channel: channel.name, kind: 'outreach', replyType: 'bounced', sentiment: null, reply_reason: null, at, round_id: roundId, note: round.note || null })
    })
    // stamp replyType onto the matching outreach activity so metrics reflect it
    const replyMap = {}
    reply.forEach((r) => { replyMap[r.channel] = r })
    outreach.forEach((o) => { const rp = replyMap[o.channel]; if (rp) { o.replyType = rp.replyType; o.sentiment = rp?.sentiment || null; o.reply_reason = rp?.reply_reason || null } })

    setState((current) => {
      const followUps = [...current.follow_up_tasks]
      if (humanCompany && !followUps.some((t) => t.company_id === humanCompany.id && t.status === 'open')) {
        followUps.push({ id: `fu_${Date.now()}`, company_id: humanCompany.id, company_name: humanCompany.name, reason: '客户给了真人回复，建议二次触达', priority: 'high', created_at: at, status: 'open', done_at: null })
      }
      return {
        ...current,
        activities: [...current.activities, ...outreach, ...reply],
        follow_up_tasks: followUps,
        // 真人回复分支写回客户（最新一次），停滞点同步清掉
        prospects: current.prospects.map((p) => {
          if (p.id !== prospect.id) return p
          const isHuman = humanCompany && humanCompany.id === p.id
          return {
            ...p,
            updatedAt: '刚刚',
            replyReason: isHuman ? (humanCompany.replyReason || p.replyReason) : p.replyReason,
            stuckAt: isHuman ? '' : p.stuckAt,
            channels: p.channels.map((c) => (sentKeys.includes(c.key) ? { ...c, touchCount: (c.touchCount || 0) + 1 } : c)),
          }
        }),
      }
    })
    resetRound(); setShowRoundForm(false)
    setToast(`已保存本轮 ${sentKeys.length} 个渠道触达${humanCompany ? '，并生成二次触达提醒' : ''}`)
    setTimeout(() => setToast(''), 2800)
  }
  const completeTask = (taskId) => setState((current) => ({
    ...current, follow_up_tasks: current.follow_up_tasks.map((t) => (t.id === taskId ? { ...t, status: 'done', done_at: new Date().toISOString() } : t)),
  }))
  const addContact = () => {
    if (!contactForm.name.trim()) return
    setState((current) => ({ ...current, contacts: [...current.contacts, { id: `c_${Date.now()}`, company_id: prospect.id, name: contactForm.name.trim(), level: contactForm.level, acquisition_method: contactForm.acquisition_method.trim(), email: contactForm.email.trim(), created_at: new Date().toISOString() }] }))
    setContactForm({ name: '', level: 'Owner', acquisition_method: '', email: '' }); setShowContactForm(false)
  }

  return (
    <section className="customer-workspace">
      {openTasks.length ? (
        <section className="followup-panel">
          <h2>待二次触达 <small>{openTasks.length} 条提醒（真人回复过的客户）</small></h2>
          <div className="followup-list">
            {openTasks.map((task) => (
              <div className={`followup-card ${task.priority}`} key={task.id}>
                <div className="followup-main"><strong>{task.company_name}</strong><span>{task.reason}</span></div>
                <div className="followup-actions">
                  <button type="button" className="button outline compact" onClick={() => completeTask(task.id)}>标记完成</button>
                </div>
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="customer-heading">
        <div>
          <h1>{prospect.name}</h1>
          <p>记录已经发出的触达和收到的回复；不计时、不排名，只验证哪条路径有效。</p>
        </div>
        <div className="heading-actions">
          <button type="button" className="button outline compact" onClick={() => setShowEdit(true)}><Pencil size={15} />编辑客户</button>
        </div>
      </div>

      <section className="card">
        <h2>客户信息</h2>
        <div className="info-grid">
          <div><span>客户类型</span><strong>{prospect.customerType || prospect.segment || '待补充'}</strong></div>
          <div><span>市场</span><strong>{prospect.market || '待补充'}</strong></div>
          <div><span>业务员</span><strong>{prospect.owner || '未分配'}</strong></div>
          <div><span>当前阶段</span><strong>{prospect.status || '待补充'}</strong></div>
          <div><span>从哪里发现</span><strong>{prospect.sourceMethod || prospect.source || '待补充'}</strong></div>
          <div><span>真人回复内容</span><strong>{prospect.replyReason || '—'}</strong></div>
          <div className="info-combo"><span>停滞点<small>卡在哪一步，点选或输入</small></span>
            <Combobox
              label="停滞点"
              value={prospect.stuckAt || ''}
              onChange={(v) => updateSelected((p) => ({ ...p, stuckAt: v }))}
              onNewOption={(v) => register('stuckAt', v)}
              options={getOptions(state, 'stuckAt')}
              placeholder="无 / 触达后无回应…"
            />
          </div>
          <div><span>首次联系</span><strong>{prospect.first_contact || '待补充'}</strong></div>
          {prospect.region ? <div><span>州/地区</span><strong>{prospect.region}</strong></div> : null}
          {prospect.scale ? <div><span>体量</span><strong>{prospect.scale}</strong></div> : null}
          <div className="span-2"><span>网站</span>{prospect.url ? <a href={prospect.url} target="_blank" rel="noreferrer">{prospect.url} <ExternalLink size={13} /></a> : <span>待补充</span>}</div>
        </div>
        {prospect.remark ? <label className="fit-note"><span>备注<small>原始记录</small></span><textarea readOnly value={prospect.remark} /></label> : null}
      </section>

      <section className="card">
        <div className="card-head"><h2>联系人 <small>获取方法与决策人层级</small></h2>{!showContactForm && <button type="button" className="button outline compact" onClick={() => setShowContactForm(true)}><Plus size={15} />添加联系人</button>}</div>
        {companyContacts.length ? (
          <div className="contact-list">
            {companyContacts.map((contact) => (
              <div className="contact-card" key={contact.id}>
                <div className="contact-main"><strong>{contact.name || '(未填姓名)'}</strong>{contact.level ? <span className="level-badge">{contact.level}</span> : null}</div>
                {contact.acquisition_method ? <div className="contact-meta">获取方法：{contact.acquisition_method}</div> : null}
                {contact.email ? <div className="contact-meta">{contact.email}</div> : null}
                {contact.phone ? <div className="contact-meta">{contact.phone}</div> : null}
              </div>
            ))}
          </div>
        ) : <p className="contact-empty">还没有记录联系人。Outbound 里「怎么找到 Owner / Buyer」是澳洲最痛的点，先在这里记下来。</p>}
        {showContactForm ? (
          <div className="contact-form">
            <label>姓名<input value={contactForm.name} onChange={(e) => setContactForm((f) => ({ ...f, name: e.target.value }))} placeholder="联系人姓名" /></label>
            <label>决策人层级<select value={contactForm.level} onChange={(e) => setContactForm((f) => ({ ...f, level: e.target.value }))}><option>Owner</option><option>Buyer</option><option>Manager</option><option>Unknown</option></select></label>
            <label>获取方法<input value={contactForm.acquisition_method} onChange={(e) => setContactForm((f) => ({ ...f, acquisition_method: e.target.value }))} placeholder="例如：Hunter 邮箱挖掘 / LinkedIn" /></label>
            <label>邮箱 / 联系方式<input value={contactForm.email} onChange={(e) => setContactForm((f) => ({ ...f, email: e.target.value }))} placeholder="选填" /></label>
            <div className="contact-form-actions"><button type="button" className="button secondary" onClick={() => setShowContactForm(false)}>取消</button><button type="button" className="button primary compact" onClick={addContact}>保存联系人</button></div>
          </div>
        ) : null}
      </section>

      {/* ── 渠道与触达：完全重写 ── */}
      <section className="card">
        <div className="card-head"><h2>渠道与触达</h2>{!showRoundForm && <button type="button" className="button primary compact" onClick={() => { resetRound(); setShowRoundForm(true) }}><Plus size={15} />记录新触达</button>}</div>

        {showRoundForm ? (
          <div className="round-form-v2">
            {/* 步骤1：选择渠道 */}
            <div className="form-section">
              <h4>选择本次触达的渠道</h4>
              {availableChannels.length > 0 ? (
                <div className="channel-pick-grid">
                  {availableChannels.map((channel) => (
                    <label key={channel.key} className={`channel-pick ${round.entries[channel.key]?.sent ? 'selected' : ''}`}>
                      <input
                        type="checkbox"
                        checked={!!round.entries[channel.key]?.sent}
                        onChange={() => toggleSent(channel.key)}
                      />
                      <span>{channel.name}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <p className="form-hint">该客户还没有确认可用渠道。请先「编辑客户」，在弹窗中确认有哪些渠道。</p>
              )}
            </div>

            {/* 步骤2：配置各渠道结果 */}
            {selectedChannelKeys.length > 0 && (
              <div className="form-section">
                <h4>填写各渠道结果</h4>
                <div className="channel-config-list">
                  {selectedChannelKeys.map((key) => {
                    const channel = availableChannels.find((c) => c.key === key)
                    const entry = round.entries[key] || { sent: true, result: 'none', replyReason: '' }
                    return (
                      <div className="channel-config" key={key}>
                        <div className="config-header">
                          <strong>{channel.name}</strong>
                          <span className="config-count">第 {(channel.touchCount || 0) + 1} 次</span>
                        </div>
                        <div className="config-body">
                          <select value={entry.result} onChange={(e) => setResult(key, e.target.value)} aria-label={`${channel.name}结果`}>
                            {RESULT_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                          </select>
                          {entry.result === 'human' ? (
                            <div className="reason-cell">
                              <span className="reason-label">回复内容</span>
                              <Combobox
                                label={`${channel.name}真人回复内容`}
                                value={entry.replyReason || ''}
                                onChange={(v) => setReplyReason(key, v)}
                                onNewOption={(v) => register('replyReason', v)}
                                options={getOptions(state, 'replyReason')}
                                placeholder="拒绝 / 价格异议 / 感兴趣…"
                              />
                            </div>
                          ) : null}
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {selectedChannelKeys.length > 0 && (
              <>
                <label className="field full"><span>本次发送内容备注（选填）</span><input value={round.messageNote ?? ''} onChange={(e) => setRound((r) => ({ ...r, messageNote: e.target.value }))} placeholder="实际使用的邮件/话术名称或简短区别；没有固定版本可留空" /></label>
                <label className="field full"><span>异常情况备注（可选）</span><textarea value={round.note ?? ''} onChange={(e) => setRound((r) => ({ ...r, note: e.target.value }))} placeholder="只记录与默认情况不同的内容，例如某个平台无法私信。" /></label>
              </>
            )}

            <div className="form-actions">
              <button type="button" className="button secondary" onClick={() => { resetRound(); setShowRoundForm(false) }}>取消</button>
              <button type="button" className="button primary" onClick={saveRound} disabled={selectedChannelKeys.length === 0}>保存本次触达</button>
            </div>
          </div>
        ) : (
          <>
            {/* 历史触达时间线 */}
            <div className="touch-history">
              {companyActivities.length > 0 ? (
                companyActivities.map((activity, idx) => (
                  <div className="touch-record" key={activity.id}>
                    <div className="touch-meta">
                      <span className="touch-round">第 {companyActivities.length - idx} 次触达</span>
                      <span className="touch-date">{activity.at ? activity.at.slice(0, 10) : ''}</span>
                      <ResultBadge replyType={activity.replyType} sentiment={activity.sentiment} replyReason={activity.reply_reason || activity.replyReason} />
                    </div>
                    <div className="touch-detail">
                      <span className="touch-channel-tag">{activity.channel}</span>
                      {activity.note ? <span className="touch-note">{activity.note}</span> : null}
                    </div>
                  </div>
                ))
              ) : (
                <p className="touch-empty">还没有触达记录。点击上方「记录新触达」开始记录。</p>
              )}
            </div>
          </>
        )}
      </section>

      {showEdit && <AddCustomerModal prospect={prospect} state={state} onNewOption={register} onClose={() => setShowEdit(false)} onEdit={(id, data) => { updateSelected((p) => ({ ...p, name: data.name, market: data.market, customerType: data.customerType, sourceMethod: data.sourceMethod, fitNote: data.fitNote, channels: p.channels.map((c) => ({ ...c, available: data.availability[c.key] || c.available })) })); setShowEdit(false); setToast('已更新客户信息'); setTimeout(() => setToast(''), 2200) }} />}
      {toast && <div className="toast">{toast}</div>}
    </section>
  )
}
