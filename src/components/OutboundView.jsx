import { TrendingUp, Users } from 'lucide-react'
import { computeOutbound } from '../metrics'
import SalesWorkspace from './SalesWorkspace'

export default function OutboundView({ state, setState, currentUser }) {
  const ob = computeOutbound(state, {})
  return (
    <div className="flow-page">
      <div className="flow-header">
        <div>
          <h1>总体 Outbound</h1>
          <p>所有业务员主动触达客户的全量数据。点击客户可进入建档与触达记录。</p>
        </div>
      </div>
      <div className="metrics-row">
        <div className="metric-card green"><div className="mc-body"><span className="mc-label">触达动作</span><strong className="mc-value">{ob.total}</strong><small className="mc-sub">事件总数</small></div></div>
        <div className="metric-card green"><div className="mc-body"><span className="mc-label">真人回复率</span><strong className="mc-value">{ob.humanReplyRate}</strong><small className="mc-sub">{ob.human} 次真人</small></div></div>
        <div className="metric-card blue"><div className="mc-body"><span className="mc-label">自动回复率</span><strong className="mc-value">{ob.autoReplyRate}</strong><small className="mc-sub">{ob.auto} 次（信号）</small></div></div>
        <div className="metric-card red"><div className="mc-body"><span className="mc-label">退信率</span><strong className="mc-value">{ob.bounceRate}</strong><small className="mc-sub">{ob.bounce} 次</small></div></div>
        <div className="metric-card amber"><div className="mc-body"><span className="mc-label">无回应率</span><strong className="mc-value">{ob.noResponseRate}</strong><small className="mc-sub">{ob.none} 次</small></div></div>
        <div className="metric-card default"><div className="mc-body"><span className="mc-label">获真人回复客户</span><strong className="mc-value">{ob.humanCompanies}</strong><small className="mc-sub">/ {ob.touchedCompanies} 已触达</small></div></div>
      </div>
      <SalesWorkspace state={state} setState={setState} ownerId={null} currentUser={currentUser} />
    </div>
  )
}
