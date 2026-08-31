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
  const hasCompanyFilter = Boolean(
    (filter.market && filter.market !== '全部') ||
    (filter.ownerIds && filter.ownerIds.length),
  )
  const out = state.activities.filter(
    (a) => a.flow_type === 'outbound' && a.kind === 'outreach' && (!hasCompanyFilter || ids.has(a.company_id)),
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

const splitTouchChannels = (value = '') => value
  .split(/[、,，/]+/)
  .map((item) => item.trim().toLowerCase())
  .filter(Boolean)

// Free, deterministic analysis for V1. Every conclusion is derived from the
// same records used by the dashboard and exposes its evidence/denominator.
// No model call, API key, or usage credit is involved.
export function computeRuleInsights(state, filter = {}) {
  const ob = computeOutbound(state, filter)
  const ib = computeInbound(state, filter)
  const ids = allowedCompanyIds(state, filter)
  const hasMarketFilter = filter.market && filter.market !== '全部'
  const includeOutbound = filter.flow !== 'inbound'
  const includeInbound = filter.flow !== 'outbound'
  const outboundRecords = state.activities.filter((activity) => (
    activity.flow_type === 'outbound' &&
    activity.kind === 'outreach' &&
    (!hasMarketFilter || ids.has(activity.company_id))
  ))
  const marketScope = hasMarketFilter ? filter.market : '全部市场'
  const flowScope = filter.flow === 'inbound' ? 'Inbound' : filter.flow === 'outbound' ? 'Outbound' : '全部路径'
  const scope = `${marketScope} · ${flowScope}`
  const noResponseRate = ob.total ? (ob.none / ob.total) * 100 : 0
  const multiChannel = outboundRecords.filter((activity) => new Set(splitTouchChannels(activity.channel)).size >= 2).length
  const channelSignals = ob.perChannel
    .map(([name, values]) => ({ name, total: values.out, human: values.human, rate: values.out ? values.human / values.out : 0 }))
    .filter((item) => item.human > 0)
    .sort((a, b) => b.rate - a.rate || b.total - a.total)
  const bestSignal = channelSignals[0]
  const missingInboundAction = ib.leads.filter((lead) => !String(lead.next_action || '').trim()).length
  const activeInbound = ib.leads.filter((lead) => ['New', 'Learning', 'Qualified', 'Stalled'].includes(lead.inbound_status)).length

  const insights = []
  if (includeOutbound && !ob.total) {
    insights.push({
      id: 'response', tone: 'neutral', title: '当前范围没有 Outbound 触达记录',
      evidence: `${marketScope} · 0 条触达`,
      meaning: '没有足够记录判断客户回应瓶颈。',
      action: '先记录实际触达渠道与结果，再进行比较。',
    })
  } else if (includeOutbound && noResponseRate >= 70) {
    insights.push({
      id: 'response', tone: 'warning', title: '当前主要瓶颈是获得真人回应',
      evidence: `${ob.total} 条触达中，${ob.none} 条无回应，${ob.human} 条真人回复（无回应率 ${noResponseRate.toFixed(1)}%）`,
      meaning: '继续单纯增加客户数量，暂时不能解释为什么客户不回复。',
      action: '下一轮固定客户类型，一次只改变一个变量：触达组合、联系人层级或首条信息表达。',
    })
  } else if (includeOutbound) {
    insights.push({
      id: 'response', tone: 'positive', title: '已经出现可继续验证的回应信号',
      evidence: `${ob.total} 条触达中获得 ${ob.human} 条真人回复`,
      meaning: '当前路径存在有效信号，但仍需按客户类型和触达方式拆分。',
      action: '保持相同条件重复测试，确认结果能否稳定出现。',
    })
  }

  if (includeOutbound) insights.push(bestSignal ? {
    id: 'channel', tone: 'signal', title: `“${bestSignal.name}”出现早期回复信号`,
    evidence: `${bestSignal.total} 条该触达组合中有 ${bestSignal.human} 条真人回复（${(bestSignal.rate * 100).toFixed(1)}%）`,
    meaning: bestSignal.human < 3 ? '这是早期信号，样本不足以认定为最佳渠道。' : '该组合值得作为下一轮对照组继续测试。',
    action: '复制相同客户类型与触达组合，积累至少 3 次真人回复后再判断可复制性。',
  } : {
    id: 'channel', tone: 'neutral', title: '尚未找到出现真人回复的触达组合',
    evidence: `${ob.perChannel.length} 种已记录触达组合，真人回复 0 条`,
    meaning: '当前数据不能支持“哪个渠道更有效”的结论。',
    action: '继续记录真实触达组合，并区分真人、自动回复、退信和无回应。',
  })

  if (includeOutbound) insights.push({
    id: 'coverage', tone: multiChannel < Math.ceil(ob.total / 2) ? 'warning' : 'neutral', title: '多渠道触达覆盖情况',
    evidence: `${ob.total} 条触达记录中，${multiChannel} 条明确包含两个及以上渠道`,
    meaning: '这里统计的是记录中明确写出的渠道组合，不把未记录的动作视为已经完成。',
    action: '业务员一次保存该客户本轮使用的全部渠道，避免逐个平台反复回填。',
  })

  if (includeInbound && ib.total) {
    insights.push({
      id: 'inbound', tone: missingInboundAction ? 'warning' : 'positive', title: 'Inbound 是否形成可执行下一步',
      evidence: `${ib.total} 条询盘中，${activeInbound} 条仍在处理中，${missingInboundAction} 条未填写下一步动作`,
      meaning: 'Inbound 的关键不是数量，而是需求是否被接住并形成下一步。',
      action: missingInboundAction ? '优先为未填写的询盘补充下一步动作与预计跟进日期。' : '继续按来源平台比较推进速度与转化状态。',
    })
  } else if (includeInbound) {
    insights.push({
      id: 'inbound', tone: 'neutral', title: '当前范围没有 Inbound 询盘',
      evidence: `${marketScope} · 0 条询盘`,
      meaning: '没有询盘记录时，不能分析来源平台或后续推进情况。',
      action: '保持当前视图用于观察新询盘进入后来自哪个市场与平台。',
    })
  }

  const confidence = filter.flow === 'inbound'
    ? (ib.total >= 5 ? '可以观察处理问题，尚不足形成转化规律' : '询盘样本较少，结论仅用于工作跟进')
    : (ob.human >= 3 ? '已有初步重复信号' : '样本不足，结论仅用于设计下一轮测试')
  return {
    scope,
    generatedBy: '本地规则计算 · 0 API 费用',
    confidence,
    insights,
  }
}
