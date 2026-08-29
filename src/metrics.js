// Shared dashboard metrics. All numbers trace to real activities / leads.
// Outbound "result" is read from each outreach activity's replyType
// (derived from the customer's current stage in 05 — single latest touch).
export const LEAD_STATUS_LABELS = {
  New: '新询盘', Learning: '了解中', Qualified: '已确认意向',
  Converted: '已转化', Stalled: '停滞', Lost: '流失',
}
export const LEAD_STATUSES = ['New', 'Learning', 'Qualified', 'Converted', 'Stalled', 'Lost']
export const RESULT_LABEL = { none: '无回应', auto: '自动回复', human: '真人回复', bounced: '退信' }

// Return a set of prospect ids allowed by an optional market / owner filter.
export function allowedCompanyIds(state, { market, ownerIds } = {}) {
  return new Set(
    state.prospects
      .filter((p) => (!market || market === '全部' || p.market === market))
      .filter((p) => (!ownerIds || ownerIds.includes(p.owner)))
      .map((p) => p.id),
  )
}

export function computeOutbound(state, filter = {}) {
  const ids = allowedCompanyIds(state, filter)
  const out = state.activities.filter(
    (a) => a.flow_type === 'outbound' && a.kind === 'outreach' && (!ids.size || ids.has(a.company_id)),
  )
  let human = 0, auto = 0, bounce = 0, none = 0
  const perChannel = {}
  out.forEach((a) => {
    const rt = a.replyType || 'none'
    if (rt === 'human') human += 1
    else if (rt === 'auto') auto += 1
    else if (rt === 'bounced') bounce += 1
    else none += 1
    const c = (perChannel[a.channel] ||= { out: 0, human: 0, auto: 0, bounce: 0, none: 0 })
    c.out += 1
    if (rt === 'human') c.human += 1
    else if (rt === 'auto') c.auto += 1
    else if (rt === 'bounced') c.bounce += 1
    else c.none += 1
  })
  const total = out.length
  const pct = (n) => (total ? `${((n / total) * 100).toFixed(1)}%` : '—')
  const touchedCompanies = new Set(out.map((a) => a.company_id))
  const humanCompanies = new Set(out.filter((a) => a.replyType === 'human').map((a) => a.company_id))
  return {
    total, human, auto, bounce, none,
    humanReplyRate: pct(human), autoReplyRate: pct(auto),
    bounceRate: pct(bounce), noResponseRate: pct(none),
    perChannel: Object.entries(perChannel)
      .map(([name, v]) => [name, v, v.out ? ((v.human / v.out) * 100).toFixed(1) : '0'])
      .sort((a, b) => b[1].out - a[1].out),
    touchedCompanies: touchedCompanies.size,
    humanCompanies: humanCompanies.size,
  }
}

export function computeInbound(state, filter = {}) {
  const leads = state.inbound_leads.filter((l) => {
    if (filter.market && filter.market !== '全部' && l.country !== filter.market) return false
    if (filter.ownerIds && filter.ownerIds.length && !(l.lead_owner && filter.ownerIds.includes(l.lead_owner))) return false
    return true
  })
  const counts = LEAD_STATUSES.reduce((acc, s) => { acc[s] = leads.filter((l) => l.inbound_status === s).length; return acc }, {})
  const bySource = {}
  const byOwner = {}
  const byCountry = {}
  leads.forEach((l) => {
    bySource[l.source_platform] = (bySource[l.source_platform] || 0) + 1
    const o = l.lead_owner || '未分配'
    ;(byOwner[o] ||= []).push(l)
    const c = l.country || '未知'
    byCountry[c] = (byCountry[c] || 0) + 1
  })
  return { leads, total: leads.length, counts, bySource, byOwner, byCountry }
}

// Per-market summary across the whole state (ignores active filter).
export function marketSummary(state) {
  const map = {}
  const ensure = (m) => (map[m] ||= { prospects: 0, touches: 0, humans: 0, leads: 0 })
  state.prospects.forEach((p) => { const m = p.market || '未分类'; ensure(m).prospects += 1 })
  state.activities.filter((a) => a.flow_type === 'outbound' && a.kind === 'outreach').forEach((a) => {
    const p = state.prospects.find((pp) => pp.id === a.company_id)
    const m = p?.market || '未分类'
    ensure(m).touches += 1
    if (a.replyType === 'human') ensure(m).humans += 1
  })
  state.inbound_leads.forEach((l) => { ensure(l.country || '未分类').leads += 1 })
  return Object.entries(map).filter(([, v]) => v.prospects > 0 || v.leads > 0).sort((a, b) => b[1].prospects - a[1].prospects)
}

export function computeWorkers(state) {
  return state.workers.map((w) => {
    const ids = new Set(state.prospects.filter((p) => p.owner === w.name).map((p) => p.id))
    const out = state.activities.filter((a) => a.flow_type === 'outbound' && a.kind === 'outreach' && ids.has(a.company_id))
    const human = out.filter((a) => a.replyType === 'human').length
    const leads = state.inbound_leads.filter((l) => l.lead_owner === w.name)
    const pending = state.follow_up_tasks.filter((t) => t.status === 'open' && ids.has(t.company_id)).length
    return {
      ...w,
      prospects: ids.size,
      touches: out.length,
      human,
      humanRate: out.length ? `${((human / out.length) * 100).toFixed(1)}%` : '—',
      inbound: leads.length,
      pending,
    }
  })
}
