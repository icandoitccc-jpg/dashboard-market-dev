// 共享选项字典：预置选项 + 业务员自定义新增（写入 state.customOptions，
// 并产生 frontline_events 通知主管 = 前线最新消息）。
// 铁律：预置选项只放真实存在的枚举（来自五大表真实数据或已确认的方法），
// 不为下拉完整性发明业务枚举。

export const FIELD_LABELS = {
  sourceMethod: '发现方法',
  customerType: '终端业态',
  channels: '渠道',
  replyReason: '真人回复内容',
  stuckAt: '停滞点',
  inboundNeedType: '询盘需求类型',
}

export const PRESET_OPTIONS = {
  // 发现客户的方式（Outbound 数据主轴第一环）
  sourceMethod: [
    'Google Maps',
    'Google 搜索',
    'Instagram 搜索',
    'Facebook 群组',
    '竞品 Stockist 名单',
    'Amazon / 电商榜单',
    '客户信息表',
    '行业展会名单',
    '行业协会 / 名录',
    '转介绍',
    '客户主动询盘',
  ],
  // 终端业态（枚举来自 05 表真实取值）
  customerType: [
    '大型连锁卖场',
    '独立零售店',
    '轻量化专卖店',
    '军事化战术风格',
    '自己的品牌',
    '改装越野中心',
  ],
  // 客户实际拥有的渠道（按客户勾选，绝不硬套主流平台）
  channels: [
    'Facebook',
    'Instagram',
    '邮件',
    '网站表单',
    'TikTok',
    'LinkedIn',
    'WhatsApp',
    '电话',
    'Amazon',
    '实体店到访',
  ],
  // 真人回复的分支细分（拒绝也是有效信号）
  replyReason: [
    '感兴趣',
    '拒绝',
    '价格异议',
    '质量担心',
    '等折扣',
  ],
  // 停滞点
  stuckAt: [
    '触达后无回应',
    '自动回复未转真人',
    '等待报价',
    '等待寄样',
    '跟进中失联',
    '不匹配归档',
  ],
  // Inbound 询盘需求类型（枚举来自 Inbound 表真实取值）
  inboundNeedType: [
    '批发',
    '价格咨询',
    '产品咨询',
    '产品册咨询',
    '合作咨询',
    '订购样品',
  ],
}

// 合并预置 + 自定义：表单下拉用这份
export function getOptions(state, field) {
  const custom = state?.customOptions?.[field] || []
  return [...new Set([...(PRESET_OPTIONS[field] || []), ...custom])]
}

// 判断是否是「新值」（预置与自定义都没有）
export function isNewOption(state, field, value) {
  if (!value || !value.trim()) return false
  return !getOptions(state, field).includes(value.trim())
}

// 注册新选项：写入共享字典 + 产生前线事件（主管总览可见）。
// 返回新的 state（供 setState 用）。
export function registerOption(state, field, value, worker) {
  const v = String(value).trim()
  if (!v || getOptions(state, field).includes(v)) return state
  const custom = state.customOptions || {}
  const events = state.frontline_events || []
  return {
    ...state,
    customOptions: { ...custom, [field]: [...(custom[field] || []), v] },
    frontline_events: [
      {
        id: `fe_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        worker: worker || '未署名',
        field,
        fieldLabel: FIELD_LABELS[field] || field,
        value: v,
        at: new Date().toISOString(),
      },
      ...events,
    ],
  }
}
