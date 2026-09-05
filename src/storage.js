// v7: 从浏览器本地存储切换为 Supabase 在线数据库。
// 数据结构（字段名）在 App 内部保持不变，只在这一层做 JS 字段名 <-> 数据库列名 的转换，
// 这样组件代码（AddCustomerModal / CustomerDetail / InboundLeads / DailyLog 等）完全不用改。
import { supabase } from './supabaseClient'

const USER_KEY = 'market-path-lab-current-user' // 仅作为断线时的显示兜底，不作为身份依据

// ---------- 空值处理：Postgres 的 date/timestamp 列不接受空字符串 ----------
const emptyToNull = (v) => (v === '' || v === undefined ? null : v)

// ================= 字段名映射：DB(snake_case) <-> 前端(原有命名) =================
function rowToProspect(r) {
  return {
    id: r.id, name: r.name, market: r.market, region: r.region, segment: r.segment,
    style_fit: r.style_fit, scale: r.scale, status: r.status, source: r.source, owner: r.owner,
    website: r.website, url: r.url, domain: r.domain, quoted: !!r.quoted, sampled: !!r.sampled,
    first_contact: r.first_contact || '', channel: r.channel, touch_count: r.touch_count || 0,
    batch: r.batch, last_sent: r.last_sent || '', remark: r.remark,
    customerType: r.customer_type, sourceMethod: r.source_method, fitNote: r.fit_note,
    discovered_at: r.discovered_at, channels: Array.isArray(r.channels) ? r.channels : [],
    updatedAt: r.updated_at, next_follow: r.next_follow, feedback: r.feedback,
    replyReason: r.reply_reason, stuckAt: r.stuck_at,
  }
}
function prospectToRow(p) {
  return {
    id: p.id, name: p.name, market: p.market, region: p.region, segment: p.segment,
    style_fit: p.style_fit, scale: p.scale, status: p.status, source: p.source, owner: p.owner,
    website: p.website, url: p.url, domain: p.domain, quoted: !!p.quoted, sampled: !!p.sampled,
    first_contact: emptyToNull(p.first_contact), channel: p.channel, touch_count: p.touch_count || 0,
    batch: p.batch, last_sent: emptyToNull(p.last_sent), remark: p.remark,
    customer_type: p.customerType, source_method: p.sourceMethod, fit_note: p.fitNote,
    discovered_at: emptyToNull(p.discovered_at), channels: p.channels || [],
    updated_at: p.updatedAt ?? null, next_follow: p.next_follow, feedback: p.feedback,
    reply_reason: p.replyReason, stuck_at: p.stuckAt,
  }
}

function rowToContact(r) { return { ...r } } // 字段名本来就一致
function contactToRow(c) {
  return { ...c, created_at: emptyToNull(c.created_at) }
}

function rowToActivity(r) {
  return {
    id: r.id, company_id: r.company_id, contact_id: r.contact_id, flow_type: r.flow_type,
    channel: r.channel, kind: r.kind, replyType: r.reply_type, replyReason: r.reply_reason,
    sentiment: r.sentiment, at: r.at, round_id: r.round_id, note: r.note,
  }
}
function activityToRow(a) {
  return {
    id: a.id, company_id: a.company_id, contact_id: a.contact_id, flow_type: a.flow_type,
    channel: a.channel, kind: a.kind, reply_type: a.replyType === 'none' ? null : a.replyType,
    reply_reason: a.replyReason, sentiment: a.sentiment, at: emptyToNull(a.at),
    round_id: a.round_id, note: a.note,
  }
}

function rowToFollowUp(r) { return { ...r } }
function followUpToRow(t) { return { ...t, created_at: emptyToNull(t.created_at), done_at: emptyToNull(t.done_at) } }

function rowToLead(r) { return { ...r, need_type: r.need_type || [], need_discovery: r.need_discovery || [] } }
function leadToRow(l) {
  return {
    ...l,
    received_at: emptyToNull(l.received_at),
    last_contact: emptyToNull(l.last_contact),
    follow_up: emptyToNull(l.follow_up),
    assigned_at: emptyToNull(l.assigned_at),
    need_type: l.need_type || [],
    need_discovery: Array.isArray(l.need_discovery) ? l.need_discovery : (l.need_discovery ? [l.need_discovery] : []),
  }
}

function rowToDaily(r) {
  return {
    id: r.id, date: r.date, schedule: r.schedule, interruption: r.interruption, result: r.result,
    feeling: r.feeling, adjustment: r.adjustment, worker: r.worker, created_by: r.created_by,
    created_at: r.created_at, updated_by: r.updated_by, updated_at: r.updated_at, importNote: r.import_note,
  }
}
function dailyToRow(d) {
  return {
    id: d.id, date: emptyToNull(d.date), schedule: d.schedule, interruption: d.interruption,
    result: d.result, feeling: d.feeling, adjustment: d.adjustment, worker: d.worker,
    created_by: d.created_by, created_at: emptyToNull(d.created_at), updated_by: d.updated_by,
    updated_at: emptyToNull(d.updated_at), import_note: d.importNote,
  }
}

// ================= 加载：从各表拉取，拼成 App 内部一直使用的 state 形状 =================
export async function loadState() {
  const [prospects, contacts, activities, followUps, leads, daily, options, events, profiles] = await Promise.all([
    supabase.from('prospects').select('*'),
    supabase.from('contacts').select('*'),
    supabase.from('activities').select('*'),
    supabase.from('follow_up_tasks').select('*'),
    supabase.from('inbound_leads').select('*'),
    supabase.from('daily_rhythm').select('*'),
    supabase.from('custom_options').select('*'),
    supabase.from('frontline_events').select('*').order('created_at', { ascending: false }),
    supabase.from('profiles').select('*'),
  ])

  const firstError = [prospects, contacts, activities, followUps, leads, daily, options, events, profiles]
    .find((r) => r.error)?.error
  if (firstError) throw firstError

  const customOptions = { sourceMethod: [], customerType: [], channels: [], replyReason: [], stuckAt: [], inboundNeedType: [] }
  ;(options.data || []).forEach((o) => {
    if (!customOptions[o.field]) customOptions[o.field] = []
    customOptions[o.field].push(o.value)
  })

  return {
    prospects: (prospects.data || []).map(rowToProspect),
    contacts: (contacts.data || []).map(rowToContact),
    activities: (activities.data || []).map(rowToActivity),
    follow_up_tasks: (followUps.data || []).map(rowToFollowUp),
    inbound_leads: (leads.data || []).map(rowToLead),
    daily_rhythm: (daily.data || []).map(rowToDaily),
    customOptions,
    frontline_events: (events.data || []).map((e) => ({
      id: e.id, worker: e.created_by, field: e.field, value: e.value, at: e.created_at,
    })),
    workers: (profiles.data || []).map((p) => ({ id: p.name, name: p.name, role: p.role })),
    rounds: [],
  }
}

// ================= 保存：整表按主键 upsert，不做全表删除，安全防丢数据 =================
// 说明：这个函数在 state 每次变化时整体调用一次（App.jsx 的 useEffect）。
// 由于是 upsert（存在则更新/不存在则插入），不会误删别的设备刚写入、本机还没刷新到的数据。
export async function saveState(state) {
  const tasks = []
  if (state.prospects?.length) tasks.push(supabase.from('prospects').upsert(state.prospects.map(prospectToRow)))
  if (state.contacts?.length) tasks.push(supabase.from('contacts').upsert(state.contacts.map(contactToRow)))
  if (state.activities?.length) tasks.push(supabase.from('activities').upsert(state.activities.map(activityToRow)))
  if (state.follow_up_tasks?.length) tasks.push(supabase.from('follow_up_tasks').upsert(state.follow_up_tasks.map(followUpToRow)))
  if (state.inbound_leads?.length) tasks.push(supabase.from('inbound_leads').upsert(state.inbound_leads.map(leadToRow)))
  if (state.daily_rhythm?.length) tasks.push(supabase.from('daily_rhythm').upsert(state.daily_rhythm.map(dailyToRow)))

  const optionRows = []
  Object.entries(state.customOptions || {}).forEach(([field, values]) => {
    (values || []).forEach((value) => optionRows.push({ field, value }))
  })
  if (optionRows.length) tasks.push(supabase.from('custom_options').upsert(optionRows, { onConflict: 'field,value', ignoreDuplicates: true }))

  if (state.frontline_events?.length) {
    const eventRows = state.frontline_events.map((e) => ({
      id: e.id, field: e.field, value: e.value, created_by: e.worker, created_at: e.at,
    }))
    tasks.push(supabase.from('frontline_events').upsert(eventRows))
  }

  const results = await Promise.all(tasks)
  const failed = results.find((r) => r.error)
  if (failed) {
    // eslint-disable-next-line no-console
    console.error('保存到数据库失败：', failed.error)
  }
}

// "当前登录人" 现在由 Supabase Auth 会话决定，这里只保留一个断网兜底显示用的缓存。
export function loadCurrentUser() {
  try { return localStorage.getItem(USER_KEY) || '' } catch { return '' }
}
export function saveCurrentUser(name) {
  try { localStorage.setItem(USER_KEY, name) } catch { /* 忽略 */ }
}
