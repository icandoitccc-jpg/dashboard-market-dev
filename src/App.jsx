import { useEffect, useRef, useState } from 'react'
import { LayoutDashboard, TrendingUp, Inbox, Users, Clock, LogOut, RefreshCw } from 'lucide-react'
import Overview from './components/Overview'
import OutboundView from './components/OutboundView'
import InboundView from './components/InboundLeads'
import TeamView from './components/TeamView'
import WorkerDetail from './components/WorkerDetail'
import Login from './components/Login'
import { loadState, saveState } from './storage'
import { supabase } from './supabaseClient'

const NAV = [
  { key: 'overview', label: '看板总览', icon: LayoutDashboard },
  { key: 'outbound', label: '总体 Outbound', icon: TrendingUp },
  { key: 'inbound', label: '总体 Inbound', icon: Inbox },
  { key: 'team', label: '业务员动向', icon: Users },
]

export default function App() {
  // ---- 登录状态：由 Supabase Auth 会话决定，不再是可以随意切换的下拉框 ----
  const [session, setSession] = useState(undefined) // undefined = 还没查完；null = 未登录
  const [profile, setProfile] = useState(null) // { id, name, role }
  const [authError, setAuthError] = useState('')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) { setProfile(null); return }
    let cancelled = false
    supabase.from('profiles').select('*').eq('id', session.user.id).single().then(({ data, error }) => {
      if (cancelled) return
      if (error) { setAuthError('登录成功，但没找到你的账号资料，请联系陈晨确认。'); return }
      setProfile(data)
    })
    return () => { cancelled = true }
  }, [session])

  // ---- 业务数据：从 Supabase 异步加载 ----
  const [view, setView] = useState('overview')
  const [state, setState] = useState(null)
  const [dataError, setDataError] = useState('')
  const [refreshing, setRefreshing] = useState(false)
  const skipNextSave = useRef(true) // 加载完首次赋值不应该触发保存

  const reloadFromServer = () => {
    setRefreshing(true)
    skipNextSave.current = true
    loadState().then((s) => setState(s)).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      setDataError('数据加载失败，请检查网络后刷新页面重试。')
    }).finally(() => setRefreshing(false))
  }

  useEffect(() => {
    if (!profile) return
    let cancelled = false
    skipNextSave.current = true
    loadState().then((s) => { if (!cancelled) setState(s) }).catch((err) => {
      // eslint-disable-next-line no-console
      console.error(err)
      if (!cancelled) setDataError('数据加载失败，请检查网络后刷新页面重试。')
    })
    return () => { cancelled = true }
  }, [profile])

  useEffect(() => {
    if (!state) return
    if (skipNextSave.current) { skipNextSave.current = false; return }
    saveState(state)
  }, [state])

  const navigate = (v) => setView(v)

  if (session === undefined) {
    return <div className="app-loading">正在检查登录状态…</div>
  }
  if (!session) {
    return <Login />
  }
  if (authError) {
    return <div className="app-loading">{authError}</div>
  }
  if (!profile || !state) {
    return <div className="app-loading">正在加载数据…</div>
  }
  if (dataError) {
    return <div className="app-loading">{dataError}</div>
  }

  const currentUser = profile.name
  const isWorker = view.startsWith('worker:')
  // 支持 worker:姓名 或 worker:姓名:daily（daily 会直接跳到「记录今天」表单，减少点击）
  const workerParts = isWorker ? view.slice('worker:'.length).split(':') : []
  const workerId = isWorker ? workerParts[0] : null
  const autoOpenDaily = isWorker && workerParts[1] === 'daily'

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-brand">
          <div className="topbar-brand-logo">M</div>
          <div className="topbar-brand-text">
            <div className="topbar-title">市场开发路径验证</div>
            <div className="topbar-subtitle">Market Path Explorer</div>
          </div>
        </div>
        <nav className="top-nav">
          {NAV.map((tab) => {
            const Icon = tab.icon
            return (
              <button key={tab.key} className={`top-nav-item ${view === tab.key ? 'active' : ''}`} onClick={() => setView(tab.key)}>
                <Icon size={15} />{tab.label}
              </button>
            )
          })}
        </nav>
        <div className="topbar-user">
          <button
            type="button"
            className="button outline compact"
            onClick={() => setView(`worker:${currentUser}:daily`)}
          >
            <Clock size={14} />记录今天
          </button>
          <span className="avatar">{currentUser.slice(0, 1)}</span>
          <span className="current-user-label">{currentUser} · {profile.role}</span>
          <button type="button" className="icon-button" title="刷新数据（看看对方是否有新记录）" onClick={reloadFromServer} disabled={refreshing}>
            <RefreshCw size={15} className={refreshing ? 'spin' : ''} />
          </button>
          <button type="button" className="icon-button" title="退出登录" onClick={() => supabase.auth.signOut()}>
            <LogOut size={15} />
          </button>
        </div>
      </header>

      <main className="main-content">
        {view === 'overview' && <Overview state={state} onNavigate={navigate} />}
        {view === 'outbound' && <OutboundView state={state} setState={setState} currentUser={currentUser} />}
        {view === 'inbound' && <InboundView state={state} setState={setState} currentUser={currentUser} />}
        {view === 'team' && <TeamView state={state} onNavigate={navigate} />}
        {isWorker && <WorkerDetail state={state} setState={setState} workerId={workerId} onNavigate={navigate} currentUser={currentUser} autoOpenDaily={autoOpenDaily} />}
      </main>
    </div>
  )
}
