import { Users, ArrowRight, User } from 'lucide-react'
import { computeWorkers } from '../metrics'

export default function TeamView({ state, onNavigate }) {
  const team = computeWorkers(state)
  return (
    <div className="dash-page">
      <div className="flow-header"><div><h1>业务员动向</h1><p>所有业务员的开发动态。点击任意一人，进入他/她自己的工作台（含负责的客户、个人分析与 Inbound）。</p></div></div>
      {team.length > 0 ? (
        <div className="team-grid wide">
          {team.map((w) => (
            <div className="team-card" key={w.id}>
              <div className="team-card-head"><User size={18} /><div><strong>{w.name}</strong><span className="team-role">{w.role}</span></div></div>
              <div className="team-card-body">
                <div className="team-stat"><span>Outbound 客户</span><strong>{w.prospects}</strong></div>
                <div className="team-stat"><span>触达</span><strong>{w.touches}</strong></div>
                <div className="team-stat"><span>真人回复率</span><strong>{w.humanRate}</strong></div>
                <div className="team-stat"><span>获回复客户</span><strong>{w.human}</strong></div>
                <div className="team-stat"><span>Inbound 询盘</span><strong>{w.inbound}</strong></div>
                <div className="team-stat"><span>待跟进</span><strong>{w.pending}</strong></div>
              </div>
              <button type="button" className="button primary compact" onClick={() => onNavigate(`worker:${w.id}`)}>进入工作台 <ArrowRight size={14} /></button>
            </div>
          ))}
        </div>
      ) : <div className="empty-block">还没有团队活动数据。</div>}
    </div>
  )
}
