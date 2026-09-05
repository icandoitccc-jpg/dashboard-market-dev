import { useEffect, useRef, useState } from 'react'
import { LayoutDashboard, TrendingUp, Inbox, Users, Users2, Clock, LogOut, RefreshCw } from 'lucide-react'
import Overview from './components/Overview'
import AllContacts from './components/AllContacts'
import OutboundView from './components/OutboundView'
import InboundView from './components/InboundLeads'
import TeamView from './components/TeamView'
import WorkerDetail from './components/WorkerDetail'
import Login from './components/Login'
import { loadState, saveState } from './storage'
import { supabase } from './supabaseClient'

const NAV = [
  { key: 'overview', label: '看板总览', icon: LayoutDashboard },
  { key: 'contacts', label: '全部客户', icon: Users2 },
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

  // 支持从「全部客户」直接跳到某个 Outbound 客户 / Inbound 询盘的详情：
  // view = 'outbound:c_005' 或 'inbound:IN-001'。用 id 做 key 强制重新挂载，
  // 保证每次跳转都能选中正确的那一条，不会停留在上一次打开的记录上。
  const isOutbound = view === 'outbound' || view.startsWith('outbound:')
  const outboundId = view.startsWith('outbound:') ? view.slice('outbound:'.length) : null
  const isInbound = view === 'inbound' || view.startsWith('inbound:')
  const inboundId = view.startsWith('inbound:') ? view.slice('inbound:'.length) : null
  const activeNav = isOutbound ? 'outbound' : isInbound ? 'inbound' : view

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
              <button key={tab.key} className={`top-nav-item ${activeNav === tab.key ? 'active' : ''}`} onClick={() => setView(tab.key)}>
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
        {view === 'contacts' && <AllContacts state={state} onNavigate={navigate} />}
        {isOutbound && <OutboundView key={outboundId || 'all'} state={state} setState={setState} currentUser={currentUser} initialSelectedId={outboundId} onNavigate={navigate} />}
        {isInbound && <InboundView key={inboundId || 'all'} state={state} setState={setState} currentUser={currentUser} initialSelectedId={inboundId} onNavigate={navigate} />}
        {view === 'team' && <TeamView state={state} onNavigate={navigate} />}
        {isWorker && <WorkerDetail state={state} setState={setState} workerId={workerId} onNavigate={navigate} currentUser={currentUser} autoOpenDaily={autoOpenDaily} />}
      </main>
    </div>
  )
}
