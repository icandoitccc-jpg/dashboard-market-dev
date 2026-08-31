import { AlertTriangle, ArrowRight, CheckCircle2, Lightbulb, SearchCheck } from 'lucide-react'

const TONE_ICON = {
  warning: AlertTriangle,
  positive: CheckCircle2,
  signal: Lightbulb,
  neutral: SearchCheck,
}

export default function RuleInsights({ analysis }) {
  return (
    <section className="dash-section analysis-section">
      <div className="analysis-header">
        <div>
          <h2>自动分析与下一轮测试</h2>
          <p>根据当前筛选范围实时计算；每条结论都显示证据、含义与可执行动作。</p>
        </div>
        <div className="analysis-meta">
          <span>{analysis.generatedBy}</span>
          <strong>{analysis.scope}</strong>
        </div>
      </div>

      <div className="analysis-confidence">
        <span>结论边界</span>
        <strong>{analysis.confidence}</strong>
      </div>

      <div className="analysis-grid">
        {analysis.insights.map((insight) => {
          const Icon = TONE_ICON[insight.tone] || SearchCheck
          return (
            <article className={`analysis-card ${insight.tone}`} key={insight.id}>
              <div className="analysis-card-title">
                <span className="analysis-icon"><Icon size={16} /></span>
                <h3>{insight.title}</h3>
              </div>
              <div className="analysis-evidence">
                <span>数据证据</span>
                <strong>{insight.evidence}</strong>
              </div>
              <p>{insight.meaning}</p>
              <div className="analysis-action">
                <ArrowRight size={14} />
                <span><strong>下一步：</strong>{insight.action}</span>
              </div>
            </article>
          )
        })}
      </div>
    </section>
  )
}
