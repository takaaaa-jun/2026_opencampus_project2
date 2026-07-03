import { useState, useMemo, type ReactNode } from 'react'

interface AuthGuardProps {
  children: ReactNode
}

const PASSWORD_KEY = 'opencampus_auth_authenticated'

export function AuthGuard({ children }: AuthGuardProps) {
  const [password, setPassword] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    try {
      return sessionStorage.getItem(PASSWORD_KEY) === 'true'
    } catch {
      return false
    }
  })
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // サーバーのAPIエンドポイントベースURLを設定
  const backendBase = useMemo(() => {
    // 1. URLクエリパラメータがある場合は最優先（手動指定用）
    const urlParams = new URLSearchParams(window.location.search)
    const queryIp = urlParams.get('server_ip')
    const queryPort = urlParams.get('server_port')
    const queryPath = urlParams.get('server_path')

    if (queryIp || queryPort || queryPath) {
      const ip = queryIp || window.location.hostname
      const port = queryPort || (window.location.port ? window.location.port : '80')
      const pathPrefix = queryPath ? `/${queryPath.replace(/^\/+|\/+$/g, '')}` : ''
      return `http://${ip}:${port}${pathPrefix}`
    }

    // 2. クエリパラメータがない場合は、現在のアドレスから自動判定
    const protocol = window.location.protocol // "http:" or "https:"
    const host = window.location.hostname
    const port = window.location.port ? `:${window.location.port}` : ''
    const pathPrefix = window.location.pathname.includes('/2026_opencampus_project2')
      ? '/2026_opencampus_project2'
      : ''

    return `${protocol}//${host}${port}${pathPrefix}`
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!password) return

    setIsSubmitting(true)
    setError(null)

    try {
      const res = await fetch(`${backendBase}/api/webrtc/auth/verify/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      })

      if (res.ok) {
        try {
          sessionStorage.setItem(PASSWORD_KEY, 'true')
        } catch {
          // ignore storage errors
        }
        setIsAuthenticated(true)
      } else {
        setError('パスワードが正しくありません。')
      }
    } catch (err) {
      setError('サーバーとの通信に失敗しました。')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (isAuthenticated) {
    return <>{children}</>
  }

  return (
    <div className="auth-container">
      <form className="auth-card" onSubmit={(e) => void handleSubmit(e)}>
        <div className="auth-header">
          <h2>🔒 パスワード保護</h2>
          <p>このページにアクセスするにはパスワードが必要です。</p>
        </div>
        <div className="input-group">
          <label htmlFor="auth-password">Password</label>
          <input
            id="auth-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="パスワードを入力"
            disabled={isSubmitting}
            autoFocus
          />
        </div>
        {error && <div className="auth-error">{error}</div>}
        <button type="submit" className="btn-primary" disabled={isSubmitting}>
          {isSubmitting ? '送信中...' : '送信'}
        </button>
      </form>
    </div>
  )
}
