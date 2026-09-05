import { useState } from 'react'
import { supabase } from '../supabaseClient'

export default function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    setLoading(false)
    if (err) setError(err.message === 'Invalid login credentials' ? '账号或密码不对，请再确认一下' : err.message)
  }

  return (
    <div className="login-shell">
      <form className="login-card" onSubmit={submit}>
        <div className="login-brand">
          <div className="topbar-brand-logo">M</div>
          <div>
            <div className="login-title">市场开发路径验证</div>
            <div className="login-subtitle">Market Path Explorer</div>
          </div>
        </div>
        <label>账号邮箱
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoFocus placeholder="you@example.com" />
        </label>
        <label>密码
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required placeholder="••••••••" />
        </label>
        {error ? <div className="login-error">{error}</div> : null}
        <button type="submit" className="button primary" disabled={loading}>{loading ? '登录中…' : '登录'}</button>
        <p className="login-hint">还没有账号？请联系陈晨开通。</p>
      </form>
    </div>
  )
}
