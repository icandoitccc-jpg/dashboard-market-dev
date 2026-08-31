// v6: 剔除05表开头5条演示行(业务1/2/3/4，美国真人回复全是演示) → 40→37（美15+澳22），美国真人回复=0
// v5: 只保留「确认触达过(发过信息)」的客户（纯档案客户不入库）→ 62→40（美18+澳22）
const KEY = 'market-path-lab-state-v6'
const USER_KEY = 'market-path-lab-current-user'

import { SEED_STATE } from './seedData'

// Migration / backfill applied to every loaded state so the app never crashes
// on older shapes and so new Shared Layer arrays + flow_type tagging exist.
// NOTE: flow_type is stamped on Acquisitions (activities/rounds) only — Company
// stays flow-neutral per the agreed architecture.
function normalize(state) {
  if (!state || typeof state !== 'object') state = {}

  if (!Array.isArray(state.prospects)) state.prospects = []
  if (!Array.isArray(state.rounds)) state.rounds = []
  if (!Array.isArray(state.contacts)) state.contacts = []
  if (!Array.isArray(state.activities)) state.activities = []
  if (!Array.isArray(state.follow_up_tasks)) state.follow_up_tasks = []
  if (!Array.isArray(state.inbound_leads)) state.inbound_leads = []
  if (!Array.isArray(state.daily_rhythm)) state.daily_rhythm = []
  if (!Array.isArray(state.workers)) state.workers = []
  // v4 新增：共享下拉字典 + 前线事件流（老 localStorage 数据也要有，否则表单崩溃）
  if (!state.customOptions || typeof state.customOptions !== 'object') state.customOptions = {}
  ;['sourceMethod', 'customerType', 'channels', 'replyReason', 'stuckAt', 'inboundNeedType'].forEach((f) => {
    if (!Array.isArray(state.customOptions[f])) state.customOptions[f] = []
  })
  if (!Array.isArray(state.frontline_events)) state.frontline_events = []

  // Ensure every prospect has a channels array (touch form needs it).
  state.prospects.forEach((prospect) => {
    if (!Array.isArray(prospect.channels)) prospect.channels = []
    if (!prospect.id) prospect.id = `c_${Math.random().toString(36).slice(2, 8)}`
  })
  state.rounds.forEach((round) => {
    if (!round.flow_type) round.flow_type = 'outbound'
  })

  // Historical imports used 2026-01-01 as a placeholder when the source cell
  // had no usable date. Never show that invented date. For outreach events we
  // can safely recover the first-contact date from the same customer record;
  // otherwise the date remains blank until a user records it.
  const placeholderDates = new Set(['2026-01-01', '2026-01-01T00:00:00'])
  const knownDateCorrections = new Map([['c_049', '2026-08-27'], ['c_051', '2026-08-27']])
  const isInvalidImportedDate = (value) => placeholderDates.has(value) || (
    typeof value === 'string' && /^2026-/.test(value) && Number.isNaN(new Date(value).getTime())
  )
  const prospectById = new Map(state.prospects.map((prospect) => [prospect.id, prospect]))
  state.prospects.forEach((prospect) => {
    const corrected = knownDateCorrections.get(prospect.id) || ''
    if (isInvalidImportedDate(prospect.first_contact) || (!prospect.first_contact && corrected)) prospect.first_contact = corrected
    if (isInvalidImportedDate(prospect.last_sent)) prospect.last_sent = corrected
    prospect.channels.forEach((channel) => {
      if (placeholderDates.has(channel.discoveredAt)) channel.discoveredAt = ''
    })
  })
  state.contacts.forEach((contact) => {
    if (placeholderDates.has(contact.created_at)) contact.created_at = ''
  })
  state.activities.forEach((activity) => {
    const firstContact = prospectById.get(activity.company_id)?.first_contact
    const recoverableSeedDate = !activity.at && activity.id?.endsWith('_seed') && firstContact
    if (!isInvalidImportedDate(activity.at) && !recoverableSeedDate) return
    activity.at = firstContact ? `${firstContact}T00:00:00` : ''
  })
  state.follow_up_tasks.forEach((task) => {
    if (placeholderDates.has(task.created_at)) task.created_at = ''
  })
  state.inbound_leads.forEach((lead) => {
    if (placeholderDates.has(lead.received_at)) lead.received_at = ''
    if (placeholderDates.has(lead.assigned_at)) lead.assigned_at = ''
  })

  return state
}

export function loadState() {
  try {
    const saved = localStorage.getItem(KEY)
    if (saved) return normalize(JSON.parse(saved))
  } catch {
    // Fall back to the bundled real-data seed.
  }
  // Deep clone so the immutable seed module is never mutated in place.
  return normalize(JSON.parse(JSON.stringify(SEED_STATE)))
}

export function saveState(state) {
  localStorage.setItem(KEY, JSON.stringify(state))
}

export function resetState() {
  localStorage.removeItem(KEY)
}

// "当前操作员" = 谁在录入这条数据。归属原则：谁录入，客户/询盘就归谁
// （跨 Outbound / Inbound / 未来老客户三条路统一）。与数据本身分开持久化。
export function loadCurrentUser() {
  try {
    const saved = localStorage.getItem(USER_KEY)
    if (saved) return saved
  } catch {
    // 忽略，回退默认
  }
  return '陈晨'
}

export function saveCurrentUser(name) {
  localStorage.setItem(USER_KEY, name)
}
