import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { Eye, EyeOff } from 'lucide-react'
import { apiUrl } from '../api/client'
import { useAuth } from '../contexts/AuthContext'
import { resetPassword } from '../api/auth'

export default function Login() {
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [resetEmail, setResetEmail] = useState('')
  const [resetStatus, setResetStatus] = useState('')
  const [resetLoading, setResetLoading] = useState(false)
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const from = location.state?.from?.pathname || '/dashboard'

  const handleGitHubLogin = () => {
    window.location.assign(apiUrl('/oauth/github'))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      await login(form.email, form.password)
      navigate(from, { replace: true })
    } catch (err) {
      setError(err.message || err.response?.data?.error || 'Invalid email or password')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async (e) => {
    e.preventDefault()
    setResetLoading(true)
    setResetStatus('')
    try {
      await resetPassword(resetEmail)
      setResetStatus('Check your email for a reset link.')
    } catch {
      setResetStatus('Check your email for a reset link.')
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-factory-light-gray flex flex-col">
      <div className="h-12 flex items-center px-6 border-b border-cool-gray/40 bg-factory-light-gray">
        <Link to="/" className="text-body text-factory-black flex items-center gap-1.5">
          <span>🍅</span><span>OpenSauce</span>
        </Link>
      </div>

      <div className="flex-1 flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-xs">
          {showReset ? (
            <>
              <h1 className="text-heading font-normal text-factory-black mb-1">Reset password</h1>
              <p className="text-body-sm text-graphite mb-8">
                Enter your email and we'll send you a reset link.
              </p>
              <form onSubmit={handleReset} className="space-y-3">
                {resetStatus && (
                  <p className="text-body-sm text-green-700 border border-green-200 bg-green-50 rounded px-3 py-2">{resetStatus}</p>
                )}
                <div>
                  <label className="label">Email</label>
                  <input type="email" autoComplete="email" className="input" placeholder="you@example.com"
                    value={resetEmail} onChange={(e) => setResetEmail(e.target.value)} required />
                </div>
                <button type="submit" disabled={resetLoading} className="btn-primary w-full justify-center py-2 disabled:opacity-50">
                  {resetLoading ? 'Sending…' : 'Send reset link'}
                </button>
              </form>
              <button
                onClick={() => { setShowReset(false); setResetStatus('') }}
                className="mt-4 text-body-sm text-graphite hover:text-factory-black"
              >
                ← Back to sign in
              </button>
            </>
          ) : (
            <>
              <h1 className="text-heading font-normal text-factory-black mb-1">Welcome back</h1>
              <p className="text-body-sm text-graphite mb-8">
                No account?{' '}
                <Link to="/signup" className="text-factory-black hover:underline">Sign up →</Link>
              </p>

              <form onSubmit={handleSubmit} className="space-y-3">
                {error && (
                  <p className="text-body-sm text-red-600 border border-red-200 bg-red-50 rounded px-3 py-2">{error}</p>
                )}
                <div>
                  <label className="label">Email</label>
                  <input type="email" autoComplete="email" className="input" placeholder="you@example.com"
                    value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} required />
                </div>
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="label mb-0">Password</label>
                    <button
                      type="button"
                      onClick={() => setShowReset(true)}
                      className="text-caption text-ash-gray hover:text-factory-black transition-colors"
                    >
                      Forgot password?
                    </button>
                  </div>
                  <div className="relative">
                    <input type={showPassword ? 'text' : 'password'} autoComplete="current-password" className="input pr-10" placeholder="••••••••"
                      value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} required />
                    <button
                      type="button"
                      onClick={() => setShowPassword((v) => !v)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-ash-gray hover:text-factory-black transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
                <button type="submit" disabled={loading} className="btn-primary w-full justify-center py-2 disabled:opacity-50">
                  {loading ? 'Signing in…' : 'Sign in'}
                </button>
              </form>

              <div className="flex items-center gap-3 my-5">
                <div className="h-px flex-1 bg-cool-gray/40" />
                <span className="text-caption text-ash-gray">or</span>
                <div className="h-px flex-1 bg-cool-gray/40" />
              </div>

              <button type="button" onClick={handleGitHubLogin} className="btn-outline w-full justify-center gap-2 py-2 text-body-sm">
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.477 2 2 6.477 2 12c0 4.418 2.865 8.166 6.839 9.489.5.092.682-.217.682-.482 0-.237-.009-.868-.013-1.703-2.782.604-3.369-1.34-3.369-1.34-.454-1.154-1.11-1.462-1.11-1.462-.908-.62.069-.608.069-.608 1.003.07 1.531 1.03 1.531 1.03.892 1.529 2.341 1.087 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.11-4.555-4.943 0-1.091.39-1.984 1.029-2.683-.103-.253-.446-1.27.098-2.647 0 0 .84-.269 2.75 1.025A9.564 9.564 0 0 1 12 6.844a9.59 9.59 0 0 1 2.504.337c1.909-1.294 2.747-1.025 2.747-1.025.546 1.377.203 2.394.1 2.647.64.699 1.028 1.592 1.028 2.683 0 3.842-2.339 4.687-4.566 4.935.359.309.678.919.678 1.852 0 1.336-.012 2.415-.012 2.743 0 .267.18.578.688.48C19.138 20.163 22 16.418 22 12c0-5.523-4.477-10-10-10z"/>
                </svg>
                Continue with GitHub
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
