# Architecture Impact Analysis: Outbound + Inbound 双线路

> 基于当前 repo（`referenced-chatgpt-conversation-this-is-an`，React 18 + Vite 6，localStorage `market-path-lab-state-v2`）与 `OUTBOUND_INBOUND_ARCHITECTURE_UPDATE.md` 完成。
> 本文件是设计真相来源；代码改动需与之对齐。

---

## 0. 一句话结论

当前数据结构**已经写死为 Outbound**（没有 `flow_type`、没有联系人实体、回复是覆盖式状态、`sourceMethod` 把 Inbound 事件硬塞进 Outbound 下拉框）。
但你最初要的 3 项修改（日期、联系人获取方法、回复历史）恰恰就是"抽 Shared Layer"的天然入口——把它们直接挂在 **Company / Contact / Activity** 这一层、并给所有现有 Acquisition（`prospect`/`round`）打上 `flow_type: 'outbound'`，则未来接入 Inbound **零迁移**。

> ⚠️ 对本 Agent 上一轮 Gap Analysis 第 D 点的修正：我原建议"底层简化为 2 态 + 退信"。这误把**分析口径当成了存储规则**。按陈晨澄清，底层必须保留 **Auto Reply / Human Reply / Delivery Failed（+ Outreach / Follow-up 动作事件）**；"有效回复 = 真人回复"是**计算出来的视图**，不是存进去的字段。`No Response` 也不作为存储事件，而是派生状态。详见第 6 节。

> ⚠️ **三点实施前调整（陈晨 2026-08-27 确认，已并入本设计）**：
> 1. **Company 保持 flow-neutral**：`flow_type` 属于 Acquisition/Lead 与 Activity，不属于 Company。现有数据仅为迁移临时打 `outbound` 标记。
> 2. **Inbound 不无限推迟**：Shared Layer 验证后直接进入 Minimal Inbound MVP（Lead Inbox / Assignment / Original Inquiry / Need Discovery / Status / Next Action / Follow-up / Lost-Stalled），暂不做完整 Inbound Analytics 或大型 CRM。
> 3. **No Response 不作为存储事件**：底层只存实际发生的事件（outreach / auto_reply / human_reply / delivery_failed / follow_up 等）；No Response 是派生状态（某次 outreach 后观察窗口内无对应 reply/delivery 事件）。

---

## 1. Current Architecture Assessment（现状真实结构）

当前 `state = { prospects: [...], rounds: [...] }`。

**Prospect（= 公司，被当成客户）**
```
{
  id, name, url, domain, market, customerType,
  sourceMethod,        // 发现方法（Outbound 专属，却混进了"客户主动询盘"这一 Inbound 事件）
  fitNote,
  updatedAt: '刚刚',    // 假的日期字符串，不是真实时间戳
  channels: [
    { key, name, kind, checked, found, touchCount, status }
    // status 是【覆盖式】单值：'未触达'|'等待回复'|'未回复'|'未读'|'已读未回'|'自动回复'|'真人回复'|'有效回复'|'正向回复'|'退信'
  ]
}
```

**Round（= 一次多渠道触达）**
```
{ id, prospectId, createdAt: ISO, stage: '首次联系'|'第一次跟进'|..., messageNote, note, selected: [channelKeys] }
```

**判定证据（为什么是 Outbound 写死，仅限 Acquisition 层）**
1. 全局无 `flow_type` / `acquisition_type` 字段（在 Acquisition/Lead 与 Activity 上缺失）。
2. `sourceMethod` 下拉里既有 Google Search（Outbound 发现），也有"客户主动询盘"（本质是 Inbound 事件）——架构上错位。
3. 整个模型假设"你找到客户 → 你主动触达 → 等回复"。Inbound 的"客户主动来 → 分配 → 接住 → 挖需求"完全无载体。
4. 回复是 `channel.status` 单值覆盖，没有历史事件——既答不了"第几轮、哪天、先自动后真人"，也让未来 Inbound 无法复用。

---

## 2. 对你 7 个判断请求的直接回答

**A. 当前 Customer/Prospect 是否已写死为 Outbound？**
👉 **是（但仅限 Acquisition 层）。** 当前 `prospect`/`round` 无 `flow_type`、无联系人维度、`sourceMethod` 混淆两条流、回复覆盖式。
⚠️ **关键修正**：`flow_type` 属于 **Acquisition/Lead 与 Activity**，**不属于 Company**。目标模型中 Company 保持 **flow-neutral**——同一公司未来可同时拥有 Outbound 与 Inbound Acquisition。现有数据仅为迁移临时打 `flow_type:'outbound'` 标记，目标模型不在 Company 上定义 flow_type。

**B. Company / Contact / Activity / Follow-up 哪些先抽 Shared Layer？**
👉 **四个都抽，但形态不同：**
- **Company** — 抽。当前 `prospect` 本质就是 Company。**不**在 Company 上加 flow_type。
- **Contact** — 抽（**新增**）。这是"联系人获取方法"和"决策人层级"的家；Outbound 和 Inbound 共用。
- **Activity（时间轴/事件）** — 抽（**新增**）。回复历史、日期、各触达动作都落这里；两条流共用。
- **Follow-up** — **部分抽**。Follow-up *任务*（谁、何时该跟进）是共享的，抽成 `follow_up_tasks`；但两条流的*跟进节奏逻辑*各自保留。当前代码跟进几乎没做，这一步很轻。

**C. Prospecting Experiment / Contact Discovery / Outreach Attempt 哪些保持 Outbound-specific？**
👉 **三个都保持 Outbound-only（动作层），但存储进共享 Activity：**
- **Prospecting Experiment** — Outbound-only（测试"发现方法 × 联系方法 × 渠道"的设计），先占命名空间，暂不强建。
- **Contact Discovery** — Outbound-only（"怎么找到 Owner/Buyer"是主动开发问题；Inbound 客户已经带着联系人来）。
- **Outreach Attempt** — Outbound-only *动作*，但作为 `activity(flowType='outbound', kind='outreach')` 落共享层。动作专属、存储共享。

**D. Inbound Lead 如何接入而不污染 Outbound 指标？**
👉 三条隔离原则：
1. Inbound 用独立实体 `inbound_leads`（或 `acquisitions(flow_type='inbound')`），挂在**同一个** Company/Contact 上（同公司可同时经历两条流，见架构文档 §11）。
2. Inbound 的所有事件（首次响应、挖需求、回复）写进**同一个** `activities` 表，但带 `flowType='inbound'`。
3. Dashboard 在**查询层按 `flowType` 分桶**：Outbound Analytics 只筛 `outbound`，Inbound Analytics 只筛 `inbound`，Management Overview 两栏并列。**绝不合成一个 Reply Rate。**
   - Inbound 另有自己的漏斗状态（`inbound_status`：NEW/ASSIGNED/CONTACTED/DISCOVERY/QUALIFIED/...），不写进 `channel.status`，也不进 Outbound 回复事件。

**E. 日期 / 联系人获取方法 / 回复历史应挂在哪层（避免 Inbound 再次迁移）？**
👉 **全部挂 Shared Layer，不挂 Outbound 专属结构：**
- **日期**：`discovered_at`（公司发现日）挂在 Company/Acquisition；每次事件时间戳挂在 Activity；`first_response_at` 挂在 Inbound Lead。→ Inbound 直接复用 Activity 的时间轴，零迁移。
- **联系人获取方法**：`contact.acquisition_method` + `contact.level`（Owner/Buyer/Manager）。→ Inbound 联系人同样有 acquisition_method（如"Instagram 主动私信自愿留下"），共享。
- **回复历史**：`activities[]` 数组（共享）。→ 天然的跨流事件流，Inbound 直接 append。

**F. 哪些现有 Dashboard 指标应暂隐藏 / 标记 experimental（因数据结构不足）？**
👉 见第 9 节完整清单。

**G. 最小改造顺序（最大化保留现有代码、避免重复开发）？**
👉 见第 11 节。核心思路：先做你原本要的 3 项修改，但用"Shared Layer + `flow_type` 打标（仅 Acquisition/Activity）"的方式做，等于顺手完成架构地基，现有组件几乎不动。

---

## 3. Shared Layer Proposal（目标结构）

```
companies[]            // = 原 prospect，改名概念；保留字段减少改动；FLOW-NEUTRAL（无 flow_type）
  id, name, domain, market, customerType, fitNote
  discovered_at: ISO   // 新增：真实发现日期（替换 '刚刚'）

contacts[]             // 新增共享实体
  id, company_id, name, level: Owner|Buyer|Manager|Unknown
  handles: { email, linkedin, instagram, whatsapp, ... }
  acquisition_method   // 联系人获取方法（如 Hunter / LinkedIn / 社媒私信 / 官网表单）
  created_at: ISO

activities[]           // 新增共享事件流（替换覆盖式 channel.status）
  id, company_id, contact_id?, flow_type: 'outbound'|'inbound'   // ← flow_type 在这里
  channel, kind: 'outreach'|'reply'|'follow_up'|'note'|'discovery'|'assignment'
  replyType?: 'auto_reply'|'human_reply'|'delivery_failed'        // ← 不含 no_response（派生）
  sentiment?: 'interested'|'neutral'|'not_interested'            // 仅 human_reply
  at: ISO, round_id?, note?

follow_up_tasks[]      // 新增共享（轻量）
  id, company_id, contact_id?, flow_type, due_date, done, note?
```

**Outbound 专属（保持；flow_type 在此层）**
```
prospecting_experiments[]   // Outbound-only，先占命名空间
outbound_acquisitions[]     // 链接 company ↔ experiment：discovery_method, discovered_at, source 细节；flow_type='outbound'
rounds[]                    // 保留：一轮多渠道触达容器；保存时改为 append activities，不再覆盖 channel.status；flow_type='outbound'
```

**Inbound 专属（Shared Layer 验证后直接进入，本阶段不无限推迟）**
```
inbound_leads[]             // flow_type='inbound'，挂在 company/contact 上
  received_at, source_platform, source_account, country, original_message,
  lead_owner, assigned_by, assigned_at, inbound_status, lost_reason?, company_id?
```

> 关键：现有 `rounds` 不删、不重写。`saveRound` 改为"创建 round **同时** append 对应 activities"。`channel.status` 改为**只读派生**（取该渠道最新 reply activity，或观察窗口内无事件则派生为"未回复"），UI 不动结构、只改语义，避免破坏现有界面。

---

## 4. Outbound-specific Components（保持专属）

| 组件 | 归属 | 说明 |
|------|------|------|
| Prospecting Experiment | Outbound-only | 测试设计层，未来建；现在只预留 |
| Contact Discovery | Outbound-only | "如何找到决策人"是主动开发问题；Inbound 已有联系人 |
| Outreach Attempt | Outbound-only 动作 | 存为 `activity(flowType='outbound')`，存储共享 |
| `outbound_acquisitions` | Outbound-only | 承载 `discovery_method` / `discovered_at`，从 Company 上挪下来的 Outbound 专属字段 |

---

## 5. New Inbound Entities & 隔离设计

- **入口**：`inbound_leads` 独立实体，但 `company_id` / `contact_id` 指向**共享** Company/Contact。
- **事件**：首次响应、挖需求、回复全部写 `activities`（`flowType='inbound'`）。
- **漏斗状态**：Inbound 自己的 `inbound_status` 枚举（NEW→ASSIGNED→CONTACTED→DISCOVERY→QUALIFIED→ACTIVE→...→LOST），**不**进 `channel.status`、不进 Outbound 回复事件。
- **指标隔离**：所有 Dashboard 查询带 `flow_type` 过滤。Outbound 的 Cold Human Reply Rate 与 Inbound 的 Conversation Rate **分开展示**，永不合并（架构文档 §4 已论证合并无管理意义）。
- **共享复用**：Company/Contact/Activity/Follow-up 全部复用，Inbound 不重复造轮子。

---

## 6. 数据模型修正：实际事件 vs 派生状态（重要）

陈晨澄清两点：
1. "有效回复 = 真人回复"是**分析口径**，不代表底层只存两种事件。
2. **No Response 不作为存储事件**——底层只存实际发生的事件；No Response 是派生状态。

**底层只存储实际发生的事件（`replyType`，共享、两条流适用）**
- `auto_reply` — 自动/机器人回复。**不计入有效回复**，但**必须保留**（澳洲社媒已观察到 Auto Reply → 引导 Email → Email 仍无真人回复，这是要分析的 Market Signal）
- `human_reply` — 真人回复 = 有效回复；可再分 `sentiment: interested | neutral | not_interested`
- `delivery_failed` — 退信/投递失败，单独计数
- （`outreach` / `follow_up` / `discovery` / `assignment` 等作为 `kind` 记录触达与跟进动作，本身不是 reply）

**No Response = 派生状态（不存储）**
- 判定规则：某次 `kind='outreach'` 事件后，在**观察窗口**内，若该 `channel`/该 `round` 没有对应的 `human_reply` / `auto_reply` / `delivery_failed` 事件，则派生为"未回复（观察中）"。
- 好处：避免人为决定"何时记一次 No Response"，也避免重复存储。

**分析视图（计算出来，不存储）**
- 有效回复率 = `human_reply` 事件数 / 触达次数
- 自动回复率 = `auto_reply` / 触达（作为 Market Signal 展示）
- 退信率 = `delivery_failed` / 触达
- 正向回复率 = `human_reply` 且 `sentiment='interested'` / 触达（未来再开）

> 因此：原 Gap Analysis 第 D 点"简化为 2 态"**作废**。UI 上回复录入改为"对每渠道记一条事件（auto/human/delivery 三选一 + 真人时选情绪）"，`channel.status` 退化为只读派生显示，No Response 由系统派生。

---

## 7. Database / State Impact

- 当前 localStorage JSON 形状扩展即可，**无需迁移到 Supabase**（Supabase 是后续阶段）。
- 一次性回填：遍历现有 `prospects` / `rounds`，加 `flow_type: 'outbound'`（Acquisition 层标记，非 Company）；`updatedAt:'刚刚'` 无法还原真实日期，建议**保留展示、新增 `discovered_at` 由时菊后续录入补齐**（不伪造历史）。
- 新增顶层键：`contacts`、`activities`、`follow_up_tasks`、`inbound_leads`（后两者按阶段建）。
- 向后兼容：旧 `channel.status` 字段保留为派生只读，避免现有组件报错。

---

## 8. Routing / Navigation Impact

- 当前 Sidebar 多数入口是死的（见 Gap Analysis B）。本阶段**不**加 Inbound 导航。
- 最小预留：在 Sidebar 配置里留 `OUTBOUND` / `INBOUND` / `MANAGEMENT` 三个分组占位（架构文档 §13），但 Inbound 分组本阶段不渲染内容。
- 工作台（My Work Today）统一视图是未来事；本阶段先不动路由，避免范围蔓延。

---

## 9. Dashboard Impact（暂隐藏 / 标记 experimental）

**因数据结构不足，本阶段应隐藏或标 experimental 的指标：**

| 指标 | 状态 | 原因 |
|------|------|------|
| 完整路径排名（Full-path ranking） | **experimental** | 路径仍是累计渠道拼接，无真实渠道顺序；需 activities 记录每触达的渠道次序后才可信 |
| 决策人触达率（Decision Maker Rate） | **experimental** | 缺 `contact.level`；需先有 Contact 实体 |
| 联系人获取率（Contact Acquisition Rate） | **experimental** | 缺 `contact.acquisition_method`；需先有 Contact |
| 周对比 / 观察窗口 | **隐藏** | `discovered_at` 与事件时间戳未真实化前无法按周分组 |
| Auto Reply → Email → 无真人回复 信号 | **experimental** | 需事件历史；activities 落地后才有数据 |
| 任何"效率/时长/工时"指标 | **永不显示** | 产品铁律：不计时、不监控工时 |
| 员工绩效排名 | **永不显示** | 产品铁律 |
| 任何 Inbound 指标 | **不显示** | Inbound 模块未建；显示即污染 |

**本阶段可正常展示（3 项修改落地后）：**
- 各市场客户总数
- 各渠道累计触达次数
- 真人回复率（派生自 `human_reply` / 触达）
- 自动回复占比（Market Signal）
- 退信率
- 各渠道「真人回复 vs 自动回复」对比

---

## 10. Migration Impact

- **现有 Outbound 代码几乎全保留**：`SalesWorkspace` / `ManagerDashboard` / `AddCustomerModal` 组件结构不动。
- 改动集中在：
  1. `storage.js` / state 初始化增加 `contacts` / `activities` 键；
  2. `saveRound` 增加"append activities"；
  3. 回复录入 UI 从 10 值 select 改为事件记录；
  4. Dashboard 指标改为从 `activities` 计算。
- **Inbound 接入时零迁移**：日期/联系人方法/回复历史已在 Shared Layer，Inbound 直接 append，不碰 Outbound 结构。

---

## 11. Minimal Implementation Plan（顺序 = 最大程度保留代码）

> 原则（架构文档 §24）：**Preserve → Shared Layer → Contact → Activity → Dashboard Recalculation → Real Data Test → Minimal Inbound MVP**
> 每完成一个结构性阶段，先验证现有 Outbound 功能未被破坏，再进入下一阶段；不做一次性大范围重写。

1. **打标（1 行改动级）**：现有 `prospects`/`rounds` 回填 `flow_type: 'outbound'`（Acquisition 层；Company 不加）。新增 `contacts`/`activities`/`follow_up_tasks` 空数组。
2. **加真实日期（Shared）**：Company 加 `discovered_at`（ISO）；`rounds` 已有 `createdAt`，Dashboard 时间轴复用。停止写 `updatedAt:'刚刚'`，改由最新 activity 派生。
3. **加 Contact 实体（Shared，新增）**：`contacts[]` + UI（在客户详情里可添加联系人、选层级、填"联系人获取方法"）。→ 直接修复 Gap Analysis 第 1 点。
4. **加 Activity 事件流（Shared，核心）**：`saveRound` 改为同时 append `activities`；回复录入改为记实际事件（auto/human/delivery + 真人情绪）。**`channel.status` 改为只读派生**，现有 UI 不破坏。No Response 由观察窗口派生。→ 修复第 2、3 点（覆盖式 + 历史）。
5. **Dashboard 重算**：从 `activities` 计算指标；按第 9 节隐藏/标记 experimental。
6. **真实数据试用**：让时菊录几条，陈晨亲自看哪里还"不对劲"。
7. **直接进入 Minimal Inbound MVP（不无限推迟）**：Shared Layer 验证后立刻建 `inbound_leads` + Lead Inbox / Assignment / Original Inquiry / Need Discovery / Status / Next Action / Follow-up / Lost-Stalled；事件写 `activities(flowType='inbound')`；暂不做完整 Inbound Analytics 或大型 CRM；Dashboard 按 `flow_type` 分桶，Outbound 指标不被污染。

---

## 12. Risks if We Do Not Adjust Now

- 若继续在 `channel.status` 覆盖式存储上堆功能，等 Inbound 到来时必须**拆掉重来**整个回复体系 → 高成本重构。
- 若不把"联系人获取方法 / 日期 / 回复历史"放进 Shared Layer，未来 Inbound 会各自再建一份 → 重复开发 + 同公司两行数据无法合并（架构文档 §11 的两个真实场景会失真）。
- 若现在就把 Auto Reply 当"无回复"丢弃，会丢失澳洲社媒最关键的 Market Signal（Auto Reply→Email→仍无真人），导致误判渠道价值。
- 若现在合成 Outbound+Inbound 的单一 Reply Rate，管理结论失真（架构文档 §4 已论证）。

---

## Appendix：目标 state 形状（示意）

```jsonc
{
  "companies": [   // FLOW-NEUTRAL：无 flow_type
    { "id": "1", "name": "Adventure 4x4", "domain": "adv4x4.com",
      "market": "澳大利亚", "customerType": "4WD 改装店", "fitNote": "",
      "discovered_at": "2026-09-01T09:30:00.000Z" }
  ],
  "contacts": [
    { "id": "c1", "company_id": "1", "name": "John", "level": "Owner",
      "handles": { "email": "john@adv4x4.com", "instagram": "@john" },
      "acquisition_method": "Hunter (邮箱挖掘)", "created_at": "..." }
  ],
  "activities": [   // flow_type 在此
    { "id": "a1", "company_id": "1", "contact_id": "c1", "flow_type": "outbound",
      "channel": "owner_email", "kind": "outreach", "at": "2026-09-01T10:00:00Z", "round_id": "r1" },
    { "id": "a2", "company_id": "1", "contact_id": "c1", "flow_type": "outbound",
      "channel": "owner_email", "kind": "reply", "replyType": "auto_reply", "at": "2026-09-01T10:05:00Z" },
    { "id": "a3", "company_id": "1", "contact_id": "c1", "flow_type": "outbound",
      "channel": "owner_email", "kind": "reply", "replyType": "human_reply", "sentiment": "neutral", "at": "2026-09-03T08:20:00Z" }
    // 若 a1 之后观察窗口内无任何 reply/delivery 事件 → 派生 "no_response"，不存储
  ],
  "rounds": [ { "id": "r1", "company_id": "1", "flow_type": "outbound", "createdAt": "...", "stage": "首次联系", "selected": ["owner_email"] } ],
  "follow_up_tasks": [],
  "inbound_leads": []   // Shared Layer 验证后建
}
```

---

## 13. 实施记录（2026-08-27，已落地，未做一次性大重写）

按 §11 顺序小步实施，每阶段 `npm run build` + dev server 启动校验通过，现有 Outbound 功能零破坏。

- **Stage 1 — Shared 数据形状**（`src/storage.js`）：`normalize()` 回填 `contacts / activities / follow_up_tasks / inbound_leads` 空数组；`prospects`/`rounds` 临时打 `flow_type:'outbound'`（Company 不加）；**一次性幂等回填**——把历史 `rounds` 的每轮渠道触达转成 `outreach` 活动，旧数据也能被新指标统计。
- **Stage 2 — Contact 共享实体 + UI**（`SalesWorkspace.jsx` + `styles.css`）：客户详情「联系人」面板，可录姓名 / 决策人层级（Owner·Buyer·Manager·Unknown）/ **联系人获取方法** / 邮箱，存入 `state.contacts` 关联 `company_id`。直接修复 Gap 第 1 点。
- **Stage 3 — Activity 事件流 + 派生 No Response**（`SalesWorkspace.jsx` + `storage.js`）：`saveRound` 改为同时 append `outreach` 活动；回复录入从 10 值下拉改为「记录回复事件」（auto / human + 情绪 / delivery_failed）；`channel.status` 退化为只读派生展示；**No Response 不存储**，由「该 outreach 之后同渠道无 reply/delivery 事件」派生。底层 4 类事件均保留，符合口径要求。
- **Stage 4 — Dashboard 从 activities 重算**（`ManagerDashboard.jsx` + `styles.css`）：所有 Outbound 指标改从 `activities` 计算；新增「回复质量·事件级」面板（真人/自动/退信/无回复 + 各渠道对比，自动回复标为 Market Signal）；完整路径、渠道组合标 **experimental**；永不显示效率/工时/排名/Inbound 指标。
- **Stage 6 — Minimal Inbound MVP**（`InboundLeads.jsx` + `App.jsx` + `Sidebar.jsx` + `styles.css`）：左侧新增常驻「Inbound 询盘」入口（一级流，非藏于 Outbound 下）；Lead Inbox + 接入 + 原始询盘 + 需求发现清单 + 状态 + 下一步 + 跟进日期 + 流失/停滞原因；事件写 `activities(flow_type:'inbound')`，**Dashboard 按 flow_type 分桶，Outbound 指标零污染**。暂不做大型 Inbound Analytics。

> 体验入口：`npm run dev -- --port 4174`（localStorage 单机，时菊录的数据本机可见；多人/多机需后续接数据库，属另一阶段）。
> 已完成顺序：Preserve → Shared → Contact → Activity → Dashboard → Real Data Test(待用户) → Inbound MVP。
