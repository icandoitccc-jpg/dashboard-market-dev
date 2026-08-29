import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Plus } from 'lucide-react'

// 可自定义下拉：预置选项可点选，手动输入新值后点「新增」确认。
// 新值通过 onNewOption 上报 → 写入共享字典 + 前线事件（主管可见）。
export default function Combobox({ label, value, onChange, onNewOption, options, placeholder, ariaLabel }) {
  const [open, setOpen] = useState(false)
  const [filter, setFilter] = useState('')
  const rootRef = useRef(null)

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (rootRef.current && !rootRef.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    return () => document.removeEventListener('mousedown', onDoc)
  }, [open])

  const text = open ? filter : (value || '')
  const needle = filter.trim().toLowerCase()
  const filtered = needle ? options.filter((o) => o.toLowerCase().includes(needle)) : options
  const typed = filter.trim()
  const isNew = typed && !options.includes(typed)

  return (
    <div className="editable-select" ref={rootRef}>
      <input
        aria-label={ariaLabel || label}
        value={text}
        onFocus={() => { setOpen(true); setFilter(value || '') }}
        onChange={(event) => { setFilter(event.target.value); setOpen(true) }}
        onKeyDown={(event) => {
          if (event.key === 'Enter') {
            event.preventDefault()
            if (typed) {
              onChange(typed)
              if (isNew && onNewOption) onNewOption(typed)
            }
            setOpen(false)
          } else if (event.key === 'Escape') {
            setOpen(false)
          }
        }}
        placeholder={placeholder}
      />
      <button type="button" aria-label={`打开${label}选项`} onClick={() => { setOpen((current) => !current); setFilter(open ? '' : (value || '')) }}><ChevronDown size={17} /></button>
      {open ? (
        <div className="editable-options" role="listbox" aria-label={`${label}已有选项`}>
          {filtered.map((option) => (
            <button type="button" role="option" key={option} className={option === value ? 'current' : ''} onClick={() => { onChange(option); setOpen(false) }}>{option}</button>
          ))}
          {isNew ? (
            <button type="button" className="new-option" onClick={() => { onChange(typed); if (onNewOption) onNewOption(typed); setOpen(false) }}><Plus size={14} />新增「{typed}」</button>
          ) : null}
          {!filtered.length && !isNew ? <span className="no-match">没有匹配项，直接输入即为新选项</span> : null}
        </div>
      ) : null}
    </div>
  )
}
