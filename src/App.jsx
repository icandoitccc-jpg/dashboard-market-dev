import { useEffect, useState } from 'react'
import { LayoutDashboard, TrendingUp, Inbox, Users } from 'lucide-react'
import Overview from './components/Overview'
import OutboundView from './components/OutboundView'
import InboundView from './components/InboundLeads'
import TeamView from './components/TeamView'
import WorkerDetail from './components/WorkerDetail'
import { loadState, saveState, loadCurrentUser, saveCurrentUser } from './storage'

const NAV = [
  { key: 'overview', label: '看板总览', icon: LayoutDashboard },
  { key: 'outbound', label: '总体 Outbound', icon: TrendingUp },
  { key: 'inbound', label: '总体 Inbound', icon: Inbox },
  { key: 'team', label: '业务员动向', icon: Users },
]

export default function App() {
  const [view, setView] = useState('overview')
  const [state, setState] = useState(loadState)
  const [currentUser, setCurrentUser] = useState(loadCurrentUser)

  useEffect(() => saveState(state), [state])
  useEffect(() => saveCurrentUser(currentUser), [currentUser])

  const navigate = (v) => setView(v)

  const isWorker = view.startsWith('worker:')
  const workerId = isWorker ? view.slice('worker:'.length) : null

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
          <span className="avatar">{currentUser.slice(0, 1)}</span>
          <select className="user-switch" value={currentUser} onChange={(e) => setCurrentUser(e.target.value)} aria-label="切换当前操作员">
            {state.workers.map((w) => <option key={w.name} value={w.name}>{w.name} · {w.role}</option>)}
          </select>
        </div>
      </header>

      <main className="main-content">
        {view === 'overview' && <Overview state={state} onNavigate={navigate} />}
        {view === 'outbound' && <OutboundView state={state} setState={setState} currentUser={currentUser} />}
        {view === 'inbound' && <InboundView state={state} setState={setState} currentUser={currentUser} />}
        {view === 'team' && <TeamView state={state} onNavigate={navigate} />}
        {isWorker && <WorkerDetail state={state} setState={setState} workerId={workerId} onNavigate={navigate} currentUser={currentUser} />}
      </main>
    </div>
  )
}
