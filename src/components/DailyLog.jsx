import { useEffect, useState } from 'react'
import { Clock, Plus, Pencil } from 'lucide-react'

const today = () => new Date().toISOString().slice(0, 10)

const blankForm = () => ({
  date: today(),
  schedule: '',
  interruption: '',
  result: '',
  feeling: '',
  adjustment: '',
})

// 每日工作复盘：业务员和主管各记各的一天，字段全部选填。
// canEdit 由调用方传入：本人始终可编辑自己的记录；主管可编辑任何人的记录（用于纠错，归属不变）。
export default function DailyLog({ entries, worker, currentUser, canManagerEdit, setState, autoOpen = false }) {
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [form, setForm] = useState(blankForm())

  const isSelf = currentUser === worker

  // 顶部「记录今天」快捷入口跳转过来时，直接展开表单，省一次点击
  useEffect(() => {
    if (autoOpen && isSelf) { setForm(blankForm()); setEditingId(null); setShowForm(true) }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoOpen])

  const openNew = () => { setForm(blankForm()); setEditingId(null); setShowForm(true) }
  const openEdit = (entry) => {
    setForm({
      date: entry.date || today(),
      schedule: entry.schedule || '',
      interruption: entry.interruption || '',
      result: entry.result || '',
      feeling: entry.feeling || '',
      adjustment: entry.adjustment || '',
    })
    setEditingId(entry.id)
    setShowForm(true)
  }
  const close = () => { setShowForm(false); setEditingId(null) }

  const save = (event) => {
    event.preventDefault()
    const now = new Date().toISOString()
    if (editingId) {
      setState((current) => ({
        ...current,
        daily_rhythm: current.daily_rhythm.map((d) =>
          d.id === editingId
            ? { ...d, ...form, updated_at: now, updated_by: currentUser, importNote: undefined }
            : d,
        ),
      }))
    } else {
      const entry = {
        id: `d_${worker}_${Date.now()}`,
        ...form,
        worker,
        created_at: now,
        created_by: currentUser,
      }
      setState((current) => ({ ...current, daily_rhythm: [entry, ...current.daily_rhythm] }))
    }
    close()
  }

  const canEditEntry = (entry) => isSelf || canManagerEdit

  return (
    <div className="panel">
      <div className="card-head">
        <h3><Clock size={15} />工作节奏记录 <small>每日工作节奏记录（真实备注，非考评）</small></h3>
        {isSelf ? (
          <button type="button" className="button primary compact" onClick={openNew}><Plus size={15} />记录今天</button>
        ) : null}
      </div>

      {showForm ? (
        <form className="daily-log-form" onSubmit={save}>
          <div className="form-grid">
            <label>日期<input type="date" value={form.date} onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))} /></label>
            <label className="full">今天的安排（选填）<small>例如时间段+做的事</small><textarea value={form.schedule} onChange={(e) => setForm((f) => ({ ...f, schedule: e.target.value }))} placeholder="例如：11:30–12:30 新客户开发；13:30–15:00 老客户回复" /></label>
            <label className="full">中断/被打断情况（选填）<input value={form.interruption} onChange={(e) => setForm((f) => ({ ...f, interruption: e.target.value }))} placeholder="例如：无 / 临时开会1小时" /></label>
            <label className="full">今天的结果（选填）<textarea value={form.result} onChange={(e) => setForm((f) => ({ ...f, result: e.target.value }))} placeholder="例如：找8个客户，1个真人回复" /></label>
            <label className="full">感受/观察（选填）<input value={form.feeling} onChange={(e) => setForm((f) => ({ ...f, feeling: e.target.value }))} placeholder="例如：某市场回复率偏低" /></label>
            <label className="full">明天的调整（选填）<input value={form.adjustment} onChange={(e) => setForm((f) => ({ ...f, adjustment: e.target.value }))} placeholder="例如：继续测试当前节奏 / 换一个渠道试试" /></label>
          </div>
          <div className="form-actions">
            <button type="button" className="button secondary" onClick={close}>取消</button>
            <button type="submit" className="button primary">{editingId ? '保存修改' : '保存记录'}</button>
          </div>
        </form>
      ) : null}

      {entries.length ? (
        <div className="daily-feed">
          {entries.map((d) => (
            <div className="daily-item" key={d.id}>
              <div className="daily-item-head">
                <div className="daily-date">
                  {d.date}
                  {d.updated_at ? <span className="daily-edited-tag"> · 已修改</span> : ''}
                  {d.importNote ? <span className="daily-import-tag" title={d.importNote}> · 待确认归属</span> : ''}
                </div>
                {canEditEntry(d) ? (
                  <button type="button" className="icon-button small" onClick={() => openEdit(d)} aria-label="编辑这条记录"><Pencil size={13} /></button>
                ) : null}
              </div>
              {d.schedule ? <div className="daily-schedule">{d.schedule}</div> : null}
              {d.interruption ? <div className="daily-feeling">中断：{d.interruption}</div> : null}
              {d.result ? <div className="daily-result">{d.result}</div> : null}
              {d.feeling ? <div className="daily-feeling">感受：{d.feeling}</div> : null}
              {d.adjustment ? <div className="daily-adjust">调整：{d.adjustment}</div> : null}
            </div>
          ))}
        </div>
      ) : <p className="contact-empty">{isSelf ? '还没有每日工作节奏记录，点击「记录今天」开始。' : '暂无每日工作节奏记录。'}</p>}
    </div>
  )
}
